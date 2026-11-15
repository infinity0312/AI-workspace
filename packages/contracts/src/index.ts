import { z } from 'zod';
import { informationAttrs,guideStepAttrs,weatherAttrs,taskGapAttrs } from './productivity';
import { learningLessonAttrs,learningGoalAttrs } from './learning';
import { artifactEmbedAttrs, checklistAttrs, chartAttrs, externalInlineAttrs, footnoteInlineAttrs, imageAttrs, knowledgeEmbedAttrs, sourceCardAttrs, tableAttrs, wikiInlineAttrs } from './workspace-blocks';
export * from './workspace-blocks';
export * from './chart-scene';
import { chronologyDate, isProjectionType, knowledgeNodeType, projectionAttrs } from './projection';
export * from './projection';
export * from './product';
export * from './learning';
export * from './productivity';
export { DocumentMergeConflict, mergeArtifactDocuments, sameContent } from './merge';

export const id = z.string().uuid();
export const title = z.string().trim().min(1).max(200);
export const json = z.json();
export const mode = z.enum(['cloud_managed', 'local_only', 'temporary_processing']);
export const sensitivity = z.enum(['public', 'personal', 'sensitive', 'restricted']);
export const policy = z.object({
  externalProviderAllowed: z.boolean().default(false),
  sensitivity: sensitivity.default('personal'),
}).strict();
export const inline = z.object({
  id: id.optional(),
  type: z.string().min(1).max(64),
  text: z.string().max(100_000).optional(),
  attrs: z.record(z.string(), json).optional(),
  marks: z.array(z.object({ type: z.string(), attrs: z.record(z.string(), json).optional() })).max(30).optional(),
}).passthrough();
export const block = z.object({
  id,
  type: z.string().min(1).max(64),
  attrs: z.record(z.string(), json).optional(),
  children: z.array(inline).max(2000).optional(),
}).passthrough();
export const artifactDocument = z.object({
  schema_version: z.literal('1.0'),
  blocks: z.array(block).max(2000),
  relations: z.object({ source_ids: z.array(id).max(1000), knowledge_node_ids: z.array(id).max(1000) }).strict(),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  const byId = new Map(value.blocks.map(item => [item.id,item]));
  for (const [index, item] of value.blocks.entries()) {
    if (ids.has(item.id)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'id'], message: 'Duplicate block ID' });
    ids.add(item.id);
    if (isProjectionType(item.type) && item.attrs?.view_version === 1 && !projectionAttrs.safeParse(item.attrs).success)
      ctx.addIssue({ code:'custom',path:['blocks',index,'attrs'],message:'Invalid knowledge projection configuration' });
    const schema = item.type === 'chart' && item.attrs?.chart_version === 1 ? chartAttrs :
      item.type === 'table' && item.attrs?.table_version === 1 ? tableAttrs :
      item.type === 'interactive' && item.attrs?.kind === 'checklist' ? checklistAttrs :
      item.type === 'task_gap' ? taskGapAttrs : item.type === 'information_summary' ? informationAttrs : item.type === 'guide_step' ? guideStepAttrs : item.type === 'weather_forecast' ? weatherAttrs :
      item.type === 'learning_goal' ? learningGoalAttrs : item.type === 'learning_lesson' ? learningLessonAttrs :
      item.type === 'source_embed' ? sourceCardAttrs : item.type === 'artifact_embed' ? artifactEmbedAttrs :
      item.type === 'knowledge_embed' && item.attrs?.node_id != null ? knowledgeEmbedAttrs :
      ['image','figure'].includes(item.type) && Object.hasOwn(item.attrs ?? {},'asset_id') ? imageAttrs : undefined;
    if (schema && !schema.safeParse(item.attrs).success) ctx.addIssue({ code:'custom',path:['blocks',index,'attrs'],message:'Invalid structured block attributes' });
    if (item.type === 'chart' && item.attrs?.chart_version === 1 && typeof item.attrs.table_id === 'string' && byId.get(item.attrs.table_id)?.type !== 'table')
      ctx.addIssue({ code:'custom',path:['blocks',index,'attrs','table_id'],message:'Chart requires an existing table in this document' });
    for (const [i,node] of (item.children ?? []).entries()) {
      const inline = node.type === 'wiki_link' ? wikiInlineAttrs : node.type === 'external_link' ? externalInlineAttrs :
        node.type === 'footnote' ? footnoteInlineAttrs : undefined;
      if (inline && !inline.safeParse(node.attrs).success)
        ctx.addIssue({ code:'custom',path:['blocks',index,'children',i,'attrs'],message:'Invalid inline reference' });
    }
  }
});
export const textPatch = z.object({
  type: z.literal('replace_text_range'),
  block_id: id,
  inline_index: z.number().int().min(0),
  start_utf16: z.number().int().min(0),
  end_utf16: z.number().int().min(0),
  expected_text: z.string().max(100_000),
  expected_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  text: z.string().max(100_000),
}).strict();
export const patchOperation = z.discriminatedUnion('type', [
  textPatch,
  z.object({ type: z.literal('update_block'), block_id: id, block }).strict(),
  z.object({ type: z.literal('insert_block'), after_id: id.nullable(), block }).strict(),
  z.object({ type: z.literal('remove_block'), block_id: id }).strict(),
  z.object({ type: z.literal('replace_document'), content: artifactDocument }).strict(),
]);
export const patchInput = z.object({
  base_revision_id: id,
  operations: z.array(patchOperation).min(1).max(100),
}).strict();
export const createArtifact = z.object({
  workspace_id: id,
  project_id: id.nullable().optional(),
  title,
  kind: z.enum(['note', 'document']).default('document'),
  content: artifactDocument.optional(),
}).strict();
export const workspaceInput = z.object({ name: title, policy: policy.optional() }).strict();
export const projectInput = z.object({ name: title, description: z.string().max(4000).default('') }).strict();
export const sourceInput = z.object({
  workspace_id: id,
  project_id: id.nullable().optional(),
  title,
  url: z.url({ protocol: /^https?$/ }).max(2048).optional(),
  text: z.string().trim().min(1).max(200_000).optional(),
  asset_id: id.optional(),
  sensitivity: sensitivity.default('personal'),
  rights: z.enum(['user_owned', 'public_license', 'restricted', 'unknown']).default('unknown'),
}).strict().refine(v => Number(Boolean(v.url && !v.text && !v.asset_id)) + Number(Boolean(v.text)) + Number(Boolean(v.asset_id)) === 1 &&
  !(v.text && v.asset_id), 'Provide URL, text, or asset');
export const assetMime = z.enum([
  'application/pdf','text/plain','text/markdown','text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png','image/jpeg',
]);
export type AssetMime = z.infer<typeof assetMime>;
export const officeMime = {
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;
const extensionMime: Record<string,AssetMime|undefined> = {
  pdf:'application/pdf',txt:'text/plain',md:'text/markdown',html:'text/html',htm:'text/html',
  ...officeMime,png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
};
export const fileExtensions = Object.keys(extensionMime).map(extension => '.' + extension).join(',');
export const assetMimeForName = (name: string) => {
  const extension = name.split('.').at(-1)?.toLowerCase();
  return extension && Object.hasOwn(extensionMime,extension) ? extensionMime[extension] : undefined;
};
export const uploadInput = z.object({
  workspace_id: id,
  name: title,
  mime: assetMime,
  data_base64: z.string().min(1).max(11_200_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  storage_mode: mode.default('cloud_managed'),
  visibility: z.enum(['workspace','capture']).default('workspace'),
  export_rights:z.enum(['user_owned','public_license','unknown','restricted']).default('unknown'),
}).strict();
export const studyAudience = z.enum(['beginner','high_school','undergraduate','postgraduate','specialist']);
export const runInput = z.object({
  workspace_id: id,
  project_id: id.nullable().optional(),
  goal: z.string().trim().min(1).max(3000),
  mode: z.enum(['simple', 'research']).default('research'),
  intent:z.enum(['learn','research']).optional(),
  audience:studyAudience.optional(),
  source_ids: z.array(id).max(12).default([]),
  allow_external: z.boolean().default(false),
  use_workspace:z.boolean().default(false),
  budget: z.object({
    max_calls: z.number().int().min(1).max(8).default(4),
    max_tokens: z.number().int().min(500).max(48_000).default(16_000),
    max_seconds: z.number().int().min(5).max(300).default(120),
  }).strict().default({ max_calls: 4, max_tokens: 16_000, max_seconds: 120 }),
}).strict();
export const documentAnalysisInput = z.object({
  base_revision_id: id,
  goal: z.string().trim().min(1).max(1500),
  source_id: id.optional(),
  include_document: z.boolean().default(false),
  required_questions:z.array(z.string().trim().min(1).max(100)).max(5).optional(),
  require_licensed_image:z.boolean().optional(),
  audience:studyAudience.optional(),
  required_source_urls:z.array(z.url({ protocol:/^https$/ }).max(2048)).max(4).optional(),
  use_web: z.boolean().default(true),
  use_workspace:z.boolean().default(false),
  allow_external: z.literal(true),
}).strict();
export type { RequirementItem,RequirementLedger,RequirementStage,RequirementStatus } from './requirement-ledger';
import type { RequirementLedger } from './requirement-ledger';

export type DocumentAnalysisInput = z.infer<typeof documentAnalysisInput>;
export type DocumentAnalysisRun = {
  id: string;
  status: RunStatus;
  goal: string;
  runtime_session_id?:string;
  result: { patch_id?:string;grounded?:boolean;warning?:string;coverage?:{ requested:number;supported:number };missing_requirements?:string[];requirement_ledger?:RequirementLedger } | null;
};
export const runStatus = z.enum(['QUEUED','PLANNING','RUNNING','PAUSED','COMPLETED','PARTIAL','FAILED','CANCELLED','BUDGET_EXHAUSTED']);
export const modelResearchResult = z.object({
  summary: z.string().min(1).max(24_000),
  claims: z.array(z.object({
    statement: z.string().trim().min(1).max(1200),
    scope: z.string().trim().min(1).max(800),
    evidence_ids: z.array(id).min(1).max(5),
  }).strict()).max(16),
}).strict();
export const evidenceInput = z.object({
  passage_id: id,
  start_utf16: z.number().int().min(0),
  end_utf16: z.number().int().positive(),
}).strict();
export const nodeInput = z.object({
  workspace_id: id, project_id: id.nullable().optional(), title,
  type:knowledgeNodeType,
  event_date:chronologyDate.nullable().optional(),
  event_evidence_id:id.nullable().optional(),
  description: z.string().max(4000).default(''),
}).strict();
export const edgeInput = z.object({
  workspace_id: id, from_node_id: id, to_node_id: id,
  relation_type: z.string().trim().min(1).max(80),
  evidence_id: id.optional(),
}).strict().refine(v => v.from_node_id !== v.to_node_id, 'Use two distinct nodes');
export const mutation = z.object({
  mutation_id: id, workspace_id: id, device_id: id, entity_type: z.literal('artifact'),
  entity_id: id, operation: z.literal('patch'), base_version: z.number().int().positive(),
  client_sequence: z.number().int().positive(), payload: patchInput,
  schema_version: z.literal('1.0'), created_at: z.iso.datetime(),
}).strict();
export const exportInput = z.object({
  workspace_id: id, artifact_id: id.optional(), revision_id: id.optional(), block_id: id.optional(),
  include_images:z.boolean().optional(),include_references:z.boolean().optional(),
  format: z.enum(['markdown', 'json', 'pdf', 'docx', 'svg', 'png', 'zip']),
}).strict().refine(v => v.format === 'zip' ? !(v.artifact_id || v.revision_id || v.block_id) : Boolean(v.artifact_id), 'Select an artifact or a workspace ZIP')
  .refine(v => !v.block_id || v.format === 'svg' || v.format === 'png', 'Select a visual format for a block export');
export const emptyDocument = (): ArtifactDocument => ({ schema_version: '1.0', blocks: [], relations: { source_ids: [], knowledge_node_ids: [] } });
export const eventEnvelope = z.object({
  event_id: id, event_type: z.string(), schema_version: z.literal('1.0'),
  tenant_id: z.string(), workspace_id: id, aggregate_type: z.string(),
  aggregate_id: id, aggregate_version: z.number().int().positive(), occurred_at: z.iso.datetime(),
  payload: z.record(z.string(), json),
});
export type ArtifactDocument = z.infer<typeof artifactDocument>;
export type Block = z.infer<typeof block>;
export type PatchInput = z.infer<typeof patchInput>;
export type Mutation = z.infer<typeof mutation>;
export type RunStatus = z.infer<typeof runStatus>;
export type EventEnvelope = z.infer<typeof eventEnvelope>;
export type ErrorResponse = { error: { code: string; message: string; retryable: boolean; details: unknown; trace_id: string } };
export type ArtifactRevision = { id: string; artifact_id: string; revision_number: number; parent_revision_id: string | null; content_json: ArtifactDocument; content_hash: string; author_type: string; created_at: string };
export type ArtifactDetail = { id: string; workspace_id: string; project_id: string | null; title: string; kind: 'note' | 'document'; canonical_revision_id: string; revision: ArtifactRevision };
export type WorkspaceSummary = { id: string; name: string; role: string; policy: z.infer<typeof policy> };
export type RunSummary = { id: string; workspace_id: string; goal: string; status: RunStatus; runtime_session_id?:string; result: { artifact_id?: string; response?: string; warning?: string } | null; updated_at: string };
