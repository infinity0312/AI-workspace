import { randomUUID } from 'node:crypto';
import { artifactDocument, emptyDocument, type CaptureAction, type CaptureInput, type CaptureItem, type ClaimInput, type ClaimReview, type SearchHit, type claimDecision } from '@akw/contracts';
import type { z } from 'zod';
import { first, type Database } from '../platform/database';
import { conflict, invalid, missing, parse } from '../platform/errors';
import { canonicalUrl } from '../platform/public-web';
import type { Actor } from '../platform/security';
import { assertProject, event, idempotent, workspace } from './access';
import type { Artifacts } from './artifacts';
import { boundedText } from './document-analysis';
import type { Knowledge } from './knowledge';

type Claim = Omit<ClaimReview,'evidence'|'reviews'> & { workspace_id:string };
type Decision = z.infer<typeof claimDecision>;

export class Library {
  constructor(private readonly db:Database,private readonly artifacts:Artifacts,private readonly knowledge:Knowledge) {}

  async captures(actor: Actor,workspaceId: string) {
    await workspace(this.db,actor,workspaceId);
    return this.db.all<CaptureItem>(`SELECT id,workspace_id,title,text_body,url,asset_id,status,sensitivity,rights,result_kind,result_id,created_at
      FROM capture_items WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 250`,[workspaceId,actor.user]);
  }

  capture(actor: Actor,input: CaptureInput,key?: string) {
    return this.db.transaction(async sql => {
      await workspace(sql,actor,input.workspace_id,true);
      return idempotent(sql,actor,'capture.create:' + input.workspace_id,key,input,async () => {
        if (input.asset_id && !await first(sql,'SELECT id FROM assets WHERE id=$1 AND workspace_id=$2 AND owner_id=$3',
          [input.asset_id,input.workspace_id,actor.user])) throw missing('Asset');
        const id = randomUUID();
        const url = input.url ? canonicalUrl(input.url).href : null;
        const item = await first<CaptureItem>(sql,`INSERT INTO capture_items
          (id,workspace_id,user_id,title,text_body,url,asset_id,sensitivity,rights)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [id,input.workspace_id,actor.user,input.title,input.text ?? null,url,input.asset_id ?? null,input.sensitivity,input.rights]);
        await event(sql,actor,input.workspace_id,'CaptureAdded','capture',id,1,{},true);
        return item!;
      });
    });
  }

  processCapture(actor: Actor,id: string,input: CaptureAction,key?: string) {
    return this.db.transaction(async sql => {
      const candidate = await first<CaptureItem>(sql,'SELECT * FROM capture_items WHERE id=$1 AND user_id=$2',[id,actor.user]);
      if (!candidate) throw missing('Capture');
      await workspace(sql,actor,candidate.workspace_id,true);
      return idempotent(sql,actor,'capture.process:' + id,key,input,async () => {
        const item = (await first<CaptureItem>(sql,'SELECT * FROM capture_items WHERE id=$1',[id]))!;
        const previous = input.action === 'reopen' ? 'dismissed' : 'inbox';
        if (item.status !== previous) throw conflict('CONFLICT_CAPTURE_STATUS','Capture is already processed or its status changed');
        let status: CaptureItem['status'] = input.action === 'reopen' ? 'inbox' : 'dismissed';
        let resultKind: CaptureItem['result_kind'] = null;
        let resultId: string|null = null;
        if (input.action === 'note' || input.action === 'source') {
          await assertProject(sql,item.workspace_id,input.project_id);
          status = 'processed';
          resultKind = input.action;
          if (input.action === 'source') {
            const source = await this.knowledge.registerContentIn(sql,actor,{
              workspace_id:item.workspace_id,project_id:input.project_id,title:item.title,
              text:item.text_body ?? undefined,url:item.url ?? undefined,asset_id:item.asset_id ?? undefined,
              rights:item.rights,sensitivity:item.sensitivity,
            });
            resultId = source.id;
          } else {
            if (item.asset_id) throw invalid('Process file captures as sources');
            const document = emptyDocument();
            let text = item.text_body ?? item.url ?? '';
            while (text) {
              const part = boundedText(text,10000);
              if (!part.length) throw invalid('Captured text contains an overlong grapheme');
              document.blocks.push({ id:randomUUID(),type:'paragraph',children:[{ type:'text',text:part }] });
              text = text.slice(part.length);
            }
            const artifact = await this.artifacts.createIn(sql,actor,{
              workspace_id:item.workspace_id,project_id:input.project_id,title:item.title,kind:'note',content:parse(artifactDocument,document),
            });
            resultId = artifact.id;
          }
        }
        const updated = await first<CaptureItem>(sql,`UPDATE capture_items SET status=$2,result_kind=$3,result_id=$4,updated_at=now()
          WHERE id=$1 RETURNING *`,[id,status,resultKind,resultId]);
        await event(sql,actor,item.workspace_id,'CaptureStatusChanged','capture',id,1,{ status },true);
        return updated!;
      });
    });
  }

  async search(actor:Actor,ws:string,query:string) {
    await workspace(this.db,actor,ws);
    return this.db.all<SearchHit>(`WITH hits AS (
      SELECT a.id,'artifact' AS kind,a.title,a.updated_at AS changed,body.text AS excerpt,
        CASE WHEN strpos(lower(a.title),lower($2))>0 THEN 0 ELSE 1 END AS rank
      FROM artifacts a JOIN artifact_revisions r ON r.id=a.canonical_revision_id
      LEFT JOIN LATERAL (
        SELECT line #>> '{}' AS text FROM jsonb_path_query(r.content_json,'$.blocks[*].children[*].text') line
        WHERE strpos(lower(line #>> '{}'),lower($2))>0 LIMIT 1
      ) body ON true WHERE a.workspace_id=$1 AND a.deleted_at IS NULL AND (strpos(lower(a.title),lower($2))>0 OR body.text IS NOT NULL)
      UNION ALL
      SELECT s.id,'source',s.title,s.created_at,p.content,
        CASE WHEN strpos(lower(s.title),lower($2))>0 THEN 0 ELSE 1 END
      FROM sources s LEFT JOIN LATERAL (
        SELECT p.content FROM passages p WHERE p.document_id=(SELECT id FROM documents WHERE source_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1)
          AND strpos(lower(p.content),lower($2))>0 ORDER BY ordinal LIMIT 1
      ) p ON true WHERE s.workspace_id=$1 AND s.lifecycle IN ('active','updated') AND (strpos(lower(s.title),lower($2))>0 OR p.content IS NOT NULL)
      UNION ALL
      SELECT id,'claim',left(statement,160),created_at,statement,2 FROM claims WHERE workspace_id=$1 AND strpos(lower(statement || ' ' || scope),lower($2))>0
      UNION ALL
      SELECT id,'node',title,created_at,description,2 FROM knowledge_nodes WHERE workspace_id=$1 AND strpos(lower(title || ' ' || description),lower($2))>0
      UNION ALL
      SELECT id,'capture',title,created_at,COALESCE(text_body,url,''),2 FROM capture_items WHERE workspace_id=$1 AND user_id=$3
        AND status='inbox' AND strpos(lower(title || ' ' || COALESCE(text_body,url,'')),lower($2))>0
    )
    SELECT id,kind,title,COALESCE(substring(excerpt from GREATEST(1,strpos(lower(excerpt),lower($2))-40) for 240),'') AS excerpt
    FROM hits ORDER BY rank,changed DESC LIMIT 60`,[ws,query,actor.user]);
  }

  async maintenance(actor: Actor,ws: string) {
    await workspace(this.db,actor,ws);
    const claims = await this.db.all<Claim & { evidence_count:number }>(`SELECT c.id,c.statement,c.scope,c.status,c.version,
      (SELECT count(*)::int FROM claim_evidence ce WHERE ce.claim_id=c.id) AS evidence_count
      FROM claims c WHERE c.workspace_id=$1 ORDER BY CASE WHEN c.status='needs_review' THEN 0 WHEN c.status='proposed' THEN 1 ELSE 2 END,
        c.created_at DESC LIMIT 200`,[ws]);
    const sources = await this.db.all(`SELECT id,title,lifecycle,checked_at FROM sources WHERE workspace_id=$1
      AND lifecycle IN ('inaccessible','retracted','updated') ORDER BY checked_at DESC NULLS LAST LIMIT 100`,[ws]);
    const pendingEdges = await first<{ count:number }>(this.db,
      "SELECT count(*)::int AS count FROM knowledge_edges WHERE workspace_id=$1 AND status='proposed'",[ws]);
    return { claims,sources,pending_edges:pendingEdges?.count ?? 0 };
  }

  createClaim(actor:Actor,input:ClaimInput,key?:string) {
    return this.db.transaction(async sql => {
      await workspace(sql,actor,input.workspace_id,true);
      return idempotent(sql,actor,'claim.create:' + input.workspace_id,key,input,async () => {
        const ids = [...new Set(input.evidence_ids)];
        const available = await sql.all(`SELECT e.id FROM evidence e JOIN sources s ON s.id=e.source_id
          WHERE s.workspace_id=$1 AND e.id=ANY($2::uuid[])`,[input.workspace_id,ids]);
        if (available.length !== ids.length) throw missing('Evidence');
        const row = await first<Claim>(sql,`INSERT INTO claims(id,workspace_id,statement,scope,status)
          VALUES($1,$2,$3,$4,'proposed') RETURNING *`,[randomUUID(),input.workspace_id,input.statement,input.scope]);
        for (const evidenceId of ids) await sql.all('INSERT INTO claim_evidence(claim_id,evidence_id) VALUES($1,$2)',[row!.id,evidenceId]);
        await event(sql,actor,input.workspace_id,'ClaimProposed','claim',row!.id);
        return row!;
      });
    });
  }

  async claim(actor: Actor,id: string): Promise<ClaimReview> {
    const row = await first<Claim>(this.db,'SELECT id,workspace_id,statement,scope,status,version FROM claims WHERE id=$1',[id]);
    if (!row) throw missing('Claim');
    await workspace(this.db,actor,row.workspace_id);
    const evidence = await this.db.all<ClaimReview['evidence'][number]>(`SELECT e.id,e.quote,s.id AS source_id,s.title,s.lifecycle
      FROM claim_evidence ce JOIN evidence e ON ce.evidence_id=e.id JOIN sources s ON s.id=e.source_id
      WHERE ce.claim_id=$1 AND s.workspace_id=$2 ORDER BY e.created_at`,[id,row.workspace_id]);
    const reviews = await this.db.all<ClaimReview['reviews'][number]>(
      'SELECT id,decision,reason,created_at FROM claim_reviews WHERE claim_id=$1 ORDER BY created_at DESC LIMIT 100',[id]);
    return { id:row.id,statement:row.statement,scope:row.scope,status:row.status,version:row.version,evidence,reviews };
  }

  reviewClaim(actor: Actor,id: string,input: Decision,key?: string) {
    return this.db.transaction(async sql => {
      const claim = await first<Claim>(sql,'SELECT * FROM claims WHERE id=$1',[id]);
      if (!claim) throw missing('Claim');
      await workspace(sql,actor,claim.workspace_id,true);
      return idempotent(sql,actor,'claim.review:' + id,key,input,async () => {
        const previous = await first<Claim>(sql,'SELECT * FROM claims WHERE id=$1',[id]);
        if (previous?.version !== input.version) throw conflict('CONFLICT_CLAIM_VERSION','Claim changed before review');
        if (input.decision === 'supported' && !await first(sql,`SELECT e.id FROM claim_evidence ce JOIN evidence e ON e.id=ce.evidence_id
          JOIN sources s ON s.id=e.source_id WHERE ce.claim_id=$1 AND s.workspace_id=$2 AND s.lifecycle IN ('active','updated')
          AND e.verification_status='located' AND e.snapshot_id=(SELECT id FROM source_snapshots WHERE source_id=s.id ORDER BY retrieved_at DESC,id DESC LIMIT 1) LIMIT 1`,
          [id,claim.workspace_id])) throw invalid('An active source is required to confirm support');
        const changed = await first<Claim>(sql,`UPDATE claims SET status=$3,reviewed_at=now(),version=version+1
          WHERE id=$1 AND version=$2 RETURNING *`,[id,input.version,input.decision]);
        if (!changed) throw conflict('CONFLICT_CLAIM_VERSION','Claim changed before review');
        await sql.all(`INSERT INTO claim_reviews(id,claim_id,actor_id,previous_status,decision,reason)
          VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),id,actor.user,previous.status,input.decision,input.reason]);
        await event(sql,actor,claim.workspace_id,'ClaimReviewed','claim',id,changed.version,{ decision:input.decision });
        return changed;
      });
    });
  }
}
