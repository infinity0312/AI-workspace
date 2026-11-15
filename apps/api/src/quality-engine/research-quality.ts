import { modelResearchResult } from '@akw/contracts';
import { z } from 'zod';
import { AppError } from '../platform/errors';
import { hasQuantities,unresolved } from './evidence-checks';
import { completeSentences } from './evidence-spans';

export type ResearchResult = z.infer<typeof modelResearchResult>;

export function decodeResearchSynthesis(raw:string,evidenceIds:string[]) {
  const evidence=new Set(evidenceIds);
  const report=modelResearchResult.parse(JSON.parse(raw));
  if (report.claims.some(claim => claim.evidence_ids.some(id => !evidence.has(id))))
    throw new AppError(422,'PROVIDER_ANALYSIS_INVALID','Evidence outside run');
  return report;
}

const researchVerdict=z.object({
  summary_supported:z.boolean(),claim_indexes:z.array(z.number().int().nonnegative()).max(16),
}).strict();

export function validateResearchSynthesis(raw:string,report:ResearchResult,evidence:{ id:string;quote:string }[]) {
  const verdict = researchVerdict.parse(JSON.parse(raw));
  const accepted = new Set(verdict.claim_indexes);
  const byId = new Map(evidence.map(item => [item.id,item.quote]));
  const claims = report.claims.filter((claim,index) => accepted.has(index) && !unresolved.test(claim.statement + ' ' + claim.scope)
    && !hasQuantities(claim.scope) && (!hasQuantities(claim.statement) || claim.evidence_ids.some(id =>
      completeSentences(byId.get(id) ?? '',1200).some(item => item.text===claim.statement))));
  const summarySupported=verdict.summary_supported && !unresolved.test(report.summary) && !hasQuantities(report.summary);
  const summary=summarySupported ? report.summary : '以下整理与主题相关的原文和结论。';
  if (!summarySupported && !claims.length) return;
  return { report:{ summary,claims },summaryEvidence:summarySupported ? evidence.map(item => item.id) : undefined };
}
