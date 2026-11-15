import type { ArtifactDetail } from '@akw/contracts';
import { randomUUID } from 'node:crypto';
import { first,type Database,type Sql } from '../../platform/database';
import type { Actor } from '../../platform/security';
import { conflict } from '../../platform/errors';
import { learn,type LearningEvidence,type LearningStages } from '../../runtime/learning-workflow';
import { learningSourcePages } from '../../runtime/learning-sources';
import type { PublicResearch } from '../../runtime/public-research';
import { citeable } from '../../quality-engine/document-quality';
import { readAiEvidence,blockEvidence } from '../ai-evidence';
import type { Artifacts } from '../artifacts';
import type { Knowledge } from '../knowledge';
import { learningMastery } from '../learning-progress';
import { compileLearning,learningHeader } from '../learning-artifact';
import { assertExternal } from './external-access';
import type { JobInput,RunningJob } from './job-types';
import type { InvokeJobModel } from './model-invocation';

type LearningInput=Extract<JobInput,{kind:'learning'}>['body'];
type LearningDependencies={ db:Database;artifacts:Artifacts;knowledge:Knowledge;publicResearch?:PublicResearch;model:InvokeJobModel };
export async function executeLearning(run:RunningJob,input:LearningInput,deps:LearningDependencies) {
  const prepared=await prepareLearning(run,input,deps);
  const { lifecycle,actor,job }=run;
  const { artifacts,db,knowledge }=deps;
  await lifecycle.complete(prepared.status,async sql=>{
    await assertExternal(db,actor,job.workspace_id,sql);
    const existing=prepared.existing;
    const latest=existing && await artifacts.get(actor,existing.id,sql);
    if (latest && latest.revision.id!==input.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','The learning artifact has changed');
    const output=await compilePreparedLearning(sql,actor,job.workspace_id,prepared,knowledge,latest);
    const artifact=latest ?? await artifacts.createIn(sql,actor,{ workspace_id:job.workspace_id,kind:'document',title:prepared.run.plan.title,content:output.content },'agent');
    if (latest) await artifacts.editIn(sql,actor,latest,{ base_revision_id:latest.revision.id,operations:output.operations },'agent');
    return { artifact_id:artifact.id,...(prepared.status==='PARTIAL' ? { warning:'LEARNING_LIMITED_COVERAGE' } : {}) };
  });
}

export async function prepareLearning({ job,actor,signal,lifecycle }:RunningJob,input:LearningInput,{
  db,artifacts,knowledge,publicResearch,model,
}:LearningDependencies, options?:{ slot:number;policyMaxCalls:number;policyMaxTokens:number }) {
  const load=async ():Promise<ArtifactDetail|undefined>=>{
    if (!input.artifact_id) return;
    const detail=await artifacts.get(actor,input.artifact_id);
    if (detail.revision.id!==input.base_revision_id || !learningHeader(detail.revision.content_json))
      throw conflict('CONFLICT_ARTIFACT_VERSION','The learning artifact has changed');
    return detail;
  };
  const existing=await load();
  const original=existing && learningHeader(existing.revision.content_json);
  const goal=typeof original?.attrs?.goal==='string' ? original.attrs.goal : input.goal;
  const prior=existing?.revision.content_json.blocks.filter(block=>block.type==='learning_lesson').slice(-5)
    .map(block=>[block.attrs?.title,block.attrs?.objective,block.children?.find(node=>node.type==='text')?.text?.slice(0,400)].join(' · ')).join('\n');
  const outcomes=existing ? await learningMastery(db,actor,existing) : [];
  const progress=outcomes.slice(-12).map(item=> {
    const lesson=existing?.revision.content_json.blocks.find(block=>block.id===item.lesson_id);
    return String(lesson?.attrs?.title ?? '')+' '+item.correct+'/'+item.total;
  }).join('\n');
  const background=input.background ?? (original?.attrs?.basis==='provided' && typeof original.attrs.foundation==='string' ? original.attrs.foundation : undefined);
  const run=await learn({ goal,background,question:existing ? input.goal : undefined,prior:progress ? (prior ?? '')+'\nPractice results: '+progress : prior,
    model:(prompt,data)=>model({ max_calls:options?.policyMaxCalls ?? 6,max_tokens:options?.policyMaxTokens ?? 92_000,max_output:5500 },prompt,data),
    stage:async <K extends keyof LearningStages>(key:K,work:()=>Promise<LearningStages[K]>)=>{
      const checkpoints=options ? (job.checkpoint.compositionLearning ??= {})[options.slot] ??= {} : (job.checkpoint.learningStages ??= {});
      const cached=checkpoints[key];
      if (cached!==undefined) return cached;
      signal.throwIfAborted();
      await lifecycle.save('LearningStageStarted',{ stage:key });
      const value=await work();
      signal.throwIfAborted();
      checkpoints[key]=value;
      await lifecycle.save('LearningStageCompleted',{ stage:key });
      return value;
    },
    retrieve:async plan=>{
      await assertExternal(db,actor,job.workspace_id);
      const search=publicResearch ? await Promise.allSettled([
        learningSourcePages(goal,plan,signal),
        ...plan.queries.map(query=>publicResearch.discover(query,signal)),
      ]) : [];
      signal.throwIfAborted();
      const unique=new Map<string,NonNullable<LearningEvidence['material']>>();
      for (const item of search.flatMap(result=>result.status==='fulfilled' ? result.value : [])) {
        if (!unique.has(item.url) && citeable({ id:'',kind:item.kind,title:item.title,quote:item.text })) unique.set(item.url,item);
      }
      const discovered=await knowledge.filterPublicMaterials(job.workspace_id,[...unique.values()]);
      const local:LearningEvidence[]=[];
      if (existing) {
        const evidenceIds=[...new Set(existing.revision.content_json.blocks.filter(block=>block.type==='learning_lesson').slice(-4)
          .flatMap(blockEvidence))].slice(0,5);
        for (const id of evidenceIds) {
          const [entry]=await readAiEvidence(db,existing,[id]).catch(()=>[]);
          if (entry) local.push({ id,title:entry.title,text:entry.quote,kind:'source',evidenceId:id });
        }
      }
      const evidence:LearningEvidence[]=discovered.slice(0,existing ? 8 : 13).map(material=>({
        id:randomUUID(),title:material.title,text:material.text,kind:material.kind,material,
      }));
      return existing ? [...local,...evidence.slice(0,13-local.length)] : evidence;
    },
  });
  const status=(!existing && (run.lessons.length<3 || !run.lessons.some(lesson=>lesson.practice.length))) ? 'PARTIAL' : 'COMPLETED';
  return { status,run,goal,existing,question:existing ? input.goal : undefined } as const;
}

export type PreparedLearning=Awaited<ReturnType<typeof prepareLearning>>;
export async function compilePreparedLearning(sql:Sql,actor:Actor,workspaceId:string,prepared:PreparedLearning,knowledge:Knowledge,latest?:ArtifactDetail) {
    const { goal,run,question }=prepared;
    const scope={ workspace_id:workspaceId,project_id:latest?.project_id ?? null };
    const used=new Set(run.lessons.flatMap(lesson=>lesson.evidence));
    if (run.lessons.some(lesson=>lesson.prerequisites.length)) run.plan.views=[...new Set([...run.plan.views,'graph_embed' as const])];
    const academic=run.evidence.filter(item=>item.material?.kind==='paper' && item.material.published).length;
    if (academic>=3 && /历史|时间线|发展|应用|timeline|history|application/i.test(goal))
      run.plan.views=[...new Set([...run.plan.views,'timeline' as const])];
    const knownUrls=new Set(latest?.revision.content_json.blocks.flatMap(block=>Array.isArray(block.attrs?.paper_urls)
      ? block.attrs.paper_urls : []) ?? []);
    for (const [index,item] of run.evidence.entries()) {
      if (!latest && item.material?.journal?.startsWith('教材')) used.add(index);
      if (run.plan.views.includes('timeline') && item.material?.kind==='paper' && item.material.published &&
        !knownUrls.has(item.material.url) && index<8) used.add(index);
    }
    const ids=new Map<number,string>();
    for (const index of used) {
      const item=run.evidence[index]!;
      if (item.material) {
        const saved=await knowledge.savePublicMaterial(sql,actor,scope.workspace_id,item.material);
        ids.set(index,saved.evidence_id);
      } else if (item.evidenceId) ids.set(index,item.evidenceId);
    }
    await readAiEvidence(sql,scope,[...ids.values()],true);
    return compileLearning(sql,actor,scope,{ ...run,goal,ids,prior:latest?.revision.content_json,question });
}

export async function learningStage(db:Database,id:string) {
  const event=await first<{ stage:string }>(db,`SELECT payload->>'stage' AS stage FROM job_events
    WHERE run_id=$1 AND event_type='LearningStageStarted' ORDER BY sequence DESC LIMIT 1`,[id]);
  return event?.stage;
}
