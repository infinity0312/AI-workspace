import { randomUUID } from 'node:crypto';
import type { StudyCard, StudyCardInput, StudyGoal, StudyGoalInput, StudyRating } from '@akw/contracts';
import { first, type Database, type Sql } from '../platform/database';
import { conflict, missing } from '../platform/errors';
import type { Actor } from '../platform/security';
import { event, idempotent, workspace } from './access';

type GoalRow = Omit<StudyGoal,'steps'> & { workspace_id:string };
type CardRow = StudyCard & { workspace_id:string };
async function activeArtifact(sql:Sql,ws:string,id?:string) {
  if (id && !await first(sql,'SELECT id FROM artifacts WHERE id=$1 AND workspace_id=$2 AND deleted_at IS NULL',[id,ws])) throw missing('Artifact');
}

export function nextReview(card: Pick<StudyCard,'streak'|'interval_minutes'>,rating:StudyRating) {
  const day = 1440;
  if (rating === 'again') return { minutes:10,streak:0 };
  if (rating === 'hard') return { minutes:Math.max(day,Math.round(card.interval_minutes * 1.2)),streak:card.streak };
  const streak = card.streak + 1;
  const minutes = rating === 'easy' ? Math.max(4 * day,Math.round(card.interval_minutes * 2.6))
    : streak === 1 ? day : streak === 2 ? 6 * day : Math.round(card.interval_minutes * 2.2);
  return { minutes:Math.min(minutes,365 * day),streak };
}

export class Study {
  constructor(private readonly db:Database) {}

  async overview(actor:Actor,ws:string) {
    await workspace(this.db,actor,ws);
    const goals = await this.db.all<GoalRow>(`SELECT id,title,notes,target_date::text,artifact_id,status,version
      FROM study_goals WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100`,[ws,actor.user]);
    const steps = goals.length ? await this.db.all<StudyGoal['steps'][number] & { goal_id:string }>(
      'SELECT id,goal_id,title,done FROM study_steps WHERE goal_id=ANY($1::uuid[]) ORDER BY goal_id,position',[goals.map(goal => goal.id)]) : [];
    const cards = await this.db.all<StudyCard>(`SELECT id,artifact_id,question,answer,due_at,interval_minutes,streak,version,
      due_at<=now() AS due FROM study_cards WHERE workspace_id=$1 AND user_id=$2 AND archived_at IS NULL ORDER BY due_at LIMIT 300`,
      [ws,actor.user]);
    return { goals:goals.map(goal => ({ ...goal,steps:steps.filter(step => step.goal_id === goal.id) })),cards };
  }

  createGoal(actor:Actor,input:StudyGoalInput,key?:string) {
    return this.db.transaction(async sql => {
      await workspace(sql,actor,input.workspace_id,true);
      return idempotent(sql,actor,'study.goal:' + input.workspace_id,key,input,async () => {
        await activeArtifact(sql,input.workspace_id,input.artifact_id);
        const id = randomUUID();
        const goal = await first<GoalRow>(sql,`INSERT INTO study_goals(id,workspace_id,user_id,title,notes,target_date,artifact_id)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,notes,target_date::text,artifact_id,status,version`,
          [id,input.workspace_id,actor.user,input.title,input.notes,input.target_date ?? null,input.artifact_id ?? null]);
        const steps: StudyGoal['steps'] = [];
        for (const [position,title] of input.steps.entries()) {
          const step = await first<StudyGoal['steps'][number]>(sql,`INSERT INTO study_steps(id,goal_id,title,position)
            VALUES($1,$2,$3,$4) RETURNING id,title,done`,[randomUUID(),id,title,position]);
          steps.push(step!);
        }
        await event(sql,actor,input.workspace_id,'StudyGoalCreated','study_goal',id,1,{},true);
        return { ...goal!,steps };
      });
    });
  }

  updateGoal(actor:Actor,id:string,input:{ version:number; step_id?:string; done?:boolean; completed?:boolean },key?:string) {
    return this.db.transaction(async sql => {
      const goal = await first<GoalRow>(sql,'SELECT * FROM study_goals WHERE id=$1 AND user_id=$2',[id,actor.user]);
      if (!goal) throw missing('Goal');
      await workspace(sql,actor,goal.workspace_id,true);
      return idempotent(sql,actor,'study.goal.update:' + id,key,input,async () => {
        if (input.step_id) {
          const step = await first(sql,'UPDATE study_steps SET done=$3 WHERE id=$1 AND goal_id=$2 RETURNING id',[input.step_id,id,input.done]);
          if (!step) throw missing('Study step');
        }
        const progress = await first<{ total:number; done:number }>(sql,`SELECT count(*)::int AS total,
          count(*) FILTER(WHERE done)::int AS done FROM study_steps WHERE goal_id=$1`,[id]);
        const completed = input.completed ?? (progress!.total > 0 && progress!.done === progress!.total);
        const changed = await first<GoalRow>(sql,`UPDATE study_goals SET status=$3,version=version+1
          WHERE id=$1 AND version=$2 RETURNING id,title,notes,target_date::text,artifact_id,status,version`,
          [id,input.version,completed ? 'completed' : 'active']);
        if (!changed) throw conflict('CONFLICT_STUDY_VERSION','Learning goal changed');
        const steps = await sql.all<StudyGoal['steps'][number]>('SELECT id,title,done FROM study_steps WHERE goal_id=$1 ORDER BY position',[id]);
        await event(sql,actor,goal.workspace_id,'StudyGoalProgress','study_goal',id,changed.version,{},true);
        return { ...changed,steps };
      });
    });
  }

  createCard(actor:Actor,input:StudyCardInput,key?:string) {
    return this.db.transaction(async sql => {
      await workspace(sql,actor,input.workspace_id,true);
      return idempotent(sql,actor,'study.card:' + input.workspace_id,key,input,async () => {
        await activeArtifact(sql,input.workspace_id,input.artifact_id);
        const id = randomUUID();
        const card = await first<StudyCard>(sql,`INSERT INTO study_cards(id,workspace_id,user_id,artifact_id,question,answer)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING id,artifact_id,question,answer,due_at,interval_minutes,streak,version,true AS due`,
          [id,input.workspace_id,actor.user,input.artifact_id ?? null,input.question,input.answer]);
        await event(sql,actor,input.workspace_id,'StudyCardCreated','study_card',id,1,{},true);
        return card!;
      });
    });
  }

  review(actor:Actor,id:string,input:{ version:number; rating:StudyRating },key?:string) {
    return this.db.transaction(async sql => {
      const candidate = await first<CardRow>(sql,'SELECT * FROM study_cards WHERE id=$1 AND user_id=$2',[id,actor.user]);
      if (!candidate) throw missing('Study card');
      await workspace(sql,actor,candidate.workspace_id,true);
      return idempotent(sql,actor,'study.card.review:' + id,key,input,async () => {
        const card = await first<CardRow>(sql,'SELECT * FROM study_cards WHERE id=$1 AND archived_at IS NULL',[id]);
        if (!card || card.version !== input.version) throw conflict('CONFLICT_STUDY_VERSION','Review card changed');
        const interval = nextReview(card,input.rating);
        const updated = await first<StudyCard>(sql,`UPDATE study_cards SET due_at=now()+make_interval(mins=>$2),interval_minutes=$2,
          streak=$3,version=version+1 WHERE id=$1 RETURNING id,artifact_id,question,answer,due_at,interval_minutes,streak,version,false AS due`,
          [id,interval.minutes,interval.streak]);
        await sql.all('INSERT INTO study_reviews(id,card_id,rating,next_due_at) VALUES($1,$2,$3,$4)',
          [randomUUID(),id,input.rating,updated!.due_at]);
        await event(sql,actor,candidate.workspace_id,'StudyCardReviewed','study_card',id,updated!.version,{},true);
        return updated!;
      });
    });
  }

  archiveCard(actor:Actor,id:string,version:number,key?:string) {
    return this.db.transaction(async sql => {
      const candidate = await first<CardRow>(sql,'SELECT * FROM study_cards WHERE id=$1 AND user_id=$2',[id,actor.user]);
      if (!candidate) throw missing('Study card');
      await workspace(sql,actor,candidate.workspace_id,true);
      return idempotent(sql,actor,'study.card.archive:' + id,key,{ version },async () => {
        const row = await first<{ version:number }>(sql,`UPDATE study_cards SET archived_at=now(),version=version+1
          WHERE id=$1 AND version=$2 AND archived_at IS NULL RETURNING version`,[id,version]);
        if (!row) throw conflict('CONFLICT_STUDY_VERSION','Review card changed');
        await event(sql,actor,candidate.workspace_id,'StudyCardArchived','study_card',id,row.version,{},true);
        return { id,version:row.version };
      });
    });
  }
}
