import type { ArtifactDetail, WorkspaceEvidence, WorkspaceReferences } from '@akw/contracts';
import type { Sql } from '../platform/database';

export async function artifactReferences(sql:Sql,artifact:ArtifactDetail,extraEvidence:string[] = []):Promise<WorkspaceReferences> {
  const content = artifact.revision.content_json;
  const anchors = new Map<string,string[]>();
  const sources = new Set(content.relations.source_ids);
  const embeds = new Set<string>();
  const claimBlocks = new Map<string,string[]>();
  for (const block of content.blocks) {
    const attach = (evidence:unknown) => {
      if (typeof evidence === 'string' && /^[\da-f-]{36}$/i.test(evidence))
        anchors.set(evidence,[...new Set([...(anchors.get(evidence) ?? []),block.id])]);
    };
    if (typeof block.attrs?.source_id === 'string' && block.type === 'source_embed') sources.add(block.attrs.source_id);
    if (typeof block.attrs?.artifact_id === 'string' && block.type === 'artifact_embed') embeds.add(block.attrs.artifact_id);
    const claimId=block.attrs?.claim_id;
    if (typeof claimId==='string' && /^[\da-f-]{36}$/i.test(claimId))
      claimBlocks.set(claimId,[...(claimBlocks.get(claimId) ?? []),block.id]);
    attach(block.attrs?.evidence_id);
    for (const inline of block.children ?? []) if (inline.type === 'citation') attach(inline.attrs?.evidence_id);
  }
  const ws = artifact.workspace_id, project = artifact.project_id;
  const cited = [...new Set([...anchors.keys(),...extraEvidence])].slice(0,500);
  const inScope = (alias:string) => `(${alias}.project_id IS NULL OR ${alias}.project_id=$2)`;
  const scopedLink = (alias:string) => `EXISTS(SELECT 1 FROM project_relations r WHERE r.workspace_id=$1 AND r.from_id=$2 AND r.to_id=${alias}.project_id)`;
  const sourceRows = await sql.all<WorkspaceReferences['sources'][number]>(`SELECT s.id,s.title,s.canonical_url,s.asset_id,a.mime,s.lifecycle,s.metadata
    FROM sources s LEFT JOIN assets a ON a.id=s.asset_id AND a.visibility='workspace'
    WHERE s.workspace_id=$1 AND (${inScope('s')} OR ((s.id=ANY($3::uuid[]) OR EXISTS(
      SELECT 1 FROM evidence e WHERE e.source_id=s.id AND e.id=ANY($4::uuid[]))) AND ${scopedLink('s')}))
    ORDER BY (s.id=ANY($3::uuid[]) OR EXISTS(SELECT 1 FROM evidence e WHERE e.source_id=s.id AND e.id=ANY($4::uuid[]))) DESC,
      s.created_at DESC,s.id LIMIT 200`,[ws,project,[...sources],cited]);
  const sourceIds = sourceRows.map(row => row.id);
  const evidenceRows = await sql.all<Omit<WorkspaceEvidence,'block_ids'|'in_document'>>(`SELECT e.id,e.source_id,s.title,left(e.quote,1000) AS quote,
    (e.locator->>'page')::int AS page,e.snapshot_id,s.lifecycle
    FROM evidence e JOIN sources s ON s.id=e.source_id WHERE s.workspace_id=$1 AND s.id=ANY($2::uuid[])
      AND (e.id=ANY($3::uuid[]) OR (s.lifecycle IN ('active','updated') AND e.verification_status='located'
        AND e.snapshot_id=(SELECT id FROM source_snapshots WHERE source_id=s.id ORDER BY retrieved_at DESC,id DESC LIMIT 1)))
    ORDER BY (e.id=ANY($3::uuid[])) DESC,e.created_at DESC,e.id LIMIT 350`,[ws,sourceIds,cited]);
  const evidence = evidenceRows.map(row => ({ ...row,block_ids:anchors.get(row.id) ?? [],in_document:anchors.has(row.id) || sources.has(row.source_id) }));
  const relevant = [...new Set([...cited,...evidenceRows.filter(row => sources.has(row.source_id)).map(row => row.id)])];
  const claimRows = await sql.all<WorkspaceReferences['claims'][number]>(`SELECT c.id,c.statement,c.scope,c.status,
    ARRAY(SELECT ce.evidence_id FROM claim_evidence ce WHERE ce.claim_id=c.id AND ce.evidence_id=ANY($2::uuid[]) ORDER BY ce.evidence_id) AS evidence_ids
    FROM claims c WHERE c.workspace_id=$1 AND (c.id=ANY($3::uuid[]) OR EXISTS(
      SELECT 1 FROM claim_evidence ce WHERE ce.claim_id=c.id AND ce.evidence_id=ANY($4::uuid[])))
    ORDER BY c.created_at DESC,c.id LIMIT 100`,[ws,evidence.map(row => row.id),[...claimBlocks.keys()],relevant]);
  const artifacts = await sql.all<WorkspaceReferences['artifacts'][number]>(`SELECT a.id,a.title,a.kind,
    left(COALESCE(jsonb_path_query_first(r.content_json,'$.blocks[*] ? (@.type == "paragraph").children[*].text') #>> '{}',''),500) AS excerpt
    FROM artifacts a JOIN artifact_revisions r ON r.id=a.canonical_revision_id
    WHERE a.workspace_id=$1 AND a.id<>$3 AND a.deleted_at IS NULL AND
      (${inScope('a')} OR (a.id=ANY($4::uuid[]) AND ${scopedLink('a')}))
    ORDER BY (a.id=ANY($4::uuid[])) DESC,a.updated_at DESC,a.id LIMIT 150`,[ws,project,artifact.id,[...embeds]]);
  return { sources:sourceRows,evidence,claims:claimRows.map(claim=>({ ...claim,block_ids:claimBlocks.get(claim.id) ?? [] })),artifacts };
}
