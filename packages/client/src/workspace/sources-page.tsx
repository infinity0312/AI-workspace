import { useEffect, useState, type FormEvent } from 'react';
import { assetMimeForName,type RunSummary } from '@akw/contracts';
import { getPlatform,type NativeFile } from '../lib/platform';
import { readFileBase64 } from '../lib/files';
import { api,errorText,post,type Job,type Project,type Source,type SourceDetail } from '../lib/api';
import { lifecycleLabel } from './library-pages';
import { DownloadLink,ExternalLink,NativeImportQueue,sourcePageLabel,supportedFileTypes } from './native-actions';
import { SourceManagement } from './source-management';
import { activeRun,statusLabel } from './workflow-status';

type DesktopSources = { files: NativeFile[]; skipped: number; pick: (directory: boolean) => void; remove: (id: string) => void };
export function Sources({ ws, projects, sources, refresh, report, desktop, capture, initialSource, openArtifact, openClaimDraft, editable }: { report:(message:string)=>void;
  ws: string; projects: Project[]; sources: Source[]; refresh: () => Promise<void>;
  desktop?: DesktopSources; capture: { text: string; id: number } | null; initialSource?:string;
  openArtifact:(id:string)=>void; openClaimDraft:(evidence:{ id:string; quote:string })=>void; editable:boolean;
}) {
  const [type,setType] = useState('text');
  const [title,setTitle] = useState('');
  const [value,setValue] = useState('');
  const [project,setProject] = useState('');
  const [file,setFile] = useState<File | null>(null);
  const [rights,setRights] = useState('unknown');
  const [detail,setDetail] = useState<SourceDetail | null>(null);
  const [sourceFilter,setSourceFilter] = useState('');
  const [listMode,setListMode] = useState('active');
  const [pending,setPending] = useState<Job[]>([]);
  const [busy,setBusy] = useState(false);
  const clipboard = getPlatform().clipboard;
  const currentSource = detail?.id;
  const currentVersion = detail?.version;
  const listedVersion = sources.find(item => item.id === currentSource)?.version;
  useEffect(() => {
    if (!currentSource || listedVersion === undefined || listedVersion <= (currentVersion ?? 0)) return;
    let mounted = true;
    void api<SourceDetail>('/sources/' + currentSource).then(value => {
      if (mounted) setDetail(before => before?.id === value.id ? value : before);
    }).catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[currentSource,currentVersion,listedVersion,report]);
  useEffect(() => {
    if (!initialSource) return;
    let mounted = true;
    void api<SourceDetail>('/sources/' + initialSource).then(value => { if (mounted) setDetail(value); })
      .catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[initialSource,report]);
  useEffect(() => {
    if (capture) { setType('text'); setValue(capture.text.slice(0,200000)); }
  },[capture]);
  useEffect(() => {
    if (!pending.length) return;
    let mounted = true;
    let polling = false;
    const check = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await Promise.allSettled(pending.map(job => api<RunSummary>(job.status_url.replace('/v1',''))));
        if (!mounted) return;
        const finished = result.flatMap(item => item.status === 'fulfilled' && !activeRun(item.value.status) ? [item.value] : []);
        if (!finished.length) return;
        const done = new Set(finished.map(item => item.id));
        setPending(previous => previous.filter(job => !done.has(job.run_id)));
        const failed = finished.find(item => item.status !== 'COMPLETED');
        if (failed) report(failed.result?.warning ?? statusLabel(failed.status));
        await refresh();
      } catch (error) { if (mounted) report(errorText(error)); }
      finally { polling = false; }
    };
    const timer = window.setInterval(() => void check(),1800);
    return () => { mounted = false; window.clearInterval(timer); };
  },[pending,refresh,report]);
  function appendJobs(jobs: Job[]) { if (jobs.length) setPending(previous => [...previous,...jobs]); }
  async function paste() {
    if (!clipboard) return;
    try { setValue((await clipboard.read()).slice(0,200000)); } catch (error) { report(errorText(error)); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      let input: Record<string,unknown> = { workspace_id:ws,project_id:project || null,title,sensitivity:'personal' };
      if (type === 'file') {
        if (!file || file.size > 8 * 1024 * 1024) throw new Error('请选择不超过 8 MiB 的文件。');
        const mime = assetMimeForName(file.name);
        if (!mime) throw new Error('不支持的文件类型');
        const asset = await post<{ id: string }>('/assets',{ workspace_id:ws,name:file.name,mime,data_base64:await readFileBase64(file) });
        input = { ...input,asset_id:asset.id,rights };
      } else if (type === 'text') input = { ...input,text:value,rights };
      else input = { ...input,url:value,rights,sensitivity:'public' };
      const item = await post<Source>('/sources',input);
      if (item.status !== 'parsed') appendJobs([await post<Job>('/sources/' + item.id + '/ingest')]);
      setTitle(''); setValue(''); setFile(null);
      await refresh();
    } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  async function open(id: string) {
    try { setDetail(await api<SourceDetail>('/sources/' + id)); } catch (error) { report(errorText(error)); }
  }
  return <div className="workflow">
    <header className="page-heading"><h1>来源</h1><p>导入资料，查看解析质量与原文段落。</p></header>
    {editable && desktop && <NativeImportQueue workspace={ws} projects={projects} files={desktop.files} skipped={desktop.skipped}
      select={desktop.pick} remove={desktop.remove} refresh={refresh} report={report} onQueued={appendJobs} />}
    {editable && <form className="panel stack" onSubmit={event => void create(event)}>
      <div className="field-grid">
        <label>来源类型<select value={type} onChange={event => setType(event.target.value)}>
          <option value="text">粘贴正文</option><option value="url">公开网页</option>{!desktop && <option value="file">上传文件</option>}
        </select></label>
        <label>关联项目<select value={project} onChange={event => setProject(event.target.value)}><option value="">工作空间共享</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <label>标题<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
      {type === 'file' ? <label>资料文件<input required type="file" accept={supportedFileTypes} onChange={event => {
        const selected = event.target.files?.[0] ?? null;
        setFile(selected);
        if (selected && !title) setTitle(selected.name);
      }} /></label> : type === 'url' ? <label>公开链接<input required type="url" value={value} onChange={event => setValue(event.target.value)} /></label>
        : <><label>正文<textarea required maxLength={200000} value={value} onChange={event => setValue(event.target.value)} /></label>
          {desktop && clipboard && <div><button type="button" onClick={() => void paste()}>粘贴剪贴板</button></div>}</>}
      <label>资料权利<select value={rights} onChange={event => setRights(event.target.value)}><option value="unknown">未确认</option><option value="user_owned">本人拥有内容</option><option value="public_license">公开许可</option><option value="restricted">限制再分发</option></select></label>
      <div className="button-row"><button className="primary" disabled={busy}>添加来源</button>{pending.length > 0 && <span role="status">后台解析 {pending.length} 项</span>}</div>
    </form>}
    <div className="panel stack"><h2>来源列表</h2>
      <div className="field-grid"><label>筛选来源<input value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} /></label>
      <label>来源范围<select value={listMode} onChange={event => setListMode(event.target.value)}><option value="active">使用中</option><option value="archived">已归档</option><option value="all">全部</option></select></label></div>
      {!sources.length && <p className="muted">还没有来源。</p>}
      {sources.filter(item => (listMode === 'all' || (listMode === 'archived') === (item.lifecycle === 'archived')) &&
        item.title.toLocaleLowerCase().includes(sourceFilter.toLocaleLowerCase().trim())).map(item =>
        <div key={item.id} className="list-item"><button onClick={() => void open(item.id)}>{item.title}</button>
          <span>{item.lifecycle === 'active' ? statusLabel(item.status) : lifecycleLabel(item.lifecycle)}</span></div>)}
      {detail && <div className="detail stack">
        <div className="section-heading"><h3>{detail.title}</h3><button onClick={() => setDetail(null)}>关闭</button></div>
        <div className="button-row">
          {detail.canonical_url && <ExternalLink url={detail.canonical_url} label="打开来源" report={report} />}
          {detail.asset_id && <DownloadLink path={'/v1/assets/' + detail.asset_id + '/download'} label="下载原文件" report={report} />}
          {editable && detail.status !== 'parsed' && !['archived','retracted'].includes(detail.lifecycle) && <button onClick={() => {
            void post<Job>('/sources/' + detail.id + '/ingest').then(job => appendJobs([job])).catch(error => report(errorText(error)));
          }}>运行解析</button>}
        </div>
        <SourceManagement key={detail.id} source={detail} editable={editable} openArtifact={openArtifact}
          refresh={async () => { await open(detail.id); await refresh(); }} queue={appendJobs} report={report} />
        {detail.documents.map(doc => <div key={doc.id}><p className="muted">{doc.parser_version} · {doc.quality_report.passage_count} 个段落</p>
          {doc.quality_report.warnings.map(warning => <p key={warning} className="muted">{warning}</p>)}</div>)}
        {detail.passages.slice(0,20).map(p => <details key={p.id}>
          <summary>{sourcePageLabel(p.page,detail.documents.find(doc => doc.id === p.document_id)?.parser_version)}段落 {p.ordinal+1}</summary>
          <p className="excerpt">{p.content}</p>
          {editable && p.content.trim() && <button disabled={busy} onClick={() => {
            setBusy(true);
            void post<{ id:string; quote:string }>('/sources/' + detail.id + '/evidence',{ passage_id:p.id,start_utf16:0,end_utf16:p.content.length })
              .then(openClaimDraft).catch(error => report(errorText(error))).finally(() => setBusy(false));
          }}>引用此段并提议结论</button>}
        </details>)}
      </div>}
    </div>
  </div>;
}
