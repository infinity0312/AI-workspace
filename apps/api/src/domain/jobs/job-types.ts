import { z } from 'zod';
import type { DocumentAnalysisInput,LearningRequest,TaskMode,RunStatus } from '@akw/contracts';
import type { Sql } from '../../platform/database';
import type { Actor } from '../../platform/security';
import type { AgentCheckpoint,ResearchInput } from '../../runtime/agent';
import type { CheckedAnalysis,DocumentResearchStages } from '../../runtime/document-research';
import type { RuntimeSession } from '../../runtime/harness/session';
import type { TaskContract } from '../../quality-engine/task-contract';
import type { PlannedStep,WeatherQuery } from '../../runtime/task-routing';
import type { InformationResult } from '../../runtime/information-retrieval';
import type { WeatherData } from '@akw/contracts';
import type { LearningStages } from '../../runtime/learning-workflow';
import type { ExportInput } from '../exports';

export const selectionInput = z.object({
  base_revision_id: z.uuid(),
  block_id: z.uuid(),
  inline_index: z.number().int().nonnegative(),
  start_utf16: z.number().int().nonnegative(),
  end_utf16: z.number().int().positive(),
  instruction: z.string().trim().min(1).max(1000),
  allow_external: z.literal(true),
}).strict();
export type Selection = z.infer<typeof selectionInput>;
export type JobInput =
  | { kind:'composition';body:{ workspace_id:string;goal:string;allow_external:true;steps:PlannedStep[] } }
  | { kind:'information';body:{ workspace_id:string;goal:string;allow_external:true;mode:TaskMode;weather?:WeatherQuery;artifact_id?:string;base_revision_id?:string;block_id?:string } }
  | { kind:'learning';body:LearningRequest & { artifact_id?:string;base_revision_id?:string } }
  | { kind: 'research'; body: ResearchInput }
  | { kind: 'ingest'; body: { source_id: string; refresh?: boolean } }
  | { kind: 'export'; body: ExportInput }
  | { kind: 'selection'; body: Selection & { artifact_id: string } }
  | { kind: 'analysis'; body: DocumentAnalysisInput & { artifact_id: string } };
type Checkpoint = AgentCheckpoint & {
  contract?:TaskContract;
  runtime?:RuntimeSession;
  budget?: { calls: number; tokens: number };
  embedding?: boolean;
  analysisPolicy?:number;
  researchPolicy?:number;
  checkedAnalysis?:CheckedAnalysis;
  documentStages?:Partial<DocumentResearchStages>;
  learningStages?:Partial<LearningStages>;
  compositionLearning?:Record<number,Partial<LearningStages>>;
  composition?:{ stage:string;completed:Record<number,import('./composition-execution').PreparedStep> };
  informationStage?:string;
  informationOutput?:InformationResult|WeatherData;
};
export interface Job {
  id: string;
  workspace_id: string;
  tenant_id: string;
  user_id: string;
  status: RunStatus;
  input: JobInput;
  checkpoint: Checkpoint;
  result: Record<string,unknown> | null;
  lease_id: string | null;
  attempts: number;
  updated_at: string;
  runtime_deadline_ms?:number;
}

export type JobLifecycle = {
  assertLease: (sql:Sql,lock?:boolean)=>Promise<void>;
  event: (sql:Sql,type:string,payload:Record<string,unknown>)=>Promise<void>;
  record: (type:string,payload:Record<string,unknown>)=>Promise<void>;
  saveIn: (sql:Sql,type:string,payload:Record<string,unknown>)=>Promise<void>;
  save: (type:string,payload:Record<string,unknown>,companion?:{ type:string;payload:Record<string,unknown> })=>Promise<void>;
  complete: (status:RunStatus,produce:(sql:Sql)=>Promise<Record<string,unknown>>)=>Promise<void>;
};

export type RunningJob = { job:Job;actor:Actor;signal:AbortSignal;lifecycle:JobLifecycle };
export type AnalysisInput = Extract<JobInput,{ kind:'analysis' }>['body'];
