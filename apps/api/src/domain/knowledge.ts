import { randomUUID } from 'node:crypto';
import type { WorkspaceProjection, ProjectionNode, ProjectionEdge, nodeUpdate, edgeChange, storedSourceMetadata, edgeInput, evidenceInput, nodeInput, sourceChange, sourceInput, sourceLifecycle, uploadInput } from '@akw/contracts';
import type { z } from 'zod';
import { first, type Database, type Sql } from '../platform/database';
import { conflict, denied, invalid, missing } from '../platform/errors';
import type { ObjectStore } from '../platform/objects';
import { canonicalUrl, fetchPublic } from '../platform/public-web';
import { sha256, type Actor } from '../platform/security';
import { assertProject, event, idempotent, workspace } from './access';
import { isTextBoundary } from './artifacts';
import { checkUpload, parseDocument, type ParsedDocument } from './parsing';
import { retrievePassages, type RetrievalOptions } from './retrieval';
import type { ImageBytes, PublicMaterial } from '../runtime/public-research';

type SourceInput = z.infer<typeof sourceInput>;
export interface Source { id: string; workspace_id: string; project_id: string | null; title: string; canonical_url: string | null; asset_id: string | null; status: string; sensitivity: string; rights: string; lifecycle: string; version: number; checked_at: string|null; metadata: z.infer<typeof storedSourceMetadata> }
export interface Passage { id: string; document_id: string; ordinal: number; page: number | null; offset_utf16: number; content: string }
export interface Evidence { id: string; source_id: string; document_id: string; passage_id: string; snapshot_id: string; locator: { page: number | null; passage_ordinal: number; start_utf16: number; end_utf16: number }; quote: string; verification_status: string }
interface Asset { id: string; workspace_id: string; owner_id:string; visibility:string; filename: string; mime: string; size_bytes: number; storage_key: string; storage_mode: string }
interface PassageLineage extends Passage { source_id: string; snapshot_id: string; workspace_id: string }

export class Knowledge {
  constructor(private readonly db: Database, private readonly objects: ObjectStore) {}

  upload(actor: Actor, input: z.infer<typeof uploadInput>, key?: string) {
    if (input.storage_mode !== 'cloud_managed') throw invalid('This endpoint only accepts cloud-managed files');
    const bytes = Buffer.from(input.data_base64, 'base64');
    checkUpload(bytes, input.mime);
    const hash = sha256(bytes);
    const storageKey = input.workspace_id + '/' + hash;
    return this.db.transaction(async sql => {
      await workspace(sql, actor, input.workspace_id, true);
      return idempotent(sql, actor, 'asset.upload:' + input.workspace_id, key, { name: input.name, mime: input.mime, hash, visibility:input.visibility,export_rights:input.export_rights }, async () => {
        await this.objects.put(storageKey, bytes, input.mime);
        const id = randomUUID();
        const asset = await first(sql, `INSERT INTO assets(id,workspace_id,owner_id,filename,mime,content_hash,size_bytes,storage_key,storage_mode,visibility,export_rights)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,workspace_id,filename,mime,content_hash,size_bytes,storage_mode,visibility`,
          [id,input.workspace_id,actor.user,input.name,input.mime,hash,bytes.length,storageKey,input.storage_mode,input.visibility,input.export_rights]);
        await event(sql, actor, input.workspace_id, 'AssetUploaded', 'asset', id,1,{},input.visibility === 'capture');
        return asset!;
      });
    });
  }
  async asset(actor: Actor, id: string) {
    const asset = await first<Asset>(this.db, 'SELECT * FROM assets WHERE id=$1', [id]);
    if (!asset) throw missing('Asset');
    await workspace(this.db, actor, asset.workspace_id);
    if (asset.visibility === 'capture' && asset.owner_id !== actor.user) throw missing('Asset');
    return asset;
  }
  async imagePreview(actor:Actor,id:string) {
    const asset = await this.asset(actor,id);
    if (!['image/png','image/jpeg'].includes(asset.mime) || asset.size_bytes > 2 * 1024 * 1024) throw missing('Image preview');
    const bytes = await this.objects.get(asset.storage_key);
    checkUpload(bytes,asset.mime);
    return { mime:asset.mime,data_base64:bytes.toString('base64') };
  }

  async pdfPreview(actor:Actor,id:string) {
    const asset = await this.asset(actor,id);
    if (asset.mime !== 'application/pdf' || asset.size_bytes > 8 * 1024 * 1024) throw missing('PDF preview');
    const bytes = await this.objects.get(asset.storage_key);
    checkUpload(bytes,asset.mime);
    return { data_base64:bytes.toString('base64') };
  }

  async readAsset(actor: Actor, id: string) {
    const asset = await this.asset(actor, id);
    return { asset, bytes: await this.objects.get(asset.storage_key) };
  }

  register(actor: Actor, input: SourceInput, key?: string) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, input.workspace_id, true);
      return idempotent(sql, actor, 'source.create:' + input.workspace_id, key, input, () => this.registerContentIn(sql,actor,input));
    });
  }
  async registerContentIn(sql: Sql,actor: Actor,input: SourceInput) {
    const source = await this.registerIn(sql,actor,input);
    if (!input.text || source.status !== 'registered') return source;
    const bytes = Buffer.from(input.text,'utf8');
    await this.persistDocument(sql,actor,source,bytes,await parseDocument(bytes,'text/plain'));
    return (await first<Source>(sql,'SELECT * FROM sources WHERE id=$1',[source.id]))!;
  }
  async registerIn(sql: Sql, actor: Actor, input: SourceInput) {
    await assertProject(sql, input.workspace_id, input.project_id);
    const url = input.url ? canonicalUrl(input.url).href : null;
    if (url) {
      const existing = await first<Source>(sql, 'SELECT * FROM sources WHERE workspace_id=$1 AND canonical_url=$2', [input.workspace_id,url]);
      if (existing) {
        if (existing.project_id !== (input.project_id ?? null)) throw conflict('CONFLICT_SOURCE_SCOPE', 'Source URL is already registered in another project scope');
        return existing;
      }
    }
    if (input.asset_id) {
      const available = await first(sql,`UPDATE assets SET visibility='workspace' WHERE id=$1 AND workspace_id=$2
        AND (visibility='workspace' OR owner_id=$3) RETURNING id`,[input.asset_id,input.workspace_id,actor.user]);
      if (!available) throw missing('Asset');
    }
    const id = randomUUID();
    const source = await first<Source>(sql, `INSERT INTO sources(id,workspace_id,project_id,title,canonical_url,asset_id,rights,sensitivity,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'registered') RETURNING *`,
      [id,input.workspace_id,input.project_id ?? null,input.title,url,input.asset_id ?? null,input.rights,input.sensitivity]);
    await event(sql, actor, input.workspace_id, 'SourceRegistered', 'source', id);
    return source!;
  }
  async filterPublicMaterials(ws:string,candidates:PublicMaterial[]) {
    if (!candidates.length) return [];
    const rows = await this.db.all<Source>('SELECT * FROM sources WHERE workspace_id=$1 AND canonical_url=ANY($2::text[])',
      [ws,candidates.map(item => item.url)]);
    const indexed = new Map(rows.map(row => [row.canonical_url,row]));
    return candidates.filter(candidate => {
      const row = indexed.get(candidate.url);
      return !row || this.availableMaterial(row,candidate);
    });
  }

  private availableMaterial(source:Source,material:PublicMaterial) {
    return source.project_id === null && source.sensitivity === 'public' && source.rights !== 'restricted' &&
      ['active','updated'].includes(source.lifecycle) && source.metadata.material_kind === material.kind &&
      (material.kind !== 'image' || source.rights === 'public_license');
  }

  async savePublicMaterial(sql:Sql,actor:Actor,ws:string,material:PublicMaterial,image?:ImageBytes,ordinal=0) {
    const url = canonicalUrl(material.url).href;
    let source = await first<Source>(sql,'SELECT * FROM sources WHERE workspace_id=$1 AND canonical_url=$2',[ws,url]);
    if (source && !this.availableMaterial(source,material)) throw conflict('CONFLICT_ANALYSIS_SOURCE','Analysis source availability changed');
    const rights = material.license || ['encyclopedia','image'].includes(material.kind) ? 'public_license' : 'unknown';
    const metadata = {
      author:material.author,published:material.published,doi:material.doi,journal:material.journal,
      material_kind:material.kind,provider:material.provider,license:material.license ?? material.image?.license ?? (material.kind === 'encyclopedia' ? 'CC BY-SA' : undefined),
      license_url:material.licenseUrl ?? material.image?.licenseUrl ?? (material.kind === 'encyclopedia' ? 'https://creativecommons.org/licenses/by-sa/4.0/' : undefined),
    };
    let asset = source?.asset_id ?? null;
    if (material.kind === 'image' && !asset) {
      if (!image) throw missing('Image asset');
      asset = randomUUID();
      const hash = sha256(image.bytes), storage = ws + '/' + hash;
      await this.objects.put(storage,image.bytes,image.mime);
      await sql.all(`INSERT INTO assets(id,workspace_id,owner_id,filename,mime,content_hash,size_bytes,storage_key,storage_mode)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'cloud_managed')`,
        [asset,ws,actor.user,material.title.slice(0,180) + (image.mime === 'image/png' ? '.png' : '.jpg'),image.mime,hash,image.bytes.length,storage]);
      if (source) await sql.all('UPDATE sources SET asset_id=$2 WHERE id=$1',[source.id,asset]);
    }
    if (!source) {
      const id = randomUUID();
      source = await first<Source>(sql,`INSERT INTO sources(id,workspace_id,title,canonical_url,asset_id,rights,sensitivity,status,metadata)
        VALUES($1,$2,$3,$4,$5,$6,'public','registered',$7) RETURNING *`,[id,ws,material.title,url,asset,rights,JSON.stringify(metadata)]);
      await event(sql,actor,ws,'SourceRegistered','source',id);
    }
    const sourceId = source!.id;
    const passages=[{ content:material.text,offset:0,page:material.page ?? null },...(material.passages ?? []).map(part => ({ content:part.text,offset:0,page:part.page }))];
    const data = Buffer.from(material.passages?.length || material.page!==undefined ? JSON.stringify(passages) : material.text);
    const previous = await first<{ id:string; content_hash:string }>(sql,`SELECT id,content_hash FROM source_snapshots
      WHERE source_id=$1 ORDER BY retrieved_at DESC,id DESC LIMIT 1`,[sourceId]);
    if (previous?.content_hash !== sha256(data)) {
      await sql.all('UPDATE sources SET metadata=$2 WHERE id=$1',[sourceId,JSON.stringify(metadata)]);
      await this.persistDocument(sql,actor,source!,data,{
        parser:'public-api/' + material.provider.toLowerCase().replaceAll(' ','-') + '/v1',
        pages:Math.max(1,...passages.map(item => item.page ?? 0)),passages,warnings:[],
      },Boolean(previous));
      if (previous) await this.flagAffectedClaims(sql,sourceId,true);
    }
    const passage = await first<PassageLineage>(sql,`SELECT p.*,d.source_id,d.snapshot_id,$2::uuid AS workspace_id
      FROM passages p JOIN documents d ON d.id=p.document_id WHERE d.source_id=$1 AND p.ordinal=$3
      AND d.snapshot_id=(SELECT id FROM source_snapshots WHERE source_id=$1 ORDER BY retrieved_at DESC,id DESC LIMIT 1)
      ORDER BY d.created_at DESC,d.id DESC LIMIT 1`,[sourceId,ws,ordinal]);
    if (!passage) throw missing('Source passage');
    const evidence = await this.evidenceIn(sql,actor,passage,0,passage.content.length);
    return { evidence_id:evidence.id,asset_id:asset ?? undefined };
  }

  async ingest(actor: Actor, sourceId: string, signal?: AbortSignal, refresh = false) {
    const source = await this.source(actor,sourceId);
    if (['archived','retracted'].includes(source.lifecycle)) throw conflict('CONFLICT_SOURCE_LIFECYCLE','Source is archived or retracted');
    if (!refresh && source.status === 'parsed') return source;
    let bytes: Buffer;
    let mime: string;
    if (source.asset_id) {
      const file = await this.readAsset(actor,source.asset_id);
      bytes = file.bytes;
      mime = file.asset.mime;
    } else if (source.canonical_url) {
      try {
        const response = await fetchPublic(source.canonical_url,signal);
        bytes = response.bytes;
        mime = response.mime;
      } catch (error) {
        if (signal?.aborted) throw error;
        await this.db.transaction(async sql => {
          await workspace(sql,actor,source.workspace_id,true);
          const changed = await first<{ version:number }>(sql,`UPDATE sources SET lifecycle='inaccessible',checked_at=now(),version=version+1
            WHERE id=$1 AND version=$2 AND lifecycle NOT IN ('archived','retracted') RETURNING version`,[source.id,source.version]);
          if (changed) {
            await this.flagAffectedClaims(sql,source.id,false);
            await event(sql,actor,source.workspace_id,'SourceUnavailable','source',source.id,changed.version);
          }
        });
        throw error;
      }
    } else throw invalid('Source has no importable content');
    const report = await parseDocument(bytes,mime,signal);
    return this.db.transaction(async sql => {
      await workspace(sql,actor,source.workspace_id,true);
      const latest = await first<Source>(sql,'SELECT * FROM sources WHERE id=$1',[sourceId]);
      if (!latest) throw missing('Source');
      if (!refresh && latest.status === 'parsed' && !['archived','retracted'].includes(latest.lifecycle)) return latest;
      if (latest.version !== source.version || ['archived','retracted'].includes(latest.lifecycle)) throw conflict('CONFLICT_SOURCE_LIFECYCLE','Source changed during ingestion');
      const prior = await first<{ content_hash:string }>(sql,'SELECT content_hash FROM source_snapshots WHERE source_id=$1 ORDER BY retrieved_at DESC,id DESC LIMIT 1',[sourceId]);
      if (prior?.content_hash === sha256(bytes)) {
        const unchanged = await first<Source>(sql,`UPDATE sources SET checked_at=now(),status='parsed',
          lifecycle=CASE WHEN lifecycle='inaccessible' THEN 'active' ELSE lifecycle END,version=version+1 WHERE id=$1 RETURNING *`,[source.id]);
        await event(sql,actor,source.workspace_id,'SourceChecked','source',source.id,unchanged!.version);
        return unchanged!;
      }
      await this.persistDocument(sql,actor,latest,bytes,report,Boolean(prior));
      if (prior) await this.flagAffectedClaims(sql,sourceId,true);
      return (await first<Source>(sql,'SELECT * FROM sources WHERE id=$1',[sourceId]))!;
    });
  }

  changeSource(actor: Actor,id: string,input: z.infer<typeof sourceChange>,key?: string) {
    return this.db.transaction(async sql => {
      const source = await first<Source>(sql,'SELECT * FROM sources WHERE id=$1',[id]);
      if (!source) throw missing('Source');
      await workspace(sql,actor,source.workspace_id,true);
      return idempotent(sql,actor,'source.change:' + id,key,input,async () => {
        const row = await first<Source>(sql,`UPDATE sources SET title=COALESCE($3,title),rights=COALESCE($4,rights),
          sensitivity=COALESCE($5,sensitivity),metadata=metadata || COALESCE($6::jsonb,'{}'::jsonb),version=version+1
          WHERE id=$1 AND version=$2 RETURNING *`,
          [id,input.version,input.title ?? null,input.rights ?? null,input.sensitivity ?? null,input.metadata ? JSON.stringify(input.metadata) : null]);
        if (!row) throw conflict('CONFLICT_SOURCE_VERSION','Source changed');
        await event(sql,actor,source.workspace_id,'SourceMetadataChanged','source',id,row.version);
        return row;
      });
    });
  }

  lifecycle(actor: Actor,id: string,input: z.infer<typeof sourceLifecycle>,key?: string) {
    return this.db.transaction(async sql => {
      const source = await first<Source>(sql,'SELECT * FROM sources WHERE id=$1',[id]);
      if (!source) throw missing('Source');
      await workspace(sql,actor,source.workspace_id,true);
      return idempotent(sql,actor,'source.lifecycle:' + id,key,input,async () => {
        const next = { archive:'archived',restore:'active',retract:'retracted' }[input.action];
        const row = await first<Source>(sql,`UPDATE sources SET lifecycle=$3,version=version+1 WHERE id=$1 AND version=$2
          AND lifecycle<>$3 AND ($3<>'active' OR lifecycle IN ('archived','retracted','updated','inaccessible')) RETURNING *`,
          [id,input.version,next]);
        if (!row) throw conflict('CONFLICT_SOURCE_LIFECYCLE','Source changed');
        const flagged = next === 'active' ? 0 : await this.flagAffectedClaims(sql,id,false);
        await event(sql,actor,source.workspace_id,'SourceLifecycleChanged','source',id,row.version,{ lifecycle:next,flagged });
        return { ...row,flagged_claims:flagged };
      });
    });
  }

  private async flagAffectedClaims(sql: Sql,sourceId: string,changedContent: boolean) {
    const rows = await sql.all(`UPDATE claims c SET status='needs_review',version=version+1
      WHERE c.status IN ('proposed','supported','partially_supported','outdated')
        AND EXISTS(SELECT 1 FROM claim_evidence ce JOIN evidence e ON e.id=ce.evidence_id WHERE ce.claim_id=c.id AND e.source_id=$1)
        AND ($2::boolean OR NOT EXISTS(SELECT 1 FROM claim_evidence ce JOIN evidence e ON e.id=ce.evidence_id
          JOIN sources s ON s.id=e.source_id WHERE ce.claim_id=c.id AND s.id<>$1 AND s.lifecycle IN ('active','updated')))
      RETURNING c.id`,[sourceId,changedContent]);
    return rows.length;
  }
  async listSources(actor: Actor, ws: string) {
    await workspace(this.db, actor, ws);
    return this.db.all<Source>('SELECT * FROM sources WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200', [ws]);
  }
  async source(actor: Actor, id: string) {
    const source = await first<Source>(this.db, 'SELECT * FROM sources WHERE id=$1', [id]);
    if (!source) throw missing('Source');
    await workspace(this.db, actor, source.workspace_id);
    return source;
  }
  async sourceDetails(actor: Actor, id: string) {
    const source = await this.source(actor, id);
    const documents = await this.db.all('SELECT * FROM documents WHERE source_id=$1 ORDER BY created_at DESC', [id]);
    const passages = await this.db.all<Passage>(`SELECT p.* FROM passages p JOIN documents d ON d.id=p.document_id
      WHERE d.source_id=$1 ORDER BY d.created_at DESC,p.ordinal LIMIT 150`, [id]);
    const asset = source.asset_id ? await first<{ mime:string }>(this.db,
      'SELECT mime FROM assets WHERE id=$1 AND workspace_id=$2 AND visibility=\'workspace\'',[source.asset_id,source.workspace_id]) : undefined;
    return { ...source,asset_mime:asset?.mime ?? null,documents,passages };
  }
  async sourceDependencies(actor: Actor, id: string) {
    const source = await this.source(actor,id);
    const evidence = await this.db.all<Evidence>('SELECT * FROM evidence WHERE source_id=$1 ORDER BY created_at DESC LIMIT 200',[id]);
    const claims = await this.db.all(`SELECT DISTINCT c.* FROM claims c JOIN claim_evidence ce ON ce.claim_id=c.id
      JOIN evidence e ON e.id=ce.evidence_id WHERE e.source_id=$1 LIMIT 200`,[id]);
    const edges = await this.db.all('SELECT id,relation_type,status FROM knowledge_edges WHERE evidence_id IN (SELECT id FROM evidence WHERE source_id=$1)',[id]);
    const artifacts = await this.db.all(`SELECT a.id,a.title FROM artifacts a JOIN artifact_revisions r ON r.id=a.canonical_revision_id
      WHERE a.workspace_id=$1 AND a.deleted_at IS NULL AND (
        (r.content_json #> '{relations,source_ids}') ? $2::text OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.content_json->'blocks') AS b
          WHERE b #>> '{attrs,evidence_id}' IN (SELECT id::text FROM evidence WHERE source_id=$2::uuid)
            OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(b->'children','[]'::jsonb)) AS c
              WHERE c #>> '{attrs,evidence_id}' IN (SELECT id::text FROM evidence WHERE source_id=$2::uuid))))
      ORDER BY a.updated_at DESC LIMIT 200`,[source.workspace_id,id]);
    return { evidence,claims,edges,artifacts };
  }
  async evidence(actor: Actor, id: string) {
    const row = await first<Evidence & { workspace_id: string; title: string; canonical_url: string | null; parser_version:string; metadata:Source['metadata'] }>(this.db,
      'SELECT e.*,s.workspace_id,s.title,s.canonical_url,s.metadata,d.parser_version FROM evidence e JOIN sources s ON s.id=e.source_id JOIN documents d ON d.id=e.document_id WHERE e.id=$1', [id]);
    if (!row) throw missing('Evidence');
    await workspace(this.db, actor, row.workspace_id);
    return row;
  }
  createEvidence(actor: Actor, sourceId: string, input: z.infer<typeof evidenceInput>, key?: string) {
    return this.db.transaction(async sql => {
      const source = await first<Source>(sql, 'SELECT * FROM sources WHERE id=$1', [sourceId]);
      if (!source) throw missing('Source');
      await workspace(sql, actor, source.workspace_id, true);
      return idempotent(sql, actor, 'evidence.create:' + sourceId, key, input, async () => {
        const passage = await first<PassageLineage>(sql, `SELECT p.*,d.source_id,d.snapshot_id,s.workspace_id FROM passages p
          JOIN documents d ON d.id=p.document_id JOIN sources s ON s.id=d.source_id WHERE p.id=$1 AND d.source_id=$2`,
          [input.passage_id,sourceId]);
        if (!passage) throw missing('Passage');
        return this.evidenceIn(sql, actor, passage, input.start_utf16, input.end_utf16);
      });
    });
  }
  async evidenceIn(sql: Sql, actor: Actor, p: PassageLineage, start: number, end: number) {
    if (start >= end || !isTextBoundary(p.content,start) || !isTextBoundary(p.content,end)) throw invalid('Evidence range must align to text boundaries');
    const locator = { page: p.page, passage_ordinal: p.ordinal, start_utf16: p.offset_utf16 + start, end_utf16: p.offset_utf16 + end };
    const quote = p.content.slice(start,end);
    const prior = await first<Evidence>(sql, 'SELECT * FROM evidence WHERE passage_id=$1 AND locator=$2::jsonb', [p.id,JSON.stringify(locator)]);
    if (prior) return prior;
    const id = randomUUID();
    const evidence = await first<Evidence>(sql, `INSERT INTO evidence(id,source_id,document_id,passage_id,snapshot_id,locator,quote,verification_status)
      VALUES($1,$2,$3,$4,$5,$6,$7,'located') RETURNING *`, [id,p.source_id,p.document_id,p.id,p.snapshot_id,JSON.stringify(locator),quote]);
    await event(sql, actor, p.workspace_id, 'EvidenceCreated', 'evidence', id);
    return evidence!;
  }

  async retrieve(actor:Actor,ws:string,sourceIds:string[],query:string,projectId:string|null,embedding?:number[],options?:RetrievalOptions) {
    await workspace(this.db,actor,ws);
    return retrievePassages(this.db,{ workspace:ws,project:projectId,sources:sourceIds },query,embedding,options);
  }
  async indexPassages(actor:Actor,sourceId:string,embed:(texts:string[])=>Promise<number[][]>,profile:string) {
    const source = await this.source(actor, sourceId);
    const access = await workspace(this.db,actor,source.workspace_id);
    if (source.sensitivity !== 'public' || source.rights === 'restricted' || !access.policy.externalProviderAllowed ||
      !['public','personal'].includes(access.policy.sensitivity)) throw denied();
    const pending = await this.db.all<{ id: string; content: string }>(`SELECT p.id,p.content FROM passages p JOIN documents d ON d.id=p.document_id
      WHERE d.id=(SELECT id FROM documents WHERE source_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1) AND (p.embedding IS NULL OR p.embedding_profile IS DISTINCT FROM $2) ORDER BY p.ordinal LIMIT 24`,[sourceId,profile]);
    if (!pending.length) return 0;
    const vectors = await embed(pending.map(p => p.content));
    await this.db.transaction(async sql => {
      await workspace(sql, actor, source.workspace_id, true);
      for (const [i, passage] of pending.entries()) {
        const vector = vectors[i];
        if (vector?.length && vector.length <= 4096 && vector.every(Number.isFinite)) {
          await sql.all('UPDATE passages SET embedding=$2::vector,embedding_profile=$3 WHERE id=$1 AND (embedding IS NULL OR embedding_profile IS DISTINCT FROM $3)',[passage.id,JSON.stringify(vector),profile]);
        }
      }
    });
    return pending.length;
  }
  async backlinks(actor:Actor,id:string) {
    const node = await first<{ workspace_id:string;project_id:string|null }>(this.db,'SELECT workspace_id,project_id FROM knowledge_nodes WHERE id=$1',[id]);
    if (!node) throw missing('Knowledge node');
    await workspace(this.db,actor,node.workspace_id);
    return this.db.all<{ id:string;title:string;kind:string }>(`SELECT a.id,a.title,a.kind
      FROM artifacts a JOIN artifact_revisions r ON r.id=a.canonical_revision_id
      WHERE a.workspace_id=$1 AND a.deleted_at IS NULL AND
        ($2::uuid IS NULL OR a.project_id=$2 OR EXISTS(SELECT 1 FROM project_relations pr
          WHERE pr.workspace_id=$1 AND pr.from_id=a.project_id AND pr.to_id=$2)) AND (
        r.content_json->'relations'->'knowledge_node_ids' ? $3::text OR
        jsonb_path_exists(r.content_json,'$.blocks[*] ? (@.attrs.node_id == $node || @.attrs.root_id == $node || @.attrs.node_ids[*] == $node)',jsonb_build_object('node',$3::text)) OR
        jsonb_path_exists(r.content_json,'$.blocks[*].children[*] ? (@.type == "wiki_link" && @.attrs.node_id == $node)',jsonb_build_object('node',$3::text)))
      ORDER BY a.updated_at DESC,a.id LIMIT 100`,[node.workspace_id,node.project_id,id]);
  }
  changeEdge(actor:Actor,id:string,input:z.infer<typeof edgeChange>,key?:string) {
    return this.db.transaction(async sql => {
      const edge = await first<{ workspace_id:string }>(sql,'SELECT workspace_id FROM knowledge_edges WHERE id=$1',[id]);
      if (!edge) throw missing('Knowledge edge');
      await workspace(sql,actor,edge.workspace_id,true);
      return idempotent(sql,actor,'edge.change:' + id,key,input,async () => {
        const relation = input.action.type === 'revise' ? input.action.relation_type : null;
        const changed = await first<{ version:number;relation_type:string;status:string }>(sql,`UPDATE knowledge_edges
          SET relation_type=COALESCE($3,relation_type),status=$4,version=version+1
          WHERE id=$1 AND version=$2 AND status='confirmed' RETURNING *`,[id,input.version,relation,relation ? 'proposed' : 'rejected']);
        if (!changed) throw conflict('CONFLICT_EDGE_STATUS','Relationship changed or is no longer confirmed');
        await event(sql,actor,edge.workspace_id,relation ? 'KnowledgeEdgeRevised' : 'KnowledgeEdgeWithdrawn','knowledge_edge',id,changed.version,
          { relation_type:changed.relation_type,status:changed.status });
        return changed;
      });
    });
  }
  async graph(actor: Actor, ws: string) {
    await workspace(this.db, actor, ws);
    const nodes = await this.db.all('SELECT * FROM knowledge_nodes WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 300', [ws]);
    const edges = await this.db.all('SELECT * FROM knowledge_edges WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 500', [ws]);
    return { nodes, edges };
  }
  async projection(actor:Actor,ws:string,project:string|null,preferred:string[]):Promise<WorkspaceProjection> {
    return this.db.transaction(async sql => {
      await workspace(sql,actor,ws);
      await sql.all('SELECT id FROM workspaces WHERE id=$1 FOR SHARE',[ws]);
      const nodes = await sql.all<ProjectionNode>(`SELECT id,project_id,title,type,description,event_date,event_evidence_id,version
        FROM knowledge_nodes n WHERE workspace_id=$1 AND status='confirmed' AND
          (project_id IS NULL OR project_id=$2 OR (id=ANY($3::uuid[]) AND EXISTS(
            SELECT 1 FROM project_relations pr WHERE pr.workspace_id=$1 AND pr.from_id=$2 AND pr.to_id=n.project_id)))
        ORDER BY (id=ANY($3::uuid[])) DESC,created_at DESC,id LIMIT 500`,[ws,project,preferred]);
      const ids = nodes.map(node => node.id);
      const edges = await sql.all<ProjectionEdge>(`SELECT id,from_node_id,to_node_id,relation_type,evidence_id,status FROM knowledge_edges
        WHERE workspace_id=$1 AND status='confirmed' AND from_node_id=ANY($2::uuid[]) AND to_node_id=ANY($2::uuid[])
        ORDER BY created_at,id LIMIT 900`,[ws,ids]);
      return { version:1,scope_project_id:project,nodes,edges };
    });
  }

  private async checkEventEvidence(sql:Sql,ws:string,project:string|null|undefined,evidence:string|null|undefined) {
    if (evidence && !await first(sql,`SELECT e.id FROM evidence e JOIN sources s ON s.id=e.source_id WHERE e.id=$1 AND s.workspace_id=$2
      AND (s.project_id IS NULL OR s.project_id=$3 OR EXISTS (SELECT 1 FROM project_relations r
      WHERE r.workspace_id=$2 AND r.from_id=$3 AND r.to_id=s.project_id))`,[evidence,ws,project ?? null])) throw missing('Event evidence');
  }

  updateNode(actor:Actor,id:string,input:z.infer<typeof nodeUpdate>,key?:string) {
    return this.db.transaction(async sql => {
      const node = await first<ProjectionNode & { workspace_id:string }>(sql,'SELECT * FROM knowledge_nodes WHERE id=$1',[id]);
      if (!node) throw missing('Node');
      await workspace(sql,actor,node.workspace_id,true);
      return idempotent(sql,actor,'node.update:' + id,key,input,async () => {
        await this.checkEventEvidence(sql,node.workspace_id,node.project_id,input.event_evidence_id);
        const changed = await first<ProjectionNode>(sql,`UPDATE knowledge_nodes SET title=COALESCE($3,title),type=COALESCE($4,type),
          description=COALESCE($5,description),event_date=CASE WHEN $6 THEN $7 ELSE event_date END,
          event_evidence_id=CASE WHEN $8 THEN $9 ELSE event_evidence_id END,version=version+1
          WHERE id=$1 AND version=$2 RETURNING *`,[id,input.version,input.title ?? null,input.type ?? null,input.description ?? null,
          input.event_date !== undefined,input.event_date ?? null,input.event_evidence_id !== undefined,input.event_evidence_id ?? null]);
        if (!changed) throw conflict('CONFLICT_NODE_VERSION','Knowledge node has changed');
        await event(sql,actor,node.workspace_id,'KnowledgeNodeUpdated','knowledge_node',id,changed.version);
        return changed;
      });
    });
  }

  createNode(actor: Actor, input: z.infer<typeof nodeInput>, key?: string) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, input.workspace_id, true);
      await assertProject(sql,input.workspace_id,input.project_id);
      await this.checkEventEvidence(sql,input.workspace_id,input.project_id,input.event_evidence_id);
      return idempotent(sql, actor, 'node.create:' + input.workspace_id, key, input, async () => {
        const id = randomUUID();
        const row = await first(sql, `INSERT INTO knowledge_nodes(id,workspace_id,project_id,title,type,description,status,event_date,event_evidence_id)
          VALUES($1,$2,$3,$4,$5,$6,'confirmed',$7,$8) RETURNING *`,[id,input.workspace_id,input.project_id ?? null,input.title,input.type,input.description,input.event_date ?? null,input.event_evidence_id ?? null]);
        await event(sql, actor, input.workspace_id, 'KnowledgeNodeCreated', 'knowledge_node', id);
        return row!;
      });
    });
  }
  proposeEdge(actor: Actor, input: z.infer<typeof edgeInput>, key?: string) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, input.workspace_id, true);
      return idempotent(sql, actor, 'edge.propose:' + input.workspace_id, key, input, async () => {
        const ids = [input.from_node_id,input.to_node_id];
        const nodes = await sql.all<{ id: string; project_id: string | null }>('SELECT id,project_id FROM knowledge_nodes WHERE workspace_id=$1 AND id=ANY($2::uuid[])', [input.workspace_id,ids]);
        if (nodes.length !== 2) throw missing('Knowledge node');
        const from = nodes.find(node => node.id === ids[0])!;
        const to = nodes.find(node => node.id === ids[1])!;
        if (from.project_id && to.project_id && from.project_id !== to.project_id && !await first(sql,
          'SELECT from_id FROM project_relations WHERE workspace_id=$1 AND from_id=$2 AND to_id=$3', [input.workspace_id,from.project_id,to.project_id])) throw denied();
        if (input.evidence_id && !await first(sql, `SELECT e.id FROM evidence e JOIN sources s ON s.id=e.source_id
          WHERE s.workspace_id=$1 AND e.id=$2 AND (s.project_id IS NULL OR s.project_id=$3 OR s.project_id=$4)`,
          [input.workspace_id,input.evidence_id,from.project_id,to.project_id])) throw missing('Evidence');
        const id = randomUUID();
        const row = await first(sql, `INSERT INTO knowledge_edges(id,workspace_id,from_node_id,to_node_id,relation_type,evidence_id,status,created_by)
          VALUES($1,$2,$3,$4,$5,$6,'proposed',$7) RETURNING *`, [id,input.workspace_id,...ids,input.relation_type,input.evidence_id ?? null,actor.user]);
        await event(sql, actor, input.workspace_id, 'KnowledgeEdgeProposed', 'knowledge_edge', id);
        return row!;
      });
    });
  }
  reviewEdge(actor: Actor, id: string, decision: 'confirmed' | 'rejected', key?: string) {
    return this.db.transaction(async sql => {
      const edge = await first<{ workspace_id: string }>(sql, 'SELECT workspace_id FROM knowledge_edges WHERE id=$1', [id]);
      if (!edge) throw missing('Knowledge edge');
      await workspace(sql, actor, edge.workspace_id, true);
      return idempotent(sql, actor, 'edge.review:' + id, key, { decision }, async () => {
        const row = await first(sql, "UPDATE knowledge_edges SET status=$2,version=version+1 WHERE id=$1 AND status='proposed' RETURNING *", [id,decision]);
        if (!row) throw conflict('CONFLICT_EDGE_STATUS', 'Relationship already reviewed');
        await event(sql, actor, edge.workspace_id, 'KnowledgeEdgeReviewed', 'knowledge_edge', id, Number(row.version), { decision });
        return row;
      });
    });
  }
  private async persistDocument(sql: Sql, actor: Actor, source: Source, bytes: Buffer, parsed: ParsedDocument, updated = false) {
    const snapshot = randomUUID();
    const document = randomUUID();
    const hash = sha256(bytes);
    await sql.all('INSERT INTO source_snapshots(id,source_id,content_hash) VALUES($1,$2,$3)', [snapshot,source.id,hash]);
    await sql.all('INSERT INTO documents(id,source_id,snapshot_id,parser_version,quality_report) VALUES($1,$2,$3,$4,$5)',
      [document,source.id,snapshot,parsed.parser,JSON.stringify({ page_count: parsed.pages, passage_count: parsed.passages.length, warnings: parsed.warnings })]);
    for (let start = 0; start < parsed.passages.length; start += 50) {
      const group = parsed.passages.slice(start,start + 50).map((p,index) => ({ id: randomUUID(), ordinal: start + index, page: p.page, offset_utf16: p.offset, content: p.content }));
      await sql.all(`INSERT INTO passages(id,document_id,ordinal,page,offset_utf16,content)
        SELECT p.id,$1,p.ordinal,p.page,p.offset_utf16,p.content FROM jsonb_to_recordset($2::jsonb)
        AS p(id uuid, ordinal integer, page integer, offset_utf16 integer, content text)`, [document,JSON.stringify(group)]);
    }
    const current = await first<{ version:number }>(sql,`UPDATE sources SET status='parsed',checked_at=now(),lifecycle=$2,version=version+1
      WHERE id=$1 RETURNING version`,[source.id,updated ? 'updated' : 'active']);
    await event(sql,actor,source.workspace_id,updated ? 'SourceUpdated' : 'DocumentParsed','source',source.id,current!.version,
      { document_id:document,passage_count:parsed.passages.length });
  }
}
