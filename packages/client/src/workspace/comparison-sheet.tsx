import {EntityInspector,InspectorAction} from './entity-inspector';
import { useState } from 'react';
import type { Block } from '@akw/contracts';
import { Latex,formulaSegments } from './latex';

export function ComparisonSheet({ block,onEvidence }:{ block:Block;onEvidence?:(id:string)=>void }) {
  const [selected,setSelected]=useState<{row:number;col:number}|null>(null);
  const [mode,setMode]=useState<'table'|'object'>('table');
  const [object,setObject]=useState(1),[pinned,setPinned]=useState(true);
  const [hidden,setHidden]=useState<number[]>([]);
  const raw=block.attrs?.rows;
  if(!Array.isArray(raw) || !raw.every(Array.isArray) || !raw.length) return <p className="muted">表格数据不可用。原始数据已保留。</p>;
  const rows=raw as unknown[][];
  const columns=Math.max(...rows.map(row=>row.length));
  const hasHeader=block.attrs?.table_version===1;
  const title=typeof block.attrs?.title==='string' ? block.attrs.title : '结构化数据表';
  const cell=(value:unknown)=>value==null || String(value).trim()==='' ? <span className="missing-value">未提供</span> : formulaSegments(String(value)).map((item,index)=>item.kind==='math' ? <Latex key={index} source={item.value} display={item.display} /> : item.value);
  const data=hasHeader ? rows.slice(1) : rows;
  const headers=hasHeader ? rows[0]! : Array.from({ length:columns },(_,index)=>'列 '+(index+1));
  return <section className="comparison-sheet" aria-label={title}>
    <header className="atlas-ledger-heading"><span className="atlas-ledger-mark" aria-hidden="true">≡</span><div><p className="eyebrow">RESEARCH LEDGER</p><h3>{title}</h3></div></header><div className="section-heading"><p className="eyebrow">COMPARISON / {data.length} 行 · {columns} 列</p><div className="button-row" role="group" aria-label="表格显示模式"><button aria-pressed={mode==='table'} onClick={()=>setMode('table')}>对照表</button>{columns>1 && <button aria-pressed={mode==='object'} onClick={()=>setMode('object')}>单对象详情</button>}</div></div>
    <details><summary>显示与隐藏维度（仅影响当前视图）</summary><div className="stack">{data.map((row,index)=><label className="check" key={index}><input type="checkbox" checked={!hidden.includes(index)} onChange={event=>setHidden(values=>event.target.checked ? values.filter(value=>value!==index) : [...values,index])} />{String(row[0] ?? '行 '+(index+1)) || '未命名维度'}</label>)}</div></details>
    {mode==='table' ? <><label className="check"><input type="checkbox" checked={pinned} onChange={event=>setPinned(event.target.checked)} />固定首列</label><div className="table-wrap" tabIndex={0} role="region" aria-label={title+'，可横向滚动'}><table className={pinned ? 'pinned' : ''}><caption>{title}</caption>{hasHeader && <thead><tr>{headers.map((value,index)=><th scope="col" key={index}>{cell(value)}</th>)}</tr></thead>}<tbody>{data.map((row,index)=>!hidden.includes(index) && <tr key={index}>{Array.from({ length:columns },(_,col)=>col===0 && hasHeader ? <th scope="row" key={col}>{cell(row[col])}</th> : <td key={col}><button className="table-cell-value" onClick={()=>setSelected({row:index,col})}>{cell(row[col])}</button></td>)}</tr>)}</tbody></table></div></> : <div className="comparison-detail"><label>比较对象<select value={object} onChange={event=>setObject(Number(event.target.value))}>{headers.slice(1).map((value,index)=><option key={index} value={index+1}>{String(value ?? '') || '对象 '+(index+1)}</option>)}</select></label><dl>{data.map((row,index)=>!hidden.includes(index) && <div key={index} style={{ display:'contents' }}><dt>{cell(row[0])}</dt><dd>{cell(row[object])}</dd></div>)}</dl></div>}
    {selected&&<EntityInspector title={String(headers[selected.col]||'原始字段')} kind="表格单元格" onClose={()=>setSelected(null)}><dl><dt>维度</dt><dd>{String(data[selected.row]?.[0]||'未提供')}</dd><dt>原始值</dt><dd>{cell(data[selected.row]?.[selected.col])}</dd></dl>{onEvidence&&block.children?.filter(node=>node.type==='citation'&&typeof node.attrs?.evidence_id==='string').map((node,index)=><InspectorAction key={index} onClick={()=>onEvidence(String(node.attrs!.evidence_id))}>本表来源引用 {index+1}</InspectorAction>)}<p>单位和时间以原始行列标签为准。本单元格未提供独立来源定位或可比性说明，来源请查阅邻接引用。</p></EntityInspector>}
    <p className="projection-caption">按原始字段展示，空值表示未提供。单位、口径和时间以原始字段为准；没有结构化可比性字段，不执行排序、差值或推荐。隐藏维度不修改文档；导出包含当前版本的完整表格。</p>
  </section>;
}
