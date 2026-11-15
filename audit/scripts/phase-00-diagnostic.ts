import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ArtifactDetail } from '@akw/contracts';
import { createApp } from '../../apps/api/src/http/app';
import { migrate,openDatabase } from '../../apps/api/src/platform/database';
import { deepseekGateway,modelGateway,type ModelGateway } from '../../apps/api/src/runtime/providers';
import { services } from '../../apps/api/src/services';

const content='LEFT old RIGHT';
const replacement='LEFT new RIGHT';
const internalFixture='PHASE-00-REASONING-FIXTURE';

type Run = { status:string;result:{ patch_id?:string;warning?:string } | null };
type JobEvent = { event_type:string;payload:Record<string,unknown> };

function mock(finishReason:'stop'|'length') {
  return deepseekGateway('fixture-key','fixture-model',async (url,init) => {
    assert.equal(String(url),'https://api.deepseek.com/chat/completions');
    const request=JSON.parse(String(init?.body));
    assert.equal(request.response_format.type,'json_object');
    assert.equal(request.thinking.type,'disabled');
    assert.equal(request.tools,undefined);
    return Response.json({ model:'fixture-model',choices:[{
      finish_reason:finishReason,message:{ content:'{"text":"new"}',reasoning_content:internalFixture },
    }],usage:{ prompt_tokens:40,completion_tokens:6 } });
  });
}

async function observe(label:string,gateway:ModelGateway,expected:'COMPLETED'|'FAILED') {
  const db=await openDatabase({});
  let api:Awaited<ReturnType<typeof createApp>>|undefined;
  try {
    await migrate(db);
    const service=services(db,{
      async put() { throw new Error('Unexpected object write'); },
      async get() { throw new Error('Unexpected object read'); },
    },{ model:gateway });
    api=await createApp(service,true);
    await api.listen(0,'127.0.0.1');
    const base=await api.getUrl()+'/v1';
    const request=async<T>(path:string,body?:object):Promise<{ value:T;status:number }>=>{
      const response=await fetch(base+path,{
        method:body===undefined ? 'GET' : 'POST',
        headers:{ 'Content-Type':'application/json','Idempotency-Key':randomUUID() },
        body:body===undefined ? undefined : JSON.stringify(body),
        signal:AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Unexpected HTTP status '+response.status+' at '+path);
      return { value:await response.json() as T,status:response.status };
    };
    const { value:ws }=await request<{ id:string }>('/workspaces',{
      name:'Harness Phase 00 fixture',policy:{ sensitivity:'public',externalProviderAllowed:true },
    });
    const block={ id:randomUUID(),type:'paragraph',children:[{ type:'text',text:content }] };
    const { value:artifact }=await request<ArtifactDetail>('/artifacts',{
      workspace_id:ws.id,title:'Harness Phase 00 fixture',
      content:{ schema_version:'1.0',blocks:[block],relations:{ source_ids:[],knowledge_node_ids:[] } },
    });
    const artifactPath='/artifacts/'+artifact.id;
    const started=Date.now();
    const queued=await request<{ run_id:string }>(artifactPath+'/ai-patch-runs',{
      base_revision_id:artifact.revision.id,block_id:block.id,inline_index:0,start_utf16:5,end_utf16:8,
      instruction:'Replace the selected word with the exact word new. Output no extra spaces or punctuation.',allow_external:true,
    });
    assert.equal(queued.status,202);
    assert.ok(await service.jobs.next(AbortSignal.timeout(60_000)));
    const elapsedMs=Date.now()-started;
    const runPath='/ai-patch-runs/'+queued.value.run_id;
    const { value:run }=await request<Run>(runPath);
    assert.equal(run.status,expected);
    const { value:{ events } }=await request<{ events:JobEvent[] }>(runPath+'/events');
    const { value:before }=await request<ArtifactDetail>(artifactPath);
    assert.equal(before.revision.id,artifact.revision.id);
    const { value:patches }=await request<unknown[]>(artifactPath+'/patches');
    const snapshot=events.find(e=>e.event_type==='ContextSnapshotCreated')?.payload;
    const invocation=events.find(e=>e.event_type==='ModelInvocationCompleted')?.payload;
    const failure=events.find(e=>e.event_type==='QualityGateFailed')?.payload;
    assert.ok(snapshot && invocation);
    const serialized=JSON.stringify(events);
    for (const marker of [internalFixture,'fixture-key',content,'Replace the selected word'])
      assert.equal(serialized.includes(marker),false,'Audit event contains a raw fixture value');
    let final=before;
    if (expected==='COMPLETED') {
      assert.ok(run.result?.patch_id);
      assert.equal(patches.length,1);
      await request(artifactPath+'/patches/'+run.result.patch_id+'/accept',{});
      final=(await request<ArtifactDetail>(artifactPath)).value;
      assert.ok(final.revision.content_json.blocks[0]?.children?.[0]?.text===replacement,'Accepted revision did not contain the exact replacement');
    } else {
      assert.equal(run.result?.warning,'PROVIDER_OUTPUT_TRUNCATED');
      assert.equal(failure?.code,'Q008');
      assert.equal(patches.length,0);
    }
    return {
      label,run_id:queued.value.run_id,enqueue_status:queued.status,run_status:run.status,reason:run.result?.warning,
      elapsed_ms:elapsedMs,prompt:snapshot.prompt_id,prompt_version:snapshot.prompt_version,format:snapshot.format,
      context_hash:snapshot.context_hash,model:invocation.model,provider:invocation.provider,finish_reason:invocation.finish_reason,
      model_outcome:invocation.outcome,input_tokens:invocation.input_tokens,output_tokens:invocation.output_tokens,
      model_elapsed_ms:invocation.elapsed_ms,quality_code:failure?.code,
      proposals:patches.length,revision_before:artifact.revision.revision_number,
      revision_before_accept:before.revision.revision_number,revision_final:final.revision.revision_number,
      event_types:events.map(e=>e.event_type),
    };
  } finally {
    try { await api?.close(); }
    finally { await db.close(); }
  }
}

async function main() {
  const records=[
    await observe('fixture_stop',mock('stop'),'COMPLETED'),
    await observe('fixture_length',mock('length'),'FAILED'),
  ];
  if (process.argv.includes('--live')) {
    const gateway=modelGateway();
    if (!gateway) throw new Error('DeepSeek configuration is unavailable');
    records.push(await observe('live_deepseek',gateway,'COMPLETED'));
  }
  console.log(JSON.stringify({ captured_at:new Date().toISOString(),records },null,2));
}
void main().catch(error=>{
  console.error('Phase 00 diagnostic failed ('+(error instanceof Error ? error.name : 'Unknown')+')');
  process.exitCode=1;
});
