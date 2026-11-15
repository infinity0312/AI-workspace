import { z } from 'zod';
import { AppError } from '../platform/errors';
import { hasQuantities,supportsAnalysisStatement,unresolved } from './evidence-checks';
import { completeSentences } from './evidence-spans';
import { assessAnswer,answerContract } from './research-operators';

export type PublicEvidenceKind = 'encyclopedia'|'paper'|'image'|'report'|'dataset'|'web';
export type ResearchEvidence = { id:string;title:string;quote:string;kind:PublicEvidenceKind|'source';source_url?:string|null; requested_url?:string };

const query = z.object({ chinese:z.string().trim().min(1).max(100),english:z.string().trim().min(1).max(140) }).strict();
const queries = query.extend({
  academic:z.string().trim().min(1).max(160).optional(),
  facets:z.array(query.extend({ label:z.string().trim().min(1).max(48) })).max(5).optional(),
}).strict();
const ids = z.array(z.uuid()).min(1).max(4);
const fact = z.discriminatedUnion('kind',[
  z.object({ kind:z.literal('statement'),text:z.string().trim().min(1).max(440),evidence_ids:ids }),
  z.object({ kind:z.literal('quote'),excerpt_id:z.string().max(50) }),
]);
const sectionHeadings = {
  findings:'研究发现',comparison:'比较结果',mechanism:'作用机制',conditions:'适用条件',methods:'研究方法',limitations:'证据局限',
};
const sectionSchema=z.object({
  title:z.string().trim().min(1).max(80),
  heading:z.enum(['findings','comparison','mechanism','conditions','methods','limitations']).optional().catch(undefined),
  facet:z.number().int().min(0).max(4).nullish(),
  claims:z.array(z.unknown()).min(1).max(12),
});
const draftSchema = z.object({ sections:z.array(z.unknown()).min(1).max(12) });
const verdictSchema = z.object({
  approved_claims:z.array(z.unknown()).max(24),
  approved_images:z.array(z.unknown()).max(12).nullish(),
  answers:z.array(z.unknown()).max(24).nullish(),
});
const verdictClaim=z.string().regex(/^\d{1,2}\.\d{1,2}$/);
const verdictAnswer=z.object({ facet:z.number().int().min(0).max(4),claim_key:verdictClaim });

export type Draft = { sections:{ title:string;heading?:keyof typeof sectionHeadings;facet?:number;claims:z.infer<typeof fact>[] }[] };
export type Verdict = { approved_claims:string[];approved_images:string[];answers:z.infer<typeof verdictAnswer>[] };
export type Claim = { key:string; kind:'statement'|'quote'; text:string; evidence_ids:string[] };
export type ResolvedSection = { title:string;heading?:keyof typeof sectionHeadings;facet?:number;claims:Claim[] };
export type AnalysisReport = { sections:{ title:string;facet?:number;claims:Claim[] }[] };
export type Requirement = { id:string; label:string; targets:{ section:number;claim:number }[] };
export type DiscoveryQuery = z.infer<typeof queries>;

function decode<T>(schema:z.ZodType<T>,value:string) {
  try { return schema.parse(JSON.parse(value)); }
  catch { throw new AppError(502,'PROVIDER_ANALYSIS_INVALID','Analysis did not pass the evidence checks'); }
}
export const decodeDiscoveryPlan=(value:string)=>decode(queries,value);
export function decodeAnalysisVerdict(value:string):Verdict {
  const verdict=decode(verdictSchema,value);
  function valid<T>(items:unknown[]|null|undefined,schema:z.ZodType<T>) {
    return (items ?? []).flatMap(item=>{
      const parsed=schema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }
  return { approved_claims:valid(verdict.approved_claims,verdictClaim),
    approved_images:valid(verdict.approved_images,z.uuid()),answers:valid(verdict.answers,verdictAnswer) };
}

function excerpts(evidence:ResearchEvidence[]) {
  return evidence.flatMap(item => {
    const abstract = item.quote.indexOf('Abstract excerpt: ');
    const body = abstract < 0 ? item.quote : item.quote.slice(abstract+'Abstract excerpt: '.length);
    const spans = completeSentences(body,650);
    return spans.flatMap((span,i) => {
      if (span.text.length<12) return [];
      const previous=spans[i-1];
      const start=hasQuantities(span.text) && previous && !hasQuantities(previous.text) &&
        previous.end===span.start && span.end-previous.start<=750 ? previous.start : span.start;
      return [{ id:item.id+'#'+i,evidence_id:item.id,text:body.slice(start,span.end).trim() }];
    }).slice(0,4);
  });
}

export function compatibleResearchScope(goal:string,title:string) {
  const residential = /住宅|家用|residential|space heating|home heating/i.test(goal) && /供暖|热泵|heating|heat pump/i.test(goal);
  const vehicle = /车辆|车载|电动车|车用|汽车|vehicles?|automotive/i;
  const water = /生活热水|热水器|domestic water heating|water heater/i;
  const commercial = /商业建筑|商业楼宇|commercial building|\bcomstock\b/i;
  return !residential || [vehicle,water,commercial].every(pattern => !pattern.test(title) || pattern.test(goal));
}

export function meetsImageAttribution(goal:string,credit:string) {
  const required=/(?:有|要求|提供|注明|标明|明确)(?:明确)?(?:作者署名|作者|署名)|\b(?:with|include|provide|show) (?:a |the )?(?:named )?(?:author|photographer|credit|attribution)\b/i.test(goal);
  return !required || Boolean(credit.trim() && !/(?:\bunknown\b|\banonymous\b|^Wikimedia Commons$|作者不详|佚名|未知作者)/i.test(credit.trim()));
}

export const citeable = (item:ResearchEvidence) => item.kind !== 'image' &&
  !(item.kind === 'paper' && item.quote.includes('Bibliographic record only.'));

export function prepareAnalysisEvidence(evidence:ResearchEvidence[],primaryIds:ReadonlySet<string>=new Set()) {
  const groups=new Map<string,ResearchEvidence[]>();
  for (const item of evidence.filter(citeable)) {
    const source=item.source_url ?? item.title;
    const group=groups.get(source) ?? [];
    group.push(item);
    groups.set(source,group);
  }
  const bySource=[...groups.values()];
  const rotate=(sources:ResearchEvidence[][],depth:number)=>Array.from({ length:depth },(_,index)=>sources.flatMap(group=>group[index] ?? [])).flat();
  const priority=rotate(bySource.map(group=>group.filter(item=>primaryIds.has(item.id))).filter(group=>group.length),5).slice(0,16);
  const included=new Set(priority.map(item=>item.id));
  const text=[...priority,...rotate(bySource.map(group=>group.filter(item=>!included.has(item.id))),6)].slice(0,24);
  if (!text.length) throw new AppError(422,'ANALYSIS_NO_EVIDENCE','No citable source matched the requested topic');
  const byId = new Map(text.map(item => [item.id,item]));
  const perItem=text.filter(item=>item.kind!=='encyclopedia').map(item=>excerpts([item]));
  const optionsForQuote=Array.from({ length:4 },(_,index)=>perItem.flatMap(options=>options[index] ?? [])).flat().slice(0,36);
  return { text,byId,optionsForQuote,byExcerpt:new Map(optionsForQuote.map(item => [item.id,item])) };
}

type AnalysisEvidence = ReturnType<typeof prepareAnalysisEvidence>;

export function decodeAnalysisDraft(value:string,{ byId,byExcerpt }:AnalysisEvidence):Draft {
  const draft=decode(draftSchema,value);
  let remaining=12;
  const sections = draft.sections.slice(0,6).flatMap(candidate => {
    const section=sectionSchema.safeParse(candidate);
    if (!section.success || !remaining) return [];
    const claims=section.data.claims.flatMap(item => {
      const parsed=fact.safeParse(item);
      if (!parsed.success) return [];
      const value=parsed.data;
      if (value.kind==='quote' ? !byExcerpt.has(value.excerpt_id) : value.evidence_ids.some(id => !byId.has(id))) return [];
      return [value];
    }).slice(0,Math.min(remaining,4));
    remaining-=claims.length;
    return claims.length ? [{ title:section.data.title,heading:section.data.heading,facet:section.data.facet ?? undefined,claims }] : [];
  });
  if (!sections.length) throw new AppError(502,'PROVIDER_ANALYSIS_INVALID','Analysis did not contain valid evidence references');
  return { sections };
}

export function resolveAnalysisClaims(draft:Draft,facets:string[],{ byExcerpt,byId }:AnalysisEvidence):ResolvedSection[] {
  return draft.sections.flatMap((section,i) => {
    if (unresolved.test(section.title) || (section.facet !== undefined && facets.length>0 && section.facet>=facets.length)) return [];
    const claims = section.claims.flatMap((claim,j):Claim[] => {
      const key=(i+1)+'.'+(j+1);
      if (claim.kind === 'quote') {
        const selected=byExcerpt.get(claim.excerpt_id);
        return selected && !unresolved.test(selected.text) ? [{ key,kind:'quote',text:selected.text,evidence_ids:[selected.evidence_id] }] : [];
      }
      const cited=claim.evidence_ids.map(id => byId.get(id)?.quote ?? '');
      if (unresolved.test(claim.text) || !supportsAnalysisStatement(claim.text,cited)) return [];
      return [{ key,kind:'statement',text:claim.text,evidence_ids:[...new Set(claim.evidence_ids)] }];
    });
    return claims.length ? [{ title:section.title,heading:section.heading,facet:section.facet,claims }] : [];
  });
}

export function approvedAnalysis(sections:ResolvedSection[],decision:Verdict):AnalysisReport['sections'] {
  const accepted = new Set(decision.approved_claims);
  const unique = new Set<string>();
  return sections.flatMap(section => {
    const claims = section.claims.filter(claim => {
      if (!accepted.has(claim.key) || unique.has(claim.text)) return false;
      unique.add(claim.text);
      return true;
    });
    return claims.length ? [{ title:sectionHeadings[section.heading ?? 'findings'],facet:section.facet,claims }] : [];
  });
}

export function markCovered(answers:Map<number,Set<Claim>>,facets:string[],sections:AnalysisReport['sections'],verdict:Verdict,goal='') {
  const matches=new Map<number,Set<Claim>>();
  for (const { facet,claims } of sections) {
    if (facet===undefined || facet>=facets.length) continue;
    const matching=claims.filter(claim=>verdict.answers.some(answer=>answer.facet===facet && answer.claim_key===claim.key));
    if (matching.length) matches.set(facet,new Set([...(matches.get(facet) ?? answers.get(facet) ?? []),...matching]));
  }
  for (const [facet,claims] of matches) {
    if (assessAnswer(answerContract(facets[facet]!,goal),[...claims])) answers.set(facet,claims);
  }
}

export function analysisRequirements(facets:string[],verified:AnalysisReport['sections'],answers:Map<number,Set<Claim>>) {
  const requirements=facets.map((label,facet):Requirement => {
    const cited=answers.get(facet);
    return { id:'REQ-'+String(facet+1).padStart(3,'0'),label,targets:verified.flatMap(({ claims },section) =>
      claims.flatMap((item,claim) => cited?.has(item) ? [{ section,claim }] : [])) };
  });
  return { requirements,coverage:{ requested:requirements.length,supported:requirements.filter(item => item.targets.length>0).length } };
}
