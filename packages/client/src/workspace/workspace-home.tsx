import {AtlasArt} from './atlas-art';
import {ActiveFilterTokens,EmptyFilterResult,FacetBar,FacetPopover,PrimarySearch,ResultSummary} from './explorer-controls';
import { useEffect,useState } from 'react';
import type { WorkspaceSummary,RunSummary } from '@akw/contracts';
import { api,errorText,type WorkspaceView } from '../lib/api';
import { statusLabel } from './workflow-status';
import { TaskStart } from './task-experience';
import { UIIcon } from './ui-icon';
import { workspaceBrand } from './workspace-brand';
import { EditorialImage,EditorialEmpty } from './editorial-image';

export function WorkspaceHome({ workspace,view,online,onOpen,onSettings,onProjects,onSources,onActivity,children }:{
  workspace:WorkspaceSummary;view:WorkspaceView;online:boolean;onOpen:(id:string)=>void;onSettings:()=>void;
  onProjects:()=>void;onSources:()=>void;onActivity:()=>void;children:React.ReactNode;
}) {
  const [specimen,setSpecimen]=useState(()=>{try{return localStorage.getItem('akw-home-art')==='folio'?'compass':'botanical';}catch{return 'botanical';}});
  const first=view.artifacts[0],rest=view.artifacts.slice(1,6);
  const projectName=(id:string|null)=>view.projects.find(project=>project.id===id)?.name??'空间共享';
  return <div className="workflow atelier-home atlas-home">
    <div className="home-dateline"><span>{workspaceBrand.name}</span><h2 className="atlas-workspace-name">{workspace.name}</h2><time>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</time></div>
    <div className="home-introduction atlas-home-intro"><header className="home-heading"><p className="eyebrow">A LIVING ATLAS OF KNOWLEDGE</p><h1>让一个问题，成为一部持续生长的研究图录。</h1><p className="muted">研究、阅读、比较与制作。把理解编入同一条可以继续、可以返回的脉络。</p></header>
      <figure className="atlas-home-specimen"><AtlasArt key={specimen} asset={specimen==='botanical'?'aa_learning_botanical_01':'aa_home_compass_01'} priority/><figcaption><span>PLATE / 01<br/>知识探索 · 概念插画</span><button onClick={()=>{const next=specimen==='botanical'?'compass':'botanical';setSpecimen(next);try{localStorage.setItem('akw-home-art',next==='compass'?'folio':'atlas');}catch{/* Optional device preference. */}}}>切换概念标本</button></figcaption></figure>
      <aside className="atlas-home-margin"><span>WORKSPACE / 01</span>{first?<><p className="eyebrow">RECENT ARTIFACT</p><button aria-label={'继续最近成果：'+first.title} onClick={()=>onOpen(first.id)}>{first.title}</button></>:<p>从一个问题出发，<br/>留下可以返回的来处。</p>}<dl><div><dt>成果</dt><dd>{view.artifacts.length}</dd></div><div><dt>项目</dt><dd>{view.projects.length}</dd></div></dl></aside>
    </div>
    <TaskStart key={workspace.id} workspace={workspace} online={online} onOpen={onOpen} onSettings={onSettings} onSources={onSources}/>
    <section className="recent-work" aria-label="最近工作"><div className="section-heading"><div><p className="eyebrow">YOUR WORK, CONTINUED</p><h2>值得继续的工作</h2></div><button onClick={onProjects}>全部项目 <UIIcon name="arrow"/></button></div>
      {first?<><article className="atlas-featured-work"><span className="archive-number">01</span><div><small>{projectName(first.project_id)} · {first.kind==='note'?'知识笔记':'研究文档'}</small><button onClick={()=>onOpen(first.id)}><h3>{first.title}</h3></button><button className="atlas-continue" onClick={()=>onOpen(first.id)}>继续阅读与编辑 <UIIcon name="arrow"/></button></div><AtlasArt asset="aa_graph_mineral_01"/></article>
      {rest.length>0&&<ol className="archive-list atlas-secondary-work">{rest.map((item,index)=><li key={item.id}><span className="archive-number">{String(index+2).padStart(2,'0')}</span><button onClick={()=>onOpen(item.id)}><strong>{item.title}</strong><small>{projectName(item.project_id)} · {item.kind==='note'?'知识笔记':'文档'}</small></button><UIIcon name="arrow"/></li>)}</ol>}</>:<div className="editorial-empty atlas-first-work"><AtlasArt asset="aa_document_notebook_01"/><div><h3>这里将留下你的探索</h3><p className="muted">提交第一个任务，或添加手边资料，开始积累可继续使用的知识。</p><button onClick={onSources}>添加资料 <UIIcon name="arrow"/></button></div></div>}
    </section><div className="home-footer"><span>每一个成果，都有来处。</span><button onClick={onActivity}>查看任务活动 <UIIcon name="activity"/></button></div>{children}
  </div>;
}

export function ProjectsPage({ view,onOpen,onCreate }:{ view:WorkspaceView;onOpen:(id:string)=>void;onCreate:()=>void }) {
  const [selected,setSelected]=useState('');
  const [cover,setCover]=useState('');
  useEffect(()=>{try {setCover(localStorage.getItem('akw-project-cover:'+selected) ?? '');}catch {setCover('');}},[selected]);
  const project=view.projects.find(item=>item.id===selected);
  const documents=view.artifacts.filter(item=>!selected || (selected==='shared' ? !item.project_id : item.project_id===selected));
  return <div className="workflow"><header className="page-heading atlas-page-heading"><div><p className="eyebrow">PROJECT ARCHIVE</p><h1>项目</h1><p>把资料与成果，留在同一个研究范围里。</p></div><figure><AtlasArt asset="aa_home_atlas_fragment_01"/><figcaption>概念插画</figcaption></figure></header>
    <div className="project-index" role="group" aria-label="项目筛选"><button aria-pressed={!selected} onClick={()=>setSelected('')}>全部项目</button><button aria-pressed={selected==='shared'} onClick={()=>setSelected('shared')}>空间共享</button>{view.projects.map((item,index)=><button key={item.id} aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><span className="archive-number">{String(index+1).padStart(2,'0')}</span>{item.name}</button>)}</div>
    {project && <div className="project-cover-controls"><label>此设备的项目封面<select value={cover} onChange={event=>{setCover(event.target.value);try {localStorage.setItem('akw-project-cover:'+selected,event.target.value);}catch{/* Device decoration does not change project data. */} }}><option value="">中性档案</option><option value="project-mineral">矿物与材料 · 概念艺术</option><option value="project-discrete">离散结构 · 概念艺术</option></select></label>{cover && <figure className="project-cover"><EditorialImage key={cover} asset={cover} alt={project.name+'的本机概念封面'} /><figcaption>概念艺术，不是实验数据；封面选择仅保存在此设备。</figcaption></figure>}</div>}
    <details className="project-art-library"><summary>项目主题封面素材库</summary><p className="muted">选择项目后，可在此设备更换封面。新主题保留中性背景，不随机套用其他项目主题。</p><div>{[['project-mineral','矿物与材料'],['project-discrete','离散结构']].map(([asset,title])=><figure key={asset}><EditorialImage asset={asset!} /><figcaption>{title} · 概念艺术</figcaption></figure>)}</div></details>
    <section className="stack"><div className="section-heading"><h2>{project?.name ?? (selected==='shared' ? '空间共享' : '全部成果')}</h2><button onClick={onCreate}><UIIcon name="plus" /> 新建项目或文档</button></div>{project?.description && <p>{project.description}</p>}
      {documents.length ? <ol className="archive-list">{documents.map((item,index)=><li key={item.id}><span className="archive-number">{String(index+1).padStart(2,'0')}</span><button onClick={()=>onOpen(item.id)}><strong>{item.title}</strong><small>{item.kind==='note' ? '知识笔记' : '文档'}</small></button><UIIcon name="arrow" /></li>)}</ol> : <div className="editorial-empty"><p>还没有成果。从工作台创建文档或开始研究。</p><button onClick={onCreate}>开始创建</button></div>}
    </section></div>;
}

type ActivityRun = RunSummary;
export function ActivityPage({ workspace,online,onOpen,onResearch }:{ workspace:string;online:boolean;onOpen:(id:string)=>void;onResearch:()=>void }) {
  const [rows,setRows]=useState<ActivityRun[]>([]);
  const [search,setSearch]=useState(''),[states,setStates]=useState<string[]>([]),[after,setAfter]=useState(''),[before,setBefore]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [epoch,setEpoch]=useState(0);
  useEffect(()=>{
    const abort=new AbortController();let busy=false;
    const load=async()=>{
      if (busy || !online) { if (!online) setLoading(false);return; }busy=true;
      try {
        const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]);
        const data=await api<ActivityRun[]>('/research-runs?workspace_id='+encodeURIComponent(workspace),{ signal });
        const last=localStorage.getItem('akw-task:'+workspace);
        if(last && !data.some(item=>item.id===last)) {
          try { data.unshift(await api<ActivityRun>('/tasks/'+last,{ signal })); }
          catch(problem) { if(abort.signal.aborted) throw problem; /* A deleted task does not hide other research activity. */ }
        }
        if (!abort.signal.aborted) { setRows(data);setError(''); }
      }
      catch(problem) { if (!abort.signal.aborted) setError(errorText(problem)); }
      finally { busy=false;if (!abort.signal.aborted) setLoading(false); }
    };
    void load();const timer=window.setInterval(()=>void load(),5000);
    return()=>{ abort.abort();window.clearInterval(timer); };
  },[workspace,online,epoch]);
  const order=(item:ActivityRun)=>['QUEUED','RUNNING','WAITING_INPUT','PARTIAL','FAILED'].includes(item.status) ? 0 : 1;
  return <div className="workflow"><header className="page-heading"><p className="eyebrow">WORK IN PROGRESS</p><h1>活动</h1><p>跟进正在进行的探索，继续未完成的工作。</p></header>
    {!online && <div role="status"><EditorialEmpty asset="offline-preserved" title="当前离线"><p>联网后刷新任务活动。已缓存的文档仍可从导航打开。</p></EditorialEmpty></div>}
    {loading && <p role="status">正在读取任务活动…</p>}{error && <div role="alert"><EditorialEmpty asset="error-recovery" title="连接暂时中断"><p>{error}</p><button onClick={()=>setEpoch(value=>value+1)}>重新加载</button></EditorialEmpty></div>}
    {!loading && !error && !rows.length && <div className="editorial-empty"><UIIcon name="activity" /><div><h2>一切从一次探索开始</h2><p className="muted">任务提交后，会在这里留下真实的执行记录。</p><button onClick={onResearch}>开始研究</button></div></div>}
    <div className="stack"><PrimarySearch label="搜索活动" value={search} onChange={setSearch}/><FacetBar><FacetPopover label="执行状态" values={states} onChange={setStates} options={[...new Set(rows.map(item=>item.status))].map(value=>({value,label:statusLabel(value),count:rows.filter(item=>item.status===value).length}))}/><div className="date-range"><label>从<input type="date" value={after} onChange={event=>setAfter(event.target.value)}/></label><label>至<input type="date" value={before} onChange={event=>setBefore(event.target.value)}/></label></div></FacetBar><ActiveFilterTokens tokens={[...(search?[{key:'q',label:'搜索：'+search,remove:()=>setSearch('')}]:[]),...states.map(value=>({key:value,label:statusLabel(value),remove:()=>setStates(states.filter(item=>item!==value))})),...(after||before?[{key:'date',label:(after||'最早')+' → '+(before||'最近'),remove:()=>{setAfter('');setBefore('');}}]:[])]} onClear={()=>{setSearch('');setStates([]);setAfter('');setBefore('');}}/><ResultSummary>{rows.length} 项真实任务记录</ResultSummary></div>
    {rows.length>0&&!rows.some(item=>(!states.length||states.includes(item.status))&&item.goal.toLocaleLowerCase().includes(search.toLocaleLowerCase())&&(!after||item.updated_at.slice(0,10)>=after)&&(!before||item.updated_at.slice(0,10)<=before))&&<EmptyFilterResult empty={false} subject="活动" onClear={()=>{setSearch('');setStates([]);setAfter('');setBefore('');}}/>}
    <ol className="activity-list">{[...rows].filter(item=>(!states.length||states.includes(item.status))&&item.goal.toLocaleLowerCase().includes(search.toLocaleLowerCase())&&(!after||item.updated_at.slice(0,10)>=after)&&(!before||item.updated_at.slice(0,10)<=before)).sort((a,b)=>order(a)-order(b)).map(item=><li key={item.id} data-status={item.status}><div className="section-heading"><span className="status-label">{statusLabel(item.status)}</span><time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleString('zh-CN')}</time></div><h2>{item.goal}</h2>{item.result?.warning && <p>提示：{item.result.warning}</p>}<div className="button-row">{item.result?.artifact_id && <button onClick={()=>onOpen(item.result!.artifact_id!)}>打开已保存产物</button>}<button onClick={onResearch}>查看研究与恢复入口</button></div></li>)}</ol>
  </div>;
}
