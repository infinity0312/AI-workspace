import { z } from 'zod';

const id=z.uuid();
const text=(max:number)=>z.string().trim().min(1).max(max);
export const learningRequest=z.object({
  workspace_id:id,goal:text(1600),allow_external:z.literal(true),background:text(500).optional(),
}).strict();
export const learningFollowup=z.object({ question:text(1000),background:text(500).optional(),base_revision_id:id,allow_external:z.literal(true) }).strict();
export const learningGoalAttrs=z.object({
  version:z.literal(1),goal:text(1600),foundation:text(600),basis:z.enum(['provided','inferred','unknown']),
  diagnostic:text(400),views:z.array(z.enum(['graph_embed','mindmap','timeline','table','evidence_network'])).max(5),
}).passthrough();
export const learningQuestion=z.object({
  question:text(380),options:z.array(text(240)).length(3).refine(values=>new Set(values).size===3),
  answer:z.number().int().min(0).max(2),explanation:text(600),
}).strict();
export const learningLessonAttrs=z.object({
  version:z.literal(1),title:text(120),objective:text(300),prerequisites:z.array(id).max(5),
  math:z.array(z.object({ latex:text(420),explanation:text(500) }).strict()).max(3),
  practice:z.array(learningQuestion).max(3),
}).passthrough();
export const learningAssessment=z.object({ revision_id:id,lesson_id:id,answers:z.array(z.number().int().min(0).max(2)).min(1).max(3) }).strict();
export type LearningRequest=z.infer<typeof learningRequest>;
export type LearningAssessment=z.infer<typeof learningAssessment>;
export type LearningAssessmentResult={ correct:number;total:number;items:{ correct:boolean;answer:number;explanation:string }[] };
export type LearningMastery={ lesson_id:string;revision_id:string;correct:number;total:number;attempts:number }[];
export type LearningProgress={ id:string;goal:string;status:string;updated_at:string;runtime_session_id?:string;stage?:string;result:{
  artifact_id?:string;patch_id?:string;warning?:string;
} | null };
