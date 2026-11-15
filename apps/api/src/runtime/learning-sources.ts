import { Parser } from 'htmlparser2';
import { htmlText } from '../domain/html-text';
import { z } from 'zod';
import { fetchPublic } from '../platform/public-web';
import { providerBytes } from './providers';
import type { PublicMaterial } from './public-research';
import type { LearningPlan } from '../quality-engine/learning-quality';

const fixedPapers=[
  'https://arxiv.org/abs/1609.02907',
  'https://arxiv.org/abs/1704.01212',
  'https://arxiv.org/abs/1710.10324',
  'https://arxiv.org/abs/2106.01829',
  'https://arxiv.org/abs/1706.08566',
  'https://arxiv.org/abs/2208.05039',
];
const graphBook='https://www.cs.mcgill.ca/~wlh/grl_book/';
const heading=z.string().trim().min(5).max(210);
const plain=(value:string|undefined,max:number)=>(value ?? '').replace(/\s+/g,' ').trim().slice(0,max);

async function arxiv(url:string,signal:AbortSignal):Promise<PublicMaterial[]> {
  const response=await fetch(url,{ signal,redirect:'error',headers:{ Accept:'text/html','User-Agent':'AI-Knowledge-Workspace/0.1' } });
  const raw=(await providerBytes(response,300_000)).toString('utf8');
  const meta=new Map<string,string[]>();
  new Parser({ onopentag(tag,attrs) {
    if (tag==='meta' && attrs.name && attrs.content) meta.set(attrs.name,[...(meta.get(attrs.name) ?? []),attrs.content]);
  } },{ decodeEntities:true }).end(raw);
  const title=heading.safeParse(plain(meta.get('citation_title')?.[0],200));
  const excerpt=htmlText(raw.match(/<blockquote[^>]+abstract[^>]*>[\s\S]*?<\/blockquote>/i)?.[0] ?? '').replace(/^\s*Abstract:\s*/,'');
  const abstract=plain(excerpt || meta.get('description')?.[0],1800);
  const date=meta.get('citation_date')?.[0]?.match(/^\d{4}/)?.[0];
  const author=plain(meta.get('citation_author')?.slice(0,3).join(', '),160);
  if (!title.success || abstract.length<120 || !date) return [];
  return [{ kind:'paper',provider:'Public Web',title:title.data,url,text:abstract,published:date,author,journal:'arXiv（预印本）' }];
}

async function page(url:string,signal:AbortSignal):Promise<PublicMaterial[]> {
  if (/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(url)) return arxiv(url,signal);
  if (url===graphBook) {
    const response=await fetch(url,{ signal,redirect:'error',headers:{ Accept:'text/html','User-Agent':'AI-Knowledge-Workspace/0.1' } });
    const bytes=await providerBytes(response,100_000);
    const text=htmlText(bytes.toString('utf8'),12_000).split(/\n+/).map(part=>plain(part,420))
      .filter(part=>/graph neural network|graph representation|chapter 2|chapter 5|chapter 7/i.test(part)).slice(0,8).join('\n');
    return text ? [{ kind:'web',provider:'Public Web',title:'Graph Representation Learning',url,text,
      author:'William L. Hamilton',published:'2020',journal:'教材 · McGill University' }] : [];
  }
  const source=await fetchPublic(url,signal);
  if (!/html/.test(source.mime)) return [];
  const raw=source.bytes.toString('utf8');
  const title=heading.safeParse(plain(htmlText(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),200));
  const fragments=htmlText(raw,40_000).split(/\n+/).map(item=>plain(item,600)).filter(item=>item.length>=75).slice(0,4);
  if (!title.success || !fragments.length) return [];
  return [{ kind:'web',provider:'Public Web',url:source.finalUrl,title:title.data,text:fragments.join('\n').slice(0,2000) }];
}

export async function learningSourcePages(goal:string,plan:Pick<LearningPlan,'queries'>,signal:AbortSignal) {
  const graphStudy=/图神经网络|\bGNN\b|graph neural network/i.test(goal);
  const crystals=graphStudy && /晶体|材料|crystal|material/i.test(goal);
  const catalog=crystals ? [graphBook,...fixedPapers] : graphStudy ? [graphBook,...fixedPapers.slice(0,2)] : [];
  const proposed=plan.queries.flatMap(query=>query.urls).filter(url=>/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(url) ||
    /\.(?:edu|ac\.[a-z]{2})$/.test(new URL(url).hostname) ||
    ['www.cs.mcgill.ca','proceedings.mlr.press','openreview.net','ocw.mit.edu'].includes(new URL(url).hostname));
  const urls=[...new Set([...catalog,...proposed])].slice(0,10);
  const results=await Promise.allSettled(urls.map(url=>page(url,AbortSignal.any([signal,AbortSignal.timeout(9000)]))));
  signal.throwIfAborted();
  return results.flatMap(item=>item.status==='fulfilled' ? item.value : []);
}
