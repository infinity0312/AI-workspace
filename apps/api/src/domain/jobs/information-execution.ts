import { randomUUID } from 'node:crypto';
import { emptyDocument,weatherAttrs,type WeatherData,type Block,type ArtifactDetail } from '@akw/contracts';
import { AppError,conflict } from '../../platform/errors';
import type { Database,Sql } from '../../platform/database';
import { information,type InformationResult } from '../../runtime/information-retrieval';
import type { WeatherProvider } from '../../runtime/weather-provider';
import type { PublicResearch } from '../../runtime/public-research';
import type { Artifacts } from '../artifacts';
import type { Knowledge } from '../knowledge';
import { workspace } from '../access';
import { readAiEvidence } from '../ai-evidence';
import { assertExternal } from './external-access';
import type { Actor } from '../../platform/security';
import type { JobInput,RunningJob } from './job-types';
import type { InvokeJobModel } from './model-invocation';

const referencesBlock=():Block=>({ id:randomUUID(),type:'evidence_network',attrs:{ view_version:1,node_ids:[],title:'来源与原文' } });
const citation=(id:string)=>({ type:'citation',attrs:{ evidence_id:id } });
const text=(value:string)=>({ type:'text',text:value });
const weatherSource='https://open-meteo.com/en/docs';

export async function executeInformation({ job,actor,signal,lifecycle }:RunningJob,input:Extract<JobInput,{kind:'information'}>['body'],{
  db,artifacts,knowledge,discovery,weather,model,
}:{ db:Database;artifacts:Artifacts;knowledge:Knowledge;discovery?:PublicResearch;weather?:WeatherProvider;model?:InvokeJobModel }) {
  let existing:ArtifactDetail|undefined;
  if (input.artifact_id) {
    existing=await artifacts.get(actor,input.artifact_id);
    if (existing.revision.id!==input.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','The forecast artifact has changed');
  }
  await assertExternal(db,actor,input.workspace_id);
  const stage=(name:string)=>{
    job.checkpoint.informationStage=name;
    return lifecycle.save('InformationStageStarted',{ stage:name });
  };
  let result=job.checkpoint.informationOutput;
  if (!result) {
    if (input.mode==='weather') {
      if (!weather || !input.weather) throw new AppError(503,'WEATHER_PROVIDER_UNAVAILABLE','The forecast provider is not enabled');
      await stage('forecast');
      result=await weather(input.weather,signal);
    } else {
      result=await prepareInformation({ job,actor,signal,lifecycle },input.goal,input.mode,{ db,knowledge,discovery,model },stage);
    }
    job.checkpoint.informationOutput=result;
    await lifecycle.save('InformationOutputChecked',{ mode:input.mode });
  }
  signal.throwIfAborted();
  const status='partial' in result && result.partial ? 'PARTIAL' : 'COMPLETED';
  const output=result;
  await lifecycle.complete(status,async sql=>{
    await assertExternal(db,actor,input.workspace_id,sql);
    if (input.mode==='weather') {
      const data=weatherAttrs.parse(output);
      const block=await compileWeather(sql,actor,input.workspace_id,knowledge,data);
      if (existing) {
        const current=await artifacts.get(actor,existing.id,sql);
        if (current.revision.id!==input.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','The forecast artifact has changed');
        const previous=current.revision.content_json.blocks.find(item=>item.type==='weather_forecast' && (!input.block_id || item.id===input.block_id));
        if (!previous) throw conflict('CONFLICT_ARTIFACT_VERSION','The forecast block is no longer available');
        await artifacts.editIn(sql,actor,current,{ base_revision_id:current.revision.id,
          operations:[{ type:'update_block',block_id:previous.id,block:{ ...block,id:previous.id } }] },'agent');
        return { artifact_id:current.id,mode:input.mode };
      }
      const content=emptyDocument();
      content.blocks=[block,referencesBlock()];
      const artifact=await artifacts.createIn(sql,actor,{ workspace_id:input.workspace_id,title:data.place.name+' · 天气',kind:'document',content },'agent');
      return { artifact_id:artifact.id,mode:input.mode };
    }
    const answer=output as InformationResult;
    const content=emptyDocument();
    content.blocks=[...await compileInformation(sql,actor,input.workspace_id,knowledge,input.goal,input.mode,answer),referencesBlock()];
    const artifact=await artifacts.createIn(sql,actor,{ workspace_id:input.workspace_id,title:answer.title,kind:'document',content },'agent');
    return { artifact_id:artifact.id,mode:input.mode,...(answer.partial ? { warning:'INFORMATION_EXCERPTS_ONLY' } : {}) };
  });
}

export function prepareInformation({ job,actor,signal,lifecycle }:RunningJob,goal:string,mode:'guide'|'information',{
  db,knowledge,discovery,model,
}:{ db:Database;knowledge:Knowledge;discovery?:PublicResearch;model?:InvokeJobModel },stage:(name:string)=>Promise<void>,
limits={ max_calls:4,max_tokens:45_000 },sources?:string[]) {
  return information(goal,mode,signal,{
        sources,discover:discovery,model:model ? (prompt,data)=>model(limits,prompt,data) : undefined,
        allow:materials=>knowledge.filterPublicMaterials(job.workspace_id,materials),stage,
        local:/工作空间|我的资料|本地资料|资料库|workspace|my (?:library|sources|files)/i.test(goal) ? async()=>{
          const passages=await knowledge.retrieve(actor,job.workspace_id,[],goal,null,undefined,{ corpus:true,external:true });
          return db.transaction(async sql=>{
            await workspace(sql,actor,job.workspace_id,true);
            await assertExternal(db,actor,job.workspace_id,sql);
            await lifecycle.assertLease(sql,true);
            const rows=[];
            for (const source of passages.slice(0,2)) {
              const evidence=await knowledge.evidenceIn(sql,actor,source,0,source.content.length);
              rows.push({ id:evidence.id,title:source.title,quote:evidence.quote });
            }
            return rows;
          });
        } : undefined,
  });
}

export async function compileWeather(sql:Sql,actor:Actor,workspaceId:string,knowledge:Knowledge,data:WeatherData):Promise<Block> {
      const record=[data.place.name,data.place.area,'时区 '+data.timezone,'来源获取时间 '+data.captured_at,
        '日期 | 最低 °C | 最高 °C | 最高降水概率 %',
        ...data.days.map(day=>[day.date,day.low ?? '—',day.high ?? '—',day.precipitation ?? '—'].join(' | ')),
        ...(data.current ? ['当前值（模型） '+JSON.stringify(data.current)] : []),
        '当地时间 | 气温 °C | 降水概率 %',
        ...data.hours.map(hour=>[hour.time,hour.temperature ?? '—',hour.precipitation ?? '—'].join(' | '))].join('\n');
      // The query time is part of the source identity so re-querying keeps old forecast citations intact.
      const origin=new URL(weatherSource);
      origin.search=new URLSearchParams({ lat:String(data.place.latitude),lon:String(data.place.longitude),snapshot:data.captured_at }).toString();
      const saved=await knowledge.savePublicMaterial(sql,actor,workspaceId,{ kind:'dataset',provider:'Public Web',
        title:'Open-Meteo · '+data.place.name+' 预报快照',url:origin.href,text:record,license:'CC BY 4.0',
        licenseUrl:'https://creativecommons.org/licenses/by/4.0/' });
      return { id:randomUUID(),type:'weather_forecast',attrs:data,children:[citation(saved.evidence_id)] };
}

export async function compileInformation(sql:Sql,actor:Actor,workspaceId:string,knowledge:Knowledge,goal:string,
  mode:'guide'|'information',answer:InformationResult):Promise<Block[]> {
    const scope={ workspace_id:workspaceId,project_id:null };
    const entries=[answer.summary,...answer.items,...(answer.check ? [answer.check] : [])];
    const needed=[...new Set(entries.flatMap(item=>item.sources))];
    const refs=new Map<number,string>();
    for (const index of needed) {
      const existingId=answer.existing?.[index];
      if (existingId) refs.set(index,existingId);
      else {
        const saved=await knowledge.savePublicMaterial(sql,actor,scope.workspace_id,answer.materials[index]!);
        refs.set(index,saved.evidence_id);
      }
    }
    await readAiEvidence(sql,scope,[...refs.values()],true);
    const children=(item:InformationResult['summary'])=>[text(item.text),...item.sources.map(index=>citation(refs.get(index)!))];
    const blocks:Block[]=[{ id:randomUUID(),type:'information_summary',attrs:{ version:1,mode,goal,scope:answer.scope },
      children:children(answer.summary) }];
    const steps=mode==='guide' && !answer.partial;
    answer.items.forEach((item,index)=> {
      if (steps) blocks.push({ id:randomUUID(),type:'guide_step',attrs:{ version:1,number:index+1,title:item.title },children:children(item) });
      else blocks.push({ id:randomUUID(),type:'heading',attrs:{ level:2 },children:[text(item.title)] },
        { id:randomUUID(),type:'paragraph',children:children(item) });
    });
    if (answer.check) blocks.push({ id:randomUUID(),type:'callout',children:[text(answer.check.title+' · '),...children(answer.check)] });
    return blocks;
}

export function affectedPlaces(error:unknown):string[]|undefined {
  if (!(error instanceof AppError) || !error.details || typeof error.details!=='object' || !('options' in error.details)) return;
  const options=error.details.options;
  return Array.isArray(options) && options.every(value=>typeof value==='string') ? options.slice(0,5) : undefined;
}
