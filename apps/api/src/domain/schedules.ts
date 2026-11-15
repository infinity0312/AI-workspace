import { randomUUID } from 'node:crypto';
import type { Schedule, ScheduleInput, ScheduleUpdate } from '@akw/contracts';
import { first, type Database, type Sql } from '../platform/database';
import { AppError, conflict, denied, missing } from '../platform/errors';
import type { Actor } from '../platform/security';
import { event, idempotent, workspace } from './access';
import { Jobs } from './jobs';

type Row = Schedule & { workspace_id:string; tenant_id:string; user_id:string };
const columns = 'id,title,target,cadence_hours,enabled,next_run_at,last_run_at,last_job_id,last_skip_reason,version';

export class Schedules {
  constructor(private readonly db:Database,private readonly jobs:Jobs) {}

  async list(actor:Actor,ws:string) {
    await workspace(this.db,actor,ws);
    return this.db.all<Schedule>('SELECT ' + columns + ' FROM research_schedules WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100',[ws,actor.user]);
  }

  private async verify(sql:Sql,actor:Actor,ws:string,target:Schedule['target']) {
    const access = await workspace(sql,actor,ws,true);
    if (target.kind === 'research' && target.allow_external &&
        (!access.policy.externalProviderAllowed || !['public','personal'].includes(access.policy.sensitivity))) throw denied();
    if (target.kind === 'source' && !await first(sql,`SELECT id FROM sources WHERE id=$1 AND workspace_id=$2
      AND lifecycle NOT IN ('archived','retracted') AND canonical_url IS NOT NULL`,[target.source_id,ws])) throw missing('URL source');
  }

  create(actor:Actor,input:ScheduleInput,key?:string) {
    return this.db.transaction(async sql => {
      await this.verify(sql,actor,input.workspace_id,input.target);
      return idempotent(sql,actor,'schedule.create:' + input.workspace_id,key,input,async () => {
        const row = await first<Schedule>(sql,`INSERT INTO research_schedules(id,workspace_id,tenant_id,user_id,title,target,cadence_hours,next_run_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,now()+make_interval(hours=>$7)) RETURNING ` + columns,
          [randomUUID(),input.workspace_id,actor.tenant,actor.user,input.title,JSON.stringify(input.target),input.cadence_hours]);
        await event(sql,actor,input.workspace_id,'ScheduleCreated','schedule',row!.id,1,{},true);
        return row!;
      });
    });
  }

  change(actor:Actor,id:string,input:ScheduleUpdate,key?:string) {
    return this.db.transaction(async sql => {
      const row = await first<Row>(sql,'SELECT * FROM research_schedules WHERE id=$1 AND tenant_id=$2 AND user_id=$3',[id,actor.tenant,actor.user]);
      if (!row) throw missing('Schedule');
      await workspace(sql,actor,row.workspace_id,true);
      return idempotent(sql,actor,'schedule.change:' + id,key,input,async () => {
        if (input.enabled) await this.verify(sql,actor,row.workspace_id,row.target);
        const updated = await first<Schedule>(sql,`UPDATE research_schedules SET enabled=$3,cadence_hours=COALESCE($4,cadence_hours),
          next_run_at=CASE WHEN $3 THEN now()+make_interval(hours=>COALESCE($4,cadence_hours)) ELSE next_run_at END,
          last_skip_reason=NULL,version=version+1 WHERE id=$1 AND version=$2 RETURNING ` + columns,
          [id,input.version,input.enabled,input.cadence_hours ?? null]);
        if (!updated) throw conflict('CONFLICT_SCHEDULE_VERSION','Schedule has changed');
        await event(sql,actor,row.workspace_id,'ScheduleChanged','schedule',id,updated.version,{},true);
        return updated;
      });
    });
  }

  async enqueueDue() {
    const due = await this.db.all<{ id:string; workspace_id:string }>(
      'SELECT id,workspace_id FROM research_schedules WHERE enabled AND next_run_at<=now() ORDER BY next_run_at LIMIT 12');
    for (const item of due) await this.db.transaction(async sql => {
      await sql.all('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[item.workspace_id]);
      const row = await first<Row>(sql,'SELECT * FROM research_schedules WHERE id=$1 AND enabled AND next_run_at<=now() FOR UPDATE',[item.id]);
      if (!row) return;
      const actor = { tenant:row.tenant_id,user:row.user_id };
      let skip:string|null = null;
      let run:string|null = null;
      try { await this.verify(sql,actor,row.workspace_id,row.target); }
      catch (error) {
        if (!(error instanceof AppError) || ![403,404].includes(error.getStatus())) throw error;
        skip = 'policy_or_access';
      }
      if (!skip && row.last_job_id && await first(sql,`SELECT id FROM jobs WHERE id=$1 AND status IN ('QUEUED','PLANNING','RUNNING','PAUSED')`,[row.last_job_id])) {
        skip = 'previous_run_active';
      }
      if (!skip) run = (await this.jobs.enqueueSchedule(sql,actor,row.workspace_id,row.target)).run_id;
      await sql.all(`UPDATE research_schedules SET next_run_at=now()+make_interval(hours=>cadence_hours),
        last_run_at=CASE WHEN $2::uuid IS NULL THEN last_run_at ELSE now() END,last_job_id=COALESCE($2,last_job_id),
        last_skip_reason=$3,enabled=CASE WHEN $3='policy_or_access' THEN false ELSE enabled END,version=version+1 WHERE id=$1`,[row.id,run,skip]);
      await event(sql,actor,row.workspace_id,skip ? 'ScheduleSkipped' : 'ScheduleRunQueued','schedule',row.id,row.version+1,{},true);
    });
  }
}
