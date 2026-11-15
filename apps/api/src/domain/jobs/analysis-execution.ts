import type { ArtifactDetail } from '@akw/contracts';
import { first,type Database,type Sql } from '../../platform/database';
import { AppError,conflict,missing } from '../../platform/errors';
import type { DiscoveryQuery,ResearchEvidence } from '../../quality-engine/document-quality';
import { qualityFinding } from '../../quality-engine/findings';
import { requiredSources } from '../../quality-engine/source-requirements';
import { researchDocument,type DocumentResearchStages } from '../../runtime/document-research';
import { primaryResearch } from '../../runtime/harness/primary-sources';
import type { DiscoveryMetrics,ImageBytes,PublicResearch } from '../../runtime/public-research';
import type { EmbeddingGateway } from '../../runtime/providers';
import type { Artifacts } from '../artifacts';
import type { Knowledge } from '../knowledge';
import type { RetrievedPassage } from '../retrieval';
import { workspace } from '../access';
import { aiPolicyVersion,blockEvidence } from '../ai-evidence';
import { analysisLedger,analysisPatch,documentText } from '../document-analysis';
import { assertExternal } from './external-access';
import type { AnalysisInput,RunningJob } from './job-types';
import type { InvokeJobModel } from './model-invocation';

const analysisWorkflowVersion = 17;

export async function assertAnalysisSource(sql: Sql, artifact: ArtifactDetail, sourceId: string) {
  const source = await first<{ sensitivity:string; status:string; rights:string }>(sql,`SELECT s.sensitivity,s.status,s.rights FROM sources s
    WHERE s.workspace_id=$1 AND s.id=$2 AND s.lifecycle IN ('active','updated') AND (s.project_id IS NULL OR s.project_id=$3 OR EXISTS(
      SELECT 1 FROM project_relations pr WHERE pr.workspace_id=$1 AND pr.from_id=$3 AND pr.to_id=s.project_id))`,
    [artifact.workspace_id,sourceId,artifact.project_id]);
  if (!source) throw missing('Source');
  if (!['public','personal'].includes(source.sensitivity) || source.rights === 'restricted') throw new AppError(403,'PERMISSION_ANALYSIS_SOURCE','Source is restricted for external analysis');
  if (source.status !== 'parsed') throw new AppError(422,'VALIDATION_ANALYSIS_SOURCE','Source must be parsed before analysis');
  return source;
}

export async function executeAnalysis(run:RunningJob,input:AnalysisInput,{
  db,artifacts,knowledge,embed,publicResearch,model,
}:{ db:Database;artifacts:Artifacts;knowledge:Knowledge;embed?:EmbeddingGateway;publicResearch?:PublicResearch;model:InvokeJobModel }) {
  const { job,actor,signal,lifecycle }=run;
  const artifact = await artifacts.get(actor,input.artifact_id);
  if (artifact.revision.id !== input.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','Document changed before analysis');
  await assertExternal(db,actor,artifact.workspace_id);
  const sourceId = input.source_id;
  if (sourceId) await assertAnalysisSource(db,artifact,sourceId);
  if (job.checkpoint.analysisPolicy !== analysisWorkflowVersion) {
    job.checkpoint = { ...job.checkpoint,analysisPolicy:analysisWorkflowVersion,checkedAnalysis:undefined,documentStages:undefined };
    await lifecycle.save('AnalysisPolicyApplied',{ policy_version:aiPolicyVersion,workflow_version:analysisWorkflowVersion });
  }
  let checked = job.checkpoint.checkedAnalysis;
  if (!checked) {
    const source = (plan?:DiscoveryQuery) => analysisEvidence(run,db,knowledge,embed,artifact,sourceId,input.goal,Boolean(input.use_workspace),plan);
    const requested=(job.checkpoint.runtime || input.required_source_urls?.length) ? requiredSources(input.goal,input.required_source_urls) : [];
    const discovery=input.use_web!==false && (publicResearch || requested.length) ? publicResearch : undefined;
    const useDiscovery=input.use_web!==false && Boolean(discovery || requested.length);
    checked = await researchDocument({
      goal:input.goal,context:input.include_document ? documentText(artifact.revision.content_json) : undefined,source,planLocal:Boolean(sourceId || input.use_workspace),
      requiredSources:requested,requiredQuestions:input.required_questions,requireLicensedImage:input.require_licensed_image,audience:input.audience,
      stage:(key,work) => analysisStage(run,key,work),
      model:(prompt,data) => model({ max_calls:6,max_tokens:66000,max_output:3000 },prompt,data),
      discover:useDiscovery ? async query => {
        await assertExternal(db,actor,artifact.workspace_id);
        let metrics:DiscoveryMetrics|undefined;
        const [primary,discovered]=await Promise.all([
          requested.length ? primaryResearch(requested,query,signal) : Promise.resolve([]),
          discovery?.discover(query,signal,value=>{ metrics=value; },requested.some(item=>item.type==='doi') ? undefined : input.goal) ?? Promise.resolve([]),
        ]);
        const unique=new Map([...primary,...discovered.filter(item=>!primary.some(source=>source.url===item.url))].map(item=>[item.url,item]));
        const available=await knowledge.filterPublicMaterials(artifact.workspace_id,[...unique.values()]);
        if (metrics) await lifecycle.record('PublicSourcesDiscovered',{ ...metrics,primary:primary.length,eligible:available.length });
        return available;
      } : undefined,
    });
    job.checkpoint.checkedAnalysis = checked;
    await lifecycle.save('AnalysisValidated',{ section_count:checked.report.sections.length,claim_count:checked.report.sections.reduce((count,section) => count+section.claims.length,0),
      ...checked.coverage,image_count:checked.materials.filter(item => item.kind === 'image').length });
  }
  const { report,materials } = checked;
  const images = new Map<string,ImageBytes>();
  await assertExternal(db,actor,artifact.workspace_id);
  if (publicResearch) for (const { id,material } of materials) {
    if (!material.image) continue;
    try { images.set(id,await publicResearch.image(material.image.url,signal)); }
    catch { signal.throwIfAborted(); }
    if (images.size===1) break;
  }
  signal.throwIfAborted();
  if (checked.fulfillment?.visual?.mandatory && !checked.fulfillment.visual.approvedIds.some(id=>images.has(id))) {
    const emptyPatch=analysisPatch(artifact.revision.content_json,job.id,report,[],checked.coverage,checked.requirements);
    const ledger=analysisLedger(checked,emptyPatch,new Map());
    throw new AppError(422,'ANALYSIS_REQUIRED_IMAGE','A credited and licensed image could not be included',
      { missing:['相关的署名许可图片'],requirement_ledger:ledger && { ...ledger,items:ledger.items.map(item=>({ ...item,blockIds:[],evidenceIds:[],claimIds:[],
        status:{ ...item.status,artifact:'missing' } })),mandatory:{ ...ledger.mandatory,artifact:{ ...ledger.mandatory.artifact,completed:0 } } } });
  }
  await lifecycle.complete('COMPLETED',async sql => {
    await assertExternal(db,actor,job.workspace_id,sql);
    const current = await artifacts.get(actor,artifact.id,sql);
    if (current.revision.id !== input.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','Document changed during analysis');
    if (sourceId) await assertAnalysisSource(sql,current,sourceId);
    const ids = new Map<string,string>();
    const saved = new Map<string,{ material:typeof materials[number]['material'];evidence_id:string;asset_id?:string }>();
    for (const { id,material,ordinal } of materials) {
      if (material.kind === 'image' && !images.has(id)) continue;
      const reference = await knowledge.savePublicMaterial(sql,actor,artifact.workspace_id,material,images.get(id),ordinal);
      ids.set(id,reference.evidence_id);
      if (!saved.has(material.url)) saved.set(material.url,{ material,...reference });
    }
    const canonical = { sections:report.sections.map(section => ({
      ...section,claims:section.claims.map(claim => ({ ...claim,evidence_ids:claim.evidence_ids.map(id => ids.get(id) ?? id) })),
    })) };
    const draft=analysisPatch(current.revision.content_json,job.id,canonical,[...saved.values()],checked.coverage,checked.requirements);
    const { operations,requirementBlocks }=draft;
    const ledger=analysisLedger(checked,draft,ids);
    if (ledger?.gate==='blocked') throw new AppError(422,'ANALYSIS_ARTIFACT_INCOMPLETE','Mandatory requirements are missing from the proposal');
    const cited = operations.flatMap(operation => operation.type === 'insert_block' ? blockEvidence(operation.block) : []);
    const patch = await artifacts.proposeIn(sql,actor,current,{ base_revision_id:input.base_revision_id,operations },'agent',cited);
    if (ledger) {
      const origins=await sql.all<{ id:string;source_id:string }>('SELECT id,source_id FROM evidence WHERE id=ANY($1::uuid[])',[[...new Set(cited)]]);
      const sourceByEvidence=new Map(origins.map(item=>[item.id,item.source_id]));
      for (const item of ledger.items) item.sourceIds=[...new Set(item.evidenceIds.flatMap(id=>{
        const sourceId=sourceByEvidence.get(id);
        return sourceId ? [sourceId] : [];
      }))];
    }
    if (checked.requirements.length) await lifecycle.event(sql,'RequirementLedgerRecorded',{
      patch_id:patch.id,base_revision_id:input.base_revision_id,origin:'retrieval_plan',
      requirements:checked.requirements.map(({ id,label }) => {
        const blocks=requirementBlocks.get(id) ?? [];
        return { id,label,status:blocks.length ? 'supported' : 'unanswered',blocks };
      }),
    });
    const missing=ledger ? ledger.items.filter(item=>item.type!=='group' && item.status.artifact!=='complete').map(item=>item.description)
      : checked.requirements.filter(item=>!item.targets.length).map(item=>item.label);
    return { artifact_id:artifact.id,patch_id:patch.id,grounded:true,coverage:checked.coverage,requirement_ledger:ledger,
      ...(missing.length ? { missing_requirements:missing } : {}) };
  });
}

async function analysisStage<K extends keyof DocumentResearchStages>({ job,signal,lifecycle }:RunningJob,key:K,work:()=>Promise<DocumentResearchStages[K]>) {
  const cached = job.checkpoint.documentStages?.[key];
  if (cached !== undefined) return cached;
  signal.throwIfAborted();
  await lifecycle.record('AnalysisStageStarted',{ stage:key,workflow_version:analysisWorkflowVersion });
  const value = await work();
  signal.throwIfAborted();
  job.checkpoint.documentStages = { ...job.checkpoint.documentStages,[key]:value };
  const finding='retry_reason' in value && typeof value.retry_reason==='string' ? qualityFinding(value.retry_reason,key) : undefined;
  await lifecycle.save('AnalysisStageCompleted',{ stage:key,workflow_version:analysisWorkflowVersion,finding });
  return value;
}

async function analysisEvidence({ actor,signal,lifecycle }:RunningJob,db:Database,knowledge:Knowledge,embed:EmbeddingGateway|undefined,
  artifact:ArtifactDetail,sourceId:string|undefined,goal:string,corpus:boolean,plan?:DiscoveryQuery) {
  if (!sourceId && !corpus) return [];
  if (sourceId) await assertAnalysisSource(db,artifact,sourceId);
  const planned = plan ? [plan.english+' '+plan.chinese,...(plan.facets ?? []).map(item => item.english+' '+item.chinese)] : [];
  const queries = [...new Set([...planned,goal])].slice(0,7);
  let embeddings:number[][] = [];
  if (embed && corpus) {
    try { await assertExternal(db,actor,artifact.workspace_id); embeddings = await embed(queries,signal); }
    catch { signal.throwIfAborted(); await lifecycle.record('EmbeddingUnavailable',{}); }
  }
  signal.throwIfAborted();
  const fetch = (query:string,sources:string[],includeCorpus:boolean,embedding?:number[]) =>
    knowledge.retrieve(actor,artifact.workspace_id,sources,query,artifact.project_id,embedding,
      { corpus:includeCorpus,external:true,embeddingProfile:embed?.profile });
  const [selected,lists] = await Promise.all([
    sourceId ? fetch(queries[0]!,[sourceId],false) : Promise.resolve([]),
    corpus ? Promise.all(queries.map((query,index) => fetch(query,[],true,embeddings[index]))) : Promise.resolve([]),
  ]);
  const ranked = new Map<string,{ passage:RetrievedPassage;score:number }>();
  for (const list of lists) for (const [rank,passage] of list.entries()) {
    const entry=ranked.get(passage.id) ?? { passage,score:0 };
    entry.score += 1/(20+rank);
    ranked.set(passage.id,entry);
  }
  const unique = new Map([...selected.slice(0,3),...[...ranked.values()].sort((a,b) =>
    b.score-a.score || a.passage.id.localeCompare(b.passage.id)).map(entry => entry.passage)].map(passage => [passage.id,passage]));
  const counts = new Map<string,number>();
  const passages = [...unique.values()].flatMap(passage => {
    const count=counts.get(passage.source_id) ?? 0;
    const quote=passage.memory_quote ?? passage.content;
    if (!quote.trim() || count >= (sourceId === passage.source_id ? 3 : 2)) return [];
    counts.set(passage.source_id,count+1);
    return [{ passage,quote }];
  }).slice(0,8);
  if (!passages.length && sourceId && !corpus) throw new AppError(422,'VALIDATION_ANALYSIS_SOURCE_EMPTY','Selected source has no readable evidence');
  return db.transaction(async sql => {
    await workspace(sql,actor,artifact.workspace_id,true);
    await lifecycle.assertLease(sql);
    if (sourceId) await assertAnalysisSource(sql,artifact,sourceId);
    const evidence:ResearchEvidence[] = [];
    for (const { passage,quote } of passages) {
      const available=await first<{ id:string;canonical_url:string|null }>(sql,`SELECT s.id,s.canonical_url FROM sources s WHERE s.id=$1 AND s.workspace_id=$2
        AND s.lifecycle IN ('active','updated') AND s.sensitivity IN ('public','personal') AND s.rights <> 'restricted'
        AND $3=(SELECT id FROM source_snapshots WHERE source_id=s.id ORDER BY retrieved_at DESC,id DESC LIMIT 1)`,
        [passage.source_id,artifact.workspace_id,passage.snapshot_id]);
      if (!available) continue;
      const id = passage.memory_id ?? (await knowledge.evidenceIn(sql,actor,passage,0,quote.length)).id;
      evidence.push({ id,quote,title:passage.title,kind:'source',source_url:available.canonical_url });
    }
    await lifecycle.event(sql,'KnowledgeRetrieved',{ evidence_count:evidence.length,query_count:queries.length,source_count:new Set(passages.map(item => item.passage.source_id)).size,
      recall_count:passages.filter(item => item.passage.recalled).length });
    return evidence;
  });
}
