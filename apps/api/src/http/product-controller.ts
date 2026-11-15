import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { artifactRename, artifactVersion, captureAction, captureInput, claimDecision, claimInput, commentInput, commentUpdate, id, memberInput, nodeUpdate, edgeChange, projectionReferences, revisionRestore, scheduleInput, scheduleUpdate, searchInput, sourceChange, sourceLifecycle, studyCardInput, studyGoalInput, studyGoalUpdate, studyReviewInput, versionInput } from '@akw/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { parse } from '../platform/errors';
import { artifactReferences } from '../domain/workspace-references';
import { authenticate } from '../platform/security';
import { SERVICES, type Services } from '../services';

const scope = z.object({ workspace_id:id });

@Controller('v1')
export class ProductController {
  constructor(@Inject(SERVICES) private readonly app: Services) {}

  @Get('artifacts/:id/projection') async projection(@Req() req:Request,@Param('id') value:string) {
    const actor = authenticate(req);
    const artifact = await this.app.artifacts.get(actor,parse(id,value));
    const content = artifact.revision.content_json;
    const preferred = projectionReferences(content.blocks,content.relations.knowledge_node_ids);
    const graph = await this.app.knowledge.projection(actor,artifact.workspace_id,artifact.project_id,preferred);
    const evidence = [...graph.nodes.flatMap(node => node.event_evidence_id ? [node.event_evidence_id] : []),
      ...graph.edges.flatMap(edge => edge.evidence_id ? [edge.evidence_id] : [])];
    const references = await artifactReferences(this.app.db,artifact,evidence);
    return { ...graph,references };
  }
  @Get('knowledge/nodes/:id/backlinks') backlinks(@Req() req:Request,@Param('id') value:string) {
    return this.app.knowledge.backlinks(authenticate(req),parse(id,value));
  }
  @Patch('knowledge/edges/:id') changeEdge(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.knowledge.changeEdge(authenticate(req),parse(id,value),parse(edgeChange,body),key);
  }
  @Patch('knowledge/nodes/:id') updateNode(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.knowledge.updateNode(authenticate(req),parse(id,value),parse(nodeUpdate,body),key);
  }
  @Get('search') search(@Req() req:Request,@Query() query:unknown) {
    const input = parse(searchInput,query);
    return this.app.library.search(authenticate(req),input.workspace_id,input.q);
  }
  @Get('workspaces/:id/trash') trash(@Req() req: Request,@Param('id') value: string) {
    return this.app.artifacts.trash(authenticate(req),parse(id,value));
  }
  @Post('artifacts/:id/trash') @HttpCode(200)
  archive(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.artifacts.trashArtifact(authenticate(req),parse(id,value),parse(artifactVersion,body).base_revision_id,false,key);
  }
  @Post('artifacts/:id/restore') @HttpCode(200)
  restore(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.artifacts.trashArtifact(authenticate(req),parse(id,value),parse(artifactVersion,body).base_revision_id,true,key);
  }
  @Post('artifacts/:id/revisions/restore') @HttpCode(200)
  restoreRevision(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    const input = parse(revisionRestore,body);
    return this.app.artifacts.restoreRevision(authenticate(req),parse(id,value),input.base_revision_id,input.revision_id,key);
  }
  @Patch('artifacts/:id/metadata') rename(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.artifacts.rename(authenticate(req),parse(id,value),parse(artifactRename,body),key);
  }
  @Get('capture-items') captures(@Req() req: Request,@Query() query: unknown) {
    return this.app.library.captures(authenticate(req),parse(scope,query).workspace_id);
  }
  @Post('capture-items') capture(@Req() req: Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.library.capture(authenticate(req),parse(captureInput,body),key);
  }
  @Post('capture-items/:id/process') @HttpCode(200)
  process(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.library.processCapture(authenticate(req),parse(id,value),parse(captureAction,body),key);
  }
  @Patch('sources/:id/metadata') source(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.knowledge.changeSource(authenticate(req),parse(id,value),parse(sourceChange,body),key);
  }
  @Post('sources/:id/lifecycle') @HttpCode(200)
  lifecycle(@Req() req: Request,@Param('id') value: string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.knowledge.lifecycle(authenticate(req),parse(id,value),parse(sourceLifecycle,body),key);
  }
  @Post('sources/:id/revalidate') @HttpCode(202)
  revalidate(@Req() req: Request,@Param('id') value: string,@Headers('idempotency-key') key?:string) {
    return this.app.jobs.ingest(authenticate(req),parse(id,value),key,true);
  }
  @Get('workspaces/:id/members') members(@Req() req:Request,@Param('id') value:string) {
    return this.app.collaboration.members(authenticate(req),parse(id,value));
  }
  @Patch('workspaces/:id/members') member(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.collaboration.member(authenticate(req),parse(id,value),parse(memberInput,body),key);
  }
  @Get('artifacts/:id/comments') comments(@Req() req:Request,@Param('id') value:string) {
    const actor = authenticate(req);
    return this.app.collaboration.comments(actor,parse(id,value)).then(comments => ({ comments,current_user:actor.user }));
  }
  @Post('artifacts/:id/comments') comment(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.collaboration.comment(authenticate(req),parse(id,value),parse(commentInput,body),key);
  }
  @Patch('artifacts/:id/comments/:comment') updateComment(@Req() req:Request,@Param('id') value:string,@Param('comment') comment:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.collaboration.updateComment(authenticate(req),parse(id,value),parse(id,comment),parse(commentUpdate,body),key);
  }
  @Get('schedules') schedules(@Req() req:Request,@Query() query:unknown) {
    return this.app.schedules.list(authenticate(req),parse(scope,query).workspace_id);
  }
  @Post('schedules') schedule(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.schedules.create(authenticate(req),parse(scheduleInput,body),key);
  }
  @Patch('schedules/:id') changeSchedule(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.schedules.change(authenticate(req),parse(id,value),parse(scheduleUpdate,body),key);
  }
  @Get('study') study(@Req() req:Request,@Query() query:unknown) {
    return this.app.study.overview(authenticate(req),parse(scope,query).workspace_id);
  }
  @Post('study/goals') goal(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.study.createGoal(authenticate(req),parse(studyGoalInput,body),key);
  }
  @Patch('study/goals/:id') changeGoal(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.study.updateGoal(authenticate(req),parse(id,value),parse(studyGoalUpdate,body),key);
  }
  @Post('study/cards') card(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.study.createCard(authenticate(req),parse(studyCardInput,body),key);
  }
  @Post('study/cards/:id/review') @HttpCode(200)
  reviewCard(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.study.review(authenticate(req),parse(id,value),parse(studyReviewInput,body),key);
  }
  @Post('study/cards/:id/archive') @HttpCode(200)
  archiveCard(@Req() req:Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.study.archiveCard(authenticate(req),parse(id,value),parse(versionInput,body).version,key);
  }
  @Get('knowledge/maintenance') maintenance(@Req() req: Request,@Query() query:unknown) {
    return this.app.library.maintenance(authenticate(req),parse(scope,query).workspace_id);
  }
  @Post('knowledge/claims') createClaim(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.library.createClaim(authenticate(req),parse(claimInput,body),key);
  }
  @Get('knowledge/claims/:id') claim(@Req() req: Request,@Param('id') value:string) {
    return this.app.library.claim(authenticate(req),parse(id,value));
  }
  @Post('knowledge/claims/:id/review') @HttpCode(200)
  review(@Req() req: Request,@Param('id') value:string,@Body() body:unknown,@Headers('idempotency-key') key?:string) {
    return this.app.library.reviewClaim(authenticate(req),parse(id,value),parse(claimDecision,body),key);
  }
}
