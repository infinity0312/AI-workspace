import { useEffect, useState, type FormEvent } from 'react';
import type { Schedule, WorkspaceSummary } from '@akw/contracts';
import { api, errorText, post, type Source } from '../lib/api';

export function SchedulesPage({ workspace,sources,openSource,openResearch,report }: {
  workspace:WorkspaceSummary; sources:Source[]; openSource:(id:string)=>void; openResearch:()=>void; report:(text:string)=>void;
}) {
  const [rows,setRows] = useState<Schedule[]>([]);
  const [kind,setKind] = useState<'research'|'source'>('source');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const path = '/schedules?workspace_id=' + encodeURIComponent(workspace.id);
  const urls = sources.filter(source => source.canonical_url && !['archived','retracted'].includes(source.lifecycle));
  const canExternal = workspace.policy.externalProviderAllowed && ['public','personal'].includes(workspace.policy.sensitivity);
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try { const data = await api<Schedule[]>(path); if (alive) setRows(data); }
      catch (error) { if (alive) report(errorText(error)); }
      finally { if (alive) setLoading(false); }
    }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); },15000);
    return () => { alive = false; clearInterval(timer); };
  },[path,report]);
  async function run(action:()=>Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const target = kind === 'source' ? { kind,source_id:data.get('source') } :
      { kind,goal:data.get('goal'),allow_external:canExternal && data.has('external') };
    void run(async () => {
      const row = await post<Schedule>('/schedules',{ workspace_id:workspace.id,title:data.get('title'),target,cadence_hours:Number(data.get('hours')) });
      setRows(previous => [row,...previous.filter(item => item.id !== row.id)]);
      form.reset();
    });
  }
  function update(event:FormEvent<HTMLFormElement>,row:Schedule) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      const changed = await api<Schedule>('/schedules/' + row.id,{ method:'PATCH',key:crypto.randomUUID(),
        body:{ version:row.version,enabled:data.get('enabled') === 'yes',cadence_hours:Number(data.get('hours')) } });
      setRows(previous => previous.map(item => item.id === changed.id ? changed : item));
    });
  }
  return <div className="workflow">
    <header className="page-heading"><h1>定期监测</h1><p>按间隔检查网页更新，或重复执行研究任务。运行时间由服务端记录。</p></header>
    {workspace.role !== 'viewer' && <form className="panel stack" onSubmit={create}>
      <div className="field-grid"><label>计划名称<input name="title" maxLength={200} required /></label>
        <label>监测类型<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="source">网页变化</option><option value="research">重复研究</option></select></label></div>
      {kind === 'source' ? <label>网页来源<select name="source" required><option value="">选择来源</option>
        {urls.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label> :
        <label>研究目标<textarea name="goal" required maxLength={3000} /></label>}
      {kind === 'research' && canExternal && <label className="check"><input type="checkbox" name="external" />允许该计划将研究任务与符合权限的资料发送至已配置服务</label>}
      <label>间隔（小时）<input name="hours" type="number" min={1} max={720} defaultValue={24} required /></label>
      <div><button className="primary" disabled={busy || (kind === 'source' && !urls.length)}>创建计划</button></div>
      {kind === 'source' && !urls.length && <p className="muted">先在来源库添加可访问的网页。</p>}
    </form>}
    {loading ? <p className="muted">正在读取监测计划…</p> : !rows.length && <p className="muted">暂无监测计划。</p>}
    {rows.map(row => <article className="panel stack" key={row.id}>
      <div><h2>{row.title}</h2><p className="muted">{row.enabled ? '已启用 · 下次运行 ' + new Date(row.next_run_at).toLocaleString() : '已暂停'}</p></div>
      {row.last_run_at && <p>上次入队 {new Date(row.last_run_at).toLocaleString()}</p>}
      {row.last_skip_reason === 'policy_or_access' && <p>来源或权限已变化，计划已暂停。</p>}
      {row.last_skip_reason === 'previous_run_active' && <p>上次任务仍在运行，本次已跳过。</p>}
      <div className="button-row">{row.target.kind === 'source'
        ? <button onClick={() => { if (row.target.kind === 'source') openSource(row.target.source_id); }}>查看来源</button>
        : <button onClick={openResearch}>查看研究记录</button>}</div>
      {workspace.role !== 'viewer' && <form className="field-grid" key={row.version} onSubmit={event => update(event,row)}>
        <label>运行状态<select name="enabled" defaultValue={row.enabled ? 'yes' : 'no'}><option value="yes">启用</option><option value="no">暂停</option></select></label>
        <label>间隔（小时）<input name="hours" type="number" min={1} max={720} defaultValue={row.cadence_hours} required /></label>
        <div><button disabled={busy}>保存计划</button></div>
      </form>}
    </article>)}
  </div>;
}
