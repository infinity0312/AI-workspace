import {AtlasArt} from './atlas-art';
import { useState, type FormEvent } from 'react';
import type { SearchHit } from '@akw/contracts';
import { api, errorText, type WorkspaceView } from '../lib/api';
import { EditorialEmpty } from './editorial-image';

const labels = { artifact:'文档',source:'来源',claim:'结论',node:'知识节点',capture:'收件箱' };
export function SearchPage({ workspace,view,online,onOpen }:{
  workspace:string; view:WorkspaceView; online:boolean; onOpen:(hit:SearchHit)=>void;
}) {
  const [query,setQuery] = useState('');
  const [hits,setHits] = useState<SearchHit[]>();
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function search(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !query.trim()) return;
    setBusy(true); setMessage(''); setHits(undefined);
    const term = query.trim();
    try {
      if (online) {
        const params = new URLSearchParams({ workspace_id:workspace,q:term });
        setHits(await api<SearchHit[]>('/search?' + params));
      } else {
        const q = term.toLocaleLowerCase();
        const titles:SearchHit[] = [
          ...view.artifacts.map(item => ({ id:item.id,title:item.title,kind:'artifact' as const,excerpt:'' })),
          ...view.sources.filter(item => !['archived','retracted'].includes(item.lifecycle))
            .map(item => ({ id:item.id,title:item.title,kind:'source' as const,excerpt:'' })),
        ];
        setHits(titles.filter(item => item.title.toLocaleLowerCase().includes(q)));
      }
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="workflow">
    <header className="page-heading atlas-page-heading"><div><h1>搜索</h1><p>{online ? '搜索当前工作空间的文档、原文、结论和待整理资料。' : '离线时可搜索已缓存的文档和来源标题。'}</p></div><figure><AtlasArt asset="aa_global_cartographic_ornament_01"/><figcaption>概念插画</figcaption></figure></header>
    <form className="panel stack" onSubmit={event => void search(event)} role="search">
      <label>搜索内容<input type="search" required maxLength={150} autoFocus value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div><button className="primary" disabled={busy}>搜索</button></div>
    </form>
    {busy && <p role="status">正在搜索…</p>}
    {message && <p role="status">{message}</p>}
    {hits && <section className="panel stack" aria-label="搜索结果">
      {!hits.length && <EditorialEmpty asset="search-empty" title="没有匹配项。"><p className="muted">换一组关键词，继续寻找资料。</p></EditorialEmpty>}
      {hits.map(hit => <article className="detail stack" key={hit.kind + hit.id}>
        <div className="section-heading"><button onClick={() => onOpen(hit)}>{hit.title}</button><span className="muted">{labels[hit.kind]}</span></div>
        {hit.excerpt && <p className="excerpt">{hit.excerpt}</p>}
      </article>)}
    </section>}
  </div>;
}
