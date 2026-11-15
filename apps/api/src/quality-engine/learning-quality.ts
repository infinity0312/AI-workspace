import { z } from 'zod';
import { learningGoalAttrs,learningLessonAttrs,learningQuestion } from '@akw/contracts';
import { AppError } from '../platform/errors';
import { unresolved } from './evidence-checks';

const text=(max:number)=>z.string().trim().min(1).max(max);
const url=z.url({ protocol:/^https$/ }).max(500).refine(value=>{
  const address=new URL(value);
  return !address.port && !address.username && !address.password;
});
const query=z.object({ chinese:text(100),english:text(140),academic:text(160).optional(),
  urls:z.array(url).max(4).default([]) });
const plan=learningGoalAttrs.pick({ foundation:true,basis:true,diagnostic:true,views:true }).extend({
  title:text(120),queries:z.array(query).min(1).max(3),
});
const indexes=z.array(z.number().int().min(0).max(30));
const lesson=z.object({
  title:text(120),objective:text(300),explanation:text(2400),prerequisites:indexes.max(5).default([]),
  evidence:indexes.min(1).max(3),
  math:learningLessonAttrs.shape.math.default([]),practice:z.array(learningQuestion).max(3).default([]),
});
const draft=z.object({ lessons:z.array(z.unknown()).min(1).max(6) });
const verdict=z.object({ lessons:z.array(z.unknown()).max(8) });
const lineGraphMisattribution=/线图(?:的)?节点(?:天然|直接)?对应(?:一个|一组)?键角|该线图节点携带\s*∠|线图节点特征.{0,12}(?:角度|夹角|θ)|线图节点或边的特征|line graph nodes? (?:represent|encode) (?:bond )?angles/i;
const approval=z.object({ index:z.number().int().min(0).max(5),body:z.literal(true),math:indexes.max(4).default([]),
  practice:indexes.max(4).default([]) });
export type LearningPlan=z.infer<typeof plan>;
export type LearningLesson=z.infer<typeof lesson> & { index:number };

function decode<T>(schema:z.ZodType<T>,json:string) {
  try { return schema.parse(JSON.parse(json)); } catch {
    throw new AppError(502,'PROVIDER_LEARNING_INVALID','The learning response could not be read');
  }
}
export const decodeLearningPlan=(json:string)=>decode(plan,json);
export function decodeLearningDraft(json:string,available:number,limit:number) {
  return decode(draft,json).lessons.slice(0,limit).flatMap((item,index):LearningLesson[]=>{
    const value=lesson.safeParse(item);
    if (!value.success || value.data.evidence.some(id=>id>=available) || unresolved.test(value.data.explanation) ||
      /\b(?:system prompt|ignore previous instructions)\b/i.test(value.data.explanation)) return [];
    const parsed={ ...value.data,explanation:value.data.explanation.replace(/\bCGCGNN\b/g,'CGCNN') };
    return [{ ...parsed,index,evidence:[...new Set(parsed.evidence)],prerequisites:[...new Set(parsed.prerequisites.filter(id=>id<index))] }];
  });
}
export function reviewedLessons(json:string,lessons:LearningLesson[]) {
  const checks=decode(verdict,json).lessons.map(value=>approval.safeParse(value));
  return lessons.flatMap(item=>{
    if (/ALIGNN|线图|line graph/i.test(item.explanation) && lineGraphMisattribution.test(item.explanation)) return [];
    const check=checks.find(result=>result.success && result.data.index===item.index);
    if (!check?.success) return [];
    return [{ ...item,math:item.math.filter((entry,i)=>check.data.math.includes(i) &&
      !/\\(?:href|url|includegraphics|htmlClass|htmlId|htmlStyle|htmlData|def|gdef)\b/.test(entry.latex)),
      practice:item.practice.filter((_,i)=>check.data.practice.includes(i)) }];
  });
}
