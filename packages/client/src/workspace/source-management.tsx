import { useState, type FormEvent } from 'react';
import type { ClaimReview } from '@akw/contracts';
import { api, errorText, post, type Job, type SourceDetail } from '../lib/api';
import { lifecycleLabel } from './library-pages';

type Impact = { artifacts:{ id:string;title:string }[]; claims:Pick<ClaimReview,'id'|'statement'|'status'>[];
  evidence:{ id:string }[]; edges:{ id:string }[] };
export function SourceManagement({ source,editable,refresh,openArtifact,queue,report }: {
  source:SourceDetail; editable:boolean; refresh:()=>Promise<void>; openArtifact:(id:string)=>void;
  queue:(jobs:Job[])=>void; report:(message:string)=>void;
}) {
  const [impact,setImpact] = useState<Impact>();
  const [busy,setBusy] = useState(false);
  async function inspect() {
    try { setImpact(await api<Impact>('/sources/' + source.id + '/dependencies')); }
    catch (error) { report(errorText(error)); }
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api('/sources/' + source.id + '/metadata',{ method:'PATCH',key:crypto.randomUUID(),body:{
        version:source.version,title:form.get('title'),rights:form.get('rights'),sensitivity:form.get('sensitivity'),
        metadata:{ author:form.get('author'),published:form.get('published'),doi:form.get('doi') },
      } });
      await refresh();
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  async function change(action:'archive'|'retract'|'restore') {
    if (busy) return;
    setBusy(true);
    try {
      await post('/sources/' + source.id + '/lifecycle',{ action,version:source.version });
      await refresh();
      await inspect();
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="stack">
    <p>状态 · {lifecycleLabel(source.lifecycle)}{source.checked_at && ' · 最近检查 ' + new Date(source.checked_at).toLocaleString('zh-CN')}</p>
    <details>
      <summary>来源资料与权利</summary>
      {editable && <form className="stack" key={source.version} onSubmit={event => void save(event)}>
        <div className="field-grid">
          <label>来源标题<input name="title" defaultValue={source.title} maxLength={200} required /></label>
          <label>作者<input name="author" defaultValue={source.metadata.author} maxLength={250} /></label>
          <label>发表日期<input name="published" defaultValue={source.metadata.published} maxLength={100} /></label>
          <label>DOI<input name="doi" defaultValue={source.metadata.doi} maxLength={160} /></label>
          <label>来源权利<select name="rights" defaultValue={source.rights}>
            <option value="unknown">未确认</option><option value="user_owned">本人拥有</option><option value="public_license">公开许可</option><option value="restricted">限制分发</option>
          </select></label>
          <label>来源敏感级别<select name="sensitivity" defaultValue={source.sensitivity}>
            <option value="public">公开</option><option value="personal">个人</option><option value="sensitive">敏感</option><option value="restricted">受限</option>
          </select></label>
        </div>
        <div><button disabled={busy}>保存来源资料</button></div>
      </form>}
      {!editable && <p>{[source.metadata.author,source.metadata.published,source.metadata.doi].filter(Boolean).join(' · ') || '暂无书目信息。'}</p>}
    </details>
    <div className="button-row">
      <button onClick={() => void inspect()}>查看引用影响</button>
      {editable && (source.lifecycle === 'archived' || source.lifecycle === 'retracted'
        ? <button disabled={busy} onClick={() => void change('restore')}>恢复来源</button>
        : <>
          {(source.canonical_url || source.asset_id) && <button disabled={busy} onClick={() => {
            void post<Job>('/sources/' + source.id + '/revalidate').then(job => queue([job])).catch(error => report(errorText(error)));
          }}>重新检查</button>}
          {impact && <><button disabled={busy} onClick={() => void change('archive')}>归档来源</button><button disabled={busy} onClick={() => void change('retract')}>标记撤回</button></>}
        </>)}
    </div>
    {impact && <section className="stack">
      <h4>引用影响</h4>
      <p>{impact.evidence.length} 条证据 · {impact.claims.length} 条结论 · {impact.edges.length} 条关系 · {impact.artifacts.length} 篇文档</p>
      {impact.artifacts.map(item => <button key={item.id} onClick={() => openArtifact(item.id)}>{item.title}</button>)}
      {impact.claims.map(item => <p key={item.id} className="muted">{item.statement}</p>)}
      <p className="muted">归档或撤回后，历史引用仍可查看，失去有效支持的结论会进入复核。</p>
    </section>}
  </div>;
}
