import { randomUUID } from 'node:crypto';
import { emptyDocument,type ArtifactDocument,type Block } from '@akw/contracts';
import { BudgetExceeded } from '../../runtime/budget';
import { AppError } from '../../platform/errors';
import type { Database,Sql } from '../../platform/database';
import { weatherQuery, type PlannedStep, type TaskCapability } from '../../runtime/task-routing';
import type { WeatherProvider } from '../../runtime/weather-provider';
import type { PublicResearch } from '../../runtime/public-research';
import { affectedPlaces,compileInformation,compileWeather,prepareInformation } from './information-execution';
import { compilePreparedLearning,prepareLearning } from './learning-execution';
import type { Artifacts } from '../artifacts';
import type { Knowledge } from '../knowledge';
import { browseWeb } from '../workspace-browsing';
import type { SearchResult } from '../../runtime/providers';
import { assertExternal } from './external-access';
import type { JobInput,RunningJob } from './job-types';
import type { InvokeJobModel } from './model-invocation';

type Deps={ db:Database;artifacts:Artifacts;knowledge:Knowledge;discovery?:PublicResearch;search?:(query:string,signal:AbortSignal)=>Promise<SearchResult[]>;weather?:WeatherProvider;model?:InvokeJobModel };
type Work={ run:RunningJob;deps:Deps;step:PlannedStep;slot:number;stage:(value:string)=>Promise<void> };
type Produced={ blocks:Block[];nodes?:string[] };
type Capability<T=unknown>={ prepare:(context:Work)=>Promise<T>;compile:(sql:Sql,context:Work,value:T)=>Promise<Produced>;partial?:(value:T)=>boolean };
function capability<T>(worker:Capability<T>):Capability {
  return { prepare:worker.prepare,compile:(sql,context,value)=>worker.compile(sql,context,value as T),
    partial:worker.partial ? value=>worker.partial!(value as T) : undefined };
}
const weather=capability({
  prepare:async ({ deps,run,step,stage })=>{
    if (!deps.weather) throw new AppError(503,'WEATHER_PROVIDER_UNAVAILABLE','The forecast provider is not enabled');
    await stage('forecast');
    return deps.weather(step.weather ?? weatherQuery(step.goal,step.location),run.signal);
  },
  compile:async (sql,{ run,deps },data)=>({ blocks:[await compileWeather(sql,run.actor,run.job.workspace_id,deps.knowledge,data)] }),
});
const learning=capability({
  prepare:async ({ run,deps,step,slot })=>{
    if (!deps.model) throw new AppError(503,'PROVIDER_UNAVAILABLE','The model for this learning task is unavailable');
    const used=run.job.checkpoint.budget;
    return prepareLearning(run,{ workspace_id:run.job.workspace_id,goal:step.goal,allow_external:true },
      { ...deps,model:deps.model,publicResearch:deps.discovery },
      { slot,policyMaxCalls:Math.min(12,(used?.calls ?? 0)+6),policyMaxTokens:Math.min(115_000,(used?.tokens ?? 0)+75_000) });
  },
  compile:async (sql,{ run,deps },prepared)=>{
    const output=await compilePreparedLearning(sql,run.actor,run.job.workspace_id,prepared,deps.knowledge);
    return { blocks:output.content.blocks,nodes:output.content.relations.knowledge_node_ids };
  },
  partial:value=>value.status==='PARTIAL',
});
function references(mode:'guide'|'information',comparison=false) {
  return capability({
    prepare:({ run,deps,step,stage })=>{
      const used=run.job.checkpoint.budget;
      return prepareInformation(run,step.goal,mode,deps,stage,
        { max_calls:Math.min(12,(used?.calls ?? 0)+3),max_tokens:Math.min(115_000,(used?.tokens ?? 0)+40_000) },step.sources);
    },
    compile:async (sql,{ run,deps,step },answer)=>{
      const blocks=await compileInformation(sql,run.actor,run.job.workspace_id,deps.knowledge,step.goal,mode,answer);
      if (comparison && !answer.partial && answer.items.length>=2) {
        blocks.push({ id:randomUUID(),type:'table',attrs:{ table_version:1,title:'对照要点',
          rows:[['角度','依据'],...answer.items.map(item=>[item.title,item.text])] } });
      }
      return { blocks };
    },
    partial:answer=>answer.partial,
  });
}
const browsing=capability({
  prepare:async ({ run,deps,step,stage })=>{
    await stage('evidence');
    const explicit=step.goal.match(/https?:\/\/[^\s，。；！？]+/i)?.[0];
    const query=explicit ?? (step.goal.replace(/^(?:(?:请|帮我)?(?:打开|搜索|找(?:一下)?)\s*)/,'').trim() || step.goal);
    const response=await browseWeb({ db:deps.db,search:deps.search,publicResearch:deps.discovery },run.actor,
      { workspace_id:run.job.workspace_id,query:query.slice(0,600),allow_external:true },run.signal);
    if (!response.results.length) throw new AppError(422,'INFORMATION_NO_EVIDENCE','No relevant webpages were found');
    return response;
  },
  compile:async (_sql,_context,response)=>({ blocks:response.results.map(item=>({ id:randomUUID(),type:'paragraph',
    children:[{ type:'external_link',text:item.title,attrs:{ url:item.url } },{ type:'text',text:' · '+item.provider }] })) }),
});
const capabilities:Record<TaskCapability,Capability>={
  weather,learning,browse:browsing,guide:references('guide'),information:references('information'),comparison:references('information',true),
};
export type PreparedStep={ ok:true;value:unknown;partial:boolean } | { ok:false;code:string;options?:string[] };

export async function executeComposition(run:RunningJob,input:Extract<JobInput,{kind:'composition'}>['body'],deps:Deps) {
  const { job,actor,signal,lifecycle }=run;
  await assertExternal(deps.db,actor,input.workspace_id);
  const state=job.checkpoint.composition ??= { stage:'plan',completed:{} };
  const units=input.steps.map((step,slot)=>({
    run,deps,step,slot,stage:(name:string)=>{ state.stage=name;return lifecycle.save('CapabilityStageStarted',{ slot,capability:step.capability,stage:name }); },
  }));
  for (const unit of units) {
    signal.throwIfAborted();
    if (state.completed[unit.slot]) continue;
    const entry=capabilities[unit.step.capability];
    await unit.stage('plan');
    let result:PreparedStep;
    try {
      const value=await entry.prepare(unit);
      result={ ok:true,value,partial:entry.partial?.(value) ?? false };
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof AppError) && !(error instanceof BudgetExceeded)) throw error;
      result={ ok:false,code:error instanceof AppError ? error.code : 'BUDGET_EXHAUSTED',options:affectedPlaces(error) };
    }
    state.completed[unit.slot]=result;
    await lifecycle.save('CapabilityStageCompleted',{ slot:unit.slot,capability:unit.step.capability,ok:result.ok });
  }
  const gaps=units.flatMap(({ slot,step })=>{
    const result=state.completed[slot]!;
    if (!result.ok) return [{ goal:step.goal,code:result.code }];
    return result.partial ? [{ goal:step.goal,code:'CAPABILITY_PARTIAL' }] : [];
  });
  const available=units.some(({ slot })=>state.completed[slot]?.ok);
  const options=Object.values(state.completed).flatMap(result=>!result.ok ? result.options ?? [] : []).slice(0,5);
  await lifecycle.complete(available ? (gaps.length ? 'PARTIAL':'COMPLETED') : 'FAILED',async sql=>{
    await assertExternal(deps.db,actor,input.workspace_id,sql);
    if (!available) return { warning:gaps[0]?.code,gaps,options };
    const content:ArtifactDocument=emptyDocument();
    for (const unit of units) {
      const output=state.completed[unit.slot]!;
      if (output.ok) {
        const compiled=await capabilities[unit.step.capability].compile(sql,unit,output.value);
        content.blocks.push(...compiled.blocks.filter(block=>block.type!=='evidence_network'));
        if (compiled.nodes) content.relations.knowledge_node_ids.push(...compiled.nodes);
      }
      if (!output.ok || output.partial) content.blocks.push({ id:randomUUID(),type:'task_gap',
        attrs:{ version:1,goal:unit.step.goal,code:output.ok ? 'CAPABILITY_PARTIAL' : output.code } });
    }
    const primaryLearning=content.blocks.find(block=>block.type==='learning_goal')?.id;
    content.blocks=content.blocks.filter(block=>block.type!=='learning_goal' || block.id===primaryLearning);
    content.blocks.push({ id:randomUUID(),type:'evidence_network',attrs:{ view_version:1,node_ids:[],title:'来源与原文' } });
    const artifact=await deps.artifacts.createIn(sql,actor,{ workspace_id:input.workspace_id,kind:'document',title:input.goal.slice(0,140),content },'agent');
    return { artifact_id:artifact.id,gaps,options };
  });
}
