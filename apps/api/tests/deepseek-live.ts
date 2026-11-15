import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ArtifactDetail, DocumentAnalysisRun } from '@akw/contracts';
import { createApp } from '../src/http/app';
import { migrate, openDatabase } from '../src/platform/database';
import { modelGateway } from '../src/runtime/providers';
import { services } from '../src/services';

async function main() {
  const model = modelGateway();
  if (!model) throw new Error('DEEPSEEK_API_KEY is missing from local environment');
  const db = await openDatabase({});
  const objects = { async put() { throw new Error('Unexpected object write'); }, async get(): Promise<Buffer> { throw new Error('Unexpected object read'); } };
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    await migrate(db);
    const runtime = services(db,objects,{ model });
    app = await createApp(runtime,true);
    await app.listen(0,'127.0.0.1');
    const base = await app.getUrl() + '/v1';
    const call = async <T>(path: string, body?: object): Promise<T> => {
      const response = await fetch(base + path,{
        method:body ? 'POST' : 'GET',
        headers:{ 'Content-Type':'application/json','Idempotency-Key':randomUUID() },
        body:body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(path + ' returned ' + response.status + ' ' + payload.error?.code);
      return payload as T;
    };
    const ws = await call<{ id:string }>('/workspaces',{ name:'Synthetic model validation',policy:{ sensitivity:'public',externalProviderAllowed:true } });
    const signal = new AbortController().signal;
    const run = async (goal: string, mode: 'research'|'simple', source_ids: string[]) => {
      const job = await call<{ run_id:string }>('/research-runs',{
        workspace_id:ws.id,goal,mode,source_ids,allow_external:true,budget:{ max_calls:mode === 'research' ? 2 : 1,max_tokens:mode === 'research' ? 24000 : 4000,max_seconds:80 },
      });
      assert.ok(await runtime.jobs.next(signal));
      const result = await call<{ status:string;result:{ response?:string;artifact_id?:string;warning?:string } }>('/research-runs/' + job.run_id);
      assert.ok(result.status==='COMPLETED' || (mode==='research' && result.status==='PARTIAL' && result.result.artifact_id),
        result.result.warning ?? 'Research failed');
      return result.result;
    };
    const answer = await run('Reply using only the exact code AKW-CHECK-51.','simple',[]);
    assert.match(answer.response ?? '',/AKW-CHECK-51/);
    const source = await call<{ id:string }>('/sources',{
      workspace_id:ws.id,title:'Atlas 51 synthetic input',text:'The fictional Atlas 51 prototype passed 7 out of 9 calibration trials on January 1, 2020.',
      rights:'user_owned',sensitivity:'public',
    });
    const report = await run('Use the supplied synthetic source to state exactly one claim about the number of successful calibration trials, with its evidence.','research',[source.id]);
    const detail = await call<ArtifactDetail>('/artifacts/' + report.artifact_id);
    const checkedClaim = detail.revision.content_json.blocks.find(block => block.attrs?.claim_id);
    const citationBlock = checkedClaim ?? detail.revision.content_json.blocks.find(block => block.type==='quote');
    assert.match(citationBlock?.children?.find(node => node.type==='text')?.text ?? '',/7 out of 9/);
    const reference = citationBlock?.children?.find(node => node.type === 'citation')?.attrs?.evidence_id;
    assert.equal(typeof reference,'string','Expected a checked claim or a verbatim extract with a citation');
    const evidence = await call<{ source_id:string; quote:string }>('/evidence/' + reference);
    assert.equal(evidence.source_id,source.id);
    assert.match(evidence.quote,/7 out of 9/);

    const block = { id:randomUUID(),type:'paragraph',children:[{ type:'text',text:'LEFT old RIGHT' }] };
    const draft = await call<ArtifactDetail>('/artifacts',{
      workspace_id:ws.id,title:'Synthetic selection validation',
      content:{ schema_version:'1.0',blocks:[block],relations:{ source_ids:[],knowledge_node_ids:[] } },
    });
    const proposal = await call<{ run_id:string }>('/artifacts/' + draft.id + '/ai-patch-runs',{
      base_revision_id:draft.revision.id,block_id:block.id,inline_index:0,start_utf16:5,end_utf16:8,
      instruction:'Replace the selected word with the exact word new. Output no extra spaces or punctuation.',allow_external:true,
    });
    assert.ok(await runtime.jobs.next(signal));
    const patchJob = await call<{ status:string;result:{ patch_id:string;warning?:string } }>('/ai-patch-runs/' + proposal.run_id);
    assert.equal(patchJob.status,'COMPLETED',patchJob.result.warning ?? 'Patch generation failed');
    assert.equal((await call<ArtifactDetail>('/artifacts/' + draft.id)).revision.id,draft.revision.id,'Proposal must leave the artifact untouched');
    await call('/artifacts/' + draft.id + '/patches/' + patchJob.result.patch_id + '/accept',{});
    const edited = await call<ArtifactDetail>('/artifacts/' + draft.id);
    assert.equal(edited.revision.content_json.blocks[0]?.children?.[0]?.text,'LEFT new RIGHT');
    const target = await call<ArtifactDetail>('/artifacts',{ workspace_id:ws.id,title:'Synthetic analysis target' });
    const analysis = await call<{ run_id:string }>('/artifacts/' + target.id + '/analysis-runs',{
      base_revision_id:target.revision.id,goal:'Analyze the fictional Atlas 51 calibration result from the selected source.',
      source_id:source.id,allow_external:true,use_web:false,
    });
    assert.ok(await runtime.jobs.next(signal));
    const generated = await call<DocumentAnalysisRun>('/artifact-analysis-runs/' + analysis.run_id);
    assert.equal(generated.status,'COMPLETED',generated.result?.warning ?? 'Analysis failed');
    assert.equal(generated.result?.grounded,true);
    assert.equal((await call<ArtifactDetail>('/artifacts/' + target.id)).revision.content_json.blocks.length,0);
    await call('/artifacts/' + target.id + '/patches/' + generated.result?.patch_id + '/accept',{});
    const approved = await call<ArtifactDetail>('/artifacts/' + target.id);
    assert.equal(approved.revision.revision_number,2);
    assert.ok(approved.revision.content_json.blocks.some(item => item.children?.some(node => node.type === 'citation')));
    const usage = await call<{ provider:string;model:string;calls:number;input_tokens:number;output_tokens:number }[]>('/usage?workspace_id=' + ws.id);
    const calls=usage.reduce((count,item) => count + item.calls,0);
    assert.ok(calls>=6 && calls<=10,'Model calls must stay within the combined task budgets');
    console.log(JSON.stringify({ passed:['simple response','research evidence and safe extractive fallback','selection proposal and approval','grounded document analysis and approval'],usage }));
  } finally {
    await app?.close();
    await db.close();
  }
}
void main().catch(error => {
  console.error('Live validation failed:',error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
