import type { runInput } from '@akw/contracts';
import type { z } from 'zod';
import { AppError } from '../platform/errors';
import { decodeResearchSynthesis,validateResearchSynthesis,type ResearchResult } from '../quality-engine/research-quality';
import type { QualityModel } from '../quality-engine/prompts';
import { BudgetExceeded } from './budget';
import type { SearchResult } from './providers';

export type ResearchInput = z.infer<typeof runInput>;
export interface Quote { id: string; quote: string; source_id: string; page: number | null }
export interface AgentTools {
  signal: AbortSignal;
  record(type: string, payload: Record<string, unknown>): Promise<void>;
  discover?: (goal: string) => Promise<SearchResult[]>;
  register(results: SearchResult[]): Promise<string[]>;
  ingest(id: string): Promise<void>;
  retrieve(ids: string[]): Promise<Quote[]>;
  model?:QualityModel;
  step<K extends keyof Checkpoint>(name: K, execute: () => Promise<Checkpoint[K]>): Promise<Checkpoint[K]>;
}
interface Checkpoint {
  plan: { stages: string[]; sourceIds: string[] };
  sources: { ids: string[]; warnings: string[] };
  evidence: Quote[];
  synthesis: { report:ResearchResult; warning?:string };
  checkedSynthesis: { report:ResearchResult; warning?:string; summaryEvidence?:string[] };
}
const extractive = (quotes: Quote[], warning: string) => ({
  report: { summary: '以下为与主题相关的原文摘录。', claims: [] as ResearchResult['claims'] },
  warning: quotes.length ? warning : '没有可定位的证据。请提供正文、PDF 或可访问的网页。',
});

type AgentResult = Checkpoint['checkedSynthesis'] & { quotes:Quote[];sourceIds:string[];transient:boolean };

export async function runAgent(input: ResearchInput, tools: AgentTools):Promise<AgentResult> {
  if (input.mode === 'simple' && !input.source_ids.length && !input.use_workspace) {
    const value = await tools.step('synthesis', async () => tools.model
      ? { report: { summary: await tools.model('research.answer',{ goal:input.goal,...(input.audience ? { audience:input.audience } : {}) }), claims: [] } }
      : { report: { summary: '即时回答需要模型接入。可提交资料并运行本地摘录流程。', claims: [] }, warning: 'Model unavailable or not authorized' });
    return { ...value, quotes: [], sourceIds: [], transient: true };
  }

  // Each node consumes typed output from its prerequisites. All step outputs are checkpointed by the host.
  const plan = await tools.step('plan', async () => ({
    stages: ['sources','evidence','synthesis','checkedSynthesis'], sourceIds: [...new Set(input.source_ids)],
  }));
  const sources = await tools.step('sources', async () => {
    const ids = [...plan.sourceIds];
    const warnings: string[] = [];
    if (!ids.length && tools.discover) {
      try {
        ids.push(...await tools.register(await tools.discover(input.goal)));
      } catch {
        tools.signal.throwIfAborted();
        warnings.push('Search provider unavailable');
      }
    }
    const ready: string[] = [];
    for (const id of new Set(ids)) {
      tools.signal.throwIfAborted();
      try {
        await tools.ingest(id);
        ready.push(id);
      } catch {
        tools.signal.throwIfAborted();
        warnings.push('Source unavailable: ' + id);
      }
    }
    return { ids: ready, warnings };
  });
  const quotes = await tools.step('evidence', () => tools.retrieve(sources.ids));
  const synthesis = await tools.step('synthesis', async () => {
    if (!quotes.length || !tools.model) return extractive(quotes, '模型未配置或本次运行未获授权，已生成可核查的资料摘录。');
    const data = { goal: input.goal,intent:input.intent,...(input.audience ? { audience:input.audience } : {}), evidence: quotes.slice(0, 6).map(q => ({ ...q, quote: q.quote })) };
    try {
      const raw=await tools.model('research.synthesize',data);
      return { report:decodeResearchSynthesis(raw,data.evidence.map(item => item.id)) };
    } catch (error) {
      tools.signal.throwIfAborted();
      if (error instanceof BudgetExceeded || (error instanceof AppError && !error.code.startsWith('PROVIDER_'))) throw error;
      await tools.record('ValidationFallback', { stage: 'synthesis' });
      return extractive(quotes, '已保留与主题相关的原文摘录。');
    }
  });
  const checked = await tools.step('checkedSynthesis',async () => {
    if (synthesis.warning || !tools.model) return synthesis;
    if (input.budget.max_calls < 2) return extractive(quotes,'已保留与主题相关的原文摘录。');
    try {
      const evidence = quotes.slice(0,6).map(({ id,quote,source_id }) => ({ id,quote,source_id }));
      const raw = await tools.model('research.verify',{ goal:input.goal,evidence,report:synthesis.report });
      return validateResearchSynthesis(raw,synthesis.report,evidence) ?? extractive(quotes,'已保留与主题相关的原文摘录。');
    } catch (error) {
      tools.signal.throwIfAborted();
      if (error instanceof BudgetExceeded || (error instanceof AppError && !error.code.startsWith('PROVIDER_'))) throw error;
      await tools.record('ValidationFallback',{ stage:'checkedSynthesis' });
      return extractive(quotes,'已保留与主题相关的原文摘录。');
    }
  });
  return {
    ...checked, warning: [checked.warning, ...sources.warnings].filter(Boolean).join(' / ') || undefined,
    quotes, sourceIds: sources.ids, transient: input.mode === 'simple',
  };
}

export type AgentCheckpoint = Partial<Checkpoint>;
