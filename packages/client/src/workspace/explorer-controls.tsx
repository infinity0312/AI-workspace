import { useEffect,useRef,useState,type ReactNode } from 'react';

export type FilterOption={ value:string;label:string;count?:number };
export function PrimarySearch({ value,onChange,label='搜索',placeholder }:{value:string;onChange:(value:string)=>void;label?:string;placeholder?:string}) {
  return <div className="primary-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={label} placeholder={placeholder || label} value={value} onChange={event=>onChange(event.target.value)} />{value && <button aria-label={'清除'+label} onClick={()=>onChange('')}>×</button>}</div>;
}
export function ContextSelector({value,onChange,options,label='当前范围'}:{value:string;onChange:(value:string)=>void;options:FilterOption[];label?:string}) {
  return <label className="context-selector"><span>{label} /</span><select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
export function ControlPopover({label,children,active=false,drawer=false}:{label:string;children:ReactNode;active?:boolean;drawer?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  function close(){dialog.current?.close();setOpen(false);trigger.current?.focus();}
  useEffect(()=>{if(!open)return;const current=dialog.current;current?.showModal();return()=>current?.close();},[open]);
  return <><button ref={trigger} className={'facet-trigger'+(active?' is-active':'')} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>{label}<span aria-hidden="true">⌄</span></button><dialog ref={dialog} aria-label={label} className={'control-popover'+(drawer?' advanced-drawer':'')} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}} onClose={()=>{setOpen(false);trigger.current?.focus();}}><div className="popover-header"><strong>{label}</strong><button type="button" aria-label={'关闭'+label} onClick={close}>×</button></div>{open && children}</dialog></>;
}
export function FacetPopover({label,options,values,onChange,multiple=true,clearable=true}:{label:string;options:FilterOption[];values:string[];onChange:(value:string[])=>void;multiple?:boolean;clearable?:boolean}) {
  const [query,setQuery]=useState('');
  return <ControlPopover label={label+(values.length?' · '+(!multiple?(options.find(option=>option.value===values[0])?.label||values[0]):values.length):' · 全部')} active={values.length>0}>
    {options.length>7 && <PrimarySearch label={'查找'+label+'选项'} value={query} onChange={setQuery} />}
    <div className="facet-options" onKeyDown={event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const options=Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input'));const current=options.indexOf(document.activeElement as HTMLInputElement),next=event.key==='Home'?0:event.key==='End'?options.length-1:(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus();if(!multiple&&options[next])onChange([options[next]!.value]);}}>{options.filter(option=>option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(option=><label key={option.value}><input type={multiple?'checkbox':'radio'} name={label+'-facet'} value={option.value} checked={values.includes(option.value)} onChange={event=>onChange(multiple?(event.target.checked?[...values,option.value]:values.filter(value=>value!==option.value)):[option.value])} /><span>{option.label}</span>{option.count!==undefined && <small>{option.count}</small>}</label>)}</div>
    {clearable&&!!values.length && <button onClick={()=>onChange([])}>清除此条件</button>}
  </ControlPopover>;
}
export function FacetBar({children}:{children:ReactNode}) {return <div className="facet-bar" role="group" aria-label="探索筛选">{children}</div>;}
export type FilterToken={key:string;label:string;remove:()=>void};
export function ActiveFilterTokens({tokens,onClear}:{tokens:FilterToken[];onClear:()=>void}) {
  return tokens.length>0 ? <div className="active-filter-tokens" aria-label="已生效条件">{tokens.map(token=><button key={token.key} aria-label={'移除：'+token.label} onClick={token.remove}>{token.label}<span aria-hidden="true">×</span></button>)}<button className="clear-filters" onClick={onClear}>清除筛选</button></div>:null;
}
export function FocusEntityPicker({items,value,onFocus,label='聚焦实体'}:{items:{id:string;title:string;type:string}[];value:string;onFocus:(id:string)=>void;label?:string}) {
  const [query,setQuery]=useState('');
  return <ControlPopover label={label} active={!!value}><PrimarySearch value={query} onChange={setQuery} label="查找聚焦对象" /><p className="muted">选择后导航到实体；输入不会改变当前焦点。</p><div className="entity-candidates">{items.filter(item=>(item.title+' '+item.type).toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,80).map(item=><button aria-pressed={value===item.id} key={item.id} onClick={event=>{onFocus(item.id);event.currentTarget.closest('dialog')?.close();}}><small>{item.type}</small><strong>{item.title}</strong><span>聚焦 →</span></button>)}</div>{items.length>80 && <small>最多显示 80 项，请输入名称缩小候选。</small>}</ControlPopover>;
}
export function ViewOptionsMenu({children}:{children:ReactNode}){return <ControlPopover label="视图选项"><div className="view-options">{children}</div></ControlPopover>;}
export function AdvancedFilterDrawer({children,active=false}:{children:ReactNode;active?:boolean}){return <ControlPopover label="更多筛选" active={active} drawer>{children}</ControlPopover>;}
export function ResultSummary({children}:{children:ReactNode}){return <p className="result-summary" role="status" aria-live="polite">{children}</p>;}
export function EmptyFilterResult({empty,onClear,subject='内容'}:{empty:boolean;onClear:()=>void;subject?:string}){return <div className="explorer-empty"><p className="eyebrow">{empty?'COLLECTION / 00':'NO MATCH'}</p><h3>{empty?'当前范围还没有可浏览的'+subject:'没有找到符合当前条件的'+subject}</h3><p>{empty?'从来源、研究结果或正文添加真实内容后，再来探索。':'已有数据仍保留。试着放宽类型、状态或搜索条件。'}</p>{!empty && <button onClick={onClear}>清除筛选</button>}</div>;}

/** Local presentation preferences never create a domain mutation or Revision. */
export function useViewPreference<T>(key:string,initial:T):[T,(value:T)=>void,(value:T)=>void] {
  const [value,setValue]=useState<T>(()=>{try {const saved=localStorage.getItem('akw-view:'+key);return saved?{...initial,...JSON.parse(saved)}:initial;}catch{return initial;}});
  return [value,(next:T)=>{setValue(next);try{localStorage.setItem('akw-view:'+key,JSON.stringify(next));}catch{/* Optional device state. */}},setValue];
}
