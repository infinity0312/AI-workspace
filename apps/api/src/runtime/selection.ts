import { AppError } from '../platform/errors';
import type { PromptId,QualityModel } from '../quality-engine/prompts';
import { assertLiteralEdit,decodeSelectionReplacement,explicitReplacement,explicitScope,reviewSelection,selectionLength } from '../quality-engine/selection-review';
import type { ModelBudget } from './budget';

export async function rewriteSelection(input:{
  instruction:string;original:string;left:string;right:string;
  evidence:{ id:string;title:string;quote:string;kind:'source' }[];directQuote:boolean;
},signal:AbortSignal,invoke:(budget:ModelBudget,prompt:PromptId,data:unknown)=>Promise<string>) {
  const { instruction,original,left,right,evidence,directQuote }=input;
  if (evidence.length) assertLiteralEdit(instruction,original);
  const literal=explicitReplacement(instruction);
  if (literal && !evidence.length) return literal;
  const maxLength=selectionLength(instruction,original);
  const scope=evidence.length ? explicitScope(original) : [];
  const policy={ max_calls:evidence.length ? 3 : 2,max_tokens:evidence.length ? 32000 : 14000 };
  const model:QualityModel=(prompt,data) => invoke(policy,prompt,data);
  async function attempt(prompt:'selection.rewrite'|'selection.repair-length'|'selection.repair-scope'|'selection.repair-empty') {
    const replacement=decodeSelectionReplacement(await model(prompt,{ instruction,selection:original,cited:Boolean(evidence.length),max_graphemes:maxLength,required_scope:scope.length ? scope : undefined }));
    if (!replacement.trim() && !/删除|移除|\b(?:delete|remove|erase)\b/i.test(instruction))
      throw new AppError(422,'AI_EDIT_EMPTY','The proposed rewrite is empty');
    await reviewSelection({ original,replacement,before:left+original+right,after:left+replacement+right,
      evidence,maxLength,directQuote },model);
    return replacement;
  }
  return attempt('selection.rewrite').catch(error => {
    signal.throwIfAborted();
    if (error instanceof AppError && error.code==='AI_EDIT_EMPTY') return attempt('selection.repair-empty');
    if (error instanceof AppError && error.code==='AI_EDIT_LENGTH') return attempt('selection.repair-length');
    if (error instanceof AppError && error.code==='AI_EDIT_SCOPE') return attempt('selection.repair-scope');
    throw error;
  });
}
