import { useState } from 'react';
import type { WorkspaceEvidence, WorkspaceReferences } from '@akw/contracts';

export function EvidenceNetwork({ references,onEvidence,onSource,onBlock }:{
  references?:WorkspaceReferences; onEvidence:(id:string)=>void; onSource?:(id:string)=>void; onBlock?:(id:string)=>void;
}) {
  const [source,setSource] = useState('');
  const [query,setQuery] = useState('');
  if (!references) return <p className="muted">证据数据暂不可用。</p>;
  const byId = new Map(references.evidence.map(item => [item.id,item]));
  const sources = new Map(references.sources.map(item => [item.id,item]));
  const documentClaims=references.claims.filter(claim=>claim.block_ids===undefined || claim.block_ids.length>0);
  const associated = new Set(documentClaims.flatMap(claim => claim.evidence_ids));
  const cited = references.evidence.filter(item => item.in_document || associated.has(item.id));
  const names = [...new Set(cited.map(item => item.source_id))];
  const queryText = query.trim().toLocaleLowerCase();
  const show = (item:WorkspaceEvidence) => (!source || item.source_id === source) &&
    (!queryText || (item.title + ' ' + item.quote).toLocaleLowerCase().includes(queryText));
  const displayed = cited.filter(show);
  const allowed = new Set(displayed.map(item => item.id));
  const claims = documentClaims.filter(claim => claim.evidence_ids.some(id => allowed.has(id)));
  const evidence = (item:WorkspaceEvidence) => <div className="detail stack" key={item.id}>
    <div className="button-row">
      <button onClick={() => onEvidence(item.id)}>{item.title}{item.page != null && ' · 第 ' + item.page + ' 页'}</button>
      {onSource && <button onClick={() => onSource(item.source_id)}>查看来源</button>}
      {onBlock && item.block_ids.slice(0,3).map((id,index) => <button key={id} onClick={() => onBlock(id)}>正文引用 {index+1}</button>)}
    </div>
    <blockquote>{item.quote}</blockquote>
  </div>;
  return <div className="stack">
    <div className="field-grid">
      <label>来源筛选<select value={source} onChange={event => setSource(event.target.value)}><option value="">全部来源</option>
        {names.map(id => <option key={id} value={id}>{sources.get(id)?.title ?? id}</option>)}</select></label>
      <label>搜索原文<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    {claims.map(claim => <section className="panel stack" key={claim.id}>
      <h4>{claim.statement}</h4>{claim.scope && <p className="muted">{claim.scope}</p>}
      {onBlock && claim.block_ids?.map(id=><button key={id} onClick={()=>onBlock(id)}>定位结论</button>)}
      {claim.evidence_ids.filter(id => allowed.has(id)).map(id => evidence(byId.get(id)!))}
    </section>)}
    {displayed.filter(item => !associated.has(item.id)).map(evidence)}
    {!displayed.length && <p className="muted">没有符合条件的引用。可在检查器中将原文证据插入正文。</p>}
  </div>;
}
