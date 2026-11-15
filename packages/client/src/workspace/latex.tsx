import { useMemo } from 'react';
import katex from 'katex';

export function Latex({ source,display = false }:{ source:string; display?:boolean }) {
  const output = useMemo(() => {
    if (!source.trim() || source.length > 12000) return null;
    try {
      return katex.renderToString(source,{ displayMode:display,output:'htmlAndMathml',throwOnError:true,trust:false,
        maxExpand:1000,maxSize:20,strict:'ignore' });
    } catch { return null; }
  },[source,display]);
  const Tag = 'span';
  if (!output) return <Tag className="formula-error" title="公式语法不可用"><code>{source || '公式为空'}</code></Tag>;
  return <Tag className={display ? 'formula-display' : 'formula-inline'} dangerouslySetInnerHTML={{ __html:output }} />;
}

type Segment = { kind:'text'|'math'; value:string; start:number; display?:boolean };
const delimiters = /\\\(|\\\[|\$\$|\$/g;
export function formulaSegments(text:string):Segment[] {
  if (text.length > 50_000) return [{ kind:'text',value:text,start:0 }];
  const segments:Segment[] = [];
  let cursor = 0;
  function escaped(index:number) {
    let before = index - 1;
    while (before >= 0 && text[before] === '\\') before--;
    return (index - before - 1) % 2 === 1;
  }
  for (const match of text.matchAll(delimiters)) {
    const index = match.index;
    if (index < cursor || escaped(index)) continue;
    const open = match[0];
    const close = open === '\\(' ? '\\)' : open === '\\[' ? '\\]' : open;
    const start = index + open.length;
    if (open === '$' && /\s/.test(text[start] ?? ' ')) continue;
    let end = text.indexOf(close,start);
    while (end !== -1 && (escaped(end) || (open === '$' && (text[end+1] === '$' || /\d/.test(text[end+1] ?? '')))))
      end = text.indexOf(close,end + close.length);
    if (end < start || (open === '$' && /[\n\r]/.test(text.slice(start,end)))) continue;
    const value = text.slice(start,end);
    if (!value.trim() || (open === '$' && /\s$/.test(value))) continue;
    if (index > cursor) segments.push({ kind:'text',value:text.slice(cursor,index),start:cursor });
    segments.push({ kind:'math',value,start,display:open === '$$' || open === '\\[' });
    cursor = end + close.length;
  }
  if (cursor < text.length) segments.push({ kind:'text',value:text.slice(cursor),start:cursor });
  return segments;
}
