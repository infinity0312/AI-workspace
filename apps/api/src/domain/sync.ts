import type { Mutation } from '@akw/contracts';
import type { Actor } from '../platform/security';
import { first, type Database } from '../platform/database';
import { conflict, invalid } from '../platform/errors';
import { idempotent, workspace } from './access';
import { Artifacts } from './artifacts';

export class Sync {
  constructor(private readonly db: Database, private readonly artifacts: Artifacts) {}
  submit(actor: Actor, mutation: Mutation) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, mutation.workspace_id, true);
      return idempotent(sql, actor, 'sync.mutation', mutation.mutation_id, mutation, async () => {
        const state = await first<{ deleted_at:Date|null }>(sql,'SELECT deleted_at FROM artifacts WHERE id=$1 AND workspace_id=$2',
          [mutation.entity_id,mutation.workspace_id]);
        if (!state) throw invalid('Mutation workspace and resource do not match');
        if (state.deleted_at) throw conflict('CONFLICT_ARTIFACT_DELETED','Document is in the trash. The local draft is preserved.');
        const artifact = await this.artifacts.get(actor, mutation.entity_id, sql);
        const sequenced = await first(sql,`INSERT INTO devices(workspace_id,user_id,tenant_id,id,last_sequence) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(workspace_id,user_id,id) DO UPDATE SET last_sequence=EXCLUDED.last_sequence,updated_at=now()
          WHERE devices.last_sequence<EXCLUDED.last_sequence RETURNING last_sequence`,
          [mutation.workspace_id, actor.user, actor.tenant, mutation.device_id, mutation.client_sequence]);
        if (!sequenced) throw conflict('CONFLICT_DEVICE_SEQUENCE', 'Client sequence was already used');
        const revision = await this.artifacts.editIn(sql, actor, artifact, mutation.payload, 'user', true, mutation.base_version);
        return { mutation_id: mutation.mutation_id, acknowledged: true, revision };
      });
    });
  }

  async changes(actor: Actor, id: string, cursor: string, limit: number) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, id, 'share');
      const rows = await sql.all<{ server_sequence: string }>(`SELECT server_sequence::text, event_id, event_type,
      '1.0' AS schema_version, tenant_id, workspace_id, aggregate_type, aggregate_id, aggregate_version, created_at AS occurred_at, payload
      FROM domain_outbox WHERE workspace_id=$1 AND tenant_id=$2 AND server_sequence>$3
      AND (audience_user_id IS NULL OR audience_user_id=$5) ORDER BY domain_outbox.server_sequence LIMIT $4`,
        [id, actor.tenant, cursor, limit + 1,actor.user]);
      const changes = rows.slice(0, limit);
      return { changes, next_cursor: changes.at(-1)?.server_sequence ?? cursor, has_more: rows.length > limit };
    });
  }

  snapshot(actor: Actor, id: string) {
    return this.db.transaction(async sql => {
      const access = await workspace(sql, actor, id, 'share');
      const artifacts = await sql.all(`SELECT a.id,a.title,a.kind,a.project_id,r.id AS revision_id,r.revision_number,r.content_json,r.content_hash
        FROM artifacts a JOIN artifact_revisions r ON r.id=a.canonical_revision_id WHERE a.workspace_id=$1 AND a.deleted_at IS NULL`, [id]);
      const projects = await sql.all('SELECT * FROM projects WHERE workspace_id=$1', [id]);
      const row = await first<{ cursor: string }>(sql, 'SELECT COALESCE(MAX(server_sequence),0)::text AS cursor FROM domain_outbox WHERE workspace_id=$1', [id]);
      return { workspace: access, artifacts, projects, cursor: row!.cursor };
    });
  }

  async devices(actor: Actor, ws: string) {
    await workspace(this.db, actor, ws);
    return this.db.all('SELECT id,last_sequence,acknowledged_cursor::text,updated_at FROM devices WHERE workspace_id=$1 AND user_id=$2 ORDER BY updated_at DESC', [ws,actor.user]);
  }

  ack(actor: Actor, id: string, device: string, cursor: string) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, id);
      const high = await first<{ cursor: string }>(sql, 'SELECT COALESCE(MAX(server_sequence),0)::text AS cursor FROM domain_outbox WHERE workspace_id=$1', [id]);
      if (BigInt(cursor) > BigInt(high!.cursor)) throw invalid('Cursor exceeds workspace high water mark');
      await sql.all(`INSERT INTO devices(workspace_id,user_id,tenant_id,id,acknowledged_cursor) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(workspace_id,user_id,id) DO UPDATE
        SET acknowledged_cursor=GREATEST(devices.acknowledged_cursor,EXCLUDED.acknowledged_cursor),updated_at=now()`,
        [id,actor.user,actor.tenant,device,cursor]);
      return { acknowledged: true };
    });
  }
}
