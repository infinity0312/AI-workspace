import { randomUUID } from 'node:crypto';
import { artifactDocument,emptyDocument,type Block } from '@akw/contracts';
import { first,type Database } from '../../platform/database';
import { AppError,invalid,parse } from '../../platform/errors';
import { runAgent,type AgentTools,type ResearchInput } from '../../runtime/agent';
import type { EmbeddingGateway,SearchResult } from '../../runtime/providers';
import { event,workspace } from '../access';
import { aiPolicyVersion,readAiEvidence } from '../ai-evidence';
import type { Artifacts } from '../artifacts';
import type { Knowledge } from '../knowledge';
import { assertExternal } from './external-access';
import type { RunningJob } from './job-types';
import type { InvokeJobModel } from './model-invocation';

const researchWorkflowVersion = 7;

export async function executeResearch({ job,actor,signal,lifecycle }:RunningJob,input:ResearchInput,{
  db,artifacts,knowledge,search,embed,model,
}:{ db:Database;artifacts:Artifacts;knowledge:Knowledge;search?:(goal:string,signal:AbortSignal)=>Promise<SearchResult[]>;
  embed?:EmbeddingGateway;model?:InvokeJobModel }) {
  const actorAccess = await workspace(db,actor,job.workspace_id);
  const canExternal = input.allow_external && actorAccess.policy.externalProviderAllowed &&
    ['public','personal'].includes(actorAccess.policy.sensitivity);
  const originalSources = await Promise.all(input.source_ids.map(id => knowledge.source(actor,id)));
  const sourceAllowsModel = originalSources.every(source => ['public','personal'].includes(source.sensitivity) && source.rights !== 'restricted');
  const tools: AgentTools = {
    signal,
    record: (type,payload) => lifecycle.record(type,payload),
    discover: canExternal && search ? async goal => {
      await assertExternal(db,actor,job.workspace_id);
      await lifecycle.record('SearchRequested',{ provider: 'brave' });
      return search!(goal,signal);
    } : undefined,
    register: results => db.transaction(async sql => {
      await workspace(sql,actor,job.workspace_id,true);
      await lifecycle.assertLease(sql);
      const ids: string[] = [];
      for (const result of results) {
        try {
          const source = await knowledge.registerIn(sql,actor,{
            workspace_id: job.workspace_id, project_id: input.project_id, title: result.title.slice(0,200) || result.url.slice(0,200),
            url: result.url, sensitivity: 'public', rights: 'unknown',
          });
          ids.push(source.id);
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
        }
      }
      return ids;
    }),
    ingest: async id => {
      await lifecycle.assertLease(db);
      const source = await knowledge.source(actor,id);
      if (source.canonical_url && !source.asset_id && source.status !== 'parsed' && !input.source_ids.includes(id)) {
        await assertExternal(db,actor,job.workspace_id);
      }
      await knowledge.ingest(actor,id,signal);
    },
    retrieve: async ids => {
      let queryVector: number[] | undefined;
      if (ids.length && canExternal && sourceAllowsModel && embed) {
        try {
          await assertExternal(db,actor,job.workspace_id);
          const publicSources = await Promise.all(ids.map(id => knowledge.source(actor,id)));
          if (publicSources.every(source => source.sensitivity === 'public')) {
            await lifecycle.record('EmbeddingRequested',{ source_count: Math.min(3,ids.length) });
            for (const sourceId of ids.slice(0,3)) await knowledge.indexPassages(actor,sourceId,texts => embed!(texts,signal),embed.profile);
            queryVector = (await embed([input.goal],signal))[0];
          }
        } catch {
          signal.throwIfAborted();
          await lifecycle.record('EmbeddingUnavailable',{});
        }
      }
      const candidates = await knowledge.retrieve(actor,job.workspace_id,ids,input.goal,input.project_id ?? null,queryVector,
        { corpus:input.use_workspace,external:Boolean(model && canExternal && sourceAllowsModel),embeddingProfile:embed?.profile });
      return db.transaction(async sql => {
        await workspace(sql,actor,job.workspace_id,true);
        await lifecycle.assertLease(sql);
        const quotes = [];
        for (const p of candidates.slice(0,6)) {
          const evidence = p.memory_id ? await first<{ id:string; quote:string; source_id:string; locator:{ page:number|null } }>(sql,
            'SELECT id,quote,source_id,locator FROM evidence WHERE id=$1',[p.memory_id]) :
            await knowledge.evidenceIn(sql,actor,p,0,p.content.length);
          if (!evidence) continue;
          quotes.push({ id: evidence.id,quote: evidence.quote,source_id: evidence.source_id,page: evidence.locator.page });
        }
        return quotes;
      });
    },
    model: model && canExternal && sourceAllowsModel
      ? (prompt,data) => model(input.budget,prompt,data) : undefined,
    step: async (name,execute) => {
      const cached = job.checkpoint[name];
      if (cached !== undefined) return cached as Awaited<ReturnType<typeof execute>>;
      signal.throwIfAborted();
      await lifecycle.record('StepStarted',{ step: name });
      const value = await execute();
      signal.throwIfAborted();
      job.checkpoint = { ...job.checkpoint,[name]: value };
      await lifecycle.save('StepCompleted',{ step: name });
      return value;
    },
  };
  if (job.checkpoint.researchPolicy !== researchWorkflowVersion) {
    job.checkpoint={ ...job.checkpoint,researchPolicy:researchWorkflowVersion,synthesis:undefined,checkedSynthesis:undefined };
    await lifecycle.save('ResearchPolicyApplied',{ policy_version:aiPolicyVersion,workflow_version:researchWorkflowVersion });
  }
  const result = await runAgent(input,tools);
  signal.throwIfAborted();
  const status = result.warning ? 'PARTIAL' : 'COMPLETED';
  await lifecycle.complete(status,async sql => {
    const scope={ workspace_id:job.workspace_id,project_id:input.project_id ?? null };
    const used=[...(result.summaryEvidence ?? []),...result.report.claims.flatMap(claim => claim.evidence_ids)];
    if (used.length) {
      await assertExternal(db,actor,job.workspace_id,sql);
      await readAiEvidence(sql,scope,used,true);
    }
    if (job.checkpoint.runtime && result.quotes.length) await readAiEvidence(sql,scope,result.quotes.map(item=>item.id),true,false);
    if (result.transient) return { response:result.report.summary,evidence:result.quotes.map(item=>item.id),warning:result.warning };
    if (!result.quotes.length) return { warning:result.warning };
    const blocks: Block[] = [
      { id:randomUUID(),type:'heading',attrs:{ level:2 },children:[{ type:'text',text:'研究摘要' }] },
      { id:randomUUID(),type:'paragraph',attrs:used.length && result.summaryEvidence?.length ? { ai_claim:true } : undefined,
        children:[{ type:'text',text:result.report.summary },...(result.summaryEvidence ?? []).map(id => ({ type:'citation',attrs:{ evidence_id:id } }))] },
    ];
    const quoteIds = new Set(result.quotes.map(quote => quote.id));
    for (const claim of result.report.claims) {
      if (claim.evidence_ids.some(id => !quoteIds.has(id))) throw invalid('Claim references evidence outside this run');
      const claimId = randomUUID();
      await sql.all(`INSERT INTO claims(id,workspace_id,statement,scope,status) VALUES($1,$2,$3,$4,'proposed')`,
        [claimId,job.workspace_id,claim.statement,claim.scope]);
      for (const evidenceId of new Set(claim.evidence_ids)) {
        await sql.all('INSERT INTO claim_evidence(claim_id,evidence_id) VALUES($1,$2)',[claimId,evidenceId]);
      }
      blocks.push({ id: randomUUID(),type: 'paragraph',attrs: { claim_id: claimId,ai_claim:true },children: [
        { type: 'text',text: claim.statement + '（适用范围：' + claim.scope + '）' },
        ...[...new Set(claim.evidence_ids)].map(id => ({ type: 'citation',attrs: { evidence_id: id } })),
      ] });
      await event(sql,actor,job.workspace_id,'ClaimProposed','claim',claimId);
    }
    for (const quote of result.quotes) {
      blocks.push({ id: randomUUID(),type: 'quote',children: [{ type: 'text',text: quote.quote },{ type: 'citation',attrs: { evidence_id: quote.id } }] });
    }
    const content = emptyDocument();
    content.blocks = blocks;
    content.relations.source_ids = result.sourceIds;
    const artifact = await artifacts.createIn(sql,actor,{
      workspace_id: job.workspace_id,project_id: input.project_id,kind: 'document',
      title: input.goal.slice(0,180),content: parse(artifactDocument,content),
    },'agent');
    return { artifact_id: artifact.id,warning: result.warning };
  });
}
