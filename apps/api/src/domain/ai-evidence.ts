import type { ArtifactDetail,Block,PatchInput } from '@akw/contracts';
import type { Sql } from '../platform/database';
import { conflict } from '../platform/errors';
import { sha256,stableJson } from '../platform/security';

export const aiPolicyVersion = 5;
type ArtifactScope = Pick<ArtifactDetail,'workspace_id'|'project_id'>;
type EvidenceRow = { id:string; title:string; quote:string; snapshot_id:string; content:string; offset_utf16:number;
  locator:{ start_utf16:number; end_utf16:number } };
export type AiPatchValidation = { policy_version:number; patch_hash:string; evidence:{ id:string; snapshot_id:string }[] };

export function blockEvidence(block:Block) {
  const ids = (block.children ?? []).flatMap(node => node.type === 'citation' && typeof node.attrs?.evidence_id === 'string' ? [node.attrs.evidence_id] : []);
  if (['image','figure','evidence_reference'].includes(block.type) && typeof block.attrs?.evidence_id === 'string') ids.push(block.attrs.evidence_id);
  return [...new Set(ids)];
}

export async function readAiEvidence(sql:Sql,scope:ArtifactScope,ids:string[],lock = false,external = true):Promise<EvidenceRow[]> {
  const expected = [...new Set(ids)];
  if (!expected.length) return [];
  if (lock) await sql.all(`SELECT s.id FROM sources s WHERE s.workspace_id=$1 AND s.id IN
    (SELECT e.source_id FROM evidence e WHERE e.id::text=ANY($2::text[])) ORDER BY s.id FOR SHARE`,[scope.workspace_id,expected]);
  const rows = await sql.all<EvidenceRow>(`SELECT e.id,s.title,e.quote,e.snapshot_id,e.locator,p.content,p.offset_utf16
    FROM evidence e JOIN sources s ON s.id=e.source_id JOIN passages p ON p.id=e.passage_id
    WHERE s.workspace_id=$1 AND e.id::text=ANY($2::text[]) AND s.lifecycle IN ('active','updated') AND e.verification_status='located'
      AND (NOT $4::boolean OR (s.sensitivity IN ('public','personal') AND s.rights <> 'restricted'))
      AND (s.project_id IS NULL OR s.project_id=$3 OR EXISTS (SELECT 1 FROM project_relations r
        WHERE r.workspace_id=$1 AND r.from_id=$3 AND r.to_id=s.project_id))
      AND e.snapshot_id=(SELECT id FROM source_snapshots WHERE source_id=s.id ORDER BY retrieved_at DESC,id DESC LIMIT 1)
    ORDER BY e.id`,[scope.workspace_id,expected,scope.project_id,external]);
  if (rows.length !== expected.length || rows.some(row => {
    const start=row.locator.start_utf16-row.offset_utf16,end=row.locator.end_utf16-row.offset_utf16;
    return start<0 || start>=end || end>row.content.length || row.content.slice(start,end)!==row.quote;
  })) throw conflict('CONFLICT_ANALYSIS_SOURCE','Evidence or its source has changed');
  return rows;
}

export async function sealAiPatch(sql:Sql,scope:ArtifactScope,patch:PatchInput,ids:string[]):Promise<AiPatchValidation> {
  const rows = await readAiEvidence(sql,scope,ids,true);
  return { policy_version:aiPolicyVersion,patch_hash:sha256(stableJson(patch)),
    evidence:rows.map(({ id,snapshot_id }) => ({ id,snapshot_id })) };
}

export async function verifyAiPatch(sql:Sql,scope:ArtifactScope,patch:PatchInput,stored:AiPatchValidation|null) {
  if (stored?.policy_version !== aiPolicyVersion || stored.patch_hash !== sha256(stableJson(patch)))
    throw conflict('CONFLICT_ANALYSIS_OUTDATED','Generate a new proposal for the current evidence policy');
  const current = await sealAiPatch(sql,scope,patch,stored.evidence.map(item => item.id));
  if (stableJson(current.evidence)!==stableJson(stored.evidence)) throw conflict('CONFLICT_ANALYSIS_SOURCE','Evidence snapshot has changed');
}
