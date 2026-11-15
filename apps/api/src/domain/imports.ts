import { randomUUID } from 'node:crypto';
import { artifactDocument, assetMime, chronologyDate, id, isProjectionType, projectionAttrs, policy, storedSourceMetadata, title } from '@akw/contracts';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import { type Database, type Sql } from '../platform/database';
import { invalid, parse } from '../platform/errors';
import type { ObjectStore } from '../platform/objects';
import { sha256, stableJson, type Actor } from '../platform/security';
import { ensureIdentity, event, idempotent } from './access';
import { canonicalUrl } from '../platform/public-web';
import { checkUpload } from './parsing';

const paths = {
  projects:'projects/projects.json', relations:'projects/relations.json',
  artifacts:'artifacts/artifacts.json', revisions:'artifacts/revisions.json',
  nodes:'knowledge/nodes.json', edges:'knowledge/edges.json', claims:'knowledge/claims.json', claimEvidence:'knowledge/claim_evidence.json',
  sources:'sources/sources.json', evidence:'sources/evidence.json', snapshots:'sources/snapshots.json',
  documents:'sources/documents.json', passages:'sources/passages.json',
  comments:'artifacts/comments.json', claimReviews:'knowledge/claim_reviews.json', captures:'capture/items.json',
  studyGoals:'study/goals.json', studySteps:'study/steps.json', studyCards:'study/cards.json', studyReviews:'study/reviews.json',
} as const;
const optionalPaths = new Set(['comments','claimReviews','captures','studyGoals','studySteps','studyCards','studyReviews']);
const workspacePath = 'workspace/workspace.json';
const archivePaths = new Set<string>(['manifest.json','checksums.json',workspacePath,...Object.values(paths)]);
const checksum = z.string().regex(/^[0-9a-f]{64}$/);
const bytesInput = z.string().min(1).max(11_184_812).regex(/^[A-Za-z0-9+/]+={0,2}$/);
export const inspectImport = z.object({ data_base64:bytesInput }).strict();
export const restoreImport = inspectImport.extend({ confirm_checksum:checksum, name:title.optional() }).strict();
const manifestSchema = z.object({
  format:z.literal('akw-workspace'), version:z.literal('1.0'), workspace_id:id,
  schema_versions:z.object({ artifact:z.literal('1.0') }),
  checksum_algorithm:z.literal('sha256'),
  assets:z.array(z.object({
    id, filename:title, mime:assetMime,
    size_bytes:z.number().int().positive().max(8 * 1024 * 1024),
    export_rights:z.enum(['user_owned','public_license','unknown','restricted']).default('unknown'),
    path:z.string().nullable(),visibility:z.enum(['workspace','capture']).default('workspace'),
  })).max(3000),
});
type Row = Record<string, unknown>;
const rows = z.array(z.record(z.string(),z.json())).max(25_000);
const archiveWorkspace = z.object({ id,name:title,policy });
const workspaceData = (buffer: Uint8Array | undefined) => {
  if (!buffer) throw invalid('Required archive entry missing');
  try { return JSON.parse(new TextDecoder('utf-8',{ fatal:true }).decode(buffer)) as unknown; }
  catch { throw invalid('Archive contains invalid JSON'); }
};

function readArchive(encoded: string) {
  const raw = Buffer.from(encoded,'base64');
  if (raw.length > 8 * 1024 * 1024) throw invalid('Import archive exceeds 8 MiB');
  const seen = new Set<string>();
  let total = 0;
  let files: Record<string,Uint8Array>;
  try {
    files = unzipSync(raw,{ filter(entry) {
      const name = entry.name;
      if ((!archivePaths.has(name) && !/^assets\/[0-9a-f-]{36}$/i.test(name)) || seen.has(name) || seen.size >= 3030) throw invalid('Unexpected archive entry');
      if (entry.originalSize > 16 * 1024 * 1024) throw invalid('Archive entry too large');
      total += entry.originalSize;
      if (total > 64 * 1024 * 1024) throw invalid('Archive expands beyond the supported size');
      seen.add(name);
      return true;
    } });
  } catch {
    throw invalid('Archive is invalid or exceeds import limits');
  }
  const manifest = parse(manifestSchema,workspaceData(files['manifest.json']));
  const checksums = parse(z.record(z.string(),checksum),workspaceData(files['checksums.json']));
  const workspace = parse(archiveWorkspace,workspaceData(files[workspacePath]));
  if (workspace.id !== manifest.workspace_id) throw invalid('Workspace metadata does not match the manifest');
  if (Object.keys(checksums).length !== Object.keys(files).length - 1) throw invalid('Archive checksum list is incomplete');
  for (const [name,content] of Object.entries(files)) {
    if (name !== 'checksums.json' && (!Object.hasOwn(checksums,name) || sha256(Buffer.from(content)) !== checksums[name])) throw invalid('Archive checksum failed');
  }
  const assets = new Map<string,{ asset: z.infer<typeof manifestSchema>['assets'][number]; bytes: Buffer | null }>();
  const usedPaths = new Set<string>();
  for (const asset of manifest.assets) {
    if (assets.has(asset.id) || (asset.path !== null && asset.path !== 'assets/' + asset.id)) throw invalid('Invalid asset manifest entry');
    const file = asset.path ? files[asset.path] : undefined;
    if (asset.path && (!file || file.length !== asset.size_bytes)) throw invalid('Asset bytes missing or size differs from manifest');
    if (asset.path) usedPaths.add(asset.path);
    const bytes = file ? Buffer.from(file) : null;
    if (bytes) checkUpload(bytes,asset.mime);
    assets.set(asset.id,{ asset,bytes });
  }
  if (Object.keys(files).some(name => name.startsWith('assets/') && !usedPaths.has(name))) throw invalid('Unlisted asset file in archive');
  const datasets = Object.fromEntries(Object.entries(paths).map(([key,path]) => [key,optionalPaths.has(key) && !files[path] ? [] : parse(rows,workspaceData(files[path]))])) as Record<keyof typeof paths,Row[]>;
  return { checksum:sha256(raw),workspace,assets,datasets };
}

function date(value: unknown) {
  return parse(z.iso.datetime({ offset:true }),value);
}
const optionalDate = (value:unknown) => value == null ? null : date(value);
const valueString = (value: unknown, max = 200_000) => parse(z.string().max(max),value);
const valueInt = (value: unknown, min = 0) => parse(z.number().int().min(min).max(2_147_483_647),value);

function prepare(archive: ReturnType<typeof readArchive>, ws: string, actor: Actor) {
  const data = archive.datasets;
  const identitySets = new Map<string, Map<string,string>>();
  const all = new Set<string>();
  const kinds = ['projects','artifacts','revisions','nodes','edges','claims','sources','evidence','snapshots','documents','passages','comments','claimReviews','captures','studyGoals','studySteps','studyCards','studyReviews'] as const;
  type IdentityKind = typeof kinds[number];
  for (const kind of kinds) {
    const identities = new Map<string,string>();
    for (const row of data[kind]) {
      const original = parse(id,row.id);
      if (all.has(original)) throw invalid('Duplicate archived resource ID');
      all.add(original);
      identities.set(original,randomUUID());
    }
    identitySets.set(kind,identities);
  }
  const lookup = (kind: IdentityKind, value: unknown, optional = false) => {
    if (optional && (value === null || value === undefined)) return null;
    const result = identitySets.get(kind)?.get(parse(id,value));
    if (!result) throw invalid('Archive has a missing ' + kind + ' reference');
    return result;
  };
  const ref = (kind: IdentityKind,value: unknown) => lookup(kind,value)!;
  const oldWs = archive.workspace.id;
  for (const kind of ['projects','artifacts','nodes','edges','claims','sources','relations','captures','studyGoals','studyCards'] as const) {
    if (data[kind].some(row => row.workspace_id !== oldWs)) throw invalid('Archive contains another workspace');
  }

  const restoreAssets = new Map<string,{ bytes:Buffer; mime:string; key:string }>();
  const assetIds = new Map<string,string>();
  const assets = [];
  for (const [oldId,{ asset,bytes }] of archive.assets) {
    if (!bytes) continue;
    const newId = randomUUID();
    const content_hash = sha256(bytes);
    const storage_key = ws + '/' + content_hash;
    assetIds.set(oldId,newId);
    restoreAssets.set(storage_key,{ bytes,mime:asset.mime,key:storage_key });
    assets.push({ id:newId,workspace_id:ws,owner_id:actor.user,filename:asset.filename,mime:asset.mime,
      content_hash,size_bytes:bytes.length,storage_key,storage_mode:'cloud_managed',visibility:asset.visibility,export_rights:asset.export_rights });
  }

  function requireRow(kind: IdentityKind, originalId: unknown) {
    const row = indexed.get(kind)?.get(String(originalId));
    if (!row) throw invalid('Archive has a missing ' + kind + ' reference');
    return row;
  }
  const indexed = new Map(kinds.map(kind => [kind,new Map(data[kind].map(row => [String(row.id),row]))]));
  const unresolved = new Set(data.passages.filter(row => row.content === null).map(row => row.id));
  const revisionNumbers = new Map<string,Set<number>>();
  for (const row of data.revisions) {
    requireRow('artifacts',row.artifact_id);
    const n = valueInt(row.revision_number,1);
    const seen = revisionNumbers.get(String(row.artifact_id)) ?? new Set<number>();
    if (seen.has(n)) throw invalid('Duplicate artifact revision number');
    seen.add(n);
    revisionNumbers.set(String(row.artifact_id),seen);
    if (row.parent_revision_id === null) {
      if (n !== 1) throw invalid('Revision history has a missing parent');
    } else {
      const parent = requireRow('revisions',row.parent_revision_id);
      if (parent.artifact_id !== row.artifact_id || parent.revision_number !== n - 1) throw invalid('Revision history is inconsistent');
    }
  }
  for (const row of data.artifacts) {
    const current = requireRow('revisions',row.canonical_revision_id);
    if (current.artifact_id !== row.id || current.revision_number !== revisionNumbers.get(String(row.id))?.size) throw invalid('Canonical revision is inconsistent');
  }
  for (const row of data.documents) {
    if (requireRow('snapshots',row.snapshot_id).source_id !== row.source_id) throw invalid('Document and snapshot lineage differ');
  }
  for (const row of data.evidence) {
    const passage = requireRow('passages',row.passage_id);
    const document = requireRow('documents',row.document_id);
    if (passage.document_id !== document.id || document.source_id !== row.source_id || document.snapshot_id !== row.snapshot_id) {
      throw invalid('Evidence provenance is inconsistent');
    }
    const locator = parse(z.object({ page:z.number().int().nullable(),passage_ordinal:z.number().int().nonnegative(),
      start_utf16:z.number().int().nonnegative(),end_utf16:z.number().int().positive() }),row.locator);
    const offset = valueInt(passage.offset_utf16);
    if (locator.page !== passage.page || locator.passage_ordinal !== passage.ordinal || locator.start_utf16 < offset ||
      locator.start_utf16 >= locator.end_utf16 || (!unresolved.has(passage.id) &&
      valueString(passage.content).slice(locator.start_utf16-offset,locator.end_utf16-offset) !== row.quote)) throw invalid('Evidence locator does not match its passage');
  }

  function remapContent(row: Row) {
    const value = parse(artifactDocument,row.content_json);
    if (sha256(stableJson(value)) !== row.content_hash) throw invalid('Artifact revision checksum failed');
    value.relations.source_ids = value.relations.source_ids.map(key => ref('sources',key));
    value.relations.knowledge_node_ids = value.relations.knowledge_node_ids.map(key => ref('nodes',key));
    for (const block of value.blocks) {
      if (isProjectionType(block.type) && block.attrs?.view_version === 1) {
        const settings = parse(projectionAttrs,block.attrs);
        block.attrs = { ...block.attrs,node_ids:settings.node_ids.map(id => ref('nodes',id)),
          ...(settings.root_id ? { root_id:ref('nodes',settings.root_id) } : {}) };
      }
      if (block.type === 'source_embed') block.attrs = { ...block.attrs,source_id:ref('sources',block.attrs?.source_id) };
      if (block.type === 'artifact_embed') block.attrs = { ...block.attrs,artifact_id:ref('artifacts',block.attrs?.artifact_id) };
      if (block.type === 'knowledge_embed' && typeof block.attrs?.node_id === 'string') block.attrs = { ...block.attrs,node_id:ref('nodes',block.attrs.node_id) };
      if (['image','figure'].includes(block.type) && Object.hasOwn(block.attrs ?? {},'asset_id')) {
        const original = block.attrs?.asset_id == null ? null : parse(id,block.attrs.asset_id);
        if (original && archive.assets.get(original)?.asset.visibility !== 'workspace') throw invalid('Image references a private or missing asset');
        block.attrs = { ...block.attrs,asset_id:original ? assetIds.get(original) ?? null : null,
          ...(block.attrs?.evidence_id ? { evidence_id:ref('evidence',block.attrs.evidence_id) } : {}) };
      }
      if (block.type === 'evidence_reference') block.attrs = { ...block.attrs,evidence_id:ref('evidence',block.attrs?.evidence_id) };
      if (typeof block.attrs?.claim_id === 'string') block.attrs.claim_id = ref('claims',block.attrs.claim_id);
      for (const node of block.children ?? []) {
        if (node.type === 'wiki_link') node.attrs = { ...node.attrs,node_id:ref('nodes',node.attrs?.node_id) };
        if (node.type === 'citation') node.attrs = { ...node.attrs,evidence_id:ref('evidence',node.attrs?.evidence_id) };
      }
    }
    return value;
  }
  const normalized = {
    projects:data.projects.map(row => ({ id:ref('projects',row.id),workspace_id:ws,name:parse(title,row.name),
      description:valueString(row.description,4000),version:valueInt(row.version,1),created_at:date(row.created_at) })),
    relations:data.relations.map(row => ({ workspace_id:ws,from_id:ref('projects',row.from_id),to_id:ref('projects',row.to_id),created_by:actor.user })),
    assets,
    sources:data.sources.map(row => {
      const assetId = row.asset_id === null ? null : parse(id,row.asset_id);
      if (assetId && archive.assets.get(assetId)?.asset.visibility !== 'workspace') throw invalid('Source references an unavailable or private asset');
      const storedAsset = assetId ? assetIds.get(assetId) ?? null : null;
      return { id:ref('sources',row.id),workspace_id:ws,project_id:lookup('projects',row.project_id,true),title:parse(title,row.title),
        canonical_url:row.canonical_url === null ? null : canonicalUrl(valueString(row.canonical_url,2048)).href,
        asset_id:storedAsset,rights:parse(z.enum(['user_owned','public_license','unknown','restricted']),row.rights),
        sensitivity:parse(z.enum(['public','personal','sensitive','restricted']),row.sensitivity),
        status:valueString(row.status,40),created_at:date(row.created_at),checked_at:optionalDate(row.checked_at),
        lifecycle:parse(z.enum(['active','updated','inaccessible','retracted','archived']).default('active'),row.lifecycle),
        version:valueInt(row.version ?? 1,1),metadata:parse(storedSourceMetadata.default({}),row.metadata) };
    }),
    snapshots:data.snapshots.map(row => ({ id:ref('snapshots',row.id),source_id:ref('sources',row.source_id),
      content_hash:parse(checksum,row.content_hash),retrieved_at:date(row.retrieved_at) })),
    documents:data.documents.map(row => ({ id:ref('documents',row.id),source_id:ref('sources',row.source_id),
      snapshot_id:ref('snapshots',row.snapshot_id),parser_version:valueString(row.parser_version,100),
      quality_report:parse(z.json(),row.quality_report),created_at:date(row.created_at) })),
    passages:data.passages.map(row => ({ id:ref('passages',row.id),document_id:ref('documents',row.document_id),ordinal:valueInt(row.ordinal),
      page:row.page === null ? null : valueInt(row.page,1),offset_utf16:valueInt(row.offset_utf16),
      content:row.content === null ? '' : valueString(row.content) })),
    evidence:data.evidence.map(row => ({ id:ref('evidence',row.id),source_id:ref('sources',row.source_id),
      document_id:ref('documents',row.document_id),passage_id:ref('passages',row.passage_id),snapshot_id:ref('snapshots',row.snapshot_id),
      locator:parse(z.json(),row.locator),quote:valueString(row.quote),verification_status:unresolved.has(row.passage_id) ? 'source_unavailable' : valueString(row.verification_status,50),
      created_at:date(row.created_at) })),
    claims:data.claims.map(row => ({ id:ref('claims',row.id),workspace_id:ws,statement:valueString(row.statement,1200),
      scope:valueString(row.scope,800),status:valueString(row.status,40),created_at:date(row.created_at),
      version:valueInt(row.version ?? 1,1),reviewed_at:optionalDate(row.reviewed_at) })),
    claimEvidence:data.claimEvidence.map(row => ({ claim_id:ref('claims',row.claim_id),evidence_id:ref('evidence',row.evidence_id) })),
    nodes:data.nodes.map(row => ({ id:ref('nodes',row.id),workspace_id:ws,project_id:lookup('projects',row.project_id,true),
      title:parse(title,row.title),type:valueString(row.type,40),description:valueString(row.description,4000),status:valueString(row.status,40),created_at:date(row.created_at),
      version:valueInt(row.version ?? 1,1),event_date:row.event_date == null ? null : parse(chronologyDate,row.event_date),event_evidence_id:lookup('evidence',row.event_evidence_id,true) })),
    edges:data.edges.map(row => ({ id:ref('edges',row.id),workspace_id:ws,from_node_id:ref('nodes',row.from_node_id),to_node_id:ref('nodes',row.to_node_id),
      relation_type:valueString(row.relation_type,80),evidence_id:lookup('evidence',row.evidence_id,true),status:valueString(row.status,40),
      created_by:actor.user,version:valueInt(row.version,1),created_at:date(row.created_at) })),
    artifacts:data.artifacts.map(row => ({ id:ref('artifacts',row.id),workspace_id:ws,project_id:lookup('projects',row.project_id,true),title:parse(title,row.title),
      kind:parse(z.enum(['document','note']),row.kind),created_by:actor.user,created_at:date(row.created_at),updated_at:date(row.updated_at),deleted_at:optionalDate(row.deleted_at) })),
    comments:data.comments.map(row => {
      const revision = requireRow('revisions',row.revision_id);
      if (revision.artifact_id !== row.artifact_id) throw invalid('Comment revision mismatch');
      const block = row.block_id == null ? null : parse(id,row.block_id);
      if (block && !parse(artifactDocument,revision.content_json).blocks.some(item => item.id === block)) throw invalid('Comment block is missing');
      return { id:ref('comments',row.id),artifact_id:ref('artifacts',row.artifact_id),revision_id:ref('revisions',row.revision_id),block_id:block,
        author_id:actor.user,original_author_id:valueString(row.original_author_id ?? row.author_id,128),body:valueString(row.body,3000),
        version:valueInt(row.version,1),created_at:date(row.created_at),resolved_at:optionalDate(row.resolved_at),resolved_by:row.resolved_at ? actor.user : null };
    }),
    claimReviews:data.claimReviews.map(row => ({ id:ref('claimReviews',row.id),claim_id:ref('claims',row.claim_id),
      actor_id:actor.user,original_actor_id:valueString(row.original_actor_id ?? row.actor_id,128),previous_status:valueString(row.previous_status,40),
      decision:valueString(row.decision,40),reason:valueString(row.reason,1500),created_at:date(row.created_at) })),
    captures:data.captures.map(row => {
      const asset = row.asset_id == null ? null : assetIds.get(parse(id,row.asset_id));
      if (row.asset_id != null && !asset) throw invalid('Capture asset is missing');
      const kind = parse(z.enum(['note','source']).nullable(),row.result_kind);
      const fields = { asset_id:asset ?? null,url:row.url == null ? null : canonicalUrl(valueString(row.url,2048)).href,
        text_body:row.text_body == null ? null : valueString(row.text_body) };
      if (Object.values(fields).filter(value => value !== null).length !== 1) throw invalid('Capture has invalid content');
      return { id:ref('captures',row.id),workspace_id:ws,user_id:actor.user,title:parse(title,row.title),...fields,
        status:parse(z.enum(['inbox','processed','dismissed']),row.status),
        sensitivity:parse(z.enum(['public','personal','sensitive','restricted']),row.sensitivity),
        rights:parse(z.enum(['user_owned','public_license','unknown','restricted']),row.rights),
        result_kind:kind,result_id:kind ? ref(kind === 'note' ? 'artifacts' : 'sources',row.result_id) : null,
        created_at:date(row.created_at),updated_at:date(row.updated_at) };
    }),
    studyGoals:data.studyGoals.map(row => ({ id:ref('studyGoals',row.id),workspace_id:ws,user_id:actor.user,title:parse(title,row.title),
      notes:valueString(row.notes,3000),target_date:row.target_date == null ? null : parse(z.iso.date(),row.target_date),
      artifact_id:lookup('artifacts',row.artifact_id,true),status:parse(z.enum(['active','completed']),row.status),
      version:valueInt(row.version,1),created_at:date(row.created_at) })),
    studySteps:data.studySteps.map(row => ({ id:ref('studySteps',row.id),goal_id:ref('studyGoals',row.goal_id),
      title:parse(title,row.title),position:valueInt(row.position),done:parse(z.boolean(),row.done) })),
    studyCards:data.studyCards.map(row => ({ id:ref('studyCards',row.id),workspace_id:ws,user_id:actor.user,
      artifact_id:lookup('artifacts',row.artifact_id,true),question:valueString(row.question,400),answer:valueString(row.answer,5000),
      due_at:date(row.due_at),interval_minutes:valueInt(row.interval_minutes),streak:valueInt(row.streak),version:valueInt(row.version,1),
      created_at:date(row.created_at),archived_at:optionalDate(row.archived_at) })),
    studyReviews:data.studyReviews.map(row => ({ id:ref('studyReviews',row.id),card_id:ref('studyCards',row.card_id),
      rating:parse(z.enum(['again','hard','good','easy']),row.rating),reviewed_at:date(row.reviewed_at),next_due_at:date(row.next_due_at) })),
    revisions:data.revisions.map(row => {
      const content_json = remapContent(row);
      return { id:ref('revisions',row.id),artifact_id:ref('artifacts',row.artifact_id),revision_number:valueInt(row.revision_number,1),
        parent_revision_id:lookup('revisions',row.parent_revision_id,true),content_json,content_hash:sha256(stableJson(content_json)),
        author_type:valueString(row.author_type,40),author_id:actor.user,created_at:date(row.created_at) };
    }),
  };
  const canonical = data.artifacts.map(row => ({ id:ref('artifacts',row.id),revision:ref('revisions',row.canonical_revision_id) }));
  return { normalized, canonical, restoreAssets, excludedPassages:unresolved.size };
}

const tableNames = {
  projects:'projects',relations:'project_relations',assets:'assets',sources:'sources',
  snapshots:'source_snapshots',documents:'documents',passages:'passages',evidence:'evidence',
  claims:'claims',claimEvidence:'claim_evidence',nodes:'knowledge_nodes',edges:'knowledge_edges',
  artifacts:'artifacts',revisions:'artifact_revisions',comments:'artifact_comments',claimReviews:'claim_reviews',captures:'capture_items',
  studyGoals:'study_goals',studySteps:'study_steps',studyCards:'study_cards',studyReviews:'study_reviews',
} as const;
async function insertRows(sql: Sql, table: (typeof tableNames)[keyof typeof tableNames], entries: Row[]) {
  if (!entries[0]) return;
  // Column names come from the typed, normalized objects, never archive keys.
  const columns = Object.keys(entries[0]).join(',');
  for (let at = 0; at < entries.length; at += 300) {
    await sql.all(`INSERT INTO ${table}(${columns}) SELECT ${columns}
      FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,[JSON.stringify(entries.slice(at,at+300))]);
  }
}

export class Imports {
  constructor(private readonly db: Database,private readonly objects: ObjectStore) {}
  inspect(actor: Actor, encoded: string) {
    const archive = readArchive(encoded);
    const result = prepare(archive,randomUUID(),actor);
    return {
      checksum:archive.checksum,name:archive.workspace.name,
      counts:Object.fromEntries(Object.entries(result.normalized).map(([key,value]) => [key,value.length])),
      excluded_assets:[...archive.assets.values()].filter(row => !row.bytes).length,
      excluded_passages:result.excludedPassages,
    };
  }
  restore(actor: Actor,input: z.infer<typeof restoreImport>, key?: string) {
    const archive = readArchive(input.data_base64);
    if (archive.checksum !== input.confirm_checksum) throw invalid('Archive differs from the inspected file');
    const workspaceId = randomUUID();
    const restored = prepare(archive,workspaceId,actor);
    return this.db.transaction(async sql => {
      await ensureIdentity(sql,actor);
      return idempotent(sql,actor,'workspace.restore',key,{ checksum:archive.checksum,name:input.name },async () => {
        const name = input.name ?? archive.workspace.name;
        const settings = { ...archive.workspace.policy,externalProviderAllowed:false };
        await sql.all('INSERT INTO workspaces(id,tenant_id,owner_id,name,policy) VALUES($1,$2,$3,$4,$5)',
          [workspaceId,actor.tenant,actor.user,name,JSON.stringify(settings)]);
        await sql.all("INSERT INTO workspace_memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceId,actor.user]);
        for (const asset of restored.restoreAssets.values()) await this.objects.put(asset.key,asset.bytes,asset.mime);
        for (const [key,table] of Object.entries(tableNames)) {
          await insertRows(sql,table,restored.normalized[key as keyof typeof tableNames]);
        }
        await sql.all(`UPDATE artifacts a SET canonical_revision_id=c.revision FROM
          jsonb_to_recordset($1::jsonb) AS c(id uuid,revision uuid) WHERE a.id=c.id AND a.workspace_id=$2`,
          [JSON.stringify(restored.canonical),workspaceId]);
        await event(sql,actor,workspaceId,'WorkspaceRestored','workspace',workspaceId);
        return { id:workspaceId,name,role:'owner',policy:settings };
      });
    });
  }
}
