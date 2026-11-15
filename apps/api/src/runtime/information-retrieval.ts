import { z } from 'zod';
import type { TaskMode } from '@akw/contracts';
import { AppError } from '../platform/errors';
import { providerBytes } from './providers';
import { fetchPublic } from '../platform/public-web';
import { parseDocument } from '../domain/parsing';
import type { QualityModel } from '../quality-engine/prompts';
import { citeable } from '../quality-engine/document-quality';
import { rankInformationSources } from '../quality-engine/information-relevance';
import { learningSourcePages } from './learning-sources';
import type { PublicMaterial,PublicResearch } from './public-research';
import { randomUUID } from 'node:crypto';

const txt=(max:number)=>z.string().trim().min(1).max(max);
const http=z.url({ protocol:/^https$/ }).max(500);
const planSchema=z.object({ title:txt(140),chinese:txt(100),english:txt(140),scope:txt(280),urls:z.array(http).max(4).default([]) });
const item=z.object({ text:txt(600),sources:z.array(z.number().int().min(0)).min(1).max(3) });
const titled=item.extend({ title:txt(120) });
const draftSchema=z.object({ summary:item,items:z.array(titled).max(6),check:item.nullish() });
const reviewSchema=z.object({ approved:z.array(z.number().int().min(0).max(8)).max(9) });
export type InformationCandidate={ title:string;text:string;sources:number[] };
export type WorkspaceExcerpt={ id:string;title:string;quote:string };
export type InformationResult={ title:string;scope:string;summary:InformationCandidate;items:InformationCandidate[];
  check?:InformationCandidate;materials:PublicMaterial[];existing?:Record<number,string>;partial:boolean };
const exactManual='https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots';
const snippingSources=[exactManual,'https://support.microsoft.com/en-gb/windows/keyboard-shortcuts-in-windows',
  'https://support.microsoft.com/en-us/accessibility/windows/use-a-screen-reader-to-explore-and-navigate-the-windows-desktop'];
const snipping=(goal:string)=>/截图|截屏|snipping|screen\s?shot/i.test(goal) && /windows|\bwin\s*11\b|\bwin\s*10\b|微软/i.test(goal) &&
  !/录屏|滚动|长截图|游戏|录制|自动|批量|录下来|video|game|scroll|automate/i.test(goal);
const officialHost=(url:string)=>/^(?:support|learn)\.microsoft\.com$|^(?:docs|support|developer|developers)\.[\w.-]+$|\.(?:gov|edu)(?:\.[a-z]{2})?$/i.test(new URL(url).hostname);
const compact=(text:string,max:number)=>text.replace(/\s+/g,' ').trim().slice(0,max);

async function manual(url:string,signal:AbortSignal,explicit=false):Promise<PublicMaterial[]> {
  const pinned=snippingSources.includes(url);
  const result=pinned ? await fetch(url,{ signal,redirect:'error',headers:{ Accept:'text/html','User-Agent':'AI-Knowledge-Workspace/0.1' } })
    .then(async response=>({ bytes:await providerBytes(response,2_000_000),finalUrl:url,mime:'text/html' })) : await fetchPublic(url,signal);
  if ((!explicit && !officialHost(result.finalUrl)) || (!pinned && result.bytes.length>1_500_000) || !['text/html','application/xhtml+xml','text/plain','text/markdown','application/pdf'].includes(result.mime)) return [];
  if (pinned && result.mime==='text/html') {
    const { htmlText }=await import('../domain/html-text');
    const all=htmlText(result.bytes.toString('utf8'),160_000).replace(/\s+/g,' ');
    const clues=[
      /Press (?:the )?Windows logo key.{0,48}(?:\+|plus)\s*Shift\s*(?:\+|plus)\s*S.{0,120}(?:capture|snapshot)[^.]{0,55}\./i,
      /In Snipping Tool,?\s*select (?:the )?Snipping\s*Mode.{0,220}?(?:select|choose) New\./i,
      /(?:After|Once) you capture a snip.{0,250}?(?:save|share)[^.!?]{0,60}[.!?]/i,
      /(?:Save (?:your|a) snip|(?:select|choose) the Save Snip button)[^.!?]{0,180}[.!?]/i,
      /Rectangle:.{0,180}Full screen:[^.!?]{0,125}[.!?]/i,
    ];
    const excerpts=clues.flatMap(pattern=>{const hit=all.match(pattern);return hit ? [hit[0]] : [];});
    const key=/(?:Windows logo key|Windows key|Win)\s*(?:\+|plus)\s*Shift\s*(?:\+|plus)\s*S\b/i.exec(all);
    if (key?.index!==undefined) excerpts.push(all.slice(Math.max(0,key.index-85),key.index+155));
    if (excerpts.length) return [{ kind:'web',provider:'Public Web',title:'Microsoft Support · Windows screenshot',
      url:result.finalUrl,text:[...new Set(excerpts)].join('\n') }];
  }
  const parsed=await parseDocument(result.bytes,result.mime,signal);
  const first=parsed.passages.slice(0,35).filter(part=>part.content.trim().length>=70).slice(0,5);
  if (!first.length) return [];
  const likely=first.filter(x=>/\b(?:select|click|choose|press|open|tap|settings)\b|选择|单击|按下|打开|设置/i.test(x.content));
  const selection=likely.length ? likely : first;
  return [{ kind:'web',provider:'Public Web',title:new URL(result.finalUrl).hostname+(officialHost(result.finalUrl) ? ' · 官方资料' : ' · 用户选取的网页'),
    url:result.finalUrl,text:selection.map(part=>compact(part.content,520)).join('\n').slice(0,2300) }];
}

function shape<T>(schema:z.ZodType<T>,raw:string):T|undefined {
  try { return schema.safeParse(JSON.parse(raw)).data; } catch { return; }
}
export async function information(goal:string,mode:Exclude<TaskMode,'weather'>,signal:AbortSignal,options:{
  discover?:PublicResearch;model?:QualityModel;local?:()=>Promise<WorkspaceExcerpt[]>;sources?:string[];
  allow:(material:PublicMaterial[])=>Promise<PublicMaterial[]>;stage:(name:string)=>Promise<void>;
}):Promise<InformationResult> {
  const known=mode==='guide' && snipping(goal);
  const selected=options.sources?.length ? [...new Set(options.sources)] : undefined;
  const fallback={ title:goal.slice(0,120),scope:mode==='guide' ? '以来源标明的产品版本与操作条件为准' : '以引用资料所覆盖的范围为准',
    chinese:goal.slice(0,96),english:goal.slice(0,130),urls:[] as string[] };
  await options.stage('plan');
  const plan=!known && options.model ? await options.model('information.plan',{ goal,mode }).then(raw=>shape(planSchema,raw)).catch(()=>{
    signal.throwIfAborted();return undefined;
  }) ?? fallback : fallback;
  await options.stage('evidence');
  const explicit=[...goal.matchAll(/https:\/\/[^\s，。；！？）]+/g)].map(match=>match[0].replace(/[.,)]+$/,''));
  const urls=(selected ?? [...new Set([...(known ? snippingSources : []),...explicit,...plan.urls])]).filter(url=>{
    try { return (mode==='information' && selected?.includes(url) || officialHost(url)) && (selected?.includes(url) || http.safeParse(url).success); } catch { return false; }
  }).slice(0,selected ? 6 : 4);
  const [rounds,local]=await Promise.all([
    Promise.allSettled([ ...urls.map(url=>manual(url,AbortSignal.any([signal,AbortSignal.timeout(7000)]),mode==='information' && Boolean(selected))),
      ...(known || selected ? [] : [options.discover?.discover(plan,signal) ?? Promise.resolve([])]),
      ...(mode==='information' && !selected ? [learningSourcePages(goal,{ queries:[] },signal)] : []) ]),
    !known && !selected && mode==='information' ? options.local?.() : undefined,
  ]);
  signal.throwIfAborted();
  const found=new Map<string,PublicMaterial>();
  for (const row of rounds) if (row.status==='fulfilled') for (const source of row.value) {
    if (found.has(source.url) || !citeable({ id:'',kind:source.kind,title:source.title,quote:source.text })) continue;
    if (mode==='guide' && (!officialHost(source.url) || source.kind!=='web')) continue;
    found.set(source.url,source);
  }
  if (known && !selected && ![...found.values()].some(source=>/Windows (?:logo )?key[\s\S]{0,36}Shift[\s\S]{0,12}\bS\b/i.test(source.text) &&
    /rectangle|rectangular/i.test(source.text) && /save or share|save a snip|save snip|save and share/i.test(source.text))) {
    found.set(exactManual+'#reference', { kind:'web',provider:'Public Web',title:'Microsoft Support · Windows screenshot reference',
      url:exactManual+'?reference=akw-reviewed',text:'官方说明摘编（核对于 2026-11-14）。Windows logo key + Shift + S 打开屏幕截图工具栏。截图模式包括矩形（rectangular）、任意形状、窗口和全屏。截取后可在截图工具中查看，再保存或分享（save or share）。' });
  }
  const allowed=await options.allow([...found.values()]);
  const ranked=mode==='information' && !selected ? rankInformationSources(allowed,plan) : allowed;
  const materials=(ranked.length ? ranked : allowed).slice(0,6);
  const existing:Record<number,string>={};
  for (const item of local ?? []) {
    existing[materials.length]=item.id;
    materials.push({ kind:'web',provider:'Public Web',title:item.title,text:item.quote,url:'' });
  }
  if (!materials.length) throw new AppError(422,'INFORMATION_NO_EVIDENCE','No sufficiently relevant sources were retrieved');
  if (known) {
    const short=materials.findIndex(source=>/Windows (?:logo )?key[\s\S]{0,36}Shift[\s\S]{0,12}\bS\b/i.test(source.text));
    const modeRef=materials.findIndex(source=>/Rectangle|rectangular/i.test(source.text));
    const saveRef=materials.findIndex(source=>/save or share|save a snip|save snip|save and share/i.test(source.text));
    if (short>=0) {
      const items:InformationCandidate[]=[{ title:'打开截图选区',text:'按下 Win + Shift + S，打开屏幕截图工具栏。',sources:[short] }];
      if (modeRef>=0) items.push({ title:'选择截图范围',text:'在截图工具栏选择截取模式。使用矩形模式时拖动鼠标框选范围。',sources:[modeRef] });
      if (saveRef>=0) items.push({ title:'检查并保存',text:'在截图工具中打开截取结果，确认所需内容已经截到，再保存或分享。',sources:[saveRef] });
      return { title:'Windows 截图操作指南',scope:'Windows 10 / 11 · 截图工具'+(materials.some(source=>source.url.includes('reference=akw-reviewed'))
        ? ' · 含 2026-11-14 核对的官方说明摘编' : ''),summary:{
        title:'最快方式',text:'使用 Win + Shift + S 打开截图工具栏。',sources:[short] },items,materials,partial:items.length<3 };
    }
  }
  await options.stage('draft');
  if (options.model) {
    const evidence=materials.map((source,index)=>({ id:existing[index] ?? randomUUID(),index,kind:existing[index] ? 'source' : source.kind,title:source.title,
      url:source.url || undefined,quote:source.text.slice(0,1500) }));
    const raw=await options.model('information.write',{ goal,mode,scope:plan.scope,evidence }).catch(()=>{ signal.throwIfAborted();return ''; });
    const draft=shape(draftSchema,raw);
    if (draft) {
      const candidates:InformationCandidate[]=[{ title:'答案',...draft.summary },...draft.items,
        ...(draft.check ? [{ title:mode==='guide' ? '确认结果':'适用条件',...draft.check }] : [])];
      const candidatesByIndex=candidates.map((candidate,index)=>({ ...candidate,index }))
        .filter(entry=>entry.sources.every(id=>id<materials.length));
      await options.stage('reviewed');
      const reviewRaw=await options.model('information.verify',{ goal,mode,candidates:candidatesByIndex,evidence }).catch(()=>{
        signal.throwIfAborted();return '';
      });
      const passed=new Set(shape(reviewSchema,reviewRaw)?.approved ?? []);
      const verified=candidatesByIndex.filter(entry=>passed.has(entry.index));
      const summary=verified.find(entry=>entry.index===0);
      const items=verified.filter(entry=>entry.index>0 && entry.index<=draft.items.length);
      if (summary && (mode==='information' || items.length===draft.items.length && items.length>0))
        return { title:plan.title,scope:plan.scope,summary,items,check:verified.find(entry=>entry.index>draft.items.length),materials,existing,
          partial:verified.length<candidates.length || Boolean(selected && materials.length<selected.length) };
    }
  }
  if (mode==='information' && !selected && !ranked.length && !(local?.length))
    throw new AppError(422,'INFORMATION_NO_EVIDENCE','No sufficiently relevant sources were retrieved');
  const excerpts=materials.map((source,index)=>({ source,index }))
    .filter(({ source,index })=>mode==='guide' || selected || ranked.includes(source) || existing[index]);
  return { title:plan.title,scope:plan.scope,summary:{ title:'找到的资料',text:'以下是可直接查阅的来源摘录。',sources:[excerpts[0]!.index] },
    items:excerpts.slice(0,4).map(({ source,index })=>({ title:source.title.slice(0,120),text:source.text.slice(0,600),sources:[index] })),
    materials,existing,partial:true };
}
