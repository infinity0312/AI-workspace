import { PDFParse } from 'pdf-parse';
import { z } from 'zod';
import { fetchPublic } from '../platform/public-web';
import { parseDocument } from '../domain/parsing';
import { htmlText } from '../domain/html-text';
import { providerBytes,providerJson,type SearchResult } from './providers';
import type { PublicMaterial } from './public-research';
import type { DiscoveryQuery } from '../quality-engine/document-quality';
import { completeSentences } from '../quality-engine/evidence-spans';

const institution='https://www.osti.gov';
const client='AI-Knowledge-Workspace/0.1 (public research)';
const record=z.object({
  osti_id:z.union([z.string(),z.number()]).transform(String).pipe(z.string().regex(/^\d{1,12}$/)),
  title:z.string(),description:z.string().optional().nullable(),product_type:z.string().optional(),
  publication_date:z.string().optional(),doi:z.string().optional().nullable(),
});
const stop = new Set(['about','and','compare','does','for','from','into','the','with','versus','how','are','use']);
const terms = (query:string) => [...new Set((query.toLowerCase().match(/[a-z][a-z-]{2,}|\p{Script=Han}{2,}/gu) ?? [])
  .filter(word => !stop.has(word)))].slice(0,20);
const clean = (value:string) => value.replace(/\s+/g,' ').trim();
const score = (text:string,words:string[]) => words.reduce((count,word) => count+Number(text.toLowerCase().includes(word)),0);
function windows(text:string,page:number|null,wordLists:string[][]) {
  const normalized=clean(text);
  const spans=completeSentences(normalized,1000);
  return spans.flatMap((span,i) => {
    if (span.text.length<70) return [];
    const previous=spans[i-1];
    const start=previous && previous.end===span.start && span.end-previous.start<=1100 ? previous.start : span.start;
    const text=normalized.slice(start,span.end).trim();
    const scores=wordLists.map(words => score(text,words));
    return Math.max(...scores)>=2 ? [{ text,page,scores }] : [];
  });
}

async function reportPages(ostiId:string,wordLists:string[][],signal:AbortSignal) {
  // Use only the documented host and a validated record ID. No response URLs or redirects are followed.
  const url=institution+'/servlets/purl/'+ostiId;
  const response=await fetch(url,{ redirect:'error',headers:{ Accept:'application/pdf','User-Agent':client },
    signal:AbortSignal.any([signal,AbortSignal.timeout(8500)]) });
  if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/pdf') {
    await response.body?.cancel();
    return [];
  }
  const bytes=await providerBytes(response,5*1024*1024);
  if (!bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) return [];
  const reader=new PDFParse({ data:new Uint8Array(bytes),isEvalSupported:false,maxImageSize:4_000_000 });
  try {
    const result=await reader.getText({ first:25 });
    signal.throwIfAborted();
    const picked = result.pages.flatMap(page => windows(page.text,page.num,wordLists));
    const selected = new Map<string,{ text:string;page:number|null }>();
    for (const [index] of wordLists.entries()) {
      const best=picked.filter(part => (part.scores[index] ?? 0)>=2 && !selected.has(part.text))
        .sort((a,b) => (b.scores[index] ?? 0)-(a.scores[index] ?? 0))[0];
      if (best) selected.set(best.text,{ text:best.text,page:best.page });
    }
    return [...selected.values()].slice(0,5);
  } finally { await reader.destroy(); }
}

async function catalog(query:string,signal:AbortSignal) {
  const url=new URL(institution+'/api/v1/records');
  url.search=new URLSearchParams({ q:query,rows:'10' }).toString();
  const response=await fetch(url,{ redirect:'error',headers:{ Accept:'application/json','User-Agent':client },
    signal:AbortSignal.any([signal,AbortSignal.timeout(7500)]) });
  const data=z.array(z.unknown()).parse(await providerJson(response,950_000));
  return data.flatMap(item => { const result=record.safeParse(item);return result.success ? [result.data] : []; });
}

export async function institutionalResearch(plan:DiscoveryQuery,signal:AbortSignal):Promise<PublicMaterial[]> {
  const queries=[...new Set([plan.english,...(plan.facets ?? []).map(item => item.english),plan.academic].filter((item):item is string => Boolean(item)))].slice(0,6);
  const wordLists=queries.map(terms);
  const lists=await Promise.allSettled(queries.map(query => catalog(query,signal)));
  signal.throwIfAborted();
  const distinct=new Map<string,{ value:z.infer<typeof record>; score:number }>();
  for (const list of lists) if (list.status==='fulfilled') for (const [rank,value] of list.value.entries()) {
    if (!/technical report|dataset|conference|program document/i.test(value.product_type ?? '') || !value.description || /\bwithdrawn|retract(?:ed|ion)\b/i.test(value.title)) continue;
    const match=Math.max(...wordLists.map(words => score(value.title,words)));
    if (match<2) continue;
    const id=value.doi?.toLowerCase() || clean(htmlText(value.title,250)).toLowerCase().replace(/[^a-z\d ]/g,'');
    const prior=distinct.get(id);
    const measured = /\bfield\b|\blaboratory\b|\bexperimental\b|\bmeasurements?\b/i.test(value.title);
    const quality = match + Number(measured)*2 + (/technical report/i.test(value.product_type ?? '') ? 1.5 : 0) + 1/(rank+1);
    if (!prior || prior.score < quality) distinct.set(id,{ value,score:quality });
  }
  const candidates=[...distinct.values()].sort((a,b)=>b.score-a.score).slice(0,4);
  return Promise.all(candidates.map(async ({ value },index):Promise<PublicMaterial> => {
    const kind = /dataset/i.test(value.product_type ?? '') ? 'dataset' : 'report';
    const passages = index<2 && kind==='report' ? await reportPages(value.osti_id,wordLists,signal).catch(() => {
      signal.throwIfAborted(); return [];
    }) : [];
    return { kind,provider:'OSTI.GOV',title:clean(htmlText(value.title,250)).slice(0,180),url:institution+'/biblio/'+value.osti_id,
      doi:value.doi?.slice(0,160),published:value.publication_date?.slice(0,10),
      text:'Abstract excerpt: '+clean(htmlText(value.description ?? '',2400)).slice(0,1550),passages };
  }));
}

export async function webResearch(plan:DiscoveryQuery,search:(query:string,signal:AbortSignal)=>Promise<SearchResult[]>,signal:AbortSignal):Promise<PublicMaterial[]> {
  const queries=[plan.english,...(plan.facets ?? []).map(item => item.english)].slice(0,3);
  const results=await Promise.allSettled(queries.map(query => search(query,signal)));
  signal.throwIfAborted();
  const urls = new Map(results.flatMap(result => result.status==='fulfilled' ? result.value : []).map(item => [item.url,item]));
  const words=terms(queries.join(' '));
  const sources=await Promise.allSettled([...urls.values()].slice(0,5).map(async item => {
    const downloaded=await fetchPublic(item.url,AbortSignal.any([signal,AbortSignal.timeout(6500)]));
    if (!['text/html','text/plain','application/xhtml+xml'].includes(downloaded.mime)) return;
    if (downloaded.bytes.length>1_500_000) return;
    const parsed=await parseDocument(downloaded.bytes,downloaded.mime,signal);
    const pages=parsed.passages.map(part => ({ ...part,score:score(part.content,words) })).filter(part => part.score>=2 && part.content.length>=80)
      .sort((a,b)=>b.score-a.score).slice(0,3);
    const first=pages.shift();
    if (!first) return;
    const host=new URL(downloaded.finalUrl).hostname;
    return { kind:/\.gov(?:\.[a-z]{2})?$/.test(host) ? 'report' : 'web',provider:'Public Web',title:clean(htmlText(item.title,250)).slice(0,180),
      url:downloaded.finalUrl,text:clean(first.content),passages:pages.map(part => ({ text:clean(part.content),page:part.page })) } satisfies PublicMaterial;
  }));
  signal.throwIfAborted();
  return sources.flatMap(item => item.status==='fulfilled' && item.value ? [item.value] : []);
}
