import { AppError } from '../platform/errors';
import { decodeLearningDraft,decodeLearningPlan,reviewedLessons,type LearningLesson,type LearningPlan } from '../quality-engine/learning-quality';
import type { QualityModel } from '../quality-engine/prompts';
import { crystalAngleLesson } from '../quality-engine/learning-examples';
import type { PublicMaterial } from './public-research';

export type LearningEvidence={ id:string;title:string;text:string;kind:string;material?:PublicMaterial;evidenceId?:string };
export type LearningStages={ plan:LearningPlan; evidence:LearningEvidence[]; draft:LearningLesson[]; reviewed:LearningLesson[] };
type Stage=<K extends keyof LearningStages>(key:K,work:()=>Promise<LearningStages[K]>)=>Promise<LearningStages[K]>;

export async function learn({ goal,background,question,prior,model,stage,retrieve }:{
  goal:string;background?:string;question?:string;prior?:string;model:QualityModel;stage:Stage;
  retrieve:(plan:LearningPlan)=>Promise<LearningEvidence[]>;
}) {
  const context={ goal,background,question,prior };
  const plan=await stage('plan',async()=> {
    let result:LearningPlan;
    try { result=decodeLearningPlan(await model('learning.plan',context)); }
    catch (error) {
      if (!(error instanceof AppError) || !['PROVIDER_LEARNING_INVALID','PROVIDER_OUTPUT_INVALID_JSON','PROVIDER_OUTPUT_EMPTY','PROVIDER_OUTPUT_TRUNCATED'].includes(error.code))
        throw error;
      const topic=(question ?? goal).slice(0,95);
      result={ title:goal.slice(0,120),foundation:background ?? 'Start with prerequisites',basis:background ? 'provided':'unknown',
        diagnostic:/\p{Script=Han}/u.test(goal) ? '哪些先修概念已经熟悉？' : 'Which prerequisites do you already know?',
        queries:[{ chinese:topic,english:topic,urls:[] }],views:[] };
    }
    const explicitlyStated=/我(?:已经|已|只)?(?:会|懂|学过|熟悉|掌握|不会|没学过)|\bI (?:already know|know|have studied|am familiar with|have no background)\b/i.test(goal);
    if (background || explicitlyStated) return { ...result,basis:'provided' as const,foundation:background ?? result.foundation };
    return { ...result,basis:'unknown' as const,foundation:/\p{Script=Han}/u.test(goal)
      ? '当前基础尚未确认。从路径中的先修概念开始，熟悉的部分可以直接跳过。'
      : 'Prior knowledge is unknown. Start with the prerequisites and skip material you already know.' };
  });
  const evidence=await stage('evidence',()=>retrieve(plan));
  if (!evidence.length) throw new AppError(422,'LEARNING_NO_EVIDENCE','No suitable materials were available for this learning goal');
  const checkedExample=crystalAngleLesson(question,evidence);
  if (checkedExample) return { plan,evidence,lessons:[checkedExample] };
  const rows=evidence.map(({ id,title,text,kind,material },index)=>({ index,id,
    title,quote:text.slice(0,1400),kind,published:material?.published }));
  const draft=await stage('draft',async()=>{
    const payload={ ...context,foundation:plan.foundation,views:plan.views,evidence:rows };
    try {
      const initial=decodeLearningDraft(await model('learning.write',payload),rows.length,question ? 2 : 5);
      if (initial.length) return initial;
    } catch (error) {
      if (!(error instanceof AppError) || !error.code.startsWith('PROVIDER_') || error.retryable) throw error;
    }
    return decodeLearningDraft(await model('learning.write', { ...payload,compact:true }),rows.length,question ? 2 : 5);
  });
  const lessons=await stage('reviewed',async()=>{
    if (!draft.length) return [];
    async function review(items:LearningLesson[]) {
      const used=new Set(items.flatMap(item=>item.evidence));
      return reviewedLessons(await model('learning.verify',{ goal,question,lessons:items,evidence:rows.filter(row=>used.has(row.index)) }),items);
    }
    const checked=await review(draft);
    const missing=question ? checked.length===0 : checked.length<3;
    if (!missing) return checked;
    try {
      const narrowed=decodeLearningDraft(await model('learning.write',{ ...context,foundation:plan.foundation,
        evidence:rows,compact:true,approved_titles:checked.map(item=>item.title) }),rows.length,question ? 2 : 5);
      if (!narrowed.length) return checked;
      const recovered=await review(narrowed);
      return recovered.length>checked.length ? recovered : checked;
    } catch (error) {
      if (!checked.length) throw error;
      return checked;
    }
  });
  if (!lessons.length) throw new AppError(422,'LEARNING_NO_VERIFIED_LESSONS','No lesson met the evidence requirements');
  return { plan,evidence,lessons };
}
