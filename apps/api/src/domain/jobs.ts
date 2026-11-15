import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { artifactDocument,emptyDocument,patchInput,runInput,weatherAttrs,type taskRequest,type weatherRefresh,type LearningRequest,type learningFollowup,type Schedule,type ArtifactDocument,type DocumentAnalysisInput,type RunStatus } from '@akw/contracts';
import { first,type Database,type Sql } from '../platform/database';
import { AppError,conflict,denied,invalid,missing,parse } from '../platform/errors';
import { sha256,type Actor } from '../platform/security';
import { BudgetExceeded } from '../runtime/budget';
import type { ResearchInput } from '../runtime/agent';
import type { EmbeddingGateway,ModelGateway,SearchResult } from '../runtime/providers';
import type { PublicResearch } from '../runtime/public-research';
import type { StreamingGateway } from '../runtime/harness/adapter';
import { appendRuntimeEvent,createRuntimeSession,runtimeEvents,runtimeWatermark,startRuntimeDeadline,type HarnessRollout } from '../runtime/harness/session';
import { rewriteSelection } from '../runtime/selection';
import { taskContract,verifyTaskContract } from '../quality-engine/task-contract';
import { qualityFinding } from '../quality-engine/findings';
import { assertProject,event,idempotent,workspace } from './access';
import { isTextBoundary,type Artifacts } from './artifacts';
import type { Exports,ExportInput,ExportResult } from './exports';
import type { Knowledge } from './knowledge';
import { blockEvidence,readAiEvidence } from './ai-evidence';
import { assertAnalysisSource,executeAnalysis } from './jobs/analysis-execution';
import { executeResearch } from './jobs/research-execution';
import { executeComposition } from './jobs/composition-execution';
import { executeInformation,affectedPlaces } from './jobs/information-execution';
import { planTask } from '../runtime/task-routing';
import type { WeatherProvider } from '../runtime/weather-provider';
import { executeLearning,learningStage } from './jobs/learning-execution';
import { learningHeader } from './learning-artifact';
import { bindJobModel } from './jobs/model-invocation';
import { assertExternal } from './jobs/external-access';
import type { Job,JobInput,RunningJob,Selection } from './jobs/job-types';

export { selectionInput } from './jobs/job-types';

const runSeconds=(input:JobInput)=>input.kind==='research' ? input.body.budget.max_seconds : input.kind==='composition' ? 270 : input.kind==='learning' ? 200 : input.kind==='information' ? (input.body.mode==='weather' ? 35 : 120) : input.kind==='analysis' ? 160 : 120;
const takeSeconds = 45;
const terminal = ['COMPLETED','PARTIAL','FAILED','CANCELLED','BUDGET_EXHAUSTED'];
const runRoutes = { composition:'/v1/tasks/',information:'/v1/tasks/',learning:'/v1/learning-runs/',research: '/v1/research-runs/', ingest: '/v1/ingestion-runs/', export: '/v1/exports/', selection: '/v1/ai-patch-runs/', analysis: '/v1/artifact-analysis-runs/' } as const;

export class Jobs {
  constructor(
    private readonly db: Database,
    private readonly knowledge: Knowledge,
    private readonly artifacts: Artifacts,
    private readonly exports: Exports,
    private readonly model?: ModelGateway,
    private readonly search?: (goal: string, signal: AbortSignal) => Promise<SearchResult[]>,
    private readonly embed?:EmbeddingGateway,
    private readonly publicResearch?:PublicResearch,
    private readonly harness?:{ gateway:StreamingGateway;rollout:HarnessRollout },
    private readonly weather?:WeatherProvider,
  ) {}

  async task(actor:Actor,input:z.infer<typeof taskRequest>,key?:string) {
    await workspace(this.db,actor,input.workspace_id);
    await assertExternal(this.db,actor,input.workspace_id);
    const steps=planTask(input.goal,input.location);
    if (input.sources?.length) for (const step of steps) if (['guide','information','comparison'].includes(step.capability))
      step.sources=[...new Set(input.sources)];
    const request={ workspace_id:input.workspace_id,goal:input.goal,allow_external:true as const };
    if (steps.length>1 || ['comparison','browse'].includes(steps[0]?.capability ?? '') || steps.some(step=>step.sources?.length)) {
      return { ...await this.enqueue(actor,input.workspace_id,{ kind:'composition',body:{ ...request,steps } },key,
        sql=>assertExternal(this.db,actor,input.workspace_id,sql)),kind:'composition',steps:steps.map(({ capability,goal })=>({ capability,goal })) };
    }
    const planned=steps[0]!;
    const mode=planned.capability;
    if (mode==='learning') {
      const run=await this.learning(actor,request,key);
      return { ...run,kind:'learning',status_url:'/v1/tasks/'+run.run_id,events_url:'/v1/tasks/'+run.run_id+'/events' };
    }
    const informationMode=mode==='comparison' || mode==='browse' ? 'information' : mode;
    return { ...await this.enqueue(actor,input.workspace_id,{ kind:'information',body:{ ...request,mode:informationMode,weather:planned.weather } },key,async sql=>{
      await assertExternal(this.db,actor,input.workspace_id,sql);
    }),kind:'information',mode:informationMode };
  }

  async refreshWeather(actor:Actor,id:string,input:z.infer<typeof weatherRefresh>,key?:string) {
    const artifact=await this.artifacts.get(actor,id);
    const current=weatherAttrs.safeParse(artifact.revision.content_json.blocks.find(item=>item.type==='weather_forecast' && (!input.block_id || item.id===input.block_id))?.attrs);
    if (!current.success) throw missing('Forecast');
    const { place,window }=current.data;
    const goal=artifact.title;
    const weather={ city:place.name,offset:window.offset,days:window.days,place };
    return this.enqueue(actor,artifact.workspace_id,{ kind:'information',body:{ workspace_id:artifact.workspace_id,artifact_id:id,
      base_revision_id:input.base_revision_id,block_id:input.block_id,mode:'weather',weather,goal,allow_external:true } },key,async sql=>{
      await assertExternal(this.db,actor,artifact.workspace_id,sql);
      if ((await this.artifacts.get(actor,id,sql)).revision.id!==input.base_revision_id)
        throw conflict('CONFLICT_ARTIFACT_VERSION','The forecast artifact has changed');
    });
  }

  async getTask(actor:Actor,id:string) {
    const run=await this.authorized(actor,id);
    if (run.input.kind==='learning') return { ...this.summarize(run),stage:await learningStage(this.db,id) };
    if (run.input.kind==='composition') return { ...this.summarize(run),stage:run.checkpoint.composition?.stage,
      steps:run.input.body.steps.map(({ capability,goal })=>({ capability,goal })) };
    if (run.input.kind!=='information') throw missing('Information task');
    return { ...this.summarize(run),mode:run.input.body.mode,stage:run.checkpoint.informationStage };
  }

  async taskEvents(actor:Actor,id:string,cursor:string) {
    await this.getTask(actor,id);
    return this.events(actor,id,cursor);
  }

  learning(actor:Actor,input:LearningRequest,key?:string) {
    return this.enqueue(actor,input.workspace_id,{ kind:'learning',body:input },key,async sql=>{
      if (!this.model) throw new AppError(503,'PROVIDER_UNAVAILABLE','DeepSeek is not configured');
      await assertExternal(this.db,actor,input.workspace_id,sql);
    });
  }

  async followLearning(actor:Actor,id:string,input:z.infer<typeof learningFollowup>,key?:string) {
    const artifact=await this.artifacts.get(actor,id);
    return this.enqueue(actor,artifact.workspace_id,{ kind:'learning',body:{ artifact_id:id,workspace_id:artifact.workspace_id,
      goal:input.question,background:input.background,base_revision_id:input.base_revision_id,allow_external:true } },key,async sql=>{
      if (!this.model) throw new AppError(503,'PROVIDER_UNAVAILABLE','DeepSeek is not configured');
      await assertExternal(this.db,actor,artifact.workspace_id,sql);
      const current=await this.artifacts.get(actor,id,sql);
      if (!learningHeader(current.revision.content_json)) throw missing('Learning goal');
      if (current.revision.id!==input.base_revision_id)
        throw conflict('CONFLICT_ARTIFACT_VERSION','The learning artifact has changed');
    });
  }

  async getLearning(actor:Actor,id:string) {
    const run=await this.authorized(actor,id,'learning');
    return { ...this.summarize(run),stage:await learningStage(this.db,id) };
  }

  async latestLearning(actor:Actor,id:string) {
    const artifact=await this.artifacts.get(actor,id);
    const run=await first<Job>(this.db,`SELECT * FROM jobs WHERE workspace_id=$1 AND user_id=$2 AND tenant_id=$3 AND kind='learning'
      AND input->'body'->>'artifact_id'=$4 ORDER BY created_at DESC,id DESC LIMIT 1`,[artifact.workspace_id,actor.user,actor.tenant,id]);
    return run ? { ...this.summarize(run),stage:await learningStage(this.db,run.id) } : null;
  }

  research(actor: Actor, input: ResearchInput, key?: string) {
    return this.enqueue(actor,input.workspace_id,{ kind: 'research', body: input },key,async sql => {
      await assertProject(sql,input.workspace_id,input.project_id);
      for (const source of new Set(input.source_ids)) {
        if (!await first(sql, `SELECT id FROM sources s WHERE s.workspace_id=$1 AND s.id=$2 AND
          (s.project_id IS NULL OR s.project_id=$3 OR EXISTS(SELECT 1 FROM project_relations pr
           WHERE pr.workspace_id=$1 AND pr.from_id=$3 AND pr.to_id=s.project_id))`,[input.workspace_id,source,input.project_id ?? null])) throw missing('Source');
      }
    });
  }
  async ingest(actor: Actor, id: string, key?: string, refresh = false) {
    const source = await this.knowledge.source(actor,id);
    return this.enqueue(actor,source.workspace_id,{ kind: 'ingest', body: { source_id: id, refresh } },key);
  }
  async export(actor: Actor, input: ExportInput, key?: string) {
    if (input.artifact_id) {
      const artifact = await this.artifacts.get(actor,input.artifact_id);
      if (artifact.workspace_id !== input.workspace_id) throw missing('Artifact');
    }
    return this.enqueue(actor,input.workspace_id,{ kind: 'export', body: input },key);
  }
  async selection(actor: Actor, id: string, input: Selection, key?: string) {
    const artifact = await this.artifacts.get(actor,id);
    if (!this.model) throw new AppError(503,'PROVIDER_UNAVAILABLE','DeepSeek is not configured');
    return this.enqueue(actor,artifact.workspace_id,{ kind: 'selection', body: { ...input, artifact_id: id } },key,async sql => {
      const current = await this.artifacts.get(actor,id,sql);
      const access = await workspace(sql,actor,current.workspace_id);
      if (!access.policy.externalProviderAllowed || !['public','personal'].includes(access.policy.sensitivity)) throw denied();
      this.selectedText(current.revision.content_json,current.revision.id,input);
    });
  }

  async analysis(actor: Actor, id: string, input: DocumentAnalysisInput, key?: string) {
    const artifact = await this.artifacts.get(actor,id);
    return this.enqueue(actor,artifact.workspace_id,{ kind:'analysis',body:{ ...input,artifact_id:id } },key,async sql => {
      if (!this.model) throw new AppError(503,'PROVIDER_UNAVAILABLE','DeepSeek is not configured');
      const current = await this.artifacts.get(actor,id,sql);
      const access = await workspace(sql,actor,current.workspace_id);
      if (!access.policy.externalProviderAllowed || !['public','personal'].includes(access.policy.sensitivity)) throw denied();
      if (current.revision.id !== input.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','The analysis revision is stale');
      if (input.source_id) await assertAnalysisSource(sql,current,input.source_id);
    });
  }
  async analyses(actor: Actor,id: string) {
    const artifact = await this.artifacts.get(actor,id);
    const access = await workspace(this.db,actor,artifact.workspace_id);
    const rows = await this.db.all<Job>(`SELECT * FROM jobs WHERE workspace_id=$1 AND tenant_id=$2 AND kind='analysis'
      AND ($3::boolean OR user_id=$4) AND input->'body'->>'artifact_id'=$5
      ORDER BY created_at DESC,id DESC LIMIT 25`,[artifact.workspace_id,actor.tenant,access.role === 'owner',actor.user,id]);
    return rows.map(row => this.summarize(row));
  }

  private enqueue(actor: Actor, ws: string, input: JobInput, key?: string, verify?: (sql: Sql) => Promise<void>) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, ws, true);
      return idempotent(sql, actor, input.kind + '.enqueue:' + ws, key, input, async () => {
        await verify?.(sql);
        return this.enqueueIn(sql,actor,ws,input);
      });
    });
  }
  private async enqueueIn(sql:Sql,actor:Actor,ws:string,input:JobInput) {
    const id = randomUUID();
    const contract=taskContract(id,ws,input);
    const flags=contract && this.harness?.rollout.admit(ws);
    const runtime=flags && { ...flags,id:randomUUID() };
    await sql.all(`INSERT INTO jobs(id,workspace_id,tenant_id,user_id,kind,status,input,checkpoint)
      VALUES($1,$2,$3,$4,$5,'QUEUED',$6,$7)`,[id,ws,actor.tenant,actor.user,input.kind,JSON.stringify(input),JSON.stringify({ contract,runtime })]);
    if (runtime) await createRuntimeSession(sql,runtime.id,id,input.kind);
    await this.jobEvent(sql,id,'RunQueued',{ kind:input.kind });
    if (contract) await this.jobEvent(sql,id,'TaskContractCreated',contract);
    await event(sql,actor,ws,'RunQueued','run',id,1,{ kind:input.kind });
    return { run_id:id,status:'QUEUED',status_url:runRoutes[input.kind]+id,events_url:runRoutes[input.kind]+id+'/events',
      ...(runtime ? { runtime_session_id:runtime.id } : {}) };
  }

  enqueueSchedule(sql:Sql,actor:Actor,ws:string,target:Schedule['target']) {
    const input:JobInput = target.kind === 'source'
      ? { kind:'ingest',body:{ source_id:target.source_id,refresh:true } }
      : { kind:'research',body:runInput.parse({ workspace_id:ws,goal:target.goal,allow_external:target.allow_external,
          budget:{ max_calls:2,max_tokens:8000,max_seconds:90 } }) };
    return this.enqueueIn(sql,actor,ws,input);
  }
  private async authorized(actor: Actor, id: string, kind?: JobInput['kind'], sql: Sql = this.db, write = false) {
    const job = await first<Job>(sql,'SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2',[id,actor.tenant]);
    if (!job || (kind && job.input.kind !== kind)) throw missing('Run');
    const access = await workspace(sql,actor,job.workspace_id,write);
    if (job.user_id !== actor.user && access.role !== 'owner') throw missing('Run');
    return job;
  }
  async get(actor: Actor, id: string, kind?: JobInput['kind']) {
    return this.summarize(await this.authorized(actor,id,kind));
  }
  private summarize(job: Job) {
    const { id, workspace_id, status, updated_at } = job;
    const result = job.result && Object.fromEntries(Object.entries(job.result).filter(([key]) => key !== 'storage_key'));
    return { id,workspace_id,status,updated_at,kind:job.input.kind,goal:'goal' in job.input.body ? job.input.body.goal : '',result,
      ...(job.checkpoint.runtime ? { runtime_session_id:job.checkpoint.runtime.id } : {}) };
  }
  saveAnswer(actor:Actor,id:string) {
    return this.db.transaction(async sql=>{
      await this.authorized(actor,id,'research',sql,true);
      const job=await first<Job>(sql,'SELECT * FROM jobs WHERE id=$1',[id]);
      if (!job || job.input.kind!=='research') throw missing('Run');
      const input=job.input.body;
      return idempotent(sql,actor,'research.save-answer',id,{ run_id:id },async()=>{
        const response=job.result?.response;
        if (job.status!=='COMPLETED' || typeof response!=='string' || !response.trim())
          throw conflict('CONFLICT_RESEARCH_OUTPUT','This run has no completed answer to save');
        const content=emptyDocument();
        content.blocks=response.match(/[\s\S]{1,3500}/gu)!.map(text=>({
          id:randomUUID(),type:'paragraph',children:[{ type:'text',text }],
        }));
        return this.artifacts.createIn(sql,actor,{ workspace_id:job.workspace_id,project_id:input.project_id,
          kind:'note',title:input.goal.slice(0,180),content:parse(artifactDocument,content) },'user');
      });
    });
  }

  async list(actor: Actor, ws: string, kind: JobInput['kind']) {
    const access = await workspace(this.db,actor,ws);
    const jobs = await this.db.all<Job>(`SELECT * FROM jobs WHERE workspace_id=$1 AND tenant_id=$2 AND kind=$3
      AND ($4::boolean OR user_id=$5) ORDER BY updated_at DESC LIMIT 100`,[ws,actor.tenant,kind,access.role === 'owner',actor.user]);
    return jobs.map(job => this.summarize(job));
  }
  async events(actor: Actor, id: string, cursor: string, kind?: JobInput['kind']) {
    await this.authorized(actor,id,kind);
    const items = await this.db.all<{ sequence: string }>(`SELECT sequence::text,event_type,payload,created_at FROM job_events
      WHERE run_id=$1 AND sequence>$2 ORDER BY job_events.sequence LIMIT 201`,[id,cursor]);
    return { events: items.slice(0,200), next_cursor: items.slice(0,200).at(-1)?.sequence ?? cursor, has_more: items.length > 200 };
  }
  async runtimeStatus(actor:Actor,id:string) {
    const job=await this.authorized(actor,id);
    const runtime=job.checkpoint.runtime;
    if (!runtime) throw missing('Runtime session');
    return { run_id:id,session_id:runtime.id,status:job.status,watermark:await runtimeWatermark(this.db,runtime.id) };
  }

  async runtimeTimeline(actor:Actor,id:string,cursor:string) {
    const job=await this.authorized(actor,id);
    if (!job.checkpoint.runtime) throw missing('Runtime session');
    return runtimeEvents(this.db,job.checkpoint.runtime.id,cursor);
  }

  command(actor:Actor,id:string,action:'pause'|'resume'|'cancel',key?:string,runtimeOnly=false) {
    return this.db.transaction(async sql => {
      const job=await this.authorized(actor,id,runtimeOnly ? undefined : 'research',sql,true);
      if (runtimeOnly && (!job.checkpoint.runtime || action!=='cancel')) throw missing('Runtime session');
      return idempotent(sql,actor,'run.command:' + id,key,{action},async () => {
        const fresh = await first<Job>(sql,'SELECT * FROM jobs WHERE id=$1 FOR UPDATE',[id]);
        const before = fresh!.status;
        const transitions = {
          pause: { from: ['QUEUED','RUNNING','PLANNING'], to: 'PAUSED' },
          resume: { from: ['PAUSED'], to: 'QUEUED' },
          cancel: { from: ['QUEUED','PLANNING','RUNNING','PAUSED'], to: 'CANCELLED' },
        } as const;
        const selected = transitions[action];
        if (!(selected.from as readonly string[]).includes(before)) throw conflict('CONFLICT_RUN_STATUS','Run state does not allow this operation');
        await sql.all('UPDATE jobs SET status=$2,lease_id=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1',[id,selected.to]);
        await this.jobEvent(sql,id,'RunStateChanged',{ from: before, to: selected.to });
        const runtime=fresh!.checkpoint.runtime;
        if (runtime && selected.to==='CANCELLED') {
          await sql.all('DELETE FROM runtime_journal WHERE session_id=$1',[runtime.id]);
          await appendRuntimeEvent(sql,runtime.id,'turn.finished',{ status:'CANCELLED' },undefined,'terminal');
        }
        await event(sql,actor,job.workspace_id,'RunStateChanged','run',id,1,{ status: selected.to });
        return { id,status:selected.to };
      });
    });
  }
  async download(actor: Actor,id: string) {
    const job = await this.authorized(actor,id,'export');
    if (job.status !== 'COMPLETED' || !job.result) throw conflict('CONFLICT_EXPORT_PENDING','Export has not completed');
    const result = job.result as unknown as ExportResult;
    return { ...result, bytes: await this.exports.read(result) };
  }
  async usage(actor: Actor, ws: string) {
    await workspace(this.db,actor,ws);
    return this.db.all(`SELECT provider,model,count(*)::int AS calls,
      sum(input_tokens)::int AS input_tokens,sum(output_tokens)::int AS output_tokens
      FROM model_usage WHERE workspace_id=$1 GROUP BY provider,model ORDER BY provider,model`,[ws]);
  }

  async next(signal: AbortSignal,lane:'general'|'interactive'|'all'='all') {
    const job = await this.db.transaction(async sql => {
      const row = await first<Job>(sql,`SELECT * FROM jobs WHERE (status='QUEUED' OR
        (status IN ('RUNNING','PLANNING') AND lease_expires_at < now()))
        AND ($1='all' OR CASE WHEN kind='information' AND input->'body'->>'mode'='weather' THEN 'interactive' ELSE 'general' END=$1)
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,[lane]);
      if (!row) return;
      const status = row.attempts >= 5 ? 'FAILED' : 'RUNNING';
      const lease = status === 'RUNNING' ? randomUUID() : null;
      await sql.all(`UPDATE jobs SET status=$2,lease_id=$3,lease_expires_at=now() + make_interval(secs => $4),
        attempts=attempts+1,updated_at=now() WHERE id=$1`, [row.id,status,lease,takeSeconds]);
      await this.jobEvent(sql,row.id,status === 'FAILED' ? 'RetryLimitReached' : 'RunStarted',{ attempt: row.attempts + 1 });
      if (row.checkpoint.runtime) {
        if (status==='FAILED') {
          await sql.all('DELETE FROM runtime_journal WHERE session_id=$1',[row.checkpoint.runtime.id]);
          await appendRuntimeEvent(sql,row.checkpoint.runtime.id,'turn.finished',{ status },undefined,'terminal');
        }
        else await appendRuntimeEvent(sql,row.checkpoint.runtime.id,row.attempts ? 'turn.resumed' : 'turn.started',
          { attempt:row.attempts+1 },undefined,'attempt:'+(row.attempts+1));
      }
      const deadline=row.checkpoint.runtime && lease ? await startRuntimeDeadline(sql,row.checkpoint.runtime.id,runSeconds(row.input)) : undefined;
      return { ...row,lease_id:lease,status,runtime_deadline_ms:deadline } as Job;
    });
    if (!job) return false;
    if (!job.lease_id) return true;
    const actor = { tenant: job.tenant_id,user: job.user_id };
    const lost = new AbortController();
    const remaining=job.runtime_deadline_ms===undefined ? runSeconds(job.input)*1000 : job.runtime_deadline_ms-Date.now();
    const timeout=AbortSignal.timeout(Math.max(1,remaining));
    const combined = AbortSignal.any([signal,lost.signal,timeout]);
    let extending = false;
    const heartbeat = setInterval(() => {
      if (extending) return;
      extending = true;
      void first(this.db,`UPDATE jobs SET lease_expires_at=now()+make_interval(secs => $3)
        WHERE id=$1 AND lease_id=$2 AND status='RUNNING' RETURNING id`,[job.id,job.lease_id,takeSeconds])
        .then(result => { if (!result) lost.abort(); }).catch(() => lost.abort()).finally(() => { extending = false; });
    }, 3500);
    try {
      if (remaining<=0) throw new BudgetExceeded();
      const access = await workspace(this.db,actor,job.workspace_id);
      if (job.input.kind !== 'export' && access.role === 'viewer') throw denied();
      await this.execute(job,actor,combined);
    } catch (error) {
      if (!lost.signal.aborted && !signal.aborted) {
        const exhausted = error instanceof BudgetExceeded || timeout.aborted;
        const status = exhausted ? 'BUDGET_EXHAUSTED' : 'FAILED';
        const reason = exhausted ? 'Execution budget reached' : error instanceof AppError ? error.code : 'Execution failed';
        await this.complete(job,actor,status,async sql => {
          if (job.checkpoint.contract) await this.jobEvent(sql,job.id,'QualityGateFailed',qualityFinding(reason,'run'));
          if (job.checkpoint.runtime) await appendRuntimeEvent(sql,job.checkpoint.runtime.id,'quality.finding',{ code:reason });
          const missing=error instanceof AppError && error.details && typeof error.details==='object' && 'missing' in error.details
            ? error.details.missing : undefined;
          const ledger=error instanceof AppError && error.details && typeof error.details==='object' && 'requirement_ledger' in error.details
            ? error.details.requirement_ledger : undefined;
          const options=affectedPlaces(error);
          return { warning:reason,requirement_ledger:ledger,...(options ? { options } : {}),...(Array.isArray(missing) && missing.every(item=>typeof item==='string') ? { missing_requirements:missing } : {}) };
        }).catch(() => {});
      }
    } finally { clearInterval(heartbeat); }
    return true;
  }

  private async execute(job: Job, actor: Actor, signal: AbortSignal) {
    const input = job.input;
    const contract=taskContract(job.id,job.workspace_id,input);
    if (contract) {
      if (job.checkpoint.contract) verifyTaskContract(job.checkpoint.contract,contract);
      else {
        job.checkpoint.contract=contract;
        await this.save(job,'TaskContractCreated',contract);
      }
    }
    if (input.kind === 'ingest') {
      const source = await this.knowledge.ingest(actor,input.body.source_id,signal,input.body.refresh);
      signal.throwIfAborted();
      await this.complete(job,actor,'COMPLETED',async () => ({ source_id: source.id }));
      return;
    }
    if (input.kind === 'export') {
      const result = await this.exports.create(actor,input.body);
      signal.throwIfAborted();
      await this.complete(job,actor,'COMPLETED',async () => ({ ...result, download_url: '/v1/exports/' + job.id + '/download' }));
      return;
    }
    const run:RunningJob={ job,actor,signal,lifecycle:{
      assertLease:(sql,lock)=>this.assertLease(sql,job,lock),
      event:(sql,type,payload)=>this.jobEvent(sql,job.id,type,payload),
      record:(type,payload)=>this.record(job,type,payload),
      saveIn:(sql,type,payload)=>this.saveIn(sql,job,type,payload),
      save:(type,payload,companion)=>this.save(job,type,payload,companion),
      complete:(status,produce)=>this.complete(job,actor,status,produce),
    } };
    const { db,artifacts,knowledge,search,embed,publicResearch }=this;
    const model=bindJobModel(run,{ db,artifacts,model:this.model,streamingGateway:this.harness?.gateway });
    if (input.kind === 'selection') {
      const artifact = await this.artifacts.get(actor,input.body.artifact_id);
      const oldText = this.selectedText(artifact.revision.content_json,artifact.revision.id,input.body);
      const block = artifact.revision.content_json.blocks.find(item => item.id === input.body.block_id)!;
      const ids = blockEvidence(block);
      const evidence = (await readAiEvidence(this.db,artifact,ids)).map(({ id,title,quote }) => ({ id,title,quote,kind:'source' as const }));
      const inline=block.children![input.body.inline_index]!.text!;
      const left=inline.slice(Math.max(0,input.body.start_utf16-600),input.body.start_utf16);
      const right=inline.slice(input.body.end_utf16,input.body.end_utf16+600);
      const replacement=await rewriteSelection({
        instruction:input.body.instruction,original:oldText,left,right,evidence,directQuote:block.type==='quote',
      },signal,model);
      signal.throwIfAborted();
      await this.complete(job,actor,'COMPLETED',async sql => {
        await assertExternal(db,actor,job.workspace_id,sql);
        const current = await this.artifacts.get(actor,artifact.id,sql);
        if (current.revision.id !== artifact.revision.id) throw conflict('CONFLICT_ARTIFACT_VERSION','Selection changed during AI editing');
        const patch = await this.artifacts.proposeIn(sql,actor,current,parse(patchInput,{
          base_revision_id: artifact.revision.id,
          operations: [{ type: 'replace_text_range', block_id: input.body.block_id, inline_index: input.body.inline_index,
            start_utf16: input.body.start_utf16, end_utf16: input.body.end_utf16, expected_text: oldText,
            expected_sha256: sha256(oldText), text:replacement }],
        }),'agent',ids);
        return { artifact_id: artifact.id,patch_id: patch.id };
      });
      return;
    }
    if (input.kind==='composition') {
      await executeComposition(run,input.body,{ db,artifacts,knowledge,discovery:publicResearch,search,weather:this.weather,model:this.model ? model : undefined });
      return;
    }
    if (input.kind==='information') {
      await executeInformation(run,input.body,{ db,artifacts,knowledge,discovery:publicResearch,weather:this.weather,model:this.model ? model : undefined });
      return;
    }
    if (input.kind==='learning') {
      await executeLearning(run,input.body,{ db,artifacts,knowledge,publicResearch,model });
      return;
    }
    if (input.kind === 'analysis') {
      await executeAnalysis(run,input.body,{ db,artifacts,knowledge,embed,publicResearch,model });
      return;
    }
    await executeResearch(run,input.body,{ db,artifacts,knowledge,search,embed,model:this.model ? model : undefined });
  }

  private selectedText(content: ArtifactDocument, revision: string, selection: Selection) {
    if (revision !== selection.base_revision_id) throw conflict('CONFLICT_ARTIFACT_VERSION','Selection revision is stale');
    const node = content.blocks.find(block => block.id === selection.block_id)?.children?.[selection.inline_index];
    const start = selection.start_utf16;
    const end = selection.end_utf16;
    if (node?.type !== 'text' || node.text === undefined || start >= end || end - start > 3000
      || !isTextBoundary(node.text,start) || !isTextBoundary(node.text,end)) throw invalid('Select a valid text range');
    return node.text.slice(start,end);
  }

  private async assertLease(sql: Sql, job: Job, lock = false) {
    if (!await first(sql,`SELECT id FROM jobs WHERE id=$1 AND status='RUNNING' AND lease_id=$2
      AND lease_expires_at>now() ${lock ? 'FOR UPDATE' : ''}`,[job.id,job.lease_id])) throw conflict('CONFLICT_RUN_LEASE','Run lease no longer valid');
  }
  private async jobEvent(sql: Sql,id: string,type: string,payload: Record<string,unknown>) {
    await sql.all('INSERT INTO job_events(run_id,event_type,payload) VALUES($1,$2,$3)',[id,type,JSON.stringify(payload)]);
  }
  private record(job: Job,type: string,payload: Record<string,unknown>) {
    return this.db.transaction(async sql => {
      await this.assertLease(sql,job,true);
      await this.jobEvent(sql,job.id,type,payload);
    });
  }
  private save(job:Job,type:string,payload:Record<string,unknown>,companion?:{ type:string;payload:Record<string,unknown> }) {
    return this.db.transaction(async sql => {
      await this.assertLease(sql,job,true);
      await this.saveIn(sql,job,type,payload);
      if (companion) await this.jobEvent(sql,job.id,companion.type,companion.payload);
    });
  }
  private async saveIn(sql:Sql,job:Job,type:string,payload:Record<string,unknown>) {
    await sql.all('UPDATE jobs SET checkpoint=$2,updated_at=now() WHERE id=$1',[job.id,JSON.stringify(job.checkpoint)]);
    await this.jobEvent(sql,job.id,type,payload);
  }
  private complete(job: Job,actor: Actor,status: RunStatus,produce: (sql: Sql) => Promise<Record<string,unknown>>) {
    if (!terminal.includes(status)) throw invalid('Invalid final state');
    return this.db.transaction(async sql => {
      await workspace(sql,actor,job.workspace_id,true);
      await this.assertLease(sql,job,true);
      const result = await produce(sql);
      await sql.all('UPDATE jobs SET status=$2,result=$3,lease_id=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1',
        [job.id,status,JSON.stringify(result)]);
      await this.jobEvent(sql,job.id,'RunStateChanged',{ to: status });
      const runtime=job.checkpoint.runtime;
      if (runtime) {
        await sql.all('DELETE FROM runtime_journal WHERE session_id=$1',[runtime.id]);
        if (typeof result.patch_id==='string') await appendRuntimeEvent(sql,runtime.id,'artifact.proposed',{ patch_id:result.patch_id },undefined,'proposal');
        await appendRuntimeEvent(sql,runtime.id,'turn.finished',{ status },undefined,'terminal');
      }
      await event(sql,actor,job.workspace_id,'RunStateChanged','run',job.id,1,{ status });
    });
  }
}
