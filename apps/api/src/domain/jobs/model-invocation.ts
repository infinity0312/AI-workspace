import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Database,Sql } from '../../platform/database';
import { AppError,conflict,denied } from '../../platform/errors';
import { BudgetExceeded,reserveModelBudget,type ModelBudget } from '../../runtime/budget';
import type { ModelGateway } from '../../runtime/providers';
import { prompts,type PromptId } from '../../quality-engine/prompts';
import { contextManifest,contextReferences } from '../../quality-engine/context-manifest';
import { completionText,type Completion } from '../../quality-engine/model-output';
import { qualityFinding } from '../../quality-engine/findings';
import type { ChatMessage,StreamCompletion,StreamingGateway,ToolSpec } from '../../runtime/harness/adapter';
import { runtimePrompt } from '../../runtime/harness/context';
import { runToolLoop } from '../../runtime/harness/loop';
import { openToolJournal } from '../../runtime/harness/journal';
import { appendRuntimeEvent,type ReportRuntime } from '../../runtime/harness/session';
import { readAiEvidence } from '../ai-evidence';
import type { Artifacts } from '../artifacts';
import { assertExternal } from './external-access';
import type { RunningJob } from './job-types';

type StreamingAttempt = { messages:ChatMessage[];tools?:ToolSpec[];canCallTools:boolean;stepId:string;
  settle?:(sql:Sql,response:StreamCompletion)=>Promise<void> };
export type InvokeJobModel = (policy:ModelBudget,prompt:PromptId,data:unknown)=>Promise<string>;

export function bindJobModel({ job,actor,signal,lifecycle }:RunningJob,{
  db,artifacts,model,streamingGateway,
}:{ db:Database;artifacts:Artifacts;model?:ModelGateway;streamingGateway?:StreamingGateway }):InvokeJobModel {
  async function callModel(policy:ModelBudget,prompt:PromptId,data:unknown) {
    const attempt=async (request?:StreamingAttempt) => {
      try { return await modelAttempt(policy,prompt,data,request); }
      catch (error) {
        if (!(error instanceof AppError) || !error.retryable || signal.aborted || (job.checkpoint.budget?.calls ?? 0)>=policy.max_calls) throw error;
        await lifecycle.record('ModelRetry',{ code:error.code,prompt_id:prompt });
        await delay(400,undefined,{ signal });
        return modelAttempt(policy,prompt,data,request);
      }
    };
    const runtime=job.checkpoint.runtime;
    if (!runtime) return (await attempt()).text;
    if (!streamingGateway) throw new AppError(503,'PROVIDER_UNAVAILABLE','Harness provider is unavailable');
    const stepId=randomUUID();
    const context=runtimePrompt(prompt,data,runtime);
    const journal=openToolJournal(db,runtime.id,{ prompt,version:prompts[prompt].version,context:data,profile:streamingGateway.profile },{
      assertLease:sql=>lifecycle.assertLease(sql,true),
      authorize:async()=>{
        await assertExternal(db,actor,job.workspace_id);
        await readAiEvidence(db,await modelScope(),contextReferences(data).evidence_ids);
        signal.throwIfAborted();
      },
    });
    const report:ReportRuntime=(type,payload,step) => db.transaction(async sql => {
      await lifecycle.assertLease(sql,true);
      await appendRuntimeEvent(sql,runtime.id,type,payload,step);
    });
    await report('step.started',{ prompt_id:prompt,sections:context.sections,skill:context.skill },stepId);
    if (context.compaction) await report('context.compacted',context.compaction,stepId);
    try {
      const text=await runToolLoop({
        messages:context.messages,json:prompts[prompt].format==='json_object',stepId,signal,report,journal,
        tool:context.excerpts.size ? { excerpts:context.excerpts,authorize:async (item,scopeSignal) => {
          scopeSignal.throwIfAborted();
          await assertExternal(db,actor,job.workspace_id);
          await lifecycle.assertLease(db);
          if (item.kind==='source') await readAiEvidence(db,await modelScope(),[item.id]);
        } } : undefined,
        send:async (messages,tools,canCallTools,round) => {
          const response=await attempt({ messages,tools,canCallTools,stepId,
            settle:journal ? (sql,response)=>journal.settleIn(sql,round,response) : undefined });
          if (!('toolCalls' in response)) throw new AppError(502,'PROVIDER_PROTOCOL_INVALID','Harness reply is missing streaming metadata');
          return response;
        },
      });
      await report('step.finished',{ status:'completed' },stepId);
      return text;
    } catch (error) {
      await report('step.finished',{ status:'failed',code:error instanceof AppError ? error.code : undefined },stepId).catch(()=>{});
      throw error;
    }
  }

  async function modelScope() {
    const input=job.input;
    const artifactId='artifact_id' in input.body ? input.body.artifact_id : undefined;
    const scope=artifactId && ['analysis','selection','learning','information'].includes(input.kind) ? await artifacts.get(actor,artifactId) :
      { workspace_id:job.workspace_id,project_id:input.kind==='research' ? input.body.project_id ?? null : null };
    if ('revision' in scope && scope.revision.id!==job.checkpoint.contract?.artifact_revision_id)
      throw conflict('CONFLICT_ARTIFACT_VERSION','Artifact changed before model invocation');
    return scope;
  }

  async function modelAttempt(policy:ModelBudget,prompt:PromptId,data:unknown,
    request?:StreamingAttempt):Promise<Completion|StreamCompletion> {
    await assertExternal(db,actor,job.workspace_id);
    if (!model || !job.checkpoint.contract) throw denied();
    const stream=request && streamingGateway;
    if (request && !stream) throw new AppError(503,'PROVIDER_UNAVAILABLE','Harness provider is unavailable');
    const references=contextReferences(data);
    const evidence=await readAiEvidence(db,await modelScope(),references.evidence_ids);
    signal.throwIfAborted();
    const { system,format }=prompts[prompt];
    const json=format==='json_object';
    const used=job.checkpoint.budget ?? { calls:0,tokens:0 };
    const reservedData=request ? { messages:request.messages,tools:request.tools,canCallTools:request.canCallTools } : data;
    const reserve=reserveModelBudget(policy,used,request ? '' : system,reservedData);
    const call=used.calls+1;
    const manifest=contextManifest(job.checkpoint.contract,prompt,reservedData,references,evidence,stream?.profile ?? model.profile,reserve.input,reserve.output,call);
    job.checkpoint.budget={ calls:call,tokens:used.tokens+reserve.input+reserve.output };
    await lifecycle.save('ModelBudgetReserved',{ calls:call,tokens:reserve.input+reserve.output },{ type:'ContextSnapshotCreated',payload:manifest });
    const runtime=job.checkpoint.runtime;
    if (runtime && request) await db.transaction(async sql => {
      await lifecycle.assertLease(sql,true);
      await appendRuntimeEvent(sql,runtime.id,'model.request',{ call,prompt_id:prompt },request.stepId);
    });
    signal.throwIfAborted();
    const started=Date.now();
    const response=await (stream && request ? stream.complete({ messages:request.messages,json,maxOutput:reserve.output,tools:request.tools,
      canCallTools:request.canCallTools },signal) : model.generate(system,data,reserve.output,signal,json)).catch(async error => {
      const reason=error instanceof AppError ? error.code : 'PROVIDER_REQUEST_FAILED';
      await lifecycle.record('ModelInvocationFailed',{ call,prompt_id:prompt,elapsed_ms:Date.now()-started,
        ...qualityFinding(reason,'provider') });
      if (runtime && request) await db.transaction(async sql => {
        await lifecycle.assertLease(sql,true);
        await appendRuntimeEvent(sql,runtime.id,'model.failed',{ call,code:reason },request.stepId);
      });
      throw error;
    });
    let failure:unknown;
    try {
      if (!(request?.canCallTools && response.finishReason==='tool_calls')) completionText(response,json);
    } catch (error) { failure=error; }
    const finding=failure instanceof AppError ? qualityFinding(failure.code,'provider') : undefined;
    const actual=used.tokens+response.input+response.output;
    job.checkpoint.budget={ calls:call,tokens:actual };
    await db.transaction(async sql => {
      await lifecycle.assertLease(sql,true);
      await sql.all(`INSERT INTO model_usage(id,workspace_id,run_id,provider,model,input_tokens,output_tokens)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),job.workspace_id,job.id,response.provider,response.model,response.input,response.output]);
      await lifecycle.event(sql,'ModelInvocationCompleted',{ call,prompt_id:prompt,provider:response.provider,model:response.model,
        finish_reason:response.finishReason,outcome:failure ? 'rejected' : 'completed',finding,elapsed_ms:Date.now()-started,
        input_tokens:response.input,output_tokens:response.output });
      if (runtime && request) {
        if (finding) await appendRuntimeEvent(sql,runtime.id,'model.failed',{ call,code:finding.reason },request.stepId);
        else await appendRuntimeEvent(sql,runtime.id,'model.response',{ call,finish_reason:response.finishReason,input_tokens:response.input,output_tokens:response.output },request.stepId);
      }
      await lifecycle.saveIn(sql,'ModelBudgetRecorded',{ calls:call,tokens:actual });
      if (!failure && actual<=policy.max_tokens && 'toolCalls' in response) await request?.settle?.(sql,response as StreamCompletion);
    });
    if (actual>policy.max_tokens) throw new BudgetExceeded();
    if (failure) throw failure;
    return response;
  }

  return callModel;
}
