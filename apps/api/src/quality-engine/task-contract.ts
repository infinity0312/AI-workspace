import { conflict } from '../platform/errors';
import { sha256,stableJson } from '../platform/security';

const output = {
  research:'research-result.v1',
  learning:'learning-artifact.v1',
  information:'information-artifact.v1',
  composition:'capability-plan.v1',
  analysis:'analysis-patch.v1',
  selection:'selection-patch.v1',
} as const;

type TaskKind = keyof typeof output;

export type TaskContract = {
  id:string;
  version:1;
  kind:TaskKind;
  request_hash:string;
  output_schema:string;
  artifact_revision_id?:string;
};

// The job input is the canonical request. The contract binds that input to its run and workspace.
export function taskContract(runId:string,workspaceId:string,input:{ kind:string;body:unknown }):TaskContract|undefined {
  if (!Object.hasOwn(output,input.kind)) return;
  const kind=input.kind as TaskKind;
  const body=input.body as { base_revision_id?:string };
  return { id:runId,version:1,kind,request_hash:sha256(stableJson({ runId,workspaceId,input })),
    output_schema:output[kind],artifact_revision_id:body.base_revision_id };
}

export function verifyTaskContract(stored:TaskContract,current:TaskContract) {
  if (stableJson(stored)!==stableJson(current))
    throw conflict('QUALITY_CONTRACT_MISMATCH','The run input no longer matches its task contract');
}
