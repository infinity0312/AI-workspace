import { z } from 'zod';
import { AppError } from '../../platform/errors';
import type { Completion,ModelProfile } from '../../quality-engine/model-output';
import { providerBytes } from '../providers';

export const deepseekChatEndpoint='https://api.deepseek.com/chat/completions';
export type ToolCall = { id:string;type:'function';function:{ name:string;arguments:string } };
export type ChatMessage =
  | { role:'system'|'user';content:string }
  | { role:'assistant';content:string|null;tool_calls?:ToolCall[];reasoning_content?:string }
  | { role:'tool';tool_call_id:string;content:string };
export type ToolSpec = { type:'function';function:{ name:string;description:string;parameters:Record<string,unknown> } };
export type StreamRequest = { messages:ChatMessage[];json:boolean;maxOutput:number;tools?:ToolSpec[];canCallTools?:boolean;thinking?:boolean };
export type StreamCompletion = Completion & { toolCalls:ToolCall[];reasoning?:string };
export interface StreamingGateway {
  profile:ModelProfile;
  complete(request:StreamRequest,signal:AbortSignal):Promise<StreamCompletion>;
}

const reasons=z.enum(['stop','length','content_filter','tool_calls','insufficient_system_resource','aborted']);
const frame=z.object({
  model:z.string().min(1).max(120).optional(),
  usage:z.object({ prompt_tokens:z.number().int().nonnegative(),completion_tokens:z.number().int().nonnegative() }).nullish(),
  choices:z.array(z.object({
    index:z.literal(0).optional(),finish_reason:reasons.nullish(),
    delta:z.object({
      content:z.string().nullish(),reasoning_content:z.string().nullish(),
      tool_calls:z.array(z.object({
        index:z.number().int().min(0).max(7),id:z.string().max(128).optional(),type:z.literal('function').optional(),
        function:z.object({ name:z.string().max(128).optional(),arguments:z.string().optional() }).optional(),
      })).max(8).nullish(),
    }).optional(),
  })).max(1),
});

const protocolFailure=(message:string) => new AppError(502,'PROVIDER_STREAM_INVALID',message);
const truncated=() => new AppError(502,'PROVIDER_STREAM_INTERRUPTED','Incomplete model stream',{},true);

async function* dataFrames(body:ReadableStream<Uint8Array>,signal:AbortSignal) {
  const reader=body.getReader();
  const decoder=new TextDecoder('utf-8',{ fatal:true });
  let buffer='',bytes=0,data:string[]=[];
  const abort=()=>void reader.cancel().catch(()=>{});
  signal.addEventListener('abort',abort,{ once:true });
  function* consume() {
    let end:number;
    while ((end=buffer.indexOf('\n'))>=0) {
      const line=buffer.slice(0,end).replace(/\r$/,'');
      buffer=buffer.slice(end+1);
      if (!line) {
        if (data.length) yield data.join('\n');
        data=[];
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /,''));
      }
    }
  }
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value,done }=await reader.read();
      if (done) break;
      bytes+=value.length;
      if (bytes>512_000) throw new AppError(502,'PROVIDER_RESPONSE_LIMIT','Model stream exceeded size limit');
      buffer+=decoder.decode(value,{ stream:true });
      yield* consume();
    }
    signal.throwIfAborted();
    buffer+=decoder.decode();
    if (buffer) buffer+='\n';
    buffer+='\n';
    yield* consume();
  } finally {
    signal.removeEventListener('abort',abort);
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}

export async function readDeepSeekStream(body:ReadableStream<Uint8Array>,model:string,signal:AbortSignal,thinking=false):Promise<StreamCompletion> {
  let text='',reasoning='',finishReason:string|undefined,done=false;
  let usage:z.infer<typeof frame>['usage'];
  const calls=new Map<number,{ id?:string;name:string;arguments:string }>();
  for await (const data of dataFrames(body,signal)) {
    if (data==='[DONE]') { done=true;break; }
    let packet:unknown;
    try { packet=JSON.parse(data); }
    catch { throw protocolFailure('Invalid JSON model stream frame'); }
    const parsed=frame.safeParse(packet);
    if (!parsed.success) throw protocolFailure('Invalid model stream frame');
    model=parsed.data.model ?? model;
    usage=parsed.data.usage ?? usage;
    const choice=parsed.data.choices[0];
    if (!choice) continue;
    const delta=choice.delta;
    if (finishReason && (delta?.content || delta?.reasoning_content || delta?.tool_calls?.length || (choice.finish_reason && choice.finish_reason!==finishReason)))
      throw protocolFailure('Content arrived after the final completion');
    finishReason=choice.finish_reason ?? finishReason;
    text+=delta?.content ?? '';
    if (thinking) reasoning+=delta?.reasoning_content ?? '';
    for (const part of delta?.tool_calls ?? []) {
      const item=calls.get(part.index) ?? { name:'',arguments:'' };
      if (item.id && part.id && item.id!==part.id) throw protocolFailure('Tool call identity changed');
      item.id=part.id ?? item.id;
      item.name+=part.function?.name ?? '';
      item.arguments+=part.function?.arguments ?? '';
      if (item.name.length>128 || item.arguments.length>16_000) throw protocolFailure('Tool call exceeded its size limit');
      calls.set(part.index,item);
    }
    if (text.length>50_000 || reasoning.length>100_000) throw new AppError(502,'PROVIDER_RESPONSE_LIMIT','Model stream exceeded size limit');
  }
  if (!done || !finishReason || !usage) throw truncated();
  const toolCalls=[...calls.entries()].sort(([a],[b])=>a-b).map(([index,call],position):ToolCall => {
    if (index!==position || !call.id || !/^[A-Za-z0-9_-]{1,128}$/.test(call.id) || !/^[A-Za-z0-9_-]{1,64}$/.test(call.name))
      throw protocolFailure('Incomplete tool call in model stream');
    return { id:call.id,type:'function',function:{ name:call.name,arguments:call.arguments } };
  });
  if (finishReason==='tool_calls' && !toolCalls.length) throw protocolFailure('Model stopped for an absent tool call');
  if (toolCalls.length && !['tool_calls','length'].includes(finishReason)) throw protocolFailure('Unexpected tool calls in model stream');
  if (new Set(toolCalls.map(call=>call.id)).size!==toolCalls.length) throw protocolFailure('Duplicate tool call ID');
  return { text,input:usage.prompt_tokens,output:usage.completion_tokens,model,provider:'deepseek',finishReason,toolCalls,
    ...(thinking ? { reasoning } : {}) };
}

export function deepSeekStreamingGateway(key:string,model:string,fetcher:typeof fetch=fetch):StreamingGateway {
  const profile:ModelProfile={ provider:'deepseek',model,protocol:'chat-completions',thinking:'disabled' };
  return { profile,async complete(input,signal) {
    const timeout=AbortSignal.timeout(40_000);
    const combined=AbortSignal.any([signal,timeout]);
    try {
      const response=await fetcher(deepseekChatEndpoint,{
        method:'POST',redirect:'error',signal:combined,
        headers:{ Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'text/event-stream' },
        body:JSON.stringify({ model,messages:input.messages,max_tokens:input.maxOutput,stream:true,
          stream_options:{ include_usage:true },thinking:{ type:input.thinking ? 'enabled' : 'disabled' },
          ...(input.json ? { response_format:{ type:'json_object' } } : {}),...(input.tools?.length ? { tools:input.tools,tool_choice:input.canCallTools===false ? 'none' : 'auto' } : {}) }),
      });
      if (!response.ok) await providerBytes(response,512_000);
      if (!response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) {
        await response.body?.cancel().catch(()=>{});
        throw protocolFailure('Model did not return a streaming response');
      }
      return await readDeepSeekStream(response.body,model,combined,input.thinking);
    } catch (error) {
      signal.throwIfAborted();
      if (timeout.aborted) throw new AppError(502,'PROVIDER_TIMEOUT','Model request timed out',{},true);
      if (error instanceof TypeError) throw new AppError(502,'PROVIDER_NETWORK','Model network or stream failed',{},true);
      throw error;
    }
  } };
}
