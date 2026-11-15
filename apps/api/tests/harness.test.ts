import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test,type TestContext } from 'node:test';
import type { ArtifactDetail,Block,DocumentAnalysisRun,WorkspaceProjection } from '@akw/contracts';
import { createApp } from '../src/http/app';
import { migrate,openDatabase } from '../src/platform/database';
import { AppError } from '../src/platform/errors';
import { meetsSourceRequirement,requiredSources } from '../src/quality-engine/source-requirements';
import { decodeAnalysisVerdict,markCovered,prepareAnalysisEvidence,type Claim } from '../src/quality-engine/document-quality';
import { reviewSelection } from '../src/quality-engine/selection-review';
import { answerContract,assessAnswer,standardHashComparison } from '../src/quality-engine/research-operators';
import { auditRequirements,type RequirementLeaf } from '../src/quality-engine/requirement-ledger';
import { supportsAnalysisStatement } from '../src/quality-engine/evidence-checks';
import { deepSeekStreamingGateway,readDeepSeekStream,type StreamCompletion,type StreamRequest,type StreamingGateway } from '../src/runtime/harness/adapter';
import { rewriteSelection } from '../src/runtime/selection';
import { runToolLoop } from '../src/runtime/harness/loop';
import { mentionedDois } from '../src/runtime/public-research';
import { harnessRollout,type RuntimeFlags } from '../src/runtime/harness/session';
import { services } from '../src/services';

const signal=new AbortController().signal;
const flags:RuntimeFlags={ tools:true,skills:true,compaction:true };
const profile={ provider:'deepseek',model:'fixture',protocol:'chat-completions',thinking:'disabled' } as const;
const errorCode=(code:string)=>(error:unknown)=>error instanceof AppError && error.code===code;
const finish=(text:string,fields:Partial<StreamCompletion>={}):StreamCompletion=>({
  text,input:23,output:15,model:'fixture',provider:'deepseek',finishReason:'stop',toolCalls:[],...fields,
});
function sse(frames:unknown[],done=true) {
  const text=frames.map(frame=>'data: '+JSON.stringify(frame)+'\r\n\r\n').join('')+(done?'data: [DONE]\r\n\r\n':'');
  const bytes=new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for(let offset=0;offset<bytes.length;offset+=7) controller.enqueue(bytes.slice(offset,offset+7));
    controller.close();
  } });
}

test('stream reassembles UTF-8, tool arguments, reasoning state and actual usage',async()=>{
  const id=randomUUID();
  const frames=[
    { choices:[{ delta:{ content:'资料',reasoning_content:'private' } }] },
    { choices:[{ delta:{ tool_calls:[{ index:0,id:'call_one',function:{ name:'read_evidence_excerpt',arguments:'{"evidence_id":"' } }] } }] },
    { choices:[{ delta:{ tool_calls:[{ index:0,function:{ arguments:id+'"}' } }] },finish_reason:'tool_calls' }],
      usage:{ prompt_tokens:12,completion_tokens:9 },model:'resolved' },
  ];
  const output=await readDeepSeekStream(sse(frames),'fixture',signal,true);
  assert.equal(output.text,'资料');
  assert.equal(output.reasoning,'private');
  assert.equal(output.toolCalls[0]?.function.arguments,JSON.stringify({ evidence_id:id }));
  assert.deepEqual([output.input,output.output,output.model,output.finishReason],[12,9,'resolved','tool_calls']);
  assert.equal((await readDeepSeekStream(sse(frames),'fixture',signal)).reasoning,undefined);
  await assert.rejects(readDeepSeekStream(sse(frames,false),'fixture',signal),errorCode('PROVIDER_STREAM_INTERRUPTED'));
});

test('adapter distinguishes retryable HTTP errors and cancels a pending stream read',async()=>{
  const gateway=deepSeekStreamingGateway('fixture','fixture',async()=>new Response('rate limit',{ status:429 }));
  await assert.rejects(gateway.complete({ messages:[],json:false,maxOutput:250 },signal),
    (error:unknown)=>error instanceof AppError && error.code==='PROVIDER_RATE_LIMIT' && error.retryable);
  const controller=new AbortController();
  const pending=readDeepSeekStream(new ReadableStream<Uint8Array>(), 'fixture',controller.signal);
  controller.abort();
  await assert.rejects(pending,(error:unknown)=>error instanceof Error && error.name==='AbortError');
});

test('loop pairs authorized tool results, preserves private protocol state and rejects unknown evidence',async()=>{
  const id=randomUUID(),logs:unknown[]=[];
  let calls=0,authorized=0;
  const result=await runToolLoop({
    messages:[{ role:'user',content:'Answer' }],json:true,thinking:true,signal,stepId:randomUUID(),
    tool:{ excerpts:new Map([[id,{ id,title:'Fixture',quote:'Original evidence',kind:'source' }]]),
      authorize:async()=>{ authorized++; } },
    report:async(type,data)=>{ logs.push([type,data]); },
    send:async(messages,tools)=>{
      assert.equal(tools?.[0]?.function.name,'read_evidence_excerpt');
      if (++calls===1) return finish('',{ finishReason:'tool_calls',reasoning:'private fixture',toolCalls:[{
        id:'one',type:'function',function:{ name:'read_evidence_excerpt',arguments:JSON.stringify({ evidence_id:id }) },
      },{
        id:'two',type:'function',function:{ name:'read_evidence_excerpt',arguments:JSON.stringify({ evidence_id:randomUUID() }) },
      }] });
      const last=messages.slice(-3);
      assert.ok(last[0]?.role==='assistant' && last[0].reasoning_content==='private fixture');
      assert.ok(last[1]?.role==='tool' && last[1].tool_call_id==='one' && last[1].content.includes('Original evidence'));
      assert.ok(last[2]?.role==='tool' && last[2].tool_call_id==='two' && last[2].content.includes('TOOL_NOT_IN_SCOPE'));
      return finish('{"answered":true}');
    },
  });
  assert.equal(result,'{"answered":true}');
  assert.equal(authorized,1);
  assert.doesNotMatch(JSON.stringify(logs),/private fixture|Original evidence/);
});

test('rollout requires explicit enablement and local-all stays confined to local mode',()=>{
  assert.equal(harnessRollout({ AKW_HARNESS_V2_LOCAL_ALL:'true' }).admit('x'),undefined);
  assert.equal(harnessRollout({ AKW_PROFILE:'server',AKW_HARNESS_V2_ENABLED:'true',AKW_HARNESS_V2_LOCAL_ALL:'true' }).admit('x'),undefined);
  assert.deepEqual(harnessRollout({ AKW_HARNESS_V2_ENABLED:'true',AKW_HARNESS_V2_WORKSPACES:'a,x',AKW_HARNESS_V2_TOOLS:'false' }).admit('x'),
    { tools:false,skills:true,compaction:true });
});

test('publication identifiers are bounded and survive citation punctuation',()=>{
  assert.deepEqual(mentionedDois('(DOI 10.1103/PhysRevLett.116.061102), https://doi.org/10.1234/a(b); DOI 10.1103/physrevlett.116.061102'),
    ['10.1103/physrevlett.116.061102','10.1234/a(b)']);
});

test('primary source constraints reject unrelated and lookalike origins',()=>{
  const [requirement]=requiredSources('引用 NIST 的 FIPS 202 原始标准');
  assert.ok(requirement);
  assert.equal(meetsSourceRequirement(requirement,'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf'),true);
  assert.equal(meetsSourceRequirement(requirement,'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf'),false);
  assert.equal(meetsSourceRequirement(requirement,'https://csrc.nist.gov.example.test/pubs/fips/202/final'),false);
});

test('comparison coverage requires the requested construction and refuses unsupported zero padding',()=>{
  const id=randomUUID();
  const contract=answerContract('构造与输出位数');
  const quote:Claim={ key:'1.1',kind:'quote',text:'The result is a 256-bit message digest.',evidence_ids:[id] };
  assert.equal(assessAnswer(contract,[quote]),false);
  assert.equal(assessAnswer(contract,[quote,{ ...quote,kind:'statement',text:'The sponge uses a permutation.' }]),true);
  assert.equal(supportsAnalysisStatement('摘要补零对齐后外观相同。',['The functions produce the same digest length.']),false);
});

test('coverage requires an explicit measured result and preserves nonnumeric source limits as excerpts',()=>{
  const id=randomUUID();
  const evidence=prepareAnalysisEvidence([{ id,kind:'source',title:'Fixture',
    quote:'For model A the reduction was 12%. For model B the reduction was 18%. The tests do not establish performance at freezing temperatures.' }]);
  assert.ok(evidence.optionsForQuote.some(item=>item.text==='For model B the reduction was 18%.'));
  assert.ok(evidence.optionsForQuote.some(item=>item.text==='The tests do not establish performance at freezing temperatures.'));
  const answers=new Map<number,Set<Claim>>();
  const claim:Claim={ key:'1.1',kind:'statement',text:'供暖基线相同。',evidence_ids:[id] };
  const verdict={ approved_claims:[claim.key],approved_images:[],answers:[{ facet:0,claim_key:claim.key }] };
  markCovered(answers,['比较准确降幅'],[{ title:'比较结果',facet:0,claims:[claim] }],verdict);
  assert.equal(answers.size,0);
  const measured:Claim={ ...claim,kind:'quote',text:'At 24 °C the measured reduction was 12%.' };
  markCovered(answers,['比较准确降幅'],[{ title:'比较结果',facet:0,claims:[measured] }],verdict);
  assert.deepEqual([...answers.get(0)!],[measured]);
});

test('cited scope gate catches a shortened indoor condition before semantic verification',async()=>{
  await assert.rejects(reviewSelection({ original:'在恒定室内温度下开展现场测试。',replacement:'在恒温下开展现场测试。',
    before:'在恒定室内温度下开展现场测试。',after:'在恒温下开展现场测试。',
    evidence:[{ id:randomUUID(),title:'Fixture',quote:'在恒定室内温度下开展现场测试。' }],directQuote:false },
    async()=>{ throw new Error('Scope should fail before a provider call'); }),errorCode('AI_EDIT_SCOPE'));
});

test('selection applies explicit literal replacement and never silently deletes a rewrite',async ()=>{
  const input={ instruction:'Replace the selected word with the exact word new. Output no extra spaces or punctuation.',
    original:'old',left:'LEFT ',right:' RIGHT',evidence:[],directQuote:false };
  assert.equal(await rewriteSelection(input,signal,async()=>{ throw new Error('No model call is needed'); }),'new');
  const prompts:string[]=[];
  const answer=await rewriteSelection({ ...input,instruction:'Rewrite for clarity.' },signal,async (_budget,prompt)=>{
    prompts.push(prompt);
    return prompt==='selection.rewrite' ? '{"text":" "}' : '{"text":"clearer"}';
  });
  assert.equal(answer,'clearer');
  assert.deepEqual(prompts,['selection.rewrite','selection.repair-empty']);
});

test('mandatory publication requires all four stages and material pointers',()=>{
  const id=randomUUID(),evidenceId=randomUUID();
  const cite:Block={ id,type:'paragraph',children:[{ type:'citation',attrs:{ evidence_id:evidenceId } }] };
  const leaf:RequirementLeaf={ id:'A',type:'question',description:'Required claim',mandatory:true,
    retrieval:'complete',evidence:'complete',answer:'complete',evidenceIds:[evidenceId],blockIds:[id] };
  assert.equal(auditRequirements([leaf],[cite]).gate,'pass');
  for (const stage of ['retrieval','evidence','answer'] as const)
    assert.equal(auditRequirements([{ ...leaf,[stage]:'pending' }],[cite]).gate,'blocked');
  assert.equal(auditRequirements([{ ...leaf,evidenceIds:[randomUUID()] }],[cite]).gate,'blocked');
  assert.equal(auditRequirements([{ ...leaf,type:'visual_asset',mandatory:false }],[cite]).gate,'pass_with_disclosed_gaps');
});

test('dual construction and primary excerpt ordering survive the evidence cap',()=>{
  const contract=answerContract('构造与输出位数','SHA-256 versus SHA3-256');
  const first={ kind:'quote',text:'SHA-256 compresses message blocks and outputs a 256-bit digest.' };
  assert.equal(assessAnswer(contract,[first]),false);
  assert.equal(assessAnswer(contract,[first,{ kind:'statement',text:'SHA3-256 uses a sponge construction.' }]),true);
  const primary=Array.from({ length:5 },(_,index)=>({ id:randomUUID(),kind:'report' as const,title:'Required fixture',
    quote:'Primary method section '+index+' describes the construction.',source_url:'https://example.com/required' }));
  const background=Array.from({ length:25 },(_,index)=>({ id:randomUUID(),kind:'report' as const,title:'Secondary '+index,quote:'Background evidence.' }));
  const prepared=prepareAnalysisEvidence([...background,...primary],new Set(primary.map(item=>item.id)));
  assert.deepEqual(prepared.text.slice(0,5).map(item=>item.id),primary.map(item=>item.id));
  const official=[
    ['180-4','The final result of SHA-256 is a 256-bit message digest.'],
    ['180-4','Each message block, M(1), M(2), …, M(N), is processed in order, using the following steps:'],
    ['202','The four SHA-3 hash functions are named SHA3-224 and others, e.g., SHA3-256 produces 256-bit digests.'],
    ['202','SHA3-256(M) = KECCAK[512] (M || 01, 256);'],
  ].map(([number,quote])=>({ id:randomUUID(),kind:'report' as const,title:'Standard',quote:quote!,
    source_url:'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.'+number+'.pdf' }));
  assert.equal(standardHashComparison(['构造与输出位数'],'SHA-256 与 SHA3-256',official)?.claims.length,4);
  assert.equal(standardHashComparison(['构造与输出位数'],'SHA-256 与 SHA3-256',official.slice(0,3)),undefined);
  assert.equal(supportsAnalysisStatement('KMAC 由 FIPS 202 规定。',['FIPS 202 specifies SHA-3. KMAC uses KECCAK.']),false);
  assert.equal(supportsAnalysisStatement('KMAC 由 FIPS 202 规定。',['FIPS 202 defines SHA-3. KMAC uses KECCAK.']),false);
  const id=randomUUID();
  assert.deepEqual(decodeAnalysisVerdict(JSON.stringify({ approved_claims:['1.1','invalid'],approved_images:[id,'image-id'],description:'discard' })),
    { approved_claims:['1.1'],approved_images:[id],answers:[] });
});

async function setup(t:TestContext,gateway:StreamingGateway,admit:()=>RuntimeFlags|undefined=()=>flags) {
  const db=await openDatabase({});
  await migrate(db);
  const state=services(db,{ async put(){ throw new Error('Unexpected object write'); },async get(){ throw new Error('Unexpected object read'); } },{
    model:{ async generate(){ return { text:'{"text":"new"}',input:23,output:15,model:'fixture',provider:'test' }; } },
    harness:{ gateway,rollout:{ admit } },
  });
  const app=await createApp(state,true);
  t.after(async()=>{ await app.close();await db.close(); });
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl()+'/v1';
  async function req<T>(path:string,body?:object,status?:number):Promise<T> {
    const response=await fetch(base+path,{ method:body===undefined?'GET':'POST',headers:{ 'Content-Type':'application/json' },
      body:body===undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(10_000) });
    if (status) assert.equal(response.status,status);
    else assert.ok(response.ok,path+' '+response.status);
    return response.json() as Promise<T>;
  }
  const ws=await req<{ id:string }>('/workspaces',{ name:'Harness fixture',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  const block={ id:randomUUID(),type:'paragraph',children:[{ type:'text',text:'LEFT old RIGHT' }] };
  const doc=await req<ArtifactDetail>('/artifacts',{ workspace_id:ws.id,title:'Fixture',content:{
    schema_version:'1.0',blocks:[block],relations:{ source_ids:[],knowledge_node_ids:[] },
  } });
  const analysis=(body:object)=>req<{ run_id:string;runtime_session_id?:string }>('/artifacts/'+doc.id+'/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'Report the calibration finding.',allow_external:true,use_web:false,...body,
  },202);
  const selection=()=>req<{ run_id:string;runtime_session_id?:string }>('/artifacts/'+doc.id+'/ai-patch-runs',{
    base_revision_id:doc.revision.id,block_id:block.id,inline_index:0,start_utf16:5,end_utf16:8,instruction:'Replace with new.',allow_external:true,
  },202);
  const source=()=>req<{ id:string }>('/sources',{ workspace_id:ws.id,title:'Bench calibration',sensitivity:'public',
    text:'The calibration showed stable measurements in the indoor bench test. '+('The method retained a stable reference across the samples. '.repeat(25)) });
  return { db,state,req,ws,doc,analysis,selection,source };
}
type Timeline={ events:{ event_type:string;event_id:string;sequence:string;payload:Record<string,unknown> }[];next_cursor:string };
const planning=()=>finish('{"chinese":"校准","english":"calibration","facets":[{"label":"Finding","chinese":"校准","english":"calibration"}]}');
const review=()=>finish('{"approved_claims":["1.1"],"answers":[{"facet":0,"claim_key":"1.1"}]}');
function inputOf(request:StreamRequest) { return JSON.parse(request.messages[1]?.content ?? '{}'); }

test('canary preserves evidence through compaction, resumes from a checkpoint, and replays sanitized events',async t=>{
  let initialDrafts=0,toolReads=0,interrupt=true;
  const attempt=new AbortController();
  const fixture=await setup(t,{ profile,async complete(request) {
    const prompt=request.messages[0]?.content ?? '';
    if (prompt.startsWith('Plan public')) return planning();
    if (prompt.startsWith('Write a concise')) {
      const payload=inputOf(request);
      const item=payload.evidence[0];
      if (request.messages.length===2) {
        initialDrafts++;
        assert.equal(item.excerpt_truncated,true);
        return finish('',{ finishReason:'tool_calls',toolCalls:[{ id:'read_one',type:'function',
          function:{ name:'read_evidence_excerpt',arguments:JSON.stringify({ evidence_id:item.id }) } }] });
      }
      toolReads++;
      const result=request.messages.at(-1);
      assert.ok(result?.role==='tool' && JSON.parse(result.content).quote.length>880);
      return finish(JSON.stringify({ sections:[{ title:'Calibration',facet:0,claims:[
        { kind:'statement',text:'The calibration showed stable measurements.',evidence_ids:[item.id] },
      ] }] }));
    }
    if (interrupt) { interrupt=false;attempt.abort();attempt.signal.throwIfAborted(); }
    return review();
  } });
  const src=await fixture.source();
  const job=await fixture.analysis({ source_id:src.id,required_questions:['Calibration > Finding'] });
  assert.ok(job.runtime_session_id);
  await fixture.state.jobs.next(attempt.signal);
  await fixture.db.all("UPDATE jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[job.run_id]);
  await fixture.state.jobs.next(signal);
  const result=await fixture.req<DocumentAnalysisRun>('/artifact-analysis-runs/'+job.run_id);
  assert.equal(result.status,'COMPLETED');
  assert.deepEqual(result.result?.coverage,{ requested:1,supported:1 });
  const ledger=result.result?.requirement_ledger;
  assert.equal(ledger?.gate,'pass');
  assert.deepEqual(ledger?.mandatory.artifact,{ completed:1,total:1 });
  assert.equal(ledger?.items.find(item=>item.type==='group')?.description,'Calibration');
  assert.equal(ledger?.acceptedRevisionId,undefined);
  const accepted=await fixture.req<{ revision:ArtifactDetail['revision'] }>('/artifacts/'+fixture.doc.id+'/patches/'+result.result?.patch_id+'/accept',{});
  const committed=await fixture.req<DocumentAnalysisRun>('/artifact-analysis-runs/'+job.run_id);
  assert.equal(committed.result?.requirement_ledger?.acceptedRevisionId,accepted.revision.id);
  const canonical=accepted.revision.content_json.blocks.find(block=>block.attrs?.ai_claim);
  assert.equal(typeof canonical?.attrs?.claim_id,'string');
  const links=await fixture.db.all<{ evidence_id:string }>('SELECT evidence_id FROM claim_evidence WHERE claim_id=$1',[canonical?.attrs?.claim_id]);
  assert.deepEqual(links.map(item=>item.evidence_id),ledger?.items[0]?.evidenceIds);
  assert.ok(accepted.revision.content_json.blocks.some(block=>block.type==='evidence_network'));
  const projection=await fixture.req<WorkspaceProjection>('/artifacts/'+fixture.doc.id+'/projection');
  assert.deepEqual(projection.references?.claims.find(claim=>claim.id===canonical?.attrs?.claim_id)?.block_ids,[canonical?.id]);
  assert.equal(initialDrafts,1);
  assert.equal(toolReads,1);
  const route='/runtime-runs/'+job.run_id;
  const data=await fixture.req<Timeline>(route+'/events?cursor=0');
  const events=data.events.map(item=>item.event_type);
  for(const event of ['turn.resumed','context.compacted','tool.started','tool.finished','artifact.proposed','turn.finished'])
    assert.ok(events.includes(event),event);
  assert.doesNotMatch(JSON.stringify(data),/bench test|stable reference/);
  assert.equal(new Set(data.events.map(item=>item.event_id)).size,data.events.length);
  const tail=await fixture.req<Timeline>(route+'/events?cursor='+data.next_cursor);
  assert.deepEqual(tail.events,[]);
  const status=await fixture.req<{ watermark:string }>(route);
  assert.equal(status.watermark,data.next_cursor);
});

test('worker resumes between tool output and the next model response',async t=>{
  const original=process.env.AKW_RUNTIME_RECOVERY_KEY;
  process.env.AKW_RUNTIME_RECOVERY_KEY='ab'.repeat(32);
  t.after(()=>{ if (original===undefined) delete process.env.AKW_RUNTIME_RECOVERY_KEY;else process.env.AKW_RUNTIME_RECOVERY_KEY=original; });
  const firstWorker=new AbortController();
  let toolRequests=0,continuations=0;
  const fixture=await setup(t,{ profile,async complete(request) {
    const prompt=request.messages[0]?.content ?? '';
    if (prompt.startsWith('Plan public')) return planning();
    if (!prompt.startsWith('Write a concise')) return review();
    const item=inputOf(request).evidence[0];
    if (request.messages.length===2) {
      toolRequests++;
      return finish('',{ finishReason:'tool_calls',toolCalls:[{ id:'recovery_read',type:'function',
        function:{ name:'read_evidence_excerpt',arguments:JSON.stringify({ evidence_id:item.id }) } }] });
    }
    const result=request.messages.at(-1);
    assert.ok(result?.role==='tool' && JSON.parse(result.content).quote.includes('stable reference'));
    if (++continuations===1) {
      firstWorker.abort();
      firstWorker.signal.throwIfAborted();
    }
    return finish(JSON.stringify({ sections:[{ title:'Calibration',facet:0,claims:[
      { kind:'statement',text:'The calibration showed stable measurements.',evidence_ids:[item.id] },
    ] }] }));
  } });
  const source=await fixture.source();
  const job=await fixture.analysis({ source_id:source.id,required_questions:['Finding'] });
  await fixture.state.jobs.next(firstWorker.signal);
  const saved=await fixture.db.all<{ entry_key:string;sealed_payload:string }>('SELECT entry_key,sealed_payload FROM runtime_journal WHERE session_id=$1',[job.runtime_session_id]);
  assert.ok(saved.some(item=>item.entry_key==='tool:recovery_read'));
  assert.doesNotMatch(JSON.stringify(saved),/stable reference|stable measurements/);
  await fixture.db.all("UPDATE jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[job.run_id]);
  await fixture.state.jobs.next(signal);
  assert.equal((await fixture.req<DocumentAnalysisRun>('/artifact-analysis-runs/'+job.run_id)).status,'COMPLETED');
  assert.equal(toolRequests,1);
  assert.equal(continuations,2);
  assert.deepEqual(await fixture.db.all('SELECT entry_key FROM runtime_journal WHERE session_id=$1',[job.runtime_session_id]),[]);
  assert.equal((await fixture.req<unknown[]>('/artifacts/'+fixture.doc.id+'/patches')).length,1);
  assert.doesNotMatch(JSON.stringify(await fixture.req('/runtime-runs/'+job.run_id+'/events')),/stable reference|stable measurements/);
});

test('a completed quick answer can be saved once as an editable note',async t=>{
  const fixture=await setup(t,{ profile,async complete(){ return finish('An editable fixture answer.'); } });
  const run=await fixture.req<{ run_id:string }>('/research-runs',{ workspace_id:fixture.ws.id,goal:'Save a quick answer',
    mode:'simple',audience:'high_school',allow_external:true },202);
  const path='/research-runs/'+run.run_id+'/save-answer';
  await fixture.req(path,{},409);
  await fixture.state.jobs.next(signal);
  const saved=await fixture.req<ArtifactDetail>(path,{});
  assert.equal(saved.kind,'note');
  assert.equal(saved.revision.content_json.blocks[0]?.children?.[0]?.type,'text');
  assert.match(saved.revision.content_json.blocks[0]?.children?.[0]?.text ?? '',/editable fixture answer|new/);
  assert.equal((await fixture.req<ArtifactDetail>(path,{})).id,saved.id);
});

test('missing primary source prevents proposal and rollback leaves prior sessions readable',async t=>{
  let enabled=true;
  const fixture=await setup(t,{ profile,async complete(){ return planning(); } },()=>enabled ? flags : undefined);
  const src=await fixture.source();
  const job=await fixture.analysis({ source_id:src.id,goal:'引用 NIST 的 FIPS 202 原始标准' });
  await fixture.state.jobs.next(signal);
  const result=await fixture.req<DocumentAnalysisRun>('/artifact-analysis-runs/'+job.run_id);
  assert.equal(result.status,'FAILED');
  assert.equal(result.result?.warning,'ANALYSIS_REQUIRED_SOURCE');
  assert.deepEqual(result.result?.missing_requirements,['FIPS 202']);
  assert.deepEqual(await fixture.req('/artifacts/'+fixture.doc.id+'/patches'),[]);
  enabled=false;
  const legacy=await fixture.selection();
  assert.equal(legacy.runtime_session_id,undefined);
  await fixture.state.jobs.next(signal);
  await fixture.req('/runtime-runs/'+legacy.run_id,undefined,404);
  await fixture.req('/runtime-runs/'+job.run_id,undefined,200);
});

test('canary cancellation propagates to the active provider and prevents a late proposal',async t=>{
  let started!:()=>void;
  const entered=new Promise<void>(resolve=>{ started=resolve; });
  let aborted=false;
  const fixture=await setup(t,{ profile,async complete(_request,current) {
    started();
    await new Promise<void>((_resolve,reject)=>current.addEventListener('abort',()=>{ aborted=true;reject(current.reason); },{ once:true }));
    return finish('{"text":"new"}');
  } });
  const job=await fixture.selection();
  const worker=fixture.state.jobs.next(AbortSignal.timeout(8_000));
  await entered;
  await fixture.req('/runtime-runs/'+job.run_id+'/cancel',{},200);
  await worker;
  assert.ok(aborted);
  assert.deepEqual(await fixture.req('/artifacts/'+fixture.doc.id+'/patches'),[]);
  const events=await fixture.req<Timeline>('/runtime-runs/'+job.run_id+'/events');
  assert.equal(events.events.at(-1)?.payload.status,'CANCELLED');
});
