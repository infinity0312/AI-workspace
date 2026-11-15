import { randomUUID } from 'node:crypto';
import { first,type Sql } from '../../platform/database';

export type RuntimeFlags = { tools:boolean;skills:boolean;compaction:boolean };
export type RuntimeSession = RuntimeFlags & { id:string };
type RuntimeEvents = {
  'session.created': { kind:string };
  'turn.started': { attempt:number };
  'turn.resumed': { attempt:number };
  'turn.finished': { status:string };
  'step.started': { prompt_id:string;sections:string[];skill?:string };
  'step.finished': { status:'completed'|'failed';code?:string };
  'model.request': { call:number;prompt_id:string };
  'model.response': { call:number;finish_reason?:string;input_tokens:number;output_tokens:number };
  'model.failed': { call:number;code:string };
  'tool.started': { tool:string;call_id:string };
  'tool.finished': { tool:string;call_id:string;status:'completed'|'rejected' };
  'context.compacted': { strategy:'excerpt_preview.v1';before_bytes:number;after_bytes:number;evidence_count:number;evidence_ids:string[] };
  'quality.finding': { code:string;issue?:string };
  'artifact.proposed': { patch_id:string };
};
export type RuntimeEvent = keyof RuntimeEvents;
export type ReportRuntime = <K extends RuntimeEvent>(type:K,payload:RuntimeEvents[K],stepId?:string)=>Promise<void>;

export async function createRuntimeSession(sql:Sql,id:string,runId:string,kind:string) {
  await sql.all('INSERT INTO runtime_sessions(id,run_id,schema_version) VALUES($1,$2,1)',[id,runId]);
  await appendRuntimeEvent(sql,id,'session.created',{ kind },undefined,'create');
}
export async function appendRuntimeEvent<K extends RuntimeEvent>(
  sql:Sql,sessionId:string,type:K,payload:RuntimeEvents[K],stepId?:string,unique?:string,
) {
  await sql.all(`INSERT INTO runtime_events(id,session_id,event_type,schema_version,step_id,idempotency_key,payload)
    VALUES($1,$2,$3,1,$4,$5,$6) ON CONFLICT(session_id,idempotency_key) DO NOTHING`,
    [randomUUID(),sessionId,type,stepId ?? null,unique ?? null,JSON.stringify(payload)]);
}

export async function runtimeEvents(sql:Sql,sessionId:string,cursor:string) {
  const rows=await sql.all<{ sequence:string }>(`SELECT sequence::text,id AS event_id,session_id,event_type,schema_version,step_id,payload,created_at
    FROM runtime_events WHERE session_id=$1 AND sequence>$2 ORDER BY runtime_events.sequence LIMIT 101`,[sessionId,cursor]);
  const events=rows.slice(0,100);
  return { events,next_cursor:events.at(-1)?.sequence ?? cursor,has_more:rows.length>100 };
}
export async function startRuntimeDeadline(sql:Sql,sessionId:string,seconds:number) {
  const row=await first<{ millis:string }>(sql,`UPDATE runtime_sessions
    SET deadline_at=COALESCE(deadline_at,now()+make_interval(secs=>$2))
    WHERE id=$1 RETURNING floor(extract(epoch FROM deadline_at)*1000)::text AS millis`,[sessionId,seconds]);
  return row ? Number(row.millis) : undefined;
}

export async function runtimeWatermark(sql:Sql,sessionId:string) {
  const row=await first<{ cursor:string }>(sql,'SELECT COALESCE(MAX(sequence),0)::text AS cursor FROM runtime_events WHERE session_id=$1',[sessionId]);
  return row?.cursor ?? '0';
}

export interface HarnessRollout { admit(workspaceId:string):RuntimeFlags|undefined }
export function harnessRollout(env:NodeJS.ProcessEnv):HarnessRollout {
  const enabled=env.AKW_HARNESS_V2_ENABLED==='true';
  const scopes=new Set((env.AKW_HARNESS_V2_WORKSPACES ?? '').split(',').map(value=>value.trim()).filter(Boolean));
  const localAll=env.AKW_HARNESS_V2_LOCAL_ALL==='true' && (env.AKW_PROFILE ?? 'local')==='local';
  const flags={ tools:env.AKW_HARNESS_V2_TOOLS!=='false',skills:env.AKW_HARNESS_V2_SKILLS!=='false',
    compaction:env.AKW_HARNESS_V2_COMPACTION!=='false' };
  return { admit:workspaceId=>enabled && (localAll || scopes.has(workspaceId)) ? { ...flags } : undefined };
}
