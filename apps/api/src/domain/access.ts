import { randomUUID } from 'node:crypto';
import type { Actor } from '../platform/security';
import { sha256, stableJson } from '../platform/security';
import { first, type Database, type Row, type Sql } from '../platform/database';
import { conflict, denied, invalid, missing } from '../platform/errors';

export interface WorkspaceAccess {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  policy: { externalProviderAllowed: boolean; sensitivity: string };
}
export async function workspace(sql: Sql, actor: Actor, workspaceId: string, lock: boolean|'share' = false) {
  const resource = await first<WorkspaceAccess>(sql, `SELECT w.id,w.name,w.policy,m.role
    FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id
    JOIN tenant_memberships tm ON tm.tenant_id=w.tenant_id AND tm.user_id=m.user_id
    WHERE w.id=$1 AND w.tenant_id=$2 AND m.user_id=$3 ${lock === 'share' ? 'FOR SHARE OF w' : lock ? 'FOR UPDATE OF w' : ''}`, [workspaceId, actor.tenant, actor.user]);
  if (!resource) throw missing('Workspace');
  if (lock === true && resource.role === 'viewer') throw denied();
  return resource;
}
export async function assertProject(sql: Sql, workspaceId: string, projectId?: string | null) {
  if (projectId && !await first(sql, 'SELECT id FROM projects WHERE workspace_id=$1 AND id=$2', [workspaceId, projectId])) throw missing('Project');
}
export async function ensureIdentity(sql: Sql, actor: Actor) {
  await sql.all('INSERT INTO tenants(id) VALUES($1) ON CONFLICT DO NOTHING', [actor.tenant]);
  await sql.all('INSERT INTO users(id) VALUES($1) ON CONFLICT DO NOTHING', [actor.user]);
  await sql.all('INSERT INTO tenant_memberships(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.tenant, actor.user]);
}
export async function event(sql: Sql, actor: Actor, workspaceId: string, type: string, aggregateType: string, resourceId: string, version = 1, payload: Row = {}, personal = false) {
  const row = await first<{ server_sequence: string | number }>(sql, `INSERT INTO domain_outbox
    (event_id,tenant_id,workspace_id,event_type,aggregate_type,aggregate_id,aggregate_version,payload,audience_user_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING server_sequence`,
    [randomUUID(), actor.tenant, workspaceId, type, aggregateType, resourceId, version, JSON.stringify(payload),personal ? actor.user : null]);
  await sql.all(`INSERT INTO audit_log(id,tenant_id,workspace_id,actor_id,action,resource_id) VALUES($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), actor.tenant, workspaceId, actor.user, type, resourceId]);
  return String(row!.server_sequence);
}
export async function idempotent<T extends object>(
  sql: Sql, actor: Actor, scope: string, key: string | undefined, request: unknown, perform: () => Promise<T>,
): Promise<T> {
  if (!key) return perform();
  if (key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) throw invalid('Invalid Idempotency-Key');
  const hash = sha256(stableJson(request));
  const args = [actor.tenant, actor.user, scope, key];
  const inserted = await first(sql, `INSERT INTO idempotency(tenant_id,user_id,scope,key,request_hash)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING key`, [...args, hash]);
  if (!inserted) {
    const saved = await first<{ request_hash: string; response: T }>(sql, 'SELECT request_hash,response FROM idempotency WHERE tenant_id=$1 AND user_id=$2 AND scope=$3 AND key=$4', args);
    if (saved?.request_hash !== hash) throw conflict('CONFLICT_IDEMPOTENCY', 'Idempotency key was used with a different request');
    return saved.response;
  }
  const result = await perform();
  await sql.all('UPDATE idempotency SET response=$5 WHERE tenant_id=$1 AND user_id=$2 AND scope=$3 AND key=$4', [...args, JSON.stringify(result)]);
  return result;
}

export class Workspaces {
  constructor(private readonly db: Database) {}
  list(actor: Actor) {
    return this.db.all<WorkspaceAccess>(`SELECT w.id,w.name,w.policy,m.role FROM workspaces w
      JOIN workspace_memberships m ON w.id=m.workspace_id
      JOIN tenant_memberships tm ON tm.tenant_id=w.tenant_id AND tm.user_id=m.user_id
      WHERE w.tenant_id=$1 AND m.user_id=$2 ORDER BY w.created_at DESC LIMIT 200`, [actor.tenant, actor.user]);
  }
  get(actor: Actor, id: string) { return workspace(this.db, actor, id); }
  create(actor: Actor, input: { name: string; policy?: WorkspaceAccess['policy'] }, key?: string) {
    return this.db.transaction(async sql => {
      await ensureIdentity(sql, actor);
      return idempotent(sql, actor, 'workspace.create', key, input, async () => {
        const id = randomUUID();
        const policy = input.policy ?? { externalProviderAllowed: false, sensitivity: 'personal' };
        await sql.all('INSERT INTO workspaces(id,tenant_id,owner_id,name,policy) VALUES($1,$2,$3,$4,$5)',
          [id, actor.tenant, actor.user, input.name, JSON.stringify(policy)]);
        await sql.all("INSERT INTO workspace_memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')", [id, actor.user]);
        await event(sql, actor, id, 'WorkspaceCreated', 'workspace', id);
        return { id, name: input.name, policy, role: 'owner' as const };
      });
    });
  }
  updatePolicy(actor: Actor, id: string, policy: WorkspaceAccess['policy'], key?: string) {
    return this.db.transaction(async sql => {
      const access = await workspace(sql, actor, id, true);
      if (access.role !== 'owner') throw denied();
      return idempotent(sql, actor, 'workspace.policy:' + id, key, policy, async () => {
        await sql.all('UPDATE workspaces SET policy=$2 WHERE id=$1', [id, JSON.stringify(policy)]);
        await event(sql, actor, id, 'WorkspacePolicyChanged', 'workspace', id);
        return { ...access, policy };
      });
    });
  }
  async projects(actor: Actor, id: string) {
    await workspace(this.db, actor, id);
    return this.db.all('SELECT * FROM projects WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200', [id]);
  }
  createProject(actor: Actor, id: string, input: { name: string; description: string }, key?: string) {
    return this.db.transaction(async sql => {
      await workspace(sql, actor, id, true);
      return idempotent(sql, actor, 'project.create:' + id, key, input, async () => {
        const project = await first(sql, 'INSERT INTO projects(id,workspace_id,name,description) VALUES($1,$2,$3,$4) RETURNING *',
          [randomUUID(), id, input.name, input.description]);
        await event(sql, actor, id, 'ProjectCreated', 'project', String(project!.id));
        return project!;
      });
    });
  }
  updateProject(actor: Actor, projectId: string, input: { name?: string; description?: string; version: number }, key?: string) {
    return this.db.transaction(async sql => {
      const project = await first<{ workspace_id: string }>(sql, 'SELECT workspace_id FROM projects WHERE id=$1', [projectId]);
      if (!project) throw missing('Project');
      await workspace(sql, actor, project.workspace_id, true);
      return idempotent(sql, actor, 'project.update:' + projectId, key, input, async () => {
        const updated = await first(sql, `UPDATE projects SET name=COALESCE($2,name),description=COALESCE($3,description),version=version+1
          WHERE id=$1 AND version=$4 RETURNING *`, [projectId,input.name ?? null,input.description ?? null,input.version]);
        if (!updated) throw conflict('CONFLICT_PROJECT_VERSION', 'Project has changed');
        await event(sql, actor, project.workspace_id, 'ProjectUpdated', 'project', projectId, Number(updated.version));
        return updated;
      });
    });
  }
  relateProjects(actor: Actor, projectId: string, targetId: string, key?: string) {
    return this.db.transaction(async sql => {
      const project = await first<{ workspace_id: string }>(sql, 'SELECT workspace_id FROM projects WHERE id=$1', [projectId]);
      if (!project) throw missing('Project');
      await workspace(sql, actor, project.workspace_id, true);
      await assertProject(sql, project.workspace_id, targetId);
      if (projectId === targetId) throw invalid('Use two distinct projects');
      return idempotent(sql, actor, 'project.relation:' + projectId, key, { targetId }, async () => {
        const added = await first(sql, `INSERT INTO project_relations(workspace_id,from_id,to_id,created_by)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING from_id`, [project.workspace_id,projectId,targetId,actor.user]);
        if (added) await event(sql, actor, project.workspace_id, 'ProjectRelated', 'project', projectId, 1, { target_id: targetId });
        return { from_id: projectId, to_id: targetId };
      });
    });
  }
}
