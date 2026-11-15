import { z } from 'zod';

const id = z.uuid();
const title = z.string().trim().min(1).max(200);
export const sourceMetadata = z.object({
  author:z.string().trim().max(250).optional(),
  published:z.string().trim().max(100).optional(),
  doi:z.string().trim().max(160).optional(),
}).strict();
export const storedSourceMetadata = sourceMetadata.extend({
  material_kind:z.enum(['encyclopedia','paper','image','report','dataset','web']).optional(), provider:z.string().max(60).optional(),
  journal:z.string().max(160).optional(), license:z.string().max(80).optional(), license_url:z.string().max(2048).optional(),
}).strict();
export const sourceChange = z.object({
  title:title.optional(), rights:z.enum(['user_owned','public_license','restricted','unknown']).optional(),
  sensitivity:z.enum(['public','personal','sensitive','restricted']).optional(), metadata:sourceMetadata.optional(),
  version:z.number().int().positive(),
}).strict();
export const sourceLifecycle = z.object({
  action:z.enum(['archive','restore','retract']),version:z.number().int().positive(),
}).strict();
export const claimInput = z.object({ workspace_id:id,statement:z.string().trim().min(1).max(1200),
  scope:z.string().trim().max(800).default(''),evidence_ids:z.array(id).min(1).max(12) }).strict();
export type ClaimInput = z.infer<typeof claimInput>;
export const claimDecision = z.object({
  decision:z.enum(['supported','partially_supported','disputed','unsupported','outdated','retracted']),
  reason:z.string().trim().max(1500).default(''),version:z.number().int().positive(),
}).strict();
export const artifactVersion = z.object({ base_revision_id:id }).strict();
export const revisionRestore = artifactVersion.extend({ revision_id:id }).strict();
export const artifactRename = artifactVersion.extend({ title,expected_title:title }).strict();
export const captureInput = z.object({
  workspace_id:id,title,
  text:z.string().trim().min(1).max(200_000).optional(),
  url:z.url({protocol:/^https?$/}).max(2048).optional(),asset_id:id.optional(),
  sensitivity:z.enum(['public','personal','sensitive','restricted']).default('personal'),
  rights:z.enum(['user_owned','public_license','restricted','unknown']).default('unknown'),
}).strict().refine(value => [value.text,value.url,value.asset_id].filter(Boolean).length === 1,'Choose one type of capture');
export const captureAction = z.object({
  action:z.enum(['note','source','dismiss','reopen']),project_id:id.nullable().optional(),
}).strict();
export type CaptureInput = z.infer<typeof captureInput>;
export type CaptureAction = z.infer<typeof captureAction>;
export type CaptureItem = {
  id:string; workspace_id:string; title:string; text_body:string|null; url:string|null; asset_id:string|null;
  status:'inbox'|'processed'|'dismissed'; result_kind:'note'|'source'|null; result_id:string|null;
  rights:CaptureInput['rights']; sensitivity:CaptureInput['sensitivity']; created_at:string;
};
export const studyGoalInput = z.object({
  workspace_id:id,title,notes:z.string().trim().max(3000).default(''),target_date:z.iso.date().optional(),
  artifact_id:id.optional(),steps:z.array(title).max(20).default([]),
}).strict();
export const studyGoalUpdate = z.object({ version:z.number().int().positive(),step_id:id.optional(),
  done:z.boolean().optional(),completed:z.boolean().optional(),
}).strict().refine(v => (v.step_id !== undefined && v.done !== undefined && v.completed === undefined) ||
  (v.step_id === undefined && v.done === undefined && v.completed !== undefined),'Choose a task or a goal status');
export const studyCardInput = z.object({
  workspace_id:id,artifact_id:id.optional(),question:z.string().trim().min(1).max(400),answer:z.string().trim().min(1).max(5000),
}).strict();
export const studyRating = z.enum(['again','hard','good','easy']);
export const studyReviewInput = z.object({ version:z.number().int().positive(),rating:studyRating }).strict();
export const versionInput = z.object({ version:z.number().int().positive() }).strict();
export type StudyGoalInput = z.infer<typeof studyGoalInput>;
export type StudyCardInput = z.infer<typeof studyCardInput>;
export type StudyRating = z.infer<typeof studyRating>;
export type StudyGoal = { id:string; title:string; notes:string; target_date:string|null; artifact_id:string|null;
  status:'active'|'completed'; version:number; steps:{ id:string; title:string; done:boolean }[] };
export type StudyCard = { id:string; artifact_id:string|null; question:string; answer:string; due_at:string;
  due:boolean; interval_minutes:number; streak:number; version:number };
const scheduleTarget = z.discriminatedUnion('kind',[
  z.object({ kind:z.literal('research'),goal:z.string().trim().min(1).max(3000),allow_external:z.boolean().default(false) }).strict(),
  z.object({ kind:z.literal('source'),source_id:id }).strict(),
]);
const scheduleCadence = z.number().int().min(1).max(720);
export const scheduleInput = z.object({ workspace_id:id,title,target:scheduleTarget,cadence_hours:scheduleCadence }).strict();
export const scheduleUpdate = z.object({ version:z.number().int().positive(),enabled:z.boolean(),cadence_hours:scheduleCadence.optional() }).strict();
export type ScheduleInput = z.infer<typeof scheduleInput>;
export type ScheduleUpdate = z.infer<typeof scheduleUpdate>;
export type Schedule = { id:string; title:string; target:ScheduleInput['target']; cadence_hours:number; enabled:boolean; next_run_at:string;
  last_run_at:string|null; last_job_id:string|null; last_skip_reason:string|null; version:number };
export const memberInput = z.object({ user_id:z.string().regex(/^[\w.:-]{1,128}$/),
  role:z.enum(['editor','viewer','remove']),version:z.number().int().nonnegative() }).strict();
export const commentInput = z.object({ revision_id:id,block_id:id.optional(),body:z.string().trim().min(1).max(3000) }).strict();
export const commentUpdate = z.object({ version:z.number().int().positive(),resolved:z.boolean() }).strict();
export type WorkspaceMember = { user_id:string; role:'owner'|'editor'|'viewer'; version:number };
export type CommentInput = z.infer<typeof commentInput>;
export type CommentUpdate = z.infer<typeof commentUpdate>;
export type ArtifactComment = { id:string; artifact_id:string; revision_id:string; block_id:string|null; author_id:string; original_author_id:string|null; body:string;
  version:number; created_at:string; resolved_at:string|null; resolved_by:string|null };
export const searchInput = z.object({ workspace_id:id,q:z.string().trim().min(1).max(150) }).strict();
export type SearchHit = { id:string; kind:'artifact'|'source'|'claim'|'node'|'capture'; title:string; excerpt:string };
export type ClaimReview = {
  id:string; statement:string; scope:string; status:string; version:number;
  evidence:{ id:string; quote:string; source_id:string; title:string; lifecycle:string }[];
  reviews:{ id:string; decision:string; reason:string; created_at:string }[];
};
