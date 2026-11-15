import { AppError } from '../platform/errors';

export type ModelProfile = { provider:string;model:string;protocol:'chat-completions';thinking:'disabled' };

export interface Completion {
  text:string;
  input:number;
  output:number;
  model:string;
  provider:string;
  finishReason?:string;
}

export function completionText(completion:Completion,json:boolean):string {
  const finish=completion.finishReason;
  if (finish==='length') throw new AppError(502,'PROVIDER_OUTPUT_TRUNCATED','Model output reached its token limit');
  if (finish==='insufficient_system_resource')
    throw new AppError(502,'PROVIDER_MODEL_BUSY','Model inference resources are temporarily unavailable',{},true);
  if (finish!==undefined && finish!=='stop')
    throw new AppError(502,'PROVIDER_OUTPUT_STOPPED','Model stopped before delivering a usable response');
  if (!completion.text.trim()) throw new AppError(502,'PROVIDER_OUTPUT_EMPTY','Model returned a blank response');
  if (json) {
    try {
      const value:unknown=JSON.parse(completion.text);
      if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Expected a JSON object');
    } catch { throw new AppError(502,'PROVIDER_OUTPUT_INVALID_JSON','Model did not return a JSON object'); }
  }
  return completion.text;
}

function repairableFormatFailure(error:unknown):error is AppError {
  return error instanceof AppError && [
    'PROVIDER_OUTPUT_EMPTY','PROVIDER_OUTPUT_TRUNCATED','PROVIDER_OUTPUT_INVALID_JSON','PROVIDER_ANALYSIS_INVALID',
  ].includes(error.code);
}

export type RecoverableFormat<T> = T | { retry_reason:string };

export async function attemptFormat<T>(work:()=>Promise<T>):Promise<RecoverableFormat<T>> {
  try { return await work(); }
  catch (error) {
    if (!repairableFormatFailure(error)) throw error;
    return { retry_reason:error.code };
  }
}
