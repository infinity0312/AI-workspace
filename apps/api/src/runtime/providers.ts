import { z } from 'zod';
import { AppError } from '../platform/errors';
import { sha256 } from '../platform/security';

import type { Completion,ModelProfile } from '../quality-engine/model-output';

const deepseekEndpoint = 'https://api.deepseek.com/chat/completions';
export interface ModelGateway {
  profile?:ModelProfile;
  generate(system: string, data: unknown, maxOutput: number, signal: AbortSignal, json?: boolean): Promise<Completion>;
}
const modelResponse = z.object({
  model:z.string().min(1).max(120),
  choices:z.array(z.object({
    finish_reason:z.enum(['stop','length','content_filter','tool_calls','insufficient_system_resource','aborted']),
    message:z.object({ content:z.string().max(50_000).nullable() }),
  })).min(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative() }),
});

export async function providerBytes(response:Response,maxBytes:number):Promise<Buffer> {
  if (!response.ok || !response.body) {
    const status = response.status;
    const code = status === 401 || status === 403 ? 'PROVIDER_AUTH_FAILED'
      : status === 402 ? 'PROVIDER_BALANCE' : status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_REQUEST_FAILED';
    await response.body?.cancel().catch(() => {});
    throw new AppError(502,code,'Provider rejected the request',{},status === 429 || status >= 500);
  }
  const reader = response.body.getReader();
  let total = 0;
  const parts: Buffer[] = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > maxBytes) throw new AppError(502, 'PROVIDER_RESPONSE_LIMIT', 'Provider response exceeded size limit');
      parts.push(Buffer.from(part.value));
    }
    return Buffer.concat(parts);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function providerJson(response:Response,maxBytes = 512_000):Promise<unknown> {
  return JSON.parse((await providerBytes(response,maxBytes)).toString('utf8'));
}
export function modelGateway():ModelGateway|undefined {
  const key=process.env.DEEPSEEK_API_KEY;
  return key ? deepseekGateway(key,process.env.DEEPSEEK_MODEL ?? 'deepseek-flash') : undefined;
}

export function deepseekGateway(key:string,model:string,request:typeof fetch=fetch):ModelGateway {
  const profile:ModelProfile={ provider:'deepseek',model,protocol:'chat-completions',thinking:'disabled' };
  return {
    profile,
    async generate(system,data,maxOutput,signal,json) {
      const timeout=AbortSignal.timeout(40_000);
      let raw:unknown;
      try {
        const response=await request(deepseekEndpoint,{
          method:'POST',redirect:'error',signal:AbortSignal.any([signal,timeout]),
          headers:{ Authorization:'Bearer '+key,'Content-Type':'application/json' },
          body:JSON.stringify({
            model,max_tokens:maxOutput,thinking:{ type:profile.thinking },
            messages:[{ role:'system',content:system },{ role:'user',content:JSON.stringify(data) }],
            ...(json ? { response_format:{ type:'json_object' } } : {}),
          }),
        });
        raw=await providerJson(response);
      } catch (error) {
        signal.throwIfAborted();
        if (timeout.aborted) throw new AppError(502,'PROVIDER_TIMEOUT','Model request timed out',{},true);
        if (error instanceof SyntaxError) throw new AppError(502,'PROVIDER_PROTOCOL_INVALID','Invalid model response envelope');
        if (error instanceof TypeError) throw new AppError(502,'PROVIDER_NETWORK','Model network request failed',{},true);
        throw error;
      }
      const parsed=modelResponse.safeParse(raw);
      if (!parsed.success) throw new AppError(502,'PROVIDER_PROTOCOL_INVALID','Invalid model response envelope');
      const { choices,usage,model:responseModel }=parsed.data;
      const choice=choices[0]!;
      return { text:choice.message.content ?? '',input:usage.prompt_tokens,output:usage.completion_tokens,
        model:responseModel,provider:profile.provider,finishReason:choice.finish_reason };
    },
  };
}
export interface SearchResult { title: string; url: string }
const searchResponse = z.object({ web: z.object({ results: z.array(z.object({ title: z.string(), url: z.url({ protocol: /^https?$/ }) })) }).optional() });
export function searchProvider(): ((query: string, signal: AbortSignal) => Promise<SearchResult[]>) | undefined {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return;
  return async (query, signal) => {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query.slice(0, 350));
    url.searchParams.set('count', '5');
    const data = await providerJson(await fetch(url, {
      redirect: 'error', headers: { Accept: 'application/json', 'X-Subscription-Token': key },
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    }));
    return searchResponse.parse(data).web?.results.slice(0, 5) ?? [];
  };
}

const embeddingResponse = z.object({ data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: z.array(z.number()).min(1).max(4096) })) });
export type EmbeddingGateway = ((texts:string[],signal:AbortSignal)=>Promise<number[][]>) & { profile:string };
export function embeddingProvider():EmbeddingGateway|undefined {
  const endpoint = process.env.AKW_EMBEDDINGS_URL;
  const model = process.env.AKW_EMBEDDINGS_MODEL;
  if (!endpoint || !model) return;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Embedding endpoint requires HTTPS or loopback');
  const embed = async (texts:string[],signal:AbortSignal) => {
    const key = process.env.AKW_EMBEDDINGS_API_KEY;
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
      body: JSON.stringify({ model, input: texts }),
    });
    const data = embeddingResponse.parse(await providerJson(response, 3_000_000)).data.sort((a,b) => a.index - b.index);
    if (data.length !== texts.length || data.some((item, i) => item.index !== i || item.embedding.length !== data[0]!.embedding.length)) {
      throw new AppError(502, 'PROVIDER_EMBEDDING_INVALID', 'Embedding provider returned invalid dimensions');
    }
    return data.map(item => item.embedding);
  };
  return Object.assign(embed,{ profile:sha256(url.href + '\0' + model) });
}
