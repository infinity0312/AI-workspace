import { randomUUID } from 'node:crypto';
import { AppError } from '../platform/errors';
import {
  analysisRequirements,approvedAnalysis,citeable,compatibleResearchScope,decodeAnalysisDraft,decodeAnalysisVerdict,decodeDiscoveryPlan,
  markCovered,meetsImageAttribution,prepareAnalysisEvidence,resolveAnalysisClaims,type AnalysisReport,type Claim,type DiscoveryQuery,type Draft,type ResearchEvidence,type Verdict,
} from '../quality-engine/document-quality';
import { attemptFormat,type RecoverableFormat } from '../quality-engine/model-output';
import type { QualityModel } from '../quality-engine/prompts';
import { BudgetExceeded } from './budget';
import { meetsSourceRequirement,type SourceRequirement } from '../quality-engine/source-requirements';
import type { PublicMaterial } from './public-research';
import { auditRequirements,questionPlan } from '../quality-engine/requirement-ledger';
import { answerContract,standardHashSupport } from '../quality-engine/research-operators';

type Candidate = ResearchEvidence & { material:PublicMaterial; ordinal:number };
export type CheckedAnalysis = ReturnType<typeof analysisRequirements> & { report:AnalysisReport;materials:Candidate[];
  fulfillment?:{
    questions:ReturnType<typeof questionPlan>;mandatoryQuestions:boolean;
    sources:{ label:string;retrieved:boolean;evidenceIds:string[];usedIds:string[] }[];
    visual?:{ mandatory:boolean;retrieved:boolean;approvedIds:string[] };
  };
};
type EvidenceContext = { evidence:ResearchEvidence[]; candidates:Candidate[] };
export type DocumentResearchStages = {
  plan:RecoverableFormat<DiscoveryQuery>; plan_repair:DiscoveryQuery; context:EvidenceContext; draft:RecoverableFormat<Draft>; verdict:Verdict;
  format_repair:Draft; repair:Draft; recheck:Verdict;
};
type RunStage = <K extends keyof DocumentResearchStages>(key:K,work:()=>Promise<DocumentResearchStages[K]>)=>Promise<DocumentResearchStages[K]>;

export async function researchDocument(options:{
  goal:string; context?:string; source:(plan?:DiscoveryQuery)=>Promise<ResearchEvidence[]>; model:QualityModel; stage:RunStage;
  planLocal?:boolean;discover?:(query:DiscoveryQuery)=>Promise<PublicMaterial[]>;
  requiredSources?:SourceRequirement[];requiredQuestions?:string[];
  requireLicensedImage?:boolean;audience?:string;
}):Promise<CheckedAnalysis> {
  const { goal,context,source,model,stage,discover } = options;
  const target={ goal,...(options.audience ? { audience:options.audience } : {}) };
  const firstPlan = discover || options.planLocal
    ? await stage('plan',() => attemptFormat(async () => decodeDiscoveryPlan(await model('document.plan',target))))
    : undefined;
  const plan=firstPlan && 'retry_reason' in firstPlan
    ? await stage('plan_repair',async () => decodeDiscoveryPlan(await model('document.repair-plan',target))) : firstPlan;
  const { evidence,candidates } = await stage('context',async () => {
    const [local,materials] = await Promise.all([source(plan),plan && discover ? discover(plan) : Promise.resolve([])]);
    const candidates = materials.filter(material => compatibleResearchScope(goal,material.title) &&
      (material.kind!=='image' || (material.image && meetsImageAttribution(goal,material.image.credit)))).flatMap(material => {
      const make = (quote:string,ordinal:number) => ({ id:randomUUID(),kind:material.kind,title:material.title,quote,source_url:material.url,requested_url:material.requestedUrl,material,ordinal });
      return [make(material.text,0),...(material.passages ?? []).map((part,index) => make(part.text,index+1))];
    });
    return { evidence:[...local.filter(item => compatibleResearchScope(goal,item.title)),
      ...candidates.map(({ id,title,quote,kind,source_url,requested_url }) => ({ id,title,quote,kind,source_url,requested_url }))],candidates };
  });
  const required=options.requiredSources ?? [];
  const matches=(requirement:SourceRequirement,item:ResearchEvidence)=>item.kind!=='image' &&
    (meetsSourceRequirement(requirement,item.source_url) || meetsSourceRequirement(requirement,item.requested_url));
  const missingSources=(items:ResearchEvidence[]) => required.filter(requirement =>
    !items.some(item=>matches(requirement,item))).map(item=>item.label);
  const missingDiscovery=missingSources(evidence);
  function sourceFailure(missing:string[],message:string) {
    const ledger=auditRequirements(required.map((requirement,index)=>{
      const hits=evidence.filter(item=>matches(requirement,item));
      return { id:'SOURCE-'+(index+1),description:requirement.label,type:'source',mandatory:true,
        retrieval:hits.length ? 'complete' : 'missing',evidence:hits.some(citeable) ? 'complete' : 'missing',
        answer:missing.includes(requirement.label) ? 'missing' : 'pending',evidenceIds:[],blockIds:[] };
    }),[]);
    return new AppError(422,'ANALYSIS_REQUIRED_SOURCE',message,{ missing,requirement_ledger:ledger });
  }
  if (missingDiscovery.length) throw sourceFailure(missingDiscovery,'Required primary source unavailable');
  const primaryEvidence=evidence.filter(item=>required.some(requirement=>matches(requirement,item)));
  const primaryIds=new Set(primaryEvidence.map(item=>item.id));
  const prepared=prepareAnalysisEvidence(evidence,primaryIds);
  const { text,optionsForQuote }=prepared;
  const autoFacets=plan?.facets?.map(item=>item.label) ?? [];
  const sourceOnly=/^(?:引用\s*)?(?:nist\s*)?(?:\d{4}\s*年?\s*)?(?:原始标准|标准原文|原始论文|standard sources|original (?:\d{4} )?paper)$/i;
  const visualOnly=/^(?:相关的?)?(?:有)?(?:署名|许可|授权|合规|带署名或许可){0,4}(?:的)?(?:照片|图片|图像|插图)$|^(?:licensed |credited |licensed and credited )?(?:photo|image|illustration)$/i;
  const questions=questionPlan(options.requiredQuestions?.length ? options.requiredQuestions :
    autoFacets.filter(label=>!visualOnly.test(label.trim()) && (!required.length || !sourceOnly.test(label.trim()))));
  const facets=questions.map(item=>item.label);

  async function compose(prompt:'document.draft'|'document.repair-format'|'document.repair-coverage'|'document.repair-grounding',missing?:number[],uncited?:Set<string>) {
    const data={ ...target,document_excerpt:context,facets,answer_contracts:facets.map(facet=>answerContract(facet,goal)),
      missing_facets:missing,missing_questions:missing?.map(index=>facets[index]),
      uncited_primary_evidence_ids:uncited?.size ? [...uncited] : undefined,
      required_sources:required.length ? required.map(requirement=>({
        label:requirement.label,evidence_ids:text.filter(item=>matches(requirement,item)).map(item=>item.id),
      })) : undefined,evidence:text.map(({ id,title,quote,kind })=>({ id,title,quote,kind })),
      excerpt_options:optionsForQuote.map(({ id,evidence_id,text }) => ({ id,evidence_id,text })) };
    return decodeAnalysisDraft(await model(prompt,data),prepared);
  }

  async function review(sections:AnalysisReport['sections']) {
    const needed = new Set(sections.flatMap(section => section.claims.flatMap(claim => claim.evidence_ids)));
    const images = evidence.filter(item => item.kind === 'image');
    return decodeAnalysisVerdict(await model('document.verify',{
      goal,facets,answer_contracts:facets.map(facet=>answerContract(facet,goal)),sections,evidence:[...text.filter(item => needed.has(item.id)),...images].map(({ id,title,quote,kind })=>({ id,title,quote,kind })),
    }));
  }

  const initial=await stage('draft',() => attemptFormat(() => compose('document.draft')));
  const draft=resolveAnalysisClaims('retry_reason' in initial ? await stage('format_repair',() => compose('document.repair-format')) : initial,facets,prepared);
  const decision = await stage('verdict',() => review(draft));
  const verified = approvedAnalysis(draft,decision);
  const related = new Set(decision.approved_images);
  const answers=new Map<number,Set<Claim>>();
  markCovered(answers,facets,verified,decision,goal);
  for (const reference of standardHashSupport(facets,goal,text)) {
    if (answers.has(reference.facet)) continue;
    const current=verified.flatMap(section=>section.claims);
    const chosen=reference.claims.map(claim=>current.find(item=>item.text===claim.text &&
      item.evidence_ids.length===claim.evidence_ids.length && item.evidence_ids.every(id=>claim.evidence_ids.includes(id))) ?? claim);
    const additions=chosen.filter(claim=>!current.includes(claim));
    if (additions.length) verified.push({ ...reference,claims:additions });
    answers.set(reference.facet,new Set(chosen));
  }
  const missing=facets.map((_,index) => index).filter(index => !answers.has(index));
  const initialIds=new Set(verified.flatMap(section=>section.claims.flatMap(claim=>claim.evidence_ids)));
  const uncited=required.filter(requirement=>!text.some(item=>initialIds.has(item.id) && matches(requirement,item)));
  const primaryToAdd=new Set(text.filter(item=>uncited.some(requirement=>matches(requirement,item))).map(item=>item.id));
  if (!verified.length || missing.length || primaryToAdd.size) {
    try {
      const repaired = resolveAnalysisClaims(await stage('repair',() => verified.length ? compose('document.repair-coverage',missing,primaryToAdd) : compose('document.repair-grounding')),facets,prepared);
      const recheck = await stage('recheck',() => review(repaired));
      const priorClaims=new Map(verified.flatMap(section=>section.claims.map(claim=>[claim.text,claim] as const)));
      const reviewed=approvedAnalysis(repaired,recheck);
      let remaining=16-priorClaims.size;
      const additions=reviewed.flatMap(section => {
        const eligible=!verified.length || (section.facet!==undefined && missing.includes(section.facet));
        const claims=section.claims.filter(claim=>!priorClaims.has(claim.text) &&
          (eligible || claim.evidence_ids.some(id=>primaryToAdd.has(id)))).slice(0,remaining);
        remaining-=claims.length;
        return claims.length ? [{ ...section,claims }] : [];
      });
      for (const section of reviewed) for (const claim of section.claims) {
        const prior=priorClaims.get(claim.text);
        if (!prior || section.facet===undefined || prior.evidence_ids.length!==claim.evidence_ids.length ||
          !prior.evidence_ids.every(id=>claim.evidence_ids.includes(id))) continue;
        const keys=recheck.answers.filter(answer=>answer.claim_key===claim.key && answer.facet===section.facet);
        markCovered(answers,facets,[{ ...section,claims:[prior] }],{ ...recheck,answers:keys.map(answer=>({ ...answer,claim_key:prior.key })) },goal);
      }
      verified.push(...additions);
      markCovered(answers,facets,additions,recheck,goal);
      for (const id of recheck.approved_images) related.add(id);
    } catch (error) {
      const providerFailure=error instanceof AppError && error.code.startsWith('PROVIDER_');
      if (!verified.length || (!providerFailure && !(error instanceof BudgetExceeded))) throw error;
    }
  }
  const sections=verified;
  if (!sections.length) throw new AppError(422,'ANALYSIS_NO_EVIDENCE','No claim passed the evidence checks');
  const used = new Set(verified.flatMap(section => section.claims.flatMap(claim => claim.evidence_ids)));
  const missingCitations=missingSources(evidence.filter(item=>used.has(item.id)));
  if (missingCitations.length) throw sourceFailure(missingCitations,'Required primary source was not cited');
  const coverage=analysisRequirements(facets,sections,answers);
  if (options.requiredQuestions?.length && coverage.coverage.supported<coverage.coverage.requested)
    throw new AppError(422,'ANALYSIS_REQUIRED_QUESTIONS','A mandatory question is unanswered',
      { missing:coverage.requirements.filter(item=>!item.targets.length).map(item=>item.label) });
  const materials=candidates.filter(item=>used.has(item.id) || (related.has(item.id) && item.kind==='image'));
  const mandatoryImage=Boolean(options.requireLicensedImage || /(?:必须|务必|要求).{0,30}(?:图片|照片|插图)|(?:找|附|提供|配)一张.{0,25}(?:图片|照片|插图)|\b(?:must include|must provide|include|provide|find) (?:a |an |the )?(?:licensed |credited )?(?:image|picture|photo)\b/i.test(goal));
  const wantsImage=mandatoryImage || /(?:附上|提供|包含).{0,24}(?:图片|照片|插图)/i.test(goal);
  const sources=required.map(requirement=>{
    const hits=evidence.filter(item=>matches(requirement,item));
    return { label:requirement.label,retrieved:hits.length>0,evidenceIds:hits.filter(citeable).map(item=>item.id),
      usedIds:hits.filter(item=>used.has(item.id)).map(item=>item.id) };
  });
  return { report:{ sections },materials,...coverage,fulfillment:{ questions,mandatoryQuestions:Boolean(options.requiredQuestions?.length),
    sources,visual:wantsImage ? { mandatory:mandatoryImage,retrieved:evidence.some(item=>item.kind==='image'),
      approvedIds:evidence.filter(item=>item.kind==='image' && related.has(item.id)).map(item=>item.id) } : undefined } };
}
