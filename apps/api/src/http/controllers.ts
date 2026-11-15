import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createArtifact, documentAnalysisInput, edgeInput, evidenceInput, exportInput, id, mutation, nodeInput, patchInput, policy,
  projectInput, runInput, taskRequest, weatherRefresh, browseRequest, sourceCollectionInput, learningRequest, learningFollowup, learningAssessment, sourceInput, title, uploadInput, workspaceInput,
} from '@akw/contracts';
import { selectionInput } from '../domain/jobs';
import { inspectImport, restoreImport } from '../domain/imports';
import { openapi } from './openapi';
import { parse } from '../platform/errors';
import { browseWeb,collectLinks } from '../domain/workspace-browsing';
import { authenticate } from '../platform/security';
import { SERVICES, type Services } from '../services';

const cursor = z.string().regex(/^(?:0|[1-9][0-9]{0,18})$/).refine(v => BigInt(v) <= 9223372036854775807n);
const wsQuery = z.object({ workspace_id: id });
const cursorQuery = z.object({ cursor: cursor.default('0') });
const projectEdit = z.object({ name: title.optional(), description: z.string().max(4000).optional(), version: z.number().int().positive() }).strict()
  .refine(v => v.name !== undefined || v.description !== undefined);
const projectRelation = z.object({ to_project_id: id }).strict();
const reviewEdge = z.object({ decision: z.enum(['confirmed','rejected']) }).strict();
const mutationBatch = z.object({ mutations: z.array(mutation).min(1).max(20) }).strict();
const syncAck = z.object({ workspace_id: id, device_id: id, cursor }).strict();
const syncChanges = wsQuery.extend({ cursor: cursor.default('0'), limit: z.coerce.number().int().min(1).max(200).default(100) });

@Controller('v1')
export class CoreController {
  constructor(@Inject(SERVICES) private readonly app: Services) {}

  @Get('health') health() { return { status: 'ok', api_version: 'v1', artifact_schema: '1.0' }; }
  @Get('openapi.json') contract() { return openapi(); }

  @Get('workspaces') workspaces(@Req() req: Request) { return this.app.workspaces.list(authenticate(req)); }
  @Post('workspaces') createWorkspace(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.workspaces.create(authenticate(req),parse(workspaceInput,body),key);
  }
  @Get('workspaces/:id') workspace(@Req() req: Request,@Param('id') value: string) {
    return this.app.workspaces.get(authenticate(req),parse(id,value));
  }
  @Patch('workspaces/:id/policy') updatePolicy(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.workspaces.updatePolicy(authenticate(req),parse(id,value),parse(policy,body),key);
  }
  @Get('workspaces/:id/projects') projects(@Req() req: Request,@Param('id') value: string) {
    return this.app.workspaces.projects(authenticate(req),parse(id,value));
  }
  @Post('workspaces/:id/projects') project(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.workspaces.createProject(authenticate(req),parse(id,value),parse(projectInput,body),key);
  }
  @Patch('projects/:id') editProject(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.workspaces.updateProject(authenticate(req),parse(id,value),parse(projectEdit,body),key);
  }
  @Post('projects/:id/relations') relateProjects(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.workspaces.relateProjects(authenticate(req),parse(id,value),parse(projectRelation,body).to_project_id,key);
  }
  @Get('artifacts') artifacts(@Req() req: Request,@Query() query: unknown) {
    return this.app.artifacts.list(authenticate(req),parse(wsQuery,query).workspace_id);
  }
  @Post('artifacts') createArtifact(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.artifacts.create(authenticate(req),parse(createArtifact,body),key);
  }
  @Get('artifacts/:id') artifact(@Req() req: Request,@Param('id') value: string) {
    return this.app.artifacts.get(authenticate(req),parse(id,value));
  }
  @Get('artifacts/:id/revisions') revisions(@Req() req: Request,@Param('id') value: string) {
    return this.app.artifacts.revisions(authenticate(req),parse(id,value));
  }
  @Post('artifacts/:id/revisions') edit(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.artifacts.edit(authenticate(req),parse(id,value),parse(patchInput,body),key);
  }
  @Get('artifacts/:id/patches') patches(@Req() req: Request,@Param('id') value: string) {
    return this.app.artifacts.patches(authenticate(req),parse(id,value));
  }
  @Post('artifacts/:id/patches') propose(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.artifacts.propose(authenticate(req),parse(id,value),parse(patchInput,body),key);
  }
  @Post('artifacts/:id/patches/:patchId/accept') @HttpCode(200)
  accept(@Req() req: Request,@Param('id') value: string,@Param('patchId') patch: string,@Headers('idempotency-key') key?: string) {
    return this.app.artifacts.resolve(authenticate(req),parse(id,value),parse(id,patch),true,key);
  }
  @Post('artifacts/:id/patches/:patchId/reject') @HttpCode(200)
  reject(@Req() req: Request,@Param('id') value: string,@Param('patchId') patch: string,@Headers('idempotency-key') key?: string) {
    return this.app.artifacts.resolve(authenticate(req),parse(id,value),parse(id,patch),false,key);
  }
  @Get('artifacts/:id/analysis-runs') analyses(@Req() req: Request,@Param('id') value: string) {
    return this.app.jobs.analyses(authenticate(req),parse(id,value));
  }
  @Post('artifacts/:id/analysis-runs') @HttpCode(202)
  analysis(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.jobs.analysis(authenticate(req),parse(id,value),parse(documentAnalysisInput,body),key);
  }
  @Post('artifacts/:id/ai-patch-runs') @HttpCode(202)
  selection(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.jobs.selection(authenticate(req),parse(id,value),parse(selectionInput,body),key);
  }
}

@Controller('v1')
export class KnowledgeController {
  constructor(@Inject(SERVICES) private readonly app: Services) {}

  @Post('assets') upload(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.knowledge.upload(authenticate(req),parse(uploadInput,body),key);
  }
  @Get('assets/:id') async asset(@Req() req: Request,@Param('id') value: string) {
    const asset = await this.app.knowledge.asset(authenticate(req),parse(id,value));
    return { id: asset.id,workspace_id: asset.workspace_id,filename: asset.filename,mime: asset.mime,size_bytes: asset.size_bytes,storage_mode: asset.storage_mode };
  }
  @Get('assets/:id/preview') preview(@Req() req:Request,@Param('id') value:string) {
    return this.app.knowledge.imagePreview(authenticate(req),parse(id,value));
  }
  @Get('assets/:id/pdf-preview') pdfPreview(@Req() req:Request,@Param('id') value:string) {
    return this.app.knowledge.pdfPreview(authenticate(req),parse(id,value));
  }
  @Get('assets/:id/download') async download(@Req() req: Request,@Param('id') value: string) {
    const { asset,bytes } = await this.app.knowledge.readAsset(authenticate(req),parse(id,value));
    const encoded = encodeURIComponent(asset.filename).replace(/['()*]/g,c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return new StreamableFile(bytes,{ type: 'application/octet-stream', disposition: "attachment; filename*=UTF-8''" + encoded });
  }
  @Get('sources') sources(@Req() req: Request,@Query() query: unknown) {
    return this.app.knowledge.listSources(authenticate(req),parse(wsQuery,query).workspace_id);
  }
  @Post('sources') source(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.knowledge.register(authenticate(req),parse(sourceInput,body),key);
  }
  @Get('sources/:id') sourceDetail(@Req() req: Request,@Param('id') value: string) {
    return this.app.knowledge.sourceDetails(authenticate(req),parse(id,value));
  }
  @Get('sources/:id/dependencies') dependencies(@Req() req: Request,@Param('id') value: string) {
    return this.app.knowledge.sourceDependencies(authenticate(req),parse(id,value));
  }
  @Post('sources/:id/ingest') @HttpCode(202)
  ingest(@Req() req: Request,@Param('id') value: string,@Headers('idempotency-key') key?: string) {
    return this.app.jobs.ingest(authenticate(req),parse(id,value),key);
  }
  @Post('sources/:id/evidence') evidence(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.knowledge.createEvidence(authenticate(req),parse(id,value),parse(evidenceInput,body),key);
  }
  @Get('evidence/:id') evidenceDetail(@Req() req: Request,@Param('id') value: string) {
    return this.app.knowledge.evidence(authenticate(req),parse(id,value));
  }
  @Get('knowledge/graph') graph(@Req() req: Request,@Query() query: unknown) {
    return this.app.knowledge.graph(authenticate(req),parse(wsQuery,query).workspace_id);
  }
  @Get('knowledge/nodes') async nodes(@Req() req: Request,@Query() query: unknown) { return (await this.graph(req,query)).nodes; }
  @Get('knowledge/edges') async edges(@Req() req: Request,@Query() query: unknown) { return (await this.graph(req,query)).edges; }
  @Post('knowledge/nodes') node(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.knowledge.createNode(authenticate(req),parse(nodeInput,body),key);
  }
  @Post('knowledge/edges/suggestions') edge(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.knowledge.proposeEdge(authenticate(req),parse(edgeInput,body),key);
  }
  @Post('knowledge/reviews/:id/resolve') @HttpCode(200)
  review(@Req() req: Request,@Param('id') value: string,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.knowledge.reviewEdge(authenticate(req),parse(id,value),parse(reviewEdge,body).decision,key);
  }
}

@Controller('v1')
export class RunsController {
  constructor(@Inject(SERVICES) private readonly app: Services) {}
  @Post('browse/search') @HttpCode(200)
  browse(@Req() req:Request,@Body() body:unknown) {
    const signal=new AbortController();
    return browseWeb(this.app,authenticate(req),parse(browseRequest,body),signal.signal);
  }
  @Post('browse/collections')
  collection(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return collectLinks(this.app,authenticate(req),parse(sourceCollectionInput,body),key);
  }
  @Post('tasks') @HttpCode(202)
  createTask(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.jobs.task(authenticate(req),parse(taskRequest,body),key);
  }
  @Get('tasks/:id') task(@Req() req:Request,@Param('id') value:string) {
    return this.app.jobs.getTask(authenticate(req),parse(id,value));
  }
  @Get('tasks/:id/events') taskEvents(@Req() req:Request,@Param('id') value:string,@Query() query:unknown) {
    return this.app.jobs.taskEvents(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor);
  }
  @Post('artifacts/:id/weather-refresh') @HttpCode(202)
  refreshForecast(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.jobs.refreshWeather(authenticate(req),parse(id,value),parse(weatherRefresh,body),key);
  }
  @Post('learning-runs') @HttpCode(202)
  createLearning(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.jobs.learning(authenticate(req),parse(learningRequest,body),key);
  }
  @Get('learning-runs/:id') learning(@Req() req:Request,@Param('id') value:string) {
    return this.app.jobs.getLearning(authenticate(req),parse(id,value));
  }
  @Get('artifacts/:id/learning-followup') latestLearning(@Req() req:Request,@Param('id') value:string) {
    return this.app.jobs.latestLearning(authenticate(req),parse(id,value));
  }
  @Post('artifacts/:id/learning-followup') @HttpCode(202)
  followLearning(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.jobs.followLearning(authenticate(req),parse(id,value),parse(learningFollowup,body),key);
  }
  @Get('artifacts/:id/learning-mastery') mastery(@Req() req:Request,@Param('id') value:string) {
    return this.app.learning.mastery(authenticate(req),parse(id,value));
  }
  @Post('artifacts/:id/learning-mastery') @HttpCode(200)
  assessLearning(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.learning.submit(authenticate(req),parse(id,value),parse(learningAssessment,body),key);
  }
  @Get('research-runs') list(@Req() req: Request,@Query() query: unknown) {
    return this.app.jobs.list(authenticate(req),parse(wsQuery,query).workspace_id,'research');
  }
  @Post('research-runs') @HttpCode(202)
  create(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.jobs.research(authenticate(req),parse(runInput,body),key);
  }
  @Get('research-runs/:id') get(@Req() req: Request,@Param('id') value: string) {
    return this.app.jobs.get(authenticate(req),parse(id,value),'research');
  }
  @Get('research-runs/:id/events') events(@Req() req: Request,@Param('id') value: string,@Query() query: unknown) {
    return this.app.jobs.events(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor,'research');
  }
  @Post('research-runs/:id/save-answer') @HttpCode(200)
  saveAnswer(@Req() req:Request,@Param('id') value:string) {
    return this.app.jobs.saveAnswer(authenticate(req),parse(id,value));
  }
  @Post('research-runs/:id/:action') @HttpCode(200)
  command(@Req() req: Request,@Param('id') value: string,@Param('action') action: string,@Headers('idempotency-key') key?: string) {
    return this.app.jobs.command(authenticate(req),parse(id,value),parse(z.enum(['pause','resume','cancel']),action),key);
  }
  @Get('runtime-runs/:id') runtimeStatus(@Req() req:Request,@Param('id') value:string) {
    return this.app.jobs.runtimeStatus(authenticate(req),parse(id,value));
  }
  @Get('runtime-runs/:id/events') runtimeTimeline(@Req() req:Request,@Param('id') value:string,@Query() query:unknown) {
    return this.app.jobs.runtimeTimeline(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor);
  }
  @Post('runtime-runs/:id/cancel') @HttpCode(200)
  cancelRuntime(@Req() req:Request,@Param('id') value:string,@Headers('idempotency-key') key?:string) {
    return this.app.jobs.command(authenticate(req),parse(id,value),'cancel',key,true);
  }
  @Get('ingestion-runs/:id') ingest(@Req() req: Request,@Param('id') value: string) {
    return this.app.jobs.get(authenticate(req),parse(id,value),'ingest');
  }
  @Get('ingestion-runs/:id/events') ingestEvents(@Req() req: Request,@Param('id') value: string,@Query() query: unknown) {
    return this.app.jobs.events(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor,'ingest');
  }
  @Get('artifact-analysis-runs/:id') analysis(@Req() req: Request,@Param('id') value: string) {
    return this.app.jobs.get(authenticate(req),parse(id,value),'analysis');
  }
  @Get('artifact-analysis-runs/:id/events') analysisEvents(@Req() req: Request,@Param('id') value: string,@Query() query: unknown) {
    return this.app.jobs.events(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor,'analysis');
  }
  @Get('ai-patch-runs/:id') selection(@Req() req: Request,@Param('id') value: string) {
    return this.app.jobs.get(authenticate(req),parse(id,value),'selection');
  }
  @Get('ai-patch-runs/:id/events') selectionEvents(@Req() req: Request,@Param('id') value: string,@Query() query: unknown) {
    return this.app.jobs.events(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor,'selection');
  }
  @Get('exports') listExports(@Req() req: Request,@Query() query: unknown) {
    return this.app.jobs.list(authenticate(req),parse(wsQuery,query).workspace_id,'export');
  }
  @Post('exports') @HttpCode(202)
  createExport(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.jobs.export(authenticate(req),parse(exportInput,body),key);
  }
  @Get('exports/:id') export(@Req() req: Request,@Param('id') value: string) {
    return this.app.jobs.get(authenticate(req),parse(id,value),'export');
  }
  @Get('exports/:id/events') exportEvents(@Req() req: Request,@Param('id') value: string,@Query() query: unknown) {
    return this.app.jobs.events(authenticate(req),parse(id,value),parse(cursorQuery,query).cursor,'export');
  }
  @Get('exports/:id/download') async download(@Req() req: Request,@Param('id') value: string,@Res({ passthrough: true }) res: Response) {
    const result = await this.app.jobs.download(authenticate(req),parse(id,value));
    res.setHeader('X-Content-Checksum',result.checksum);
    return new StreamableFile(result.bytes,{ type: result.mime,disposition: 'attachment; filename="' + result.filename + '"' });
  }
  @Post('imports/dry-run') @HttpCode(200)
  importDryRun(@Req() req: Request,@Body() body: unknown) {
    return this.app.imports.inspect(authenticate(req),parse(inspectImport,body).data_base64);
  }
  @Post('imports') restoreArchive(@Req() req: Request,@Body() body: unknown,@Headers('idempotency-key') key?: string) {
    return this.app.imports.restore(authenticate(req),parse(restoreImport,body),key);
  }
  @Get('usage') usage(@Req() req: Request,@Query() query: unknown) {
    return this.app.jobs.usage(authenticate(req),parse(wsQuery,query).workspace_id);
  }
}

@Controller('v1')
export class SyncController {
  constructor(@Inject(SERVICES) private readonly app: Services) {}
  @Post('sync/mutations') @HttpCode(200)
  async mutations(@Req() req: Request,@Body() body: unknown) {
    const actor = authenticate(req);
    const items = parse(mutationBatch,body);
    const results = [];
    for (const item of items.mutations) results.push(await this.app.sync.submit(actor,item));
    return { results };
  }
  @Get('sync/changes') changes(@Req() req: Request,@Query() query: unknown) {
    const input = parse(syncChanges,query);
    return this.app.sync.changes(authenticate(req),input.workspace_id,input.cursor,input.limit);
  }
  @Post('sync/snapshot') @HttpCode(200)
  snapshot(@Req() req: Request,@Body() body: unknown) {
    return this.app.sync.snapshot(authenticate(req),parse(wsQuery,body).workspace_id);
  }
  @Post('sync/ack') @HttpCode(200)
  ack(@Req() req: Request,@Body() body: unknown) {
    const input = parse(syncAck,body);
    return this.app.sync.ack(authenticate(req),input.workspace_id,input.device_id,input.cursor);
  }
  @Get('devices') devices(@Req() req: Request,@Query() query: unknown) {
    return this.app.sync.devices(authenticate(req),parse(wsQuery,query).workspace_id);
  }
}
