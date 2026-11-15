import { randomUUID } from 'node:crypto';
import { learningLessonAttrs,type ArtifactDetail,type LearningAssessment,type LearningAssessmentResult,type LearningMastery } from '@akw/contracts';
import type { Database } from '../platform/database';
import type { Actor } from '../platform/security';
import { conflict,invalid,missing } from '../platform/errors';
import { idempotent } from './access';
import type { Artifacts } from './artifacts';

export class LearningProgress {
  constructor(private readonly db:Database,private readonly artifacts:Artifacts) {}
  async mastery(actor:Actor,id:string):Promise<LearningMastery> {
    return learningMastery(this.db,actor,await this.artifacts.get(actor,id));
  }
  submit(actor:Actor,id:string,input:LearningAssessment,key?:string):Promise<LearningAssessmentResult> {
    return this.db.transaction(async sql=>{
      const artifact=await this.artifacts.get(actor,id,sql,true);
      return idempotent(sql,actor,'learning.assessment:'+id,key,input,async()=>{
        if (input.revision_id!==artifact.revision.id) throw conflict('CONFLICT_ARTIFACT_VERSION','Reload the current learning artifact');
        const block=artifact.revision.content_json.blocks.find(item=>item.id===input.lesson_id && item.type==='learning_lesson');
        if (!block) throw missing('Lesson');
        const parsed=learningLessonAttrs.safeParse(block.attrs);
        if (!parsed.success || !parsed.data.practice.length || input.answers.length!==parsed.data.practice.length)
          throw invalid('Answer every question in one lesson');
        const items=parsed.data.practice.map((item,index)=>({ correct:item.answer===input.answers[index],answer:item.answer,explanation:item.explanation }));
        const correct=items.filter(item=>item.correct).length;
        await sql.all(`INSERT INTO learning_attempts(id,artifact_id,revision_id,lesson_id,user_id,correct,total)
          VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),id,input.revision_id,input.lesson_id,actor.user,correct,items.length]);
        return { correct,total:items.length,items };
      });
    });
  }
}

export function learningMastery(db:Database,actor:Actor,artifact:ArtifactDetail) {
  return db.all<LearningMastery[number]>(`WITH valid AS (
      SELECT a.*,count(*) OVER (PARTITION BY a.lesson_id)::int AS attempts
      FROM learning_attempts a JOIN artifact_revisions r ON r.artifact_id=a.artifact_id AND r.id=a.revision_id
      WHERE a.artifact_id=$1 AND a.user_id=$2 AND EXISTS (
        SELECT 1 FROM jsonb_array_elements($3::jsonb->'blocks') AS current
        JOIN LATERAL jsonb_array_elements(r.content_json->'blocks') AS previous
          ON previous->>'id'=current->>'id' AND previous->'attrs'->'practice'=current->'attrs'->'practice'
        WHERE current->>'id'=a.lesson_id::text))
      SELECT DISTINCT ON (lesson_id) lesson_id,revision_id,correct,total,attempts
      FROM valid ORDER BY lesson_id,created_at DESC,id DESC`,[artifact.id,actor.user,JSON.stringify(artifact.revision.content_json)]);
}
