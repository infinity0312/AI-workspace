import { useEffect,useState,type FormEvent } from 'react';
import { weatherAttrs,type BrowseResponse,type BrowseResult,type ArtifactDetail,type ProductivityProgress,type WorkspaceSummary } from '@akw/contracts';
import { ApiError,api,errorText,post,type Job } from '../lib/api';
import { ExternalLink } from './native-actions';
import { activeRun } from './workflow-status';
import { canUseModel } from './learning-experience';
import { EditorialEmpty } from './editorial-image';

const phase:Record<string,string>={ forecast:'正在查询当地预报…',plan:'正在识别任务并准备检索…',evidence:'正在查找相关来源…',
  draft:'正在组织答案…',reviewed:'正在核对答案与来源…' };
export const taskWarnings:Record<string,string>={ WEATHER_PLACE_REQUIRED:'请在问题里加上城市，例如「北京明天天气」。',
  WEATHER_PLACE_NOT_FOUND:'没有找到该地点。请用城市名，可用逗号加省份或国家。',
  WEATHER_AMBIGUOUS_PLACE:'找到多个同名地点，请补充省份或国家。',WEATHER_WINDOW_UNSUPPORTED:'请选择一个城市，可以查询今天、明天或未来七天内的预报。',
  WEATHER_PROVIDER_UNAVAILABLE:'天气数据暂时不可用，请稍后重试。',
  INFORMATION_NO_EVIDENCE:'没有找到足以回答问题的资料。请补充产品、版本或具体情境。',
  PROVIDER_UNAVAILABLE:'当前服务未配置此任务需要的模型。',PERMISSION_DENIED:'当前工作空间不允许调用外部服务。',
  CONFLICT_ARTIFACT_VERSION:'产物已更新，请打开最新版本后重试。' };

function status(run:ProductivityProgress) {
  if (activeRun(run.status)) return phase[run.stage ?? ''] ?? '任务正在排队…';
  if (run.status==='COMPLETED') return '结果已保存到工作空间。';
  if (run.status==='PARTIAL') return run.kind==='learning' ? '已保存通过核对的课程。' : '已保存可查阅的资料，当前证据不足以支持完整答案。';
  return taskWarnings[run.result?.warning ?? ''] ?? '这次没有保存新结果，可以检查条件后重试。';
}
function useTask(id:string|undefined) {
  const [run,setRun]=useState<ProductivityProgress>();
  const [error,setError]=useState('');
  const row=run?.id===id ? run : undefined;
  const pending=Boolean(id && (!row || activeRun(row.status)));
  useEffect(()=>{
    if (!id || !pending) return;
    const control=new AbortController();
    let busy=false;
    async function check() {
      if (busy) return;
      busy=true;
      try {
        const result=await api<ProductivityProgress>('/tasks/'+id,{ signal:control.signal });
        if (!control.signal.aborted) { setRun(result);setError(''); }
      } catch (problem) { if (!control.signal.aborted) setError(errorText(problem)); }
      finally { busy=false; }
    }
    void check();
    const timer=window.setInterval(()=>void check(),1000);
    return ()=>{ control.abort();window.clearInterval(timer); };
  },[id,pending]);
  return { row,pending,error };
}

export function TaskStart({ workspace,online,onOpen,onSettings,onSources }:{
  workspace:WorkspaceSummary;online:boolean;onOpen:(id:string)=>void;onSettings:()=>void;onSources?:()=>void;
}) {
  const key='akw-task:'+workspace.id;
  const [id,setId]=useState(()=>typeof window==='undefined' ? '' : localStorage.getItem(key) ?? localStorage.getItem('akw-learning-run:'+workspace.id) ?? '');
  const [goal,setGoal]=useState(()=>{ try { return localStorage.getItem('akw-intent:'+workspace.id) ?? ''; } catch { return ''; } });
  const [location,setLocation]=useState<string>();
  const [allowed,setAllowed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [browse,setBrowse]=useState<BrowseResponse>();
  const [selected,setSelected]=useState<BrowseResult[]>([]);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const task=useTask(id || undefined);
  const working=task.pending && !task.error;
  const enabled=canUseModel(workspace);
  useEffect(()=>{ try { localStorage.setItem('akw-intent:'+workspace.id,goal); } catch { /* Draft storage is optional. */ } },[workspace.id,goal]);
  async function search() {
    if (!online || !allowed || !enabled || busy || !goal.trim()) return;
    setBusy(true);setError('');setFeedback('');setBrowse(undefined);setSelected([]);
    try { setBrowse(await post<BrowseResponse>('/browse/search',{ workspace_id:workspace.id,query:goal,allow_external:true })); }
    catch (problem) { setError(errorText(problem)); }
    finally { setBusy(false); }
  }
  async function saveCollection() {
    if (!selected.length || busy) return;
    setBusy(true);setError('');
    try {
      const result=await post<ArtifactDetail>('/browse/collections',{ workspace_id:workspace.id,
        title:(browse?.query ?? goal).slice(0,140),items:selected.map(({ title,url })=>({ title,url })) });
      onOpen(result.id);
    } catch (problem) { setError(errorText(problem)); }
    finally { setBusy(false); }
  }
  async function clip(item:BrowseResult) {
    try {
      await post('/capture-items',{ workspace_id:workspace.id,title:item.title,url:item.url,sensitivity:'public',rights:'unknown' });
      setFeedback('已收藏 · '+item.title);
    } catch (problem) { setError(errorText(problem)); }
  }
  async function submit(event:FormEvent) {
    event.preventDefault();
    if (working || busy || !online || !allowed || !enabled || !goal.trim()) return;
    const sources=browse && selected.length ? selected.slice(0,6).map(item=>item.url) : undefined;
    setBusy(true);setError('');setBrowse(undefined);setSelected([]);setFeedback('');
    try {
      const queued=await post<Job>('/tasks',{ workspace_id:workspace.id,goal,location,sources,allow_external:true });
      localStorage.setItem(key,queued.run_id);
      setId(queued.run_id);setAllowed(false);
    } catch (problem) {
      setError(problem instanceof ApiError ? taskWarnings[problem.code] ?? problem.message : errorText(problem));
    } finally { setBusy(false); }
  }
  return <section className="intent-composer stack" aria-label="开始任务">
    <div className="section-heading"><h2>今天，想探索什么？</h2><span className="eyebrow">INTENT → ARTIFACT</span></div>
    <form className="stack" aria-busy={busy || working} onSubmit={event=>void submit(event)}>
      <label>你想查什么、完成什么或学会什么？<textarea required rows={3} maxLength={1600} value={goal}
        placeholder="输入问题、研究目标，或粘贴一个网页地址…" onChange={event=>{ setGoal(event.target.value);setLocation(undefined); }}
        disabled={workspace.role==='viewer' || working} /></label>
      {enabled ? <label className="check"><input type="checkbox" required checked={allowed} onChange={event=>setAllowed(event.target.checked)} />
        允许本次使用外部模型和公开检索</label>
        : <div className="button-row"><span>此工作空间需要允许使用外部服务。</span>
          {workspace.role==='owner' && <button type="button" onClick={onSettings}>设置数据权限</button>}</div>}
      <div className="button-row"><button className="primary" disabled={!online || !allowed || !enabled || working || busy || !goal.trim() || workspace.role==='viewer'}>{selected.length ? '基于所选来源生成' : '开始任务'}</button>
        <button type="button" disabled={!online || !allowed || !enabled || working || busy || !goal.trim()} onClick={()=>void search()}>浏览来源</button>
        {onSources && <button type="button" onClick={onSources}>添加文件与资料</button>}
      </div>
      {!online && <p className="muted">离线时可打开已有产物。联网后可以查询或刷新。</p>}
    </form>
    <div className="intent-examples" aria-label="任务示例">{[
      ['找资料','寻找图神经网络入门的权威来源'],['比较分析','比较太阳能与风能的适用条件、成本和限制'],['学习新知识','为零基础学习概率论设计学习路径与练习'],['处理资料','请根据我提供的网页资料整理核心观点与来源'],
    ].map(([label,example])=><button key={label} type="button" disabled={working || workspace.role==='viewer'} onClick={()=>{ setGoal(example!);setLocation(undefined); }}>{label}<span aria-hidden="true"> ↗</span></button>)}</div>
    {browse && <section className="stack" aria-label="网页结果">
      <div className="section-heading"><h2>网页结果</h2>
        <span className="muted">{browse.coverage==='web' ? '网页搜索' : '公开资料目录与链接'}</span></div>
      {browse.results.length ? <ol className="stack">{browse.results.map(item=><li className="detail stack" key={item.url}>
        <strong>{item.title}</strong><small>{item.provider} · {new URL(item.url).hostname}</small>
        {item.excerpt && <p>{item.excerpt}</p>}
        <div className="button-row">
          <ExternalLink url={item.url} label="打开原网页" report={setError} />
          {workspace.role!=='viewer' && <><button onClick={()=>void clip(item)}>收藏</button>
            <label className="check"><input type="checkbox" checked={selected.some(row=>row.url===item.url)}
              onChange={event=>setSelected(rows=>event.target.checked ? [...rows,item] : rows.filter(row=>row.url!==item.url))} />加入选集</label></>}
        </div>
      </li>)}</ol> : <EditorialEmpty asset="search-empty" title="没有返回合适结果。"><p>可换一组关键词或粘贴网页地址。</p></EditorialEmpty>}
      {selected.length>0 && <button disabled={busy} onClick={()=>void saveCollection()}>保存 {selected.length} 个来源为产物</button>}
    </section>}
    {feedback && <p role="status">{feedback}</p>}
    {(busy || working && !task.row) && <p role="status">正在提交请求…</p>}
    {!busy && !browse && task.row && <p role="status">{status(task.row)}</p>}
    {!busy && !browse && Boolean(task.row?.steps?.length) && <details><summary>查看任务计划</summary><ol>{task.row!.steps!.map((step,index)=><li key={index}>{step.goal}</li>)}</ol><small className="muted">计划来自任务服务，各步骤状态以执行结果为准。</small></details>}
    {!busy && !browse && Boolean(task.row?.result?.gaps?.length) && <ul className="task-gap" aria-label="未完成部分">{task.row!.result!.gaps!.map((gap,index)=><li key={index}><strong>{gap.goal}</strong><p>{taskWarnings[gap.code] ?? gap.code}</p></li>)}</ul>}
    {!busy && !browse && task.row?.result?.options?.length ? <ul aria-label="可能的地点">{task.row.result.options.map(option=><li key={option}>
      <button aria-pressed={location===option} onClick={()=>{ setGoal(task.row!.goal);setLocation(option); }}>{option}</button>
    </li>)}</ul> : null}
    {location && <p>已选地点 · {location}</p>}
    {!busy && !browse && task.row?.result?.artifact_id && <div><button className="primary"
      onClick={()=>onOpen(task.row!.result!.artifact_id!)}>打开产物</button></div>}
    {(error || task.error) && <p role="alert">{error || task.error}</p>}
  </section>;
}

export function ForecastActions({ artifact,blockId,enabled,onUpdated }:{
  artifact:ArtifactDetail;blockId:string;enabled:boolean;onUpdated:(value:ArtifactDetail)=>Promise<void>;
}) {
  const [id,setId]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const { row,pending,error:pollError }=useTask(id);
  const result=row?.result?.artifact_id;
  useEffect(()=>{
    if (!result) return;
    const control=new AbortController();
    void api<ArtifactDetail>('/artifacts/'+result,{ signal:control.signal }).then(item=>{
      if (!control.signal.aborted) return onUpdated(item);
    }).catch(problem=>{ if (!control.signal.aborted) setError(errorText(problem)); });
    return ()=>control.abort();
  },[result,id,onUpdated]);
  async function refresh() {
    if (busy || pending || !enabled) return;
    setBusy(true);setError('');
    try {
      const run=await post<Job>('/artifacts/'+artifact.id+'/weather-refresh',{ base_revision_id:artifact.revision.id,block_id:blockId,allow_external:true });
      setId(run.run_id);
    } catch (problem) { setError(errorText(problem)); }
    finally { setBusy(false); }
  }
  return <div className="button-row">
    <button disabled={busy || pending || !enabled} onClick={()=>void refresh()}>刷新预报</button>
    {row && <small role="status">{status(row)}</small>}
    {(error || pollError) && <small role="alert">{error || pollError}</small>}
  </div>;
}

const codeLabel=(code:number|null)=>{
  if (code===null) return '—';
  if (code===0) return '晴';
  if (code===1 || code===2) return '少云到多云';
  if (code===3) return '阴';
  if (code===45 || code===48) return '雾';
  if (code>=95) return '雷雨';
  if (code>=71 && code<=77 || code===85 || code===86) return '雪';
  if (code>=51 && code<=82) return '雨';
  return '—';
};
const unit=(value:number|null,suffix:string)=>value===null ? '—' : value+suffix;
export function WeatherView({ attrs,evidence }: { attrs:unknown;evidence:React.ReactNode }) {
  const parsed=weatherAttrs.safeParse(attrs);
  const [focused,setFocused]=useState('');
  const [time,setTime]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=window.setInterval(()=>setTime(Date.now()),60_000);
    return ()=>window.clearInterval(timer);
  },[]);
  if (!parsed.success) return <p>预报数据不可用。</p>;
  const data=parsed.data;
  const date=data.days.some(day=>day.date===focused) ? focused : data.days[0]!.date;
  const expired=Date.parse(data.expires_at)<=time;
  const hours=data.hours.filter(row=>row.time.startsWith(date));
  const localTime=data.current?.time.replace('T',' ');
  return <section className="stack" aria-label="天气预报">
    <h2>{data.place.name} · 天气预报</h2>
    <p className="muted">{data.place.area} · {data.timezone}</p>
    <p><time dateTime={data.captured_at}>获取于 {new Date(data.captured_at).toLocaleString('zh-CN')}</time>
      {' · '}{expired ? '此快照已超过刷新间隔' : '预报快照'} · 数据由 Open-Meteo 提供，已整理 · CC BY 4.0 · {evidence}</p>
    {data.current && <div className="detail stack" aria-label="当前天气">
      <h3>当前天气 · {localTime}</h3>
      <div className="button-row"><strong>{unit(data.current.temperature,' °C')} · {codeLabel(data.current.code)}</strong>
        <span>体感 {unit(data.current.apparent,' °C')}</span><span>湿度 {unit(data.current.humidity,'%')}</span><span>风速 {unit(data.current.wind,' km/h')}</span></div>
    </div>}
    <div className="table-wrap"><table><caption>逐日预报</caption><thead><tr><th>当地日期</th><th>天气</th><th>最低 / 最高</th><th>最高降水概率</th></tr></thead>
      <tbody>{data.days.map(day=><tr key={day.date}><td>{day.date}</td><td>{codeLabel(day.code)}</td>
        <td>{unit(day.low,' °C')} / {unit(day.high,' °C')}</td><td>{unit(day.precipitation,'%')}</td></tr>)}</tbody>
    </table></div>
    {hours.length>0 && <details><summary>逐小时预报</summary>
      <label>当地日期<select value={date} onChange={event=>setFocused(event.target.value)}>
        {data.days.map(day=><option key={day.date}>{day.date}</option>)}
      </select></label>
      <div className="table-wrap"><table><caption>{date} 小时预报</caption><thead><tr><th>当地时间</th><th>气温</th><th>降水概率</th></tr></thead>
        <tbody>{hours.map((item,index)=><tr key={item.time+index}><td>{item.time.slice(11)}</td>
          <td>{unit(item.temperature,' °C')}</td><td>{unit(item.precipitation,'%')}</td></tr>)}</tbody>
      </table></div>
    </details>}
  </section>;
}
