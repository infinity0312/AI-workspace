import { z } from 'zod';
import { AppError } from '../platform/errors';
import { checkUpload } from '../domain/parsing';
import { htmlText } from '../domain/html-text';
import { providerBytes, providerJson,type SearchResult } from './providers';
import { institutionalResearch,webResearch } from './institutional-research';
import { mentionedDois,safeDoi } from '../quality-engine/source-requirements';
export { mentionedDois } from '../quality-engine/source-requirements';

import type { DiscoveryQuery,PublicEvidenceKind } from '../quality-engine/document-quality';
export type PublicMaterial = {
  kind:PublicEvidenceKind; provider:'Wikipedia'|'Crossref'|'Europe PMC'|'Wikimedia Commons'|'OSTI.GOV'|'Public Web';
  title:string; url:string; text:string; author?:string; published?:string; doi?:string; journal?:string;
  image?:{ url:string; license:string; licenseUrl:string; credit:string };
  license?:string;licenseUrl?:string;
  page?:number|null;
  requestedUrl?:string;
  passages?:{ text:string; page:number|null }[];
};
export type ImageBytes = { mime:'image/png'|'image/jpeg'; bytes:Buffer };
export type DiscoveryMetrics = { channels:number;failed_channels:number;found:number;institutional:number;web_enabled:boolean };
export interface PublicResearch {
  discover(query:DiscoveryQuery,signal:AbortSignal,observe?:(metrics:DiscoveryMetrics)=>void,references?:string):Promise<PublicMaterial[]>;
  image(url:string,signal:AbortSignal):Promise<ImageBytes>;
}
const userAgent = 'AI-Knowledge-Workspace/0.1 (public literature and evidence research)';
const field = (value:string|undefined,max:number) => Array.from(htmlText(value ?? '',4000).replace(/\s+/g,' ').trim()).slice(0,max).join('');
function https(input:string|undefined,domain:string,prefix = '/') {
  if (!input) return;
  try {
    const url = new URL(input);
    if (url.protocol === 'https:' && url.hostname === domain && !url.port && !url.username && !url.password && url.pathname.startsWith(prefix)) return url.href;
  } catch { /* Discard malformed public metadata. */ }
}

function commonsImageUrl(input:string|undefined) {
  return https(input,'upload.wikimedia.org','/wikipedia/commons/') ?? https(input,'thumb.wikimedia.org','/wikipedia/commons/thumb/');
}

async function get(url:URL,signal:AbortSignal) {
  return providerJson(await fetch(url,{ redirect:'error',headers:{ 'User-Agent':userAgent,Accept:'application/json' },
    signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]) }),750_000);
}
function action(host:string,params:Record<string,string>) {
  const url = new URL('https://' + host + '/w/api.php');
  url.search = new URLSearchParams({ action:'query',format:'json',formatversion:'2',...params }).toString();
  return url;
}
type EncyclopediaEntry = PublicMaterial & { pageImage?:string };
const encyclopediaPages = z.object({ query:z.object({ pages:z.array(z.object({
  title:z.string(),fullurl:z.string().optional(),extract:z.string().optional(),pageimage:z.string().optional(),index:z.number().optional(),pageprops:z.record(z.string(),z.unknown()).optional(),
})) }).optional() });
async function encyclopedia(host:string,query:string,signal:AbortSignal):Promise<EncyclopediaEntry[]> {
  const url = action(host,{ generator:'search',gsrsearch:query,gsrnamespace:'0',gsrlimit:'3',prop:'extracts|info|pageprops|pageimages',
    exintro:'1',explaintext:'1',exchars:'1000',inprop:'url',ppprop:'disambiguation',piprop:'name',pilicense:'free',pilimit:'3' });
  const parsed = encyclopediaPages.parse(await get(url,signal));
  return (parsed.query?.pages ?? []).sort((a,b) => (a.index ?? 999)-(b.index ?? 999)).flatMap((page):EncyclopediaEntry[] => {
    const canonical = https(page.fullurl,host,'/wiki/');
    const title = field(page.title,170), text = field(page.extract,950);
    return canonical && title && text.length >= 70 && !Object.hasOwn(page.pageprops ?? {},'disambiguation')
      ? [{ kind:'encyclopedia',provider:'Wikipedia',title,url:canonical,text,pageImage:page.pageimage }] : [];
  }).slice(0,2);
}

const crossrefItem = z.object({
  DOI:z.string(),title:z.array(z.string()).optional(),type:z.string(),abstract:z.string().optional(),
  'container-title':z.array(z.string()).optional(),published:z.object({ 'date-parts':z.array(z.array(z.number())) }).optional(),
  author:z.array(z.object({ family:z.string().optional(),given:z.string().optional(),name:z.string().optional() })).optional(),
  'update-to':z.array(z.object({ type:z.string().optional() })).optional(),
});
const crossrefPage = z.object({ message:z.object({ items:z.array(crossrefItem) }) });
const crossrefWork = z.object({ message:crossrefItem });
const doiUrl = (doi:string) => 'https://doi.org/' + doi.split('/').map(encodeURIComponent).join('/');
async function crossref(query:string,signal:AbortSignal,abstracts = false):Promise<PublicMaterial[]> {
  const url = new URL('https://api.crossref.org/works');
  url.search = new URLSearchParams({ [abstracts ? 'query.bibliographic' : 'query.title']:query,rows:'8',
    filter:'type:journal-article,type:proceedings-article' + (abstracts ? ',has-abstract:true' : ''),
    select:'DOI,title,type,abstract,container-title,published,author,update-to' }).toString();
  const parsed = crossrefPage.parse(await get(url,signal));
  return parsed.message.items.flatMap(item => crossrefMaterial(item,720)).slice(0,4);
}

function crossrefMaterial(item:z.infer<typeof crossrefItem>,abstractLength:number):PublicMaterial[] {
  const doi = safeDoi(item.DOI), title = field(item.title?.[0],180);
  if (!doi || !title || /\bretract(?:ion|ed)\b/i.test(title) || item['update-to']?.some(update => /retract|withdraw/i.test(update.type ?? ''))) return [];
  const journal = field(item['container-title']?.[0],120);
  const published = String(item.published?.['date-parts'][0]?.[0] ?? '');
  const author = field(item.author?.slice(0,3).map(person => person.name ?? [person.given,person.family].filter(Boolean).join(' ')).join(', '),170);
  const abstract = field(item.abstract,abstractLength);
  return [{ kind:'paper',provider:'Crossref',title,url:doiUrl(doi),doi,journal,published,author,
    text:[title,[author,journal,published].filter(Boolean).join(' · '),'DOI: ' + doi,abstract ? 'Abstract excerpt: ' + abstract : 'Bibliographic record only.'].filter(Boolean).join('\n') }];
}

export async function crossrefByDoi(doi:string,signal:AbortSignal) {
  const work='https://api.crossref.org/works/';
  const path=doi.split('/').map(encodeURIComponent).join('/');
  const parse=async (value:string)=>crossrefWork.parse(await get(new URL(work+value),signal));
  let parsed;
  try { parsed=await parse(path); }
  catch {
    signal.throwIfAborted();
    parsed=await parse(encodeURIComponent(doi));
  }
  return safeDoi(parsed.message.DOI)===doi ? crossrefMaterial(parsed.message,1500) : [];
}

const pmcPage = z.object({ resultList:z.object({ result:z.array(z.object({
  id:z.string(),source:z.string(),title:z.string().optional(),doi:z.string().optional(),journalTitle:z.string().optional(),pubYear:z.string().optional(),
  authorString:z.string().optional(),abstractText:z.string().optional(),pubTypeList:z.object({ pubType:z.array(z.string()) }).optional(),
})) }) });
async function europePmc(query:string,signal:AbortSignal):Promise<PublicMaterial[]> {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.search = new URLSearchParams({ query:'TITLE_ABS:"' + query.replace(/["\\]/g,' ') + '" AND HAS_ABSTRACT:Y NOT PUB_TYPE:"Retracted Publication"',
    format:'json',resultType:'core',pageSize:'4' }).toString();
  const parsed = pmcPage.parse(await get(url,signal));
  return parsed.resultList.result.flatMap(item => {
    const title = field(item.title,180), abstract = field(item.abstractText,720);
    if (!title || !abstract || /\bretract(?:ion|ed)\b/i.test(title) || item.pubTypeList?.pubType.some(type => /retract|withdraw/i.test(type))) return [];
    if (!/^[a-z\d]+$/i.test(item.id) || !['MED','PMC','PPR','AGR'].includes(item.source)) return [];
    const doi = safeDoi(item.doi), url = doi ? doiUrl(doi) : 'https://europepmc.org/article/' + item.source + '/' + item.id;
    const author = field(item.authorString,170), journal = field(item.journalTitle,120), published = field(item.pubYear,20);
    return [{ kind:'paper' as const,provider:'Europe PMC' as const,title,url,doi,author,journal,published,
      text:[title,[author,journal,published].filter(Boolean).join(' · '),doi ? 'DOI: ' + doi : '', 'Abstract excerpt: ' + abstract].filter(Boolean).join('\n') }];
  }).slice(0,3);
}

const commonsPages = z.object({ query:z.object({ pages:z.array(z.object({
  title:z.string(),index:z.number().optional(),imageinfo:z.array(z.object({
    mime:z.string().optional(),thumburl:z.string().optional(),descriptionurl:z.string().optional(),
    extmetadata:z.record(z.string(),z.object({ value:z.string() })).optional(),
  })).optional(),
})) }).optional() });
async function commons(selection:Record<string,string>,signal:AbortSignal,articles = new Map<string,string>()):Promise<PublicMaterial[]> {
  const host = 'commons.wikimedia.org';
  const request = action(host,{ ...selection,prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'500',
    iiextmetadatafilter:'ObjectName|ImageDescription|Artist|LicenseShortName|LicenseUrl|NonFree' });
  const parsed = commonsPages.parse(await get(request,signal));
  return (parsed.query?.pages ?? []).sort((a,b) => (a.index ?? 999)-(b.index ?? 999)).flatMap(page => {
    const info = page.imageinfo?.[0], meta = info?.extmetadata;
    const url = https(info?.descriptionurl,host,'/wiki/File:');
    const thumbnail = commonsImageUrl(info?.thumburl);
    const license = field(meta?.LicenseShortName?.value,65);
    const licenseUrl = https(meta?.LicenseUrl?.value?.replace(/^http:/,'https:'),'creativecommons.org');
    const isPublicDomain = /^(public domain|cc0|pdm)/i.test(license);
    const isCc = /^CC BY(?:-SA)? \d(?:\.\d)?$/i.test(license) && Boolean(licenseUrl);
    const credit = field(meta?.Artist?.value,180) || (isPublicDomain ? 'Wikimedia Commons' : '');
    const title = field(meta?.ObjectName?.value || page.title.replace(/^File:/,'').replace(/\.(?:jpe?g|png|svg)$/i,''),170);
    const description = field(meta?.ImageDescription?.value,420);
    const article = articles.get(page.title.replaceAll('_',' '));
    const raster = ['image/png','image/jpeg'].includes(info?.mime ?? '') ||
      (info?.mime === 'image/svg+xml' && thumbnail?.endsWith('.png'));
    if (!url || !thumbnail || !title || !credit || !raster ||
        /^(true|1|yes)$/i.test(meta?.NonFree?.value ?? '') || (!isPublicDomain && !isCc)) return [];
    const image = { url:thumbnail,license,licenseUrl:licenseUrl ?? '',credit };
    return [{ kind:'image' as const,provider:'Wikimedia Commons' as const,title,url,author:credit,image,
      text:[title,description,article && 'Lead illustration of the encyclopedia article: ' + article,credit + ' · ' + license].filter(Boolean).join('\n') }];
  }).slice(0,3);
}

export function publicResearch(search?:(query:string,signal:AbortSignal)=>Promise<SearchResult[]>):PublicResearch {
  return {
    async discover(query,signal,observe,references) {
      const exact=Promise.allSettled(mentionedDois(references ?? '').map(doi=>crossrefByDoi(doi,signal)));
      const additional=Promise.allSettled([institutionalResearch(query,signal),search ? webResearch(query,search,signal) : Promise.resolve([])]);
      const [chinese,english,...results] = await Promise.allSettled([
        encyclopedia('zh.wikipedia.org',query.chinese,signal),encyclopedia('en.wikipedia.org',query.english,signal),
        crossref(query.english,signal),crossref(query.academic ?? query.english,signal,true),europePmc(query.english,signal),
        ...(query.facets ?? []).slice(0,2).map(item => crossref(item.english,signal,true)),
      ]);
      signal.throwIfAborted();
      const zh = chinese?.status === 'fulfilled' ? chinese.value : [];
      const en = english?.status === 'fulfilled' ? english.value : [];
      const articles = new Map<string,string>();
      for (const item of [en[0],zh[0]]) {
        if (item?.pageImage) articles.set('File:' + item.pageImage.replaceAll('_',' '),item.title);
      }
      const topic = en[0]?.title ?? query.english;
      const portrait=/\bMarie Curie\b|居里夫人|玛丽[·・ ]?居里/i.test(query.chinese+' '+query.english);
      const media = await Promise.allSettled([
        ...(portrait ? [commons({ titles:'File:Marie Curie - Henri Manuel.jpg|File:Portrait of Marie Curie (1867 - 1934), Polish chemist Wellcome M0000113.jpg' },signal)] : []),
        articles.size ? commons({ titles:[...articles.keys()].join('|') },signal,articles) : Promise.resolve([]),
        commons({ generator:'search',gsrsearch:topic,gsrnamespace:'6',gsrlimit:'7' },signal),
      ]);
      signal.throwIfAborted();
      const seen = new Set<string>();
      const unique = (item:PublicMaterial) => {
        const key = item.doi?.toLowerCase() ?? item.url;
        return !seen.has(key) && seen.add(key);
      };
      const extra=await additional;
      const reports=extra.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(unique).slice(0,6);
      signal.throwIfAborted();
      const exactResults=await exact;
      signal.throwIfAborted();
      const papers = [...exactResults,...results].flatMap(result => result.status === 'fulfilled' ? result.value : [])
        .sort((a,b) => Number(b.text.includes('Abstract excerpt:'))-Number(a.text.includes('Abstract excerpt:'))).filter(unique).slice(0,6);
      const images = media.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(unique).slice(0,3);
      const found=[reports,[zh[0],en[0],zh[1] ?? en[1]].filter(item => item !== undefined),papers,images].flat();
      const channels=[chinese,english,...exactResults,...results,...media,...extra];
      observe?.({ channels:channels.length-Number(!search),failed_channels:channels.filter(item => item?.status === 'rejected').length,
        found:found.length,institutional:reports.filter(item => item.provider === 'OSTI.GOV').length,web_enabled:Boolean(search) });
      return found;
    },
    async image(url,signal) {
      const thumbnail = commonsImageUrl(url);
      if (!thumbnail) throw new AppError(422,'VALIDATION_IMAGE_SOURCE','Illustration must be hosted on Wikimedia Commons');
      const response = await fetch(thumbnail,{ redirect:'error',headers:{ 'User-Agent':userAgent,Accept:'image/png,image/jpeg' },
        signal:AbortSignal.any([signal,AbortSignal.timeout(8500)]) });
      const mime = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || (mime !== 'image/png' && mime !== 'image/jpeg')) {
        await response.body?.cancel().catch(() => {});
        throw new AppError(502,'PROVIDER_IMAGE_UNAVAILABLE','Illustration is unavailable');
      }
      const bytes = await providerBytes(response,1_000_000);
      checkUpload(bytes,mime);
      return { bytes,mime };
    },
  };
}
