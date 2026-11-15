import { z } from 'zod';
import { AppError,parse } from '../platform/errors';
import { sameQuantities,supportsNumbers } from './evidence-checks';
import type { QualityModel } from './prompts';

const shape = z.object({ supported:z.boolean() }).strict();
const replacementSchema = z.object({ text:z.string().max(5000) }).strict();

export function decodeSelectionReplacement(value:string) {
  return parse(replacementSchema,JSON.parse(value)).text;
}
const segmenter = new Intl.Segmenter(undefined,{ granularity:'grapheme' });
const size = (text:string) => Array.from(segmenter.segment(text)).length;
const concise = /简化|压缩|更简洁|简短|精简|shorten|more concise|shorter/i;

export function selectionLength(instruction:string,original:string) {
  const length=size(original);
  return concise.test(instruction) && length >= 25 ? length-1 : undefined;
}

export function explicitReplacement(instruction:string) {
  const literal=/^replace (?:the )?selected (?:word|text) with (?:the )?exact word ([\p{L}\p{N}_-]{1,120})(?:\.)?(?:\s+Output no extra spaces or punctuation\.)?$/iu.exec(instruction.trim());
  return literal?.[1];
}

export function assertLiteralEdit(instruction:string,original:string) {
  if (/原话|原样|逐字|verbatim/i.test(instruction) && !supportsNumbers(instruction,[original]))
    throw new AppError(422,'AI_EDIT_EVIDENCE','The requested literal edit introduces a quantity without evidence');
}

const scopeMarkers = [
  { label:'室内 / indoor',pattern:/室内|户内|\bindoors?\b/i },
  { label:'室外 / outdoor',pattern:/室外|户外|\boutdoors?\b/i },
  { label:'现场 / field',pattern:/现场|实地|\bfield (?:test|trial|study)\b/i },
  { label:'实验室或台架 / laboratory or bench',pattern:/实验室|台架|\blaboratory\b|\bbench (?:test|trial)\b/i },
  { label:'样本内 / sample',pattern:/本样本|样本内|这组样本|\bin (?:this|the) sample\b/i },
];
export function explicitScope(text:string) {
  return scopeMarkers.filter(item=>item.pattern.test(text)).map(item=>item.label);
}

export async function reviewSelection(input:{
  original:string; replacement:string; before:string; after:string;
  evidence:{ id:string;title:string;quote:string }[]; directQuote:boolean; maxLength?:number;
},model:QualityModel) {
  if (input.maxLength !== undefined && size(input.replacement)>input.maxLength)
    throw new AppError(422,'AI_EDIT_LENGTH','The rewrite exceeds the requested length');
  if (!input.evidence.length || input.original === input.replacement) return;
  if (input.directQuote || !sameQuantities(input.original,input.replacement))
    throw new AppError(422,'AI_EDIT_EVIDENCE','The proposed edit changes a cited quotation or quantity');
  const remaining=new Set(explicitScope(input.replacement));
  if (explicitScope(input.original).some(label=>!remaining.has(label)))
    throw new AppError(422,'AI_EDIT_SCOPE','The proposed edit omits an explicit scope qualifier');
  const response = await model('selection.verify',{ original:input.original,replacement:input.replacement,
    before:input.before,after:input.after,evidence:input.evidence });
  let supported=false;
  try { supported=shape.parse(JSON.parse(response)).supported; } catch { /* Unparseable review cannot authorize a change. */ }
  if (!supported) throw new AppError(422,'AI_EDIT_EVIDENCE','The cited evidence does not support the revised claim');
}
