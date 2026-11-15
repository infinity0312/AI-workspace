import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/platform/errors';
import { completionText } from '../src/quality-engine/model-output';
import { deepseekGateway } from '../src/runtime/providers';

const signal=new AbortController().signal;

test('DeepSeek requests bounded JSON completions and rejects unusable finishes',async () => {
  for (const [finish,content,code] of [
    ['stop','{"valid":true}',null],
    ['stop','   ','PROVIDER_OUTPUT_EMPTY'],
    ['stop',null,'PROVIDER_OUTPUT_EMPTY'],
    ['length','{"valid":true}','PROVIDER_OUTPUT_TRUNCATED'],
    ['stop','[1]','PROVIDER_OUTPUT_INVALID_JSON'],
    ['content_filter',null,'PROVIDER_OUTPUT_STOPPED'],
    ['tool_calls','{"valid":true}','PROVIDER_OUTPUT_STOPPED'],
    ['insufficient_system_resource',null,'PROVIDER_MODEL_BUSY'],
  ] as const) {
    const gateway=deepseekGateway('fixture-key','fixture-model',async (_url,init) => {
      const sent=JSON.parse(String(init?.body));
      assert.equal(sent.max_tokens,160);
      assert.deepEqual(sent.response_format,{ type:'json_object' });
      assert.deepEqual(sent.thinking,{ type:'disabled' });
      assert.equal(sent.tools,undefined);
      return Response.json({ model:'fixture-model',choices:[{ finish_reason:finish,message:{ content,reasoning_content:'PRIVATE' } }],
        usage:{ prompt_tokens:30,completion_tokens:10 } });
    });
    const completion=await gateway.generate('Return JSON',{ goal:'Fixture' },160,signal,true);
    assert.equal(completion.finishReason,finish);
    assert.equal(completion.input+completion.output,40);
    assert.doesNotMatch(JSON.stringify(completion),/PRIVATE/);
    if (code) assert.throws(() => completionText(completion,true), (error:unknown) => error instanceof AppError && error.code===code);
    else assert.equal(completionText(completion,true),content);
  }
});

test('DeepSeek separates rate limits from malformed response envelopes',async () => {
  const generate=(response:Response)=>deepseekGateway('fixture-key','fixture-model',async () => response)
    .generate('Answer',{ goal:'Fixture' },160,signal,false);
  await assert.rejects(generate(new Response('rate limited',{ status:429 })),
    (error:unknown) => error instanceof AppError && error.code==='PROVIDER_RATE_LIMIT' && error.retryable);
  await assert.rejects(generate(new Response('invalid JSON')),
    (error:unknown) => error instanceof AppError && error.code==='PROVIDER_PROTOCOL_INVALID');
  await assert.rejects(generate(Response.json({ choices:[{ message:{ content:'No finish reason' } }] })),
    (error:unknown) => error instanceof AppError && error.code==='PROVIDER_PROTOCOL_INVALID');
});
