import { randomUUID } from 'node:crypto';
import { artifactDocument, DocumentMergeConflict, emptyDocument, mergeArtifactDocuments, isProjectionType, projectionAttrs, patchInput, type ArtifactDetail, type ArtifactDocument, type ArtifactRevision, type Block, type PatchInput, type RequirementLedger } from '@akw/contracts';
import type { Actor } from '../platform/security';
import { sha256, stableJson } from '../platform/security';
import { first, type Database, type Sql } from '../platform/database';
import { conflict, invalid, missing, parse } from '../platform/errors';
import { assertProject, event, idempotent, workspace } from './access';
import { aiPolicyVersion,blockEvidence,sealAiPatch,verifyAiPatch,type AiPatchValidation } from './ai-evidence';

interface CreateArtifact {
  workspace_id: string;
  project_id?: string | null;
  title: string;
  kind: 'note' | 'document';
  content?: ArtifactDocument;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export function isTextBoundary(text: string, offset: number) {
  return offset === text.length || (offset >= 0 && offset < text.length && graphemes.segment(text).containing(offset)?.index === offset);
}

export function applyPatch(base: ArtifactDocument, operations: PatchInput['operations'], agent = false): ArtifactDocument {
  let doc = structuredClone(base);
  for (const operation of operations) {
    if (operation.type === 'replace_document') {
      if (agent) throw invalid('AI proposals must address individual blocks or selections');
      doc = structuredClone(operation.content);
      continue;
    }
    if (operation.type === 'insert_block') {
      const after = operation.after_id ? doc.blocks.findIndex(block => block.id === operation.after_id) : -1;
      if (operation.after_id && after < 0) throw invalid('Insert anchor block unavailable');
      doc.blocks.splice(after + 1, 0, structuredClone(operation.block));
      continue;
    }
    const index = doc.blocks.findIndex(block => block.id === operation.block_id);
    const block = doc.blocks[index];
    if (!block) throw invalid('Target block unavailable');
    if (operation.type === 'remove_block') {
      doc.blocks.splice(index, 1);
    } else if (operation.type === 'update_block') {
      if (operation.block.id !== block.id) throw invalid('Block ID must remain stable');
      doc.blocks[index] = structuredClone(operation.block);
    } else {
      const inline = block.children?.[operation.inline_index];
      if (inline?.type !== 'text' || inline.text === undefined) throw invalid('Target inline text unavailable');
      const { start_utf16: start, end_utf16: end, expected_text: expected } = operation;
      if (start > end || !isTextBoundary(inline.text, start) || !isTextBoundary(inline.text, end)
        || inline.text.slice(start, end) !== expected || sha256(expected) !== operation.expected_sha256) {
        throw conflict('CONFLICT_PATCH_ANCHOR', 'Text anchor has changed or splits a grapheme');
      }
      inline.text = inline.text.slice(0, start) + operation.text + inline.text.slice(end);
    }
  }
  return parse(artifactDocument, doc);
}

function userContent(content:ArtifactDocument,prior?:ArtifactDocument):ArtifactDocument {
  const previous=new Map(prior?.blocks.map(block => [block.id,block]));
  const relevant=(block:Block) => (block.children ?? []).map(node => ({ type:node.type,text:node.text,attrs:node.attrs }));
  return { ...content,blocks:content.blocks.map(block => {
    const old=previous.get(block.id);
    if (old?.attrs?.ai_claim !== true && block.attrs?.ai_claim !== true) return block;
    if (old?.attrs?.ai_claim === true && block.type === old.type && stableJson(relevant(block))===stableJson(relevant(old))) {
      const attrs:NonNullable<Block['attrs']>={ ...block.attrs,ai_claim:true };
      if (typeof old.attrs.claim_id==='string') attrs.claim_id=old.attrs.claim_id;
      else delete attrs.claim_id;
      return { ...block,attrs };
    }
    const attrs:NonNullable<Block['attrs']>={ ...block.attrs,user_edited:true };
    delete attrs.ai_claim;
    delete attrs.claim_id;
    return { ...block,attrs };
  }) };
}

export class Artifacts {
  constructor(private readonly db: Database) {}

  async list(actor: Actor, ws: string) {
    await workspace(this.db, actor, ws);
    return this.db.all(`SELECT id,title,kind,project_id,canonical_revision_id,updated_at FROM artifacts
      WHERE workspace_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200`, [ws]);
  }
  async get(actor: Actor, id: string, sql: Sql = this.db, write = false) {
    const artifact = await first<Omit<ArtifactDetail, 'revision'>>(sql,
      'SELECT id,workspace_id,project_id,title,kind,canonical_revision_id FROM artifacts WHERE id=$1 AND deleted_at IS NULL', [id]);
    if (!artifact) throw missing('Artifact');
    await workspace(sql, actor, artifact.workspace_id, write);
    const revision = await first<ArtifactRevision>(sql, `SELECT r.* FROM artifacts a JOIN artifact_revisions r
      ON r.id=a.canonical_revision_id WHERE a.id=$1 AND a.deleted_at IS NULL`, [id]);
    if (!revision) throw missing('Artifact revision');
    return { ...artifact, canonical_revision_id: revision.id, revision };
  }
  async atRevision(actor:Actor, id:string, revisionId?:string):Promise<ArtifactDetail> {
    const current = await this.get(actor,id);
    if (!revisionId || revisionId === current.revision.id) return current;
    const revision = await first<ArtifactRevision>(this.db,
      'SELECT * FROM artifact_revisions WHERE artifact_id=$1 AND id=$2',[id,revisionId]);
    if (!revision) throw missing('Artifact revision');
    return { ...current,revision };
  }
  async revisions(actor: Actor, id: string) {
    await this.get(actor, id);
    return this.db.all<ArtifactRevision>('SELECT * FROM artifact_revisions WHERE artifact_id=$1 ORDER BY revision_number DESC LIMIT 100', [id]);
  }
  async trash(actor: Actor, ws: string) {
    await workspace(this.db,actor,ws);
    return this.db.all(`SELECT id,title,kind,project_id,canonical_revision_id,deleted_at FROM artifacts
      WHERE workspace_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`,[ws]);
  }

  async trashArtifact(actor: Actor,id: string,baseRevision: string,restore: boolean,key?: string) {
    return this.db.transaction(async sql => {
      const row = await first<{ workspace_id: string }>(sql,'SELECT workspace_id FROM artifacts WHERE id=$1',[id]);
      if (!row) throw missing('Artifact');
      await workspace(sql,actor,row.workspace_id,true);
      return idempotent(sql,actor,'artifact.lifecycle:' + id,key,{ baseRevision,restore },async () => {
        const current = await first<{ canonical_revision_id: string; deleted_at: Date|null; revision_number:number }>(sql,`SELECT a.canonical_revision_id,a.deleted_at,r.revision_number
          FROM artifacts a JOIN artifact_revisions r ON r.id=a.canonical_revision_id WHERE a.id=$1`,[id]);
        if (!current || current.canonical_revision_id !== baseRevision) throw conflict('CONFLICT_ARTIFACT_VERSION','Document changed before the operation');
        if (Boolean(current.deleted_at) !== restore) throw conflict('CONFLICT_ARTIFACT_LIFECYCLE','Document status has changed');
        await sql.all(restore ? 'UPDATE artifacts SET deleted_at=NULL,updated_at=now() WHERE id=$1' :
          'UPDATE artifacts SET deleted_at=now(),updated_at=now() WHERE id=$1',[id]);
        await event(sql,actor,row.workspace_id,restore ? 'ArtifactRestored' : 'ArtifactTrashed','artifact',id,current.revision_number);
        return { id,status:restore ? 'active' : 'trashed' };
      });
    });
  }

  restoreRevision(actor: Actor,id: string,baseRevision: string,targetRevision: string,key?: string) {
    return this.db.transaction(async sql => {
      const current = await this.get(actor,id,sql,true);
      return idempotent(sql,actor,'artifact.revision.restore:' + id,key,{ baseRevision,targetRevision },async () => {
        if (current.revision.id !== baseRevision) throw conflict('CONFLICT_ARTIFACT_VERSION','Document changed before restore');
        const target = await first<ArtifactRevision>(sql,'SELECT * FROM artifact_revisions WHERE id=$1 AND artifact_id=$2',[targetRevision,id]);
        if (!target) throw missing('Revision');
        await this.validateReferences(sql,current.workspace_id,current.project_id,target.content_json);
        const revision = await this.commit(sql,actor,current,target.content_json,'user',current.revision);
        return { revision,restored_from:target.id };
      });
    });
  }

  rename(actor: Actor,id: string,input: { base_revision_id:string; expected_title:string; title:string },key?: string) {
    return this.db.transaction(async sql => {
      const current = await this.get(actor,id,sql,true);
      return idempotent(sql,actor,'artifact.rename:' + id,key,input,async () => {
        const changed = await first(sql,`UPDATE artifacts SET title=$4,updated_at=now()
          WHERE id=$1 AND title=$2 AND canonical_revision_id=$3 AND deleted_at IS NULL RETURNING id`,
          [id,input.expected_title,input.base_revision_id,input.title]);
        if (!changed) throw conflict('CONFLICT_ARTIFACT_VERSION','Document title or revision changed');
        await event(sql,actor,current.workspace_id,'ArtifactRenamed','artifact',id,current.revision.revision_number);
        return { ...current,title:input.title };
      });
    });
  }

  async patches(actor: Actor, id: string) {
    await this.get(actor, id);
    return this.db.all(`SELECT id,artifact_id,base_revision_id,proposer_id,proposer_type,operations,status,created_at,resolved_at,
      (proposer_type <> 'agent' OR COALESCE(ai_validation->>'policy_version'=$2,false)) AS reviewed
      FROM artifact_patches WHERE artifact_id=$1 ORDER BY created_at DESC LIMIT 100`,[id,String(aiPolicyVersion)]);
  }

  async createIn(sql: Sql, actor: Actor, input: CreateArtifact, author: 'user' | 'agent' = 'user') {
    await assertProject(sql, input.workspace_id, input.project_id);
    const id = randomUUID();
    const original = input.content ?? emptyDocument();
    const content = author === 'user' ? userContent(original) : original;
    await this.validateReferences(sql, input.workspace_id, input.project_id, content);
    await sql.all(`INSERT INTO artifacts(id,workspace_id,project_id,title,kind,created_by)
      VALUES($1,$2,$3,$4,$5,$6)`, [id, input.workspace_id, input.project_id ?? null, input.title, input.kind, actor.user]);
    const revision = await this.commit(sql, actor, { id, workspace_id: input.workspace_id }, content, author);
    return { id, workspace_id: input.workspace_id, project_id: input.project_id ?? null, title: input.title, kind: input.kind, canonical_revision_id: revision.id, revision };
  }

  create(actor: Actor, input: CreateArtifact, key?: string) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, input.workspace_id, true);
      return idempotent(sql, actor, 'artifact.create:' + input.workspace_id, key, input, () => this.createIn(sql, actor, input));
    });
  }

  async editIn(sql: Sql, actor: Actor, detail: ArtifactDetail, patch: PatchInput, author: 'user' | 'agent' = 'user', allowMerge = false, version?: number) {
    const base = await first<ArtifactRevision>(sql,
      'SELECT * FROM artifact_revisions WHERE artifact_id=$1 AND id=$2', [detail.id, patch.base_revision_id]);
    if (!base || (version !== undefined && version !== base.revision_number)) throw conflict('CONFLICT_ARTIFACT_VERSION', 'Base revision unavailable');
    const incoming = applyPatch(base.content_json, patch.operations, author === 'agent');
    let content = incoming;
    if (base.id !== detail.revision.id) {
      if (!allowMerge) throw conflict('CONFLICT_ARTIFACT_VERSION', 'Artifact changed since the base revision', { current_revision_id: detail.revision.id });
      try { content = parse(artifactDocument,mergeArtifactDocuments(base.content_json,detail.revision.content_json,incoming)); }
      catch (error) {
        if (error instanceof DocumentMergeConflict) throw conflict('CONFLICT_ARTIFACT_VERSION',error.message,{ block_id:error.blockId });
        throw error;
      }
    }
    if (author === 'user') content=userContent(content,detail.revision.content_json);
    await this.validateReferences(sql, detail.workspace_id, detail.project_id, content);
    return this.commit(sql, actor, detail, content, author, detail.revision);
  }

  edit(actor: Actor, id: string, patch: PatchInput, key?: string) {
    return this.db.transaction(async sql => {
      const detail = await this.get(actor, id, sql, true);
      return idempotent(sql, actor, 'artifact.edit:' + id, key, patch, () => this.editIn(sql, actor, detail, patch));
    });
  }

  async proposeIn(sql: Sql, actor: Actor, detail: ArtifactDetail, patch: PatchInput, author: 'user' | 'agent', reviewedEvidence?:string[]) {
    const base = await first<ArtifactRevision>(sql, 'SELECT * FROM artifact_revisions WHERE artifact_id=$1 AND id=$2', [detail.id, patch.base_revision_id]);
    if (!base) throw conflict('CONFLICT_ARTIFACT_VERSION', 'Base revision unavailable');
    const candidate = applyPatch(base.content_json, patch.operations, author === 'agent');
    await this.validateReferences(sql, detail.workspace_id, detail.project_id, candidate);
    if (author === 'agent' && !reviewedEvidence) throw invalid('AI proposal requires a completed review');
    const validation = reviewedEvidence ? await sealAiPatch(sql,detail,patch,reviewedEvidence) : null;
    const row = await first(sql, `INSERT INTO artifact_patches(id,artifact_id,base_revision_id,proposer_id,proposer_type,operations,ai_validation)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,artifact_id,base_revision_id,proposer_id,proposer_type,operations,status,created_at,resolved_at`,
      [randomUUID(),detail.id,base.id,actor.user,author,JSON.stringify(patch.operations),validation ? JSON.stringify(validation) : null]);
    await event(sql, actor, detail.workspace_id, 'ArtifactPatchProposed', 'artifact', detail.id, detail.revision.revision_number, { patch_id: row!.id });
    return row!;
  }

  propose(actor: Actor, id: string, patch: PatchInput, key?: string) {
    return this.db.transaction(async sql => {
      const detail = await this.get(actor, id, sql, true);
      return idempotent(sql, actor, 'artifact.propose:' + id, key, patch, () => this.proposeIn(sql, actor, detail, patch, 'user'));
    });
  }

  resolve(actor: Actor, id: string, patchId: string, accept: boolean, key?: string) {
    return this.db.transaction(async sql => {
      const detail = await this.get(actor, id, sql, true);
      return idempotent(sql, actor, 'artifact.resolve:' + id, key, { patchId, accept }, async () => {
        const patch = await first<{ base_revision_id:string; operations:unknown; proposer_type:'user'|'agent'; status:string; ai_validation:AiPatchValidation|null }>(sql,
          'SELECT base_revision_id,operations,proposer_type,status,ai_validation FROM artifact_patches WHERE artifact_id=$1 AND id=$2 FOR UPDATE',[id,patchId]);
        if (!patch) throw missing('Patch');
        if (patch.status !== 'proposed') throw conflict('CONFLICT_PATCH_STATUS', 'Patch already resolved');
        const input = parse(patchInput, { base_revision_id: patch.base_revision_id, operations: patch.operations });
        if (accept && patch.proposer_type === 'agent') await verifyAiPatch(sql,detail,input,patch.ai_validation);
        const revision = accept ? await this.editIn(sql, actor, detail, input, patch.proposer_type) : null;
        if (revision && patch.proposer_type==='agent') await this.commitAnalysisLedger(sql,detail,input,patchId,revision);
        const status = accept ? 'accepted' : 'rejected';
        await sql.all('UPDATE artifact_patches SET status=$2,resolved_at=now() WHERE id=$1', [patchId, status]);
        await event(sql, actor, detail.workspace_id, accept ? 'ArtifactPatchAccepted' : 'ArtifactPatchRejected', 'artifact', id,
          revision?.revision_number ?? detail.revision.revision_number, { patch_id: patchId });
        return { id: patchId, status, revision };
      });
    });
  }

  private async commitAnalysisLedger(sql:Sql,detail:ArtifactDetail,patch:PatchInput,patchId:string,revision:ArtifactRevision) {
    const inserted=patch.operations.flatMap(operation=>operation.type==='insert_block' ? [operation.block] : []);
    const runId=inserted.find(block=>typeof block.attrs?.analysis_run_id==='string')?.attrs?.analysis_run_id;
    if (typeof runId!=='string') return;
    const job=await first<{ result:{ requirement_ledger?:RequirementLedger } }>(sql,`SELECT result FROM jobs
      WHERE id::text=$1 AND workspace_id=$2 AND kind='analysis' AND result->>'patch_id'=$3 AND result->>'artifact_id'=$4 FOR UPDATE`,
      [runId,detail.workspace_id,patchId,detail.id]);
    const ledger=job?.result.requirement_ledger;
    if (!ledger || ledger.version!==2) return;
    if (ledger.gate==='blocked' || ledger.items.some(item=>item.type!=='group' && item.mandatory &&
      Object.values(item.status).some(status=>status!=='complete')))
      throw conflict('CONFLICT_ANALYSIS_FULFILLMENT','The requirements were not fully verified');
    const insertedIds=new Set(inserted.map(block=>block.id));
    const byId=new Map(revision.content_json.blocks.filter(block=>insertedIds.has(block.id)).map(block=>[block.id,block]));
    for (const item of ledger.items.filter(item=>item.type!=='group' && item.status.artifact==='complete')) {
      const blocks=item.blockIds.map(id=>byId.get(id));
      const evidence=new Set(blocks.flatMap(block=>block ? blockEvidence(block) : []));
      const licensed=item.type!=='visual_asset' || blocks.some(block=>block?.type==='image' &&
        typeof block.attrs?.asset_id==='string' && typeof block.attrs?.credit==='string' && Boolean(block.attrs.credit.trim()) &&
        typeof block.attrs?.license==='string' && Boolean(block.attrs.license.trim()));
      if (!blocks.length || !item.evidenceIds.length || blocks.some(block=>!block) || !item.evidenceIds.every(id=>evidence.has(id)) || !licensed)
        throw conflict('CONFLICT_ANALYSIS_FULFILLMENT','The accepted document differs from the checked requirements');
    }
    for (const block of inserted) {
      const claimId=block.attrs?.claim_id;
      if (block.attrs?.ai_claim!==true || typeof claimId!=='string') continue;
      const statement=block.children?.filter(node=>node.type==='text' || node.type==='math_inline').map(node=>node.text ?? '').join('') ?? '';
      await sql.all(`INSERT INTO claims(id,workspace_id,statement,scope,status) VALUES($1,$2,$3,$4,'proposed')`,
        [claimId,detail.workspace_id,statement,'文档分析']);
      for (const evidenceId of blockEvidence(block)) await sql.all('INSERT INTO claim_evidence(claim_id,evidence_id) VALUES($1,$2)',[claimId,evidenceId]);
    }
    const accepted={ ...ledger,acceptedRevisionId:revision.id };
    await sql.all("UPDATE jobs SET result=jsonb_set(result,'{requirement_ledger}',$2::jsonb),updated_at=now() WHERE id::text=$1",
      [runId,JSON.stringify(accepted)]);
    await sql.all("INSERT INTO job_events(run_id,event_type,payload) VALUES($1,'RequirementArtifactAccepted',$2)",
      [runId,JSON.stringify({ patch_id:patchId,revision_id:revision.id,gate:accepted.gate })]);
  }

  private async validateReferences(sql: Sql, ws: string, projectId: string | null | undefined, document: ArtifactDocument) {
    const evidence = new Set<string>();
    const nodes = new Set(document.relations.knowledge_node_ids);
    const images = new Set<string>();
    const assets = new Set<string>();
    const sources = new Set(document.relations.source_ids);
    const embeds = new Set<string>();
    for (const block of document.blocks) {
      if (isProjectionType(block.type) && block.attrs?.view_version === 1) {
        const projection = parse(projectionAttrs,block.attrs);
        for (const id of projection.node_ids) nodes.add(id);
        if (projection.root_id) nodes.add(projection.root_id);
      }
      if (block.type === 'source_embed' && typeof block.attrs?.source_id === 'string') sources.add(block.attrs.source_id);
      if (block.type === 'artifact_embed' && typeof block.attrs?.artifact_id === 'string') embeds.add(block.attrs.artifact_id);
      if (block.type === 'knowledge_embed' && typeof block.attrs?.node_id === 'string') nodes.add(block.attrs.node_id);
      if (block.type === 'evidence_reference') {
        if (typeof block.attrs?.evidence_id !== 'string') throw invalid('Evidence block needs an evidence_id');
        evidence.add(block.attrs.evidence_id);
      }
      if (block.type === 'image' || block.type === 'figure') {
        const id = block.attrs?.asset_id, reference = block.attrs?.evidence_id;
        if (typeof reference === 'string') evidence.add(reference);
        if (typeof id === 'string') {
          assets.add(id);
          if (typeof reference === 'string') images.add(id + ':' + reference);
        }
      }
      for (const inline of block.children ?? []) {
        if (inline.type === 'wiki_link' && typeof inline.attrs?.node_id === 'string') nodes.add(inline.attrs.node_id);
        if (inline.type === 'citation') {
          if (typeof inline.attrs?.evidence_id !== 'string') throw invalid('Citation needs an evidence_id');
          evidence.add(inline.attrs.evidence_id);
        }
      }
    }
    const evidenceIds = [...evidence];
    if (evidenceIds.some(value => !/^[0-9a-f-]{36}$/i.test(value))) throw invalid('Invalid evidence_id');
    const sourceIds = [...sources];
    const nodeIds = [...nodes];
    const evidenceRows = evidenceIds.length ? await sql.all(`SELECT e.id FROM evidence e JOIN sources s ON s.id=e.source_id
      WHERE s.workspace_id=$1 AND (s.project_id IS NULL OR s.project_id=$2 OR EXISTS
        (SELECT 1 FROM project_relations pr WHERE pr.workspace_id=$1 AND pr.from_id=$2 AND pr.to_id=s.project_id))
        AND e.id::text=ANY($3::text[])`, [ws, projectId ?? null, evidenceIds]) : [];
    const sourceRows = sourceIds.length ? await sql.all(`SELECT id FROM sources s WHERE s.workspace_id=$1
      AND (s.project_id IS NULL OR s.project_id=$2 OR EXISTS
        (SELECT 1 FROM project_relations pr WHERE pr.workspace_id=$1 AND pr.from_id=$2 AND pr.to_id=s.project_id))
      AND s.id=ANY($3::uuid[])`, [ws, projectId ?? null, sourceIds]) : [];
    const nodeRows = nodeIds.length ? await sql.all(`SELECT id FROM knowledge_nodes n WHERE n.workspace_id=$1
      AND (n.project_id IS NULL OR n.project_id=$2 OR EXISTS
        (SELECT 1 FROM project_relations pr WHERE pr.workspace_id=$1 AND pr.from_id=$2 AND pr.to_id=n.project_id))
      AND n.id=ANY($3::uuid[])`, [ws, projectId ?? null, nodeIds]) : [];
    const scopedEmbeds = embeds.size ? await sql.all(`SELECT id FROM artifacts a WHERE a.workspace_id=$1 AND a.id=ANY($3::uuid[])
      AND (a.project_id IS NULL OR a.project_id=$2 OR EXISTS(SELECT 1 FROM project_relations r
        WHERE r.workspace_id=$1 AND r.from_id=$2 AND r.to_id=a.project_id))`,[ws,projectId ?? null,[...embeds]]) : [];
    const scopedAssets = assets.size ? await sql.all(`SELECT id FROM assets WHERE workspace_id=$1 AND id=ANY($2::uuid[])
      AND visibility='workspace' AND mime IN ('image/png','image/jpeg')`,[ws,[...assets]]) : [];
    if (scopedEmbeds.length !== embeds.size || scopedAssets.length !== assets.size) throw invalid('Artifact or image reference is unavailable');
    const imageRows = images.size ? await sql.all<{ id:string; evidence_id:string }>(`SELECT a.id,e.id AS evidence_id FROM assets a JOIN sources s ON s.asset_id=a.id
      JOIN evidence e ON e.source_id=s.id WHERE a.workspace_id=$1 AND s.workspace_id=$1 AND a.visibility='workspace'
        AND a.mime IN ('image/png','image/jpeg') AND a.id::text=ANY($2::text[]) AND e.id::text=ANY($3::text[])`,[ws,[...assets],evidenceIds]) : [];
    if (imageRows.filter(row => images.has(row.id + ':' + row.evidence_id)).length !== images.size) throw invalid('Image provenance is unavailable');
    if (evidenceRows.length !== evidenceIds.length || sourceRows.length !== sourceIds.length || nodeRows.length !== nodeIds.length) throw invalid('One or more references are unavailable within artifact scope');
  }

  private async commit(sql: Sql, actor: Actor, artifact: { id: string; workspace_id: string }, content: ArtifactDocument, author: 'user' | 'agent', parent?: ArtifactRevision) {
    const revision = await first<ArtifactRevision>(sql, `INSERT INTO artifact_revisions
      (id,artifact_id,revision_number,parent_revision_id,content_json,content_hash,author_type,author_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [randomUUID(), artifact.id, (parent?.revision_number ?? 0) + 1, parent?.id ?? null, JSON.stringify(content),
        sha256(stableJson(content)), author, actor.user]);
    await sql.all('UPDATE artifacts SET canonical_revision_id=$2,updated_at=now() WHERE id=$1', [artifact.id, revision!.id]);
    await event(sql, actor, artifact.workspace_id, parent ? 'ArtifactRevisionCommitted' : 'ArtifactCreated', 'artifact', artifact.id,
      revision!.revision_number, { revision_id: revision!.id, parent_revision_id: parent?.id ?? null });
    return revision!;
  }
}
