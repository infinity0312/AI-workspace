import { z } from 'zod';
import {
  artifactDocument, artifactRename, artifactVersion, captureAction, captureInput, claimDecision, claimInput, commentInput, commentUpdate, memberInput, createArtifact, documentAnalysisInput, edgeInput, edgeChange, eventEnvelope, evidenceInput, exportInput, id, mutation,
  nodeInput, nodeUpdate, workspaceProjection, taskRequest, weatherRefresh, browseRequest, sourceCollectionInput, learningRequest, learningFollowup, learningAssessment, patchInput, policy, projectInput, revisionRestore, scheduleInput, scheduleUpdate, searchInput, runInput, sourceChange, sourceInput, sourceLifecycle, studyCardInput, studyGoalInput, studyGoalUpdate, studyReviewInput, versionInput, title, uploadInput, workspaceInput,
} from '@akw/contracts';
import { inspectImport, restoreImport } from '../domain/imports';
import { selectionInput } from '../domain/jobs';

const add = z.object({ run_id:id,status:z.literal('QUEUED'),status_url:z.string(),events_url:z.string() });
const ws = z.object({ workspace_id:id });
const projectEdit = z.object({ name:title.optional(),description:z.string().max(4000).optional(),version:z.number().int().positive() }).strict();
const cursor = z.string().regex(/^\d{1,19}$/);
const apiError = z.object({ error:z.object({ code:z.string(),message:z.string(),retryable:z.boolean(),details:z.unknown(),trace_id:z.string() }) });
const page = z.object({ cursor:cursor.optional() });
const syncPage = ws.extend({ cursor:cursor.optional(),limit:z.number().int().min(1).max(200).optional() });
type Route = {
  path:string; method:'get'|'post'|'patch'; summary:string; body?:z.ZodType;
  query?:z.ZodObject; response?:z.ZodType; code?:number; download?:boolean; unauthenticated?:boolean;
};
const routes: Route[] = [
  { method:'get',path:'/health',summary:'Service health',unauthenticated:true },
  { method:'get',path:'/openapi.json',summary:'OpenAPI contract',unauthenticated:true },
  { method:'get',path:'/workspaces',summary:'List accessible workspaces' },
  { method:'post',path:'/workspaces',summary:'Create workspace',body:workspaceInput },
  { method:'get',path:'/workspaces/{id}',summary:'Read workspace' },
  { method:'patch',path:'/workspaces/{id}/policy',summary:'Update workspace data policy',body:policy },
  { method:'get',path:'/workspaces/{id}/projects',summary:'List workspace projects' },
  { method:'post',path:'/workspaces/{id}/projects',summary:'Create project',body:projectInput },
  { method:'patch',path:'/projects/{id}',summary:'Update project with optimistic version check',body:projectEdit },
  { method:'post',path:'/projects/{id}/relations',summary:'Explicitly link a project',body:z.object({ to_project_id:id }) },
  { method:'get',path:'/workspaces/{id}/trash',summary:'List documents in the workspace trash' },
  { method:'post',path:'/artifacts/{id}/trash',summary:'Move an exact document revision to the trash',body:artifactVersion,code:200 },
  { method:'post',path:'/artifacts/{id}/restore',summary:'Restore a trashed document',body:artifactVersion,code:200 },
  { method:'post',path:'/artifacts/{id}/revisions/restore',summary:'Restore historical content as a new revision',body:revisionRestore,code:200 },
  { method:'patch',path:'/artifacts/{id}/metadata',summary:'Rename a document with an optimistic check',body:artifactRename },
  { method:'get',path:'/search',summary:'Search current workspace content and personal captures',query:searchInput },
  { method:'get',path:'/capture-items',summary:'List private capture items',query:ws },
  { method:'post',path:'/capture-items',summary:'Capture material for later organization',body:captureInput },
  { method:'post',path:'/capture-items/{id}/process',summary:'Convert, dismiss or reopen a capture item',body:captureAction,code:200 },
  { method:'get',path:'/workspaces/{id}/members',summary:'List workspace member roles' },
  { method:'patch',path:'/workspaces/{id}/members',summary:'Change access for an existing tenant account',body:memberInput },
  { method:'get',path:'/artifacts/{id}/comments',summary:'Read document comments and revision anchors' },
  { method:'post',path:'/artifacts/{id}/comments',summary:'Post a comment anchored to a document revision',body:commentInput },
  { method:'patch',path:'/artifacts/{id}/comments/{comment}',summary:'Resolve or reopen a document comment',body:commentUpdate },
  { method:'get',path:'/schedules',summary:'Read private research and source monitoring schedules',query:ws },
  { method:'post',path:'/schedules',summary:'Create a recurring research or source check',body:scheduleInput },
  { method:'patch',path:'/schedules/{id}',summary:'Pause, resume or reschedule monitoring',body:scheduleUpdate },
  { method:'get',path:'/study',summary:'Read personal learning goals and review cards',query:ws },
  { method:'post',path:'/study/goals',summary:'Create a learning goal',body:studyGoalInput },
  { method:'patch',path:'/study/goals/{id}',summary:'Update goal or step progress',body:studyGoalUpdate },
  { method:'post',path:'/study/cards',summary:'Create a spaced review card',body:studyCardInput },
  { method:'post',path:'/study/cards/{id}/review',summary:'Record recall and schedule the next review',body:studyReviewInput,code:200 },
  { method:'post',path:'/study/cards/{id}/archive',summary:'Archive a review card',body:versionInput,code:200 },
  { method:'get',path:'/knowledge/maintenance',summary:'List claims and source issues for review',query:ws },
  { method:'post',path:'/knowledge/claims',summary:'Propose a claim using existing located evidence',body:claimInput },
  { method:'get',path:'/knowledge/claims/{id}',summary:'Read claim evidence and review history' },
  { method:'post',path:'/knowledge/claims/{id}/review',summary:'Record a human claim decision',body:claimDecision,code:200 },
  { method:'patch',path:'/sources/{id}/metadata',summary:'Update source classification, rights and bibliography',body:sourceChange },
  { method:'post',path:'/sources/{id}/lifecycle',summary:'Archive, restore or retract a source',body:sourceLifecycle,code:200 },
  { method:'post',path:'/sources/{id}/revalidate',summary:'Recheck an importable source and preserve snapshots',response:add,code:202 },
  { method:'get',path:'/artifacts',summary:'List artifacts',query:ws },
  { method:'post',path:'/artifacts',summary:'Create artifact and first revision',body:createArtifact },
  { method:'get',path:'/artifacts/{id}',summary:'Read artifact and canonical revision' },
  { method:'get',path:'/artifacts/{id}/revisions',summary:'Read immutable revisions' },
  { method:'post',path:'/artifacts/{id}/revisions',summary:'Commit user edits',body:patchInput },
  { method:'get',path:'/artifacts/{id}/patches',summary:'List patch proposals' },
  { method:'post',path:'/artifacts/{id}/patches',summary:'Create a patch proposal',body:patchInput },
  { method:'post',path:'/artifacts/{id}/patches/{patchId}/accept',summary:'Accept an eligible proposal',code:200 },
  { method:'post',path:'/artifacts/{id}/patches/{patchId}/reject',summary:'Reject a proposal',code:200 },
  { method:'post',path:'/research-runs/{id}/save-answer',summary:'Save a completed answer as a workspace note',code:200 },
  { method:'get',path:'/artifacts/{id}/analysis-runs',summary:'List analysis runs for a document' },
  { method:'post',path:'/artifacts/{id}/analysis-runs',summary:'Queue analysis as a proposal for the current document',body:documentAnalysisInput,response:add,code:202 },
  { method:'get',path:'/runtime-runs/{id}',summary:'Read runtime session status and event watermark' },
  { method:'get',path:'/runtime-runs/{id}/events',summary:'Read authorized runtime session events after a cursor',query:page },
  { method:'post',path:'/runtime-runs/{id}/cancel',summary:'Cancel a runtime session',code:200 },
  { method:'get',path:'/artifact-analysis-runs/{id}',summary:'Read document analysis status' },
  { method:'get',path:'/artifact-analysis-runs/{id}/events',summary:'Read document analysis events',query:page },
  { method:'post',path:'/artifacts/{id}/ai-patch-runs',summary:'Queue a selection rewrite',body:selectionInput,response:add,code:202 },
  { method:'get',path:'/ai-patch-runs/{id}',summary:'Read a selection rewrite run' },
  { method:'get',path:'/ai-patch-runs/{id}/events',summary:'Read selection rewrite events',query:page },
  { method:'post',path:'/assets',summary:'Upload an asset',body:uploadInput },
  { method:'get',path:'/assets/{id}',summary:'Read asset metadata' },
  { method:'get',path:'/assets/{id}/pdf-preview',summary:'Read a bounded PDF for the workspace reader' },
  { method:'get',path:'/assets/{id}/preview',summary:'Read a bounded workspace image preview' },
  { method:'get',path:'/assets/{id}/download',summary:'Download a permission-checked asset',download:true },
  { method:'get',path:'/sources',summary:'List sources',query:ws },
  { method:'post',path:'/sources',summary:'Register text, URL or asset source',body:sourceInput },
  { method:'get',path:'/sources/{id}',summary:'Read source, documents and passages' },
  { method:'get',path:'/sources/{id}/dependencies',summary:'Read source evidence and claims' },
  { method:'post',path:'/sources/{id}/ingest',summary:'Queue source ingestion',response:add,code:202 },
  { method:'post',path:'/sources/{id}/evidence',summary:'Create evidence from a source range',body:evidenceInput },
  { method:'get',path:'/evidence/{id}',summary:'Read evidence and locator' },
  { method:'get',path:'/ingestion-runs/{id}',summary:'Read source ingestion status' },
  { method:'get',path:'/ingestion-runs/{id}/events',summary:'Read source ingestion events',query:page },
  { method:'get',path:'/knowledge/graph',summary:'Read workspace nodes and edges',query:ws },
  { method:'get',path:'/knowledge/nodes',summary:'Read knowledge nodes',query:ws },
  { method:'get',path:'/knowledge/edges',summary:'Read knowledge edges',query:ws },
  { method:'get',path:'/artifacts/{id}/projection',summary:'Read the scoped canonical graph for artifact views',response:workspaceProjection },
  { method:'get',path:'/knowledge/nodes/{id}/backlinks',summary:'Find canonical documents referencing the knowledge node' },
  { method:'patch',path:'/knowledge/edges/{id}',summary:'Withdraw or propose a revision to a confirmed relation',body:edgeChange },
  { method:'patch',path:'/knowledge/nodes/{id}',summary:'Update a knowledge node and chronology date',body:nodeUpdate },
  { method:'post',path:'/knowledge/nodes',summary:'Create knowledge node',body:nodeInput },
  { method:'post',path:'/knowledge/edges/suggestions',summary:'Propose a knowledge edge',body:edgeInput },
  { method:'post',path:'/knowledge/reviews/{id}/resolve',summary:'Resolve a knowledge edge proposal',body:z.object({ decision:z.enum(['confirmed','rejected']) }),code:200 },
  { method:'post',path:'/browse/search',summary:'Search web or public catalog results without generation',body:browseRequest,code:200 },
  { method:'post',path:'/browse/collections',summary:'Save selected webpages in one artifact',body:sourceCollectionInput },
  { method:'post',path:'/tasks',summary:'Route a natural-language task automatically',body:taskRequest,response:add.extend({ kind:z.enum(['learning','information','composition']),mode:z.enum(['weather','guide','information']).optional(),steps:z.array(z.object({ capability:z.string(),goal:z.string() })).optional() }),code:202 },
  { method:'get',path:'/tasks/{id}',summary:'Read task category, stage and artifact outcome' },
  { method:'get',path:'/tasks/{id}/events',summary:'Read durable events for a user task',query:page },
  { method:'post',path:'/artifacts/{id}/weather-refresh',summary:'Update a forecast on the same artifact',body:weatherRefresh,response:add,code:202 },
  { method:'post',path:'/learning-runs',summary:'Start a goal-directed learning artifact',body:learningRequest,response:add,code:202 },
  { method:'get',path:'/learning-runs/{id}',summary:'Read the current learning stage and artifact outcome' },
  { method:'get',path:'/artifacts/{id}/learning-followup',summary:'Read the latest follow-up for the current learner' },
  { method:'post',path:'/artifacts/{id}/learning-followup',summary:'Continue learning in the current artifact',body:learningFollowup,response:add,code:202 },
  { method:'get',path:'/artifacts/{id}/learning-mastery',summary:'Read the learner’s private practice record' },
  { method:'post',path:'/artifacts/{id}/learning-mastery',summary:'Grade practice against the current artifact revision',body:learningAssessment,code:200 },
  { method:'get',path:'/research-runs',summary:'List research runs',query:ws },
  { method:'post',path:'/research-runs',summary:'Queue a research or answer task',body:runInput,response:add,code:202 },
  { method:'get',path:'/research-runs/{id}',summary:'Read research run' },
  { method:'get',path:'/research-runs/{id}/events',summary:'Read durable research events',query:page },
  ...(['pause','resume','cancel'] as const).map(action => ({ method:'post' as const,path:'/research-runs/{id}/' + action,summary:action + ' research run',code:200 })),
  { method:'get',path:'/exports',summary:'List export jobs',query:ws },
  { method:'post',path:'/exports',summary:'Queue an export',body:exportInput,response:add,code:202 },
  { method:'get',path:'/exports/{id}',summary:'Read export status' },
  { method:'get',path:'/exports/{id}/events',summary:'Read export events',query:page },
  { method:'get',path:'/exports/{id}/download',summary:'Download completed export',download:true },
  { method:'post',path:'/imports/dry-run',summary:'Validate a workspace archive and report exclusions',body:inspectImport,code:200 },
  { method:'post',path:'/imports',summary:'Restore an inspected archive as a new workspace',body:restoreImport },
  { method:'get',path:'/usage',summary:'Read recorded model token usage',query:ws },
  { method:'post',path:'/sync/mutations',summary:'Acknowledge versioned mutations. Read the change feed to advance the pull cursor.',body:z.object({ mutations:z.array(mutation).min(1).max(20) }),code:200 },
  { method:'get',path:'/sync/changes',summary:'Read incremental change feed',query:syncPage },
  { method:'post',path:'/sync/snapshot',summary:'Read a consistent artifact and project snapshot',body:ws,code:200 },
  { method:'post',path:'/sync/ack',summary:'Acknowledge a change feed cursor',body:ws.extend({ device_id:id,cursor }),code:200 },
  { method:'get',path:'/devices',summary:'List current actor devices',query:ws },
];
export function openapi() {
  let schemaIndex = 0;
  const schema = (input: z.ZodType) => {
    const json = z.toJSONSchema(input,{ io:'input',target:'draft-2020-12',unrepresentable:'any' });
    delete json.$schema;
    if (json.$defs) json.$id = 'urn:akw:contract:' + (++schemaIndex);
    return json;
  };
  const paths: Record<string,Record<string,unknown>> = {};
  for (const route of routes) {
    const parameters: unknown[] = [...route.path.matchAll(/\{(\w+)\}/g)].map(match =>
      ({ name:match[1],in:'path',required:true,schema:{ type:'string',format:'uuid' } }));
    for (const [name,type] of Object.entries(route.query?.shape ?? {}) as [string,z.ZodType][]) {
      parameters.push({ name,in:'query',required:!type.isOptional(),schema:schema(type) });
    }
    if (route.method !== 'get') parameters.push({ name:'Idempotency-Key',in:'header',required:false,schema:{ type:'string',maxLength:128 } });
    const code = route.code ?? (route.method === 'post' ? 201 : 200);
    const format = route.download ? { 'application/octet-stream':{ schema:{ type:'string',format:'binary' } } }
      : { 'application/json':{ schema:route.response ? schema(route.response) : {} } };
    const operation = {
      summary:route.summary, ...(route.unauthenticated ? { security:[] } : {}), parameters,
      ...(route.body ? { requestBody:{ required:true,content:{ 'application/json':{ schema:schema(route.body) } } } } : {}),
      responses:{ [code]:{ description:'Success',content:format },default:{ description:'Error',content:{ 'application/json':{ schema:{ $ref:'#/components/schemas/Error' } } } } },
    };
    (paths[route.path] ??= {})[route.method] = operation;
  }
  return {
    openapi:'3.1.0', info:{ title:'AI Knowledge Workspace API',version:'0.1.0' },servers:[{ url:'/v1' }],
    security:[{ bearerAuth:[] }], paths,
    components:{
      securitySchemes:{ bearerAuth:{ type:'http',scheme:'bearer',bearerFormat:'JWT' } },
      schemas:{ Error:schema(apiError),ArtifactDocument:schema(artifactDocument),Mutation:schema(mutation),DomainEvent:schema(eventEnvelope) },
    },
  };
}
