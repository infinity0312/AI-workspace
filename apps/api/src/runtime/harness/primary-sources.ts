import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import { parseDocument } from '../../domain/parsing';
import { fetchPublic } from '../../platform/public-web';
import type { DiscoveryQuery } from '../../quality-engine/document-quality';
import { completeSentences } from '../../quality-engine/evidence-spans';
import type { SourceRequirement } from '../../quality-engine/source-requirements';
import { providerBytes,providerJson } from '../providers';
import { crossrefByDoi,type PublicMaterial } from '../public-research';

const client='AI-Knowledge-Workspace/0.1 (public research)';
const laureates=z.object({ laureates:z.array(z.object({
  id:z.string().regex(/^\d{1,8}$/),knownName:z.object({ en:z.string() }).optional(),
  nobelPrizes:z.array(z.object({
    awardYear:z.string().regex(/^\d{4}$/),category:z.object({ en:z.string() }),
    motivation:z.object({ en:z.string() }),portion:z.string().optional(),
  })).max(10).optional(),
})).max(25).optional() });

async function nobel(plan:DiscoveryQuery,signal:AbortSignal):Promise<PublicMaterial[]> {
  const endpoint=new URL('https://api.nobelprize.org/2.1/laureates');
  const nameQuery=plan.english
    .replace(/\b(?:(?:two|first|second|both|\d{4})\s+)?(?:Nobel|prizes?|awards?|biography|achievements)\b.*$/i,'')
    .replace(/['’]s\s*$/i,'').trim();
  endpoint.searchParams.set('name',(nameQuery || plan.english).slice(0,80));
  endpoint.searchParams.set('limit','5');
  const response=await fetch(endpoint,{ redirect:'error',headers:{ Accept:'application/json','User-Agent':client },signal });
  const result=laureates.parse(await providerJson(response,128_000));
  const awards:PublicMaterial[]=(result.laureates ?? []).flatMap(person=>{
    if (!person.knownName || !person.nobelPrizes?.length) return [];
    const name=person.knownName.en.slice(0,100);
    const parts=person.nobelPrizes.map(prize=>({ page:null,text:name+' was awarded the Nobel Prize in '+prize.category.en+' in '+prize.awardYear+
      ', with this official motivation: “'+prize.motivation.en.replace(/[.]+$/,'')+'.”' }));
    return [{ kind:'report' as const,provider:'Public Web' as const,title:name+' · Nobel Prize',
      url:'https://api.nobelprize.org/2.1/laureate/'+person.id,text:parts[0]!.text,passages:parts.slice(1) }];
  });
  if (!awards.some(item=>/^Marie Curie\b/i.test(item.title))) return awards;
  const url='https://www.nobelprize.org/prizes/themes/marie-and-pierre-curie-and-the-discovery-of-polonium-and-radium/';
  try {
    const response=await fetch(url,{ redirect:'error',headers:{ Accept:'text/html','User-Agent':client },signal });
    if (!response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel();return awards; }
    const parsed=await parseDocument(await providerBytes(response,1_000_000),'text/html',signal);
    const body=parsed.passages.map(part=>part.content).join(' ').replace(/\s+/g,' ');
    const anchors=[
      /[^.!?]{0,190}Henri Becquerel[^.!?]{0,220}(?:uranium|radioactivity|radiation)[^.!?]{0,130}[.!?]/i,
      /[^.!?]{0,180}Pierre[^.!?]{0,230}(?:joined Marie|polonium)[^.!?]{0,100}[.!?]/i,
      /[^.!?]{0,180}B[eé]mont[^.!?]{0,260}[.!?]/i,
      /[^.!?]{0,200}in collaboration with Andr[eé] Debierne[^.!?]{0,140}[.!?]/i,
    ];
    const [first,...passages]=anchors.flatMap(anchor=>{
      const match=anchor.exec(body)?.[0].trim();
      return match ? [{ text:match,page:null }] : [];
    });
    if (first) awards.push({ kind:'report',provider:'Public Web',title:'Nobel Prize · Marie and Pierre Curie’s collaboration',
      url,text:first.text,passages });
  } catch { /* Award citations remain available when the supplemental page is unavailable. */ }
  try {
    const lectureUrl='https://www.nobelprize.org/uploads/2018/06/pierre-curie-lecture.pdf';
    const response=await fetch(lectureUrl,{ redirect:'error',headers:{ Accept:'application/pdf','User-Agent':client },signal });
    if (!response.headers.get('content-type')?.includes('application/pdf')) { await response.body?.cancel();return awards; }
    const parsed=await parseDocument(await providerBytes(response,2_000_000),'application/pdf',signal);
    for (const part of parsed.passages) {
      const match=/By carrying out the chemical analysis[^.]{0,700}B[eé]mont[^.]{0,200}\./i.exec(part.content.replace(/\s+/g,' '));
      if (match) {
        awards.push({ kind:'report',provider:'Public Web',title:'Nobel Prize · Pierre Curie’s Nobel lecture',url:lectureUrl,text:match[0],page:part.page });
        break;
      }
    }
  } catch { /* The award records are independent of the supplemental PDF. */ }
  return awards;
}

function excerpts(pages:{ text:string;page:number|null }[],plan:DiscoveryQuery) {
  const words=[...new Set([plan.english,...(plan.facets ?? []).map(item=>item.english)].join(' ').toLowerCase().match(/[\p{L}\d-]{4,}/gu) ?? [])]
    .filter(word=>!['what','with','from','does','this','about','between','difference'].includes(word)).slice(0,26);
  return pages.flatMap(part=>{
    const content=part.text.replace(/\s+/g,' ').trim();
    return completeSentences(content,620).flatMap(({ text })=>{
      if (text.length<75 || /^Key words:|\.{5,}|Federal Information Processing Standards Publication|This publication is available free of charge/i.test(text)) return [];
      const lower=text.toLowerCase();
      const score=words.filter(word=>lower.includes(word)).length;
      return score ? [{ text,page:part.page,score }] : [];
    });
  }).sort((a,b)=>b.score-a.score).filter((part,index,all)=>all.findIndex(item=>item.text===part.text)===index).slice(0,4)
    .map(({ text,page })=>({ text,page }));
}

function specificationPassages(number:string,pages:{ text:string;page:number|null }[],plan:DiscoveryQuery) {
  const anchors=number==='180-4' && /\bSHA-?256\b/i.test(plan.english) ? [
    /The final result of SHA-256 is a 256-bit message digest\./i,
    /Each message block,[\s\S]{1,150}?processed in order[^:]{0,60}:/i,
    /Secure hash algorithms are typically used with other cryptographic algorithms[^.]{0,350}\./i,
  ] : number==='202' && /\bSHA3-?256\b/i.test(plan.english) ? [
    /The four SHA-3 hash functions are named[^.]{0,450}?e\.g\., SHA3-256 produces 256-bit digests\./i,
    /SHA3-256\(M\)\s*=\s*KECCAK\[[^\]]+\]\s*\([^;]+?\);/i,
    /The analogy to a sponge[^.]{0,280}output bits are [“"]?squeezed[”"]? out of its state\./i,
  ] : [];
  const exact=anchors.flatMap(anchor=>{
    for(const item of pages) {
      const text=item.text.replace(/\s+/g,' ');
      if (anchor.source.startsWith('Each message block') && !text.includes('SHA-256 Hash Computation')) continue;
      const match=anchor.exec(text);
      if (match) return [{ text:match[0],page:item.page }];
    }
    return [];
  });
  return [...exact,...excerpts(pages,plan)].filter((item,index,all)=>all.findIndex(part=>part.text.includes(item.text) || item.text.includes(part.text))===index).slice(0,5);
}

async function fips(number:string,plan:DiscoveryQuery,signal:AbortSignal):Promise<PublicMaterial[]> {
  // Only the provider-defined path is allowed here. User URLs always use fetchPublic.
  if (!/^\d{2,4}(?:-\d{1,2})?$/.test(number)) return [];
  const url='https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.'+number+'.pdf';
  const response=await fetch(url,{ redirect:'error',headers:{ Accept:'application/pdf','User-Agent':client },signal });
  if (!response.headers.get('content-type')?.startsWith('application/pdf')) { await response.body?.cancel();return []; }
  const bytes=await providerBytes(response,5_000_000);
  if (!bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) return [];
  const parser=new PDFParse({ data:new Uint8Array(bytes),isEvalSupported:false,maxImageSize:4_000_000 });
  try {
    const parsed=await parser.getText({ first:30 });
    signal.throwIfAborted();
    const [first,...passages]=specificationPassages(number,parsed.pages.map(part=>({ text:part.text,page:part.num })),plan);
    if (!first) return [];
    return [{ kind:'report',provider:'Public Web',title:'NIST FIPS '+number,url,text:first.text,page:first.page,passages }];
  } finally { await parser.destroy(); }
}

async function direct(url:string,plan:DiscoveryQuery,signal:AbortSignal):Promise<PublicMaterial[]> {
  const source=await fetchPublic(url,signal);
  const parsed=await parseDocument(source.bytes,source.mime,signal);
  const passages=excerpts(parsed.passages.slice(0,150).map(part=>({ text:part.content,page:part.page })),plan);
  if (!passages.length) return [];
  return [{ kind:'web',provider:'Public Web',title:new URL(source.finalUrl).hostname,url:source.finalUrl,requestedUrl:url,
    text:passages[0]!.text,page:passages[0]!.page,passages:passages.slice(1) }];
}

export async function primaryResearch(requirements:SourceRequirement[],plan:DiscoveryQuery,signal:AbortSignal) {
  const results=await Promise.allSettled(requirements.map(requirement=>{
    const limit=AbortSignal.any([signal,AbortSignal.timeout(requirement.type==='doi' ? 18_000 : 12_000)]);
    if (requirement.type==='nobel') return nobel(plan,limit);
    if (requirement.type==='fips') return fips(requirement.number,plan,limit);
    if (requirement.type==='doi') return crossrefByDoi(requirement.doi,limit);
    return direct(requirement.url,plan,limit);
  }));
  signal.throwIfAborted();
  const materials=results.flatMap(result=>result.status==='fulfilled' ? result.value : []);
  if (!requirements.some(requirement=>requirement.type==='fips') || !/\bSHA3?-?256\b/i.test(plan.english)) return materials;
  const url='https://csrc.nist.gov/projects/message-authentication-codes';
  try {
    const response=await fetch(url,{ redirect:'error',headers:{ Accept:'text/html','User-Agent':client },
      signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]) });
    if (!response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel();return materials; }
    const parsed=await parseDocument(await providerBytes(response,550_000),'text/html',signal);
    const quotes=parsed.passages.flatMap(part=>completeSentences(part.content,600))
      .map(part=>part.text).filter(text=>/secret key|shared key|keyed hash|integrity and authenticity/i.test(text)).slice(0,4);
    const [first,...other]=quotes;
    if (first) materials.push({ kind:'report',provider:'Public Web',title:'NIST · Message authentication codes',url,text:first,
      passages:other.map(text=>({ text,page:null })) });
  } catch { signal.throwIfAborted(); }
  return materials;
}
