import { z } from 'zod';
import { AppError } from '../platform/errors';
import { sha256,stableJson } from '../platform/security';
import type { ModelProfile } from './model-output';
import { prompts,type PromptId } from './prompts';
import type { TaskContract } from './task-contract';

const contextShape=z.object({ evidence:z.array(z.object({
  id:z.uuid(),kind:z.string().optional(),source_id:z.uuid().optional(),
})).optional() });

export function contextReferences(data:unknown) {
  const parsed=contextShape.safeParse(data);
  if (!parsed.success) throw new AppError(422,'VALIDATION_SCHEMA','Invalid model context references');
  const evidence=parsed.data.evidence ?? [];
  return {
    evidence_ids:[...new Set(evidence.filter(item => item.kind==='source' || item.source_id).map(item => item.id))],
    candidate_ids:[...new Set(evidence.filter(item => item.kind!=='source' && !item.source_id).map(item => item.id))],
  };
}

export function contextManifest(contract:TaskContract,promptId:PromptId,data:unknown,references:ReturnType<typeof contextReferences>,
  evidence:{ id:string;snapshot_id:string }[],profile:ModelProfile|undefined,inputEstimate:number,outputLimit:number,call:number) {
  const { system,version,format,schema }=prompts[promptId];
  const prompt_hash=sha256(system);
  const profile_version=profile && sha256(stableJson(profile));
  return {
    call,contract_id:contract.id,contract_version:contract.version,artifact_revision_id:contract.artifact_revision_id,
    prompt_id:promptId,prompt_version:version,prompt_hash,schema,format,
    profile,profile_version,context_hash:sha256(stableJson({ contract,prompt_hash,format,profile_version,data,
      evidence:evidence.map(({ id,snapshot_id }) => ({ id,snapshot_id })) })),
    evidence_snapshots:evidence.map(({ id,snapshot_id }) => ({ id,snapshot_id })),
    estimated_input_tokens:inputEstimate,max_output_tokens:outputLimit,...references,
  };
}
