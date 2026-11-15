import { useEffect, useState, type FormEvent } from 'react';
import type { ArtifactDetail,RunSummary,WorkspaceSummary } from '@akw/contracts';
import { api,errorText,post,workspaceApi,type Job,type Project,type RunEvent,type Source } from '../lib/api';
import { RuntimeTimeline } from './runtime-timeline';
import { activeRun,statusLabel } from './workflow-status';

export function Research({ ws, projects, sources, openArtifact, report,initialGoal = '' }: { report:(message:string)=>void;
  ws: WorkspaceSummary; initialGoal?:string; projects: Project[]; sources: Source[]; openArtifact: (id: string) => void;
}) {
  const [runs,setRuns] = useState<RunSummary[]>([]);
  const [selected,setSelected] = useState('');
  const [events,setEvents] = useState<RunEvent[]>([]);
  const [goal,setGoal] = useState(initialGoal);
  const [source,setSource] = useState('');
  const [project,setProject] = useState('');
  const [mode,setMode] = useState<'simple'|'learn'|'research'>('research');
  const [audience,setAudience] = useState<'beginner'|'high_school'|'undergraduate'|'postgraduate'|'specialist'>('beginner');
  const [saving,setSaving]=useState(false);
  const [external,setExternal] = useState(false);
  const [useWorkspace,setUseWorkspace] = useState(false);
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const list = await workspaceApi.runs(ws.id);
        if (mounted) setRuns(list);
        if (selected) {
          const detail = await api<{ events: RunEvent[] }>('/research-runs/' + selected + '/events');
          if (mounted) setEvents(detail.events);
        }
      } catch (error) { if (mounted && navigator.onLine) report(errorText(error)); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(),2500);
    return () => { mounted = false; window.clearInterval(interval); };
  },[ws.id,selected,report]);
  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const job = await post<Job>('/research-runs',{ workspace_id:ws.id,project_id:project || null,goal,mode:mode==='simple' ? 'simple' : 'research',intent:mode==='simple' ? undefined : mode,audience,
        source_ids:source ? [source] : [],use_workspace:useWorkspace,allow_external:external && ws.policy.externalProviderAllowed });
      setRuns(await workspaceApi.runs(ws.id));
      setSelected(job.run_id);
      setGoal('');
    } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  async function command(id: string, action: string) {
    try { await post('/research-runs/' + id + '/' + action); setRuns(await workspaceApi.runs(ws.id)); }
    catch (error) { report(errorText(error)); }
  }
  const run = runs.find(item => item.id === selected);
  async function saveAnswer(id:string) {
    setSaving(true);
    try {
      const saved=await post<ArtifactDetail>('/research-runs/'+id+'/save-answer');
      openArtifact(saved.id);
    } catch (error) { report(errorText(error)); }
    finally { setSaving(false); }
  }
  return <div className="workflow">
    <header className="page-heading"><h1>研究</h1><p>你想学习、研究或解决什么问题？</p></header>
    <form className="panel stack" onSubmit={start}>
      <label>研究目标<textarea required maxLength={3000} value={goal} onChange={event => setGoal(event.target.value)} placeholder="你想弄清楚什么？" /></label>
      <div className="field-grid">
        <label>任务模式<select value={mode} onChange={event => setMode(event.target.value === 'simple' ? 'simple' : event.target.value==='learn' ? 'learn' : 'research')}><option value="research">深度研究</option><option value="learn">系统学习</option><option value="simple">快速了解</option></select></label>
        <label>面向读者<select value={audience} onChange={event=>setAudience(event.target.value as typeof audience)}>
          <option value="beginner">初学者</option><option value="high_school">高中生</option><option value="undergraduate">大学生</option>
          <option value="postgraduate">研究生</option><option value="specialist">专业研究者</option>
        </select></label>
        <label>关联项目<select value={project} onChange={event => setProject(event.target.value)}><option value="">工作空间共享</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>使用来源<select value={source} onChange={event => setSource(event.target.value)}><option value="">不指定来源</option>{sources.filter(item => ['active','updated'].includes(item.lifecycle) && (!item.project_id || item.project_id === project)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      </div>
      <details>
        <summary>查看建议计划</summary>
        <ol>{(mode==='simple' ? ['直接回答问题','说明适用范围','按需保存学习笔记']
          : mode==='learn' ? ['梳理概念和前置知识','对照来源、解释机制与边界','整理可继续编辑的文档']
          : ['定位原始资料','提取证据并核对比较或归因','生成附引用的研究文档']).map(step=><li key={step}>{step}</li>)}</ol>
      </details>
      <label className="check"><input type="checkbox" checked={useWorkspace} onChange={event => setUseWorkspace(event.target.checked)} />检索当前项目和共享资料</label>
      {ws.policy.externalProviderAllowed && <label className="check"><input type="checkbox" checked={external} onChange={event => setExternal(event.target.checked)} />允许本次任务使用已配置的外部服务</label>}
      <div><button className="primary" disabled={busy}>开始任务</button></div>
    </form>
    <div className="panel stack">
      <h2>任务记录</h2>
      {!runs.length && <p className="muted">这里会显示你的研究任务。</p>}
      {runs.map(item => <div key={item.id} className="list-item">
        <button className={selected === item.id ? 'selected' : ''} onClick={() => { setEvents([]); setSelected(item.id); }}>{item.goal}</button>
        <span>{statusLabel(item.status)}</span>
      </div>)}
      {run && <div className="detail stack">
        <h3>{run.goal}</h3>
        {run.result?.response && <p>{run.result.response}</p>}
        {run.result?.warning && <p className="muted">{run.result.warning}</p>}
        <div className="button-row">
          {run.result?.artifact_id && <button className="primary" onClick={() => openArtifact(run.result!.artifact_id!)}>打开研究文档</button>}
          {run.status==='COMPLETED' && run.result?.response && ws.role!=='viewer' &&
            <button disabled={saving} onClick={()=>void saveAnswer(run.id)}>保存为笔记</button>}
          {activeRun(run.status) && <button onClick={() => void command(run.id,'pause')}>暂停</button>}
          {run.status === 'PAUSED' && <button onClick={() => void command(run.id,'resume')}>恢复</button>}
          {(activeRun(run.status) || run.status === 'PAUSED') && <button onClick={() => void command(run.id,'cancel')}>取消任务</button>}
        </div>
        {run.runtime_session_id && <RuntimeTimeline key={run.id} runId={run.id} active={activeRun(run.status)||run.status==='PAUSED'} />}
        {!run.runtime_session_id && events.length > 0 && <ol className="timeline">{events.map(item => <li key={item.sequence}>
          <span>{new Date(item.created_at).toLocaleTimeString('zh-CN')}</span><strong>{item.event_type}</strong>
          {typeof item.payload.step === 'string' ? <span>{item.payload.step}</span> : null}
        </li>)}</ol>}
      </div>}
    </div>
  </div>;
}
