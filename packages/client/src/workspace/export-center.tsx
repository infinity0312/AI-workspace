import { useEffect, useState, type FormEvent } from 'react';
import { isProjectionType,type ArtifactRevision } from '@akw/contracts';
import { api,errorText,post,workspaceApi,type ArtifactSummary,type ExportJob,type Job } from '../lib/api';
import { readFileBase64 } from '../lib/files';
import { DownloadLink } from './native-actions';
import { projectionLabels } from './projection-views';
import { statusLabel } from './workflow-status';

function ArchiveRestore({ report, onRestored }: { report:(message:string)=>void; onRestored: (id: string) => Promise<void> }) {
  const [file,setFile] = useState<File | null>(null);
  const [inspection,setInspection] = useState<{ checksum:string; name:string; counts:Record<string,number>; excluded_assets:number; excluded_passages:number } | null>(null);
  const [name,setName] = useState('');
  const [busy,setBusy] = useState(false);
  async function restore(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('归档超过 8 MiB 导入上限。');
      const data_base64 = await readFileBase64(file);
      if (!inspection) {
        const result = await post<{ checksum:string; name:string; counts:Record<string,number>; excluded_assets:number; excluded_passages:number }>('/imports/dry-run',{ data_base64 });
        setInspection(result);
        setName(result.name);
      } else {
        const result = await post<{ id:string }>('/imports',{ data_base64,confirm_checksum:inspection.checksum,name });
        await onRestored(result.id);
      }
    } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  return <form className="panel stack" onSubmit={event => void restore(event)}>
    <h2>恢复工作空间</h2>
    <label>Workspace ZIP<input type="file" required accept=".zip" onChange={event => {
      setFile(event.target.files?.[0] ?? null); setInspection(null);
    }} /></label>
    {inspection && <>
      <p>校验通过。包含 {inspection.counts.artifacts ?? 0} 篇文档、{inspection.counts.sources ?? 0} 个来源和 {inspection.counts.evidence ?? 0} 条证据。</p>
      {Boolean(inspection.excluded_assets || inspection.excluded_passages) && <p className="muted">归档省略了 {inspection.excluded_assets} 个附件和 {inspection.excluded_passages} 个原文段落。</p>}
      <label>新工作空间名称<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
    </>}
    <div><button disabled={busy || !file}>{inspection ? '确认恢复到新工作空间' : '预检归档'}</button></div>
  </form>;
}

export function ExportCenter({ ws, artifacts, initial, report, onRestored }: { report:(message:string)=>void; ws: string; artifacts: ArtifactSummary[]; initial?: string; onRestored: (id: string) => Promise<void> }) {
  const [jobs,setJobs] = useState<ExportJob[]>([]);
  const [artifact,setArtifact] = useState(initial ?? '');
  const [format,setFormat] = useState(initial ? 'markdown' : 'zip');
  const [includeImages,setIncludeImages] = useState(true);
  const [includeReferences,setIncludeReferences] = useState(true);
  const [revision,setRevision] = useState('');
  const [block,setBlock] = useState('');
  const [history,setHistory] = useState<{ artifact:string;items:ArtifactRevision[] }>();
  const revisions = history?.artifact === artifact ? history.items : [];
  const selectedRevision = revision ? revisions.find(item => item.id === revision) : revisions[0];
  const visual = format === 'svg' || format === 'png';
  const diagrams = selectedRevision?.content_json.blocks.filter(item => item.type === 'chart' || isProjectionType(item.type)) ?? [];
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    if (!artifact) return;
    const controller = new AbortController();
    void api<ArtifactRevision[]>('/artifacts/'+artifact+'/revisions',{ signal:controller.signal }).then(items => {
      if (!controller.signal.aborted) setHistory({ artifact,items });
    }).catch(error => { if (!controller.signal.aborted) report(errorText(error)); });
    return () => controller.abort();
  },[artifact,report]);
  useEffect(() => {
    let mounted = true;
    const refresh = () => void workspaceApi.exports(ws).then(value => { if (mounted) setJobs(value); }).catch(error => { if (mounted && navigator.onLine) report(errorText(error)); });
    refresh();
    const interval = window.setInterval(refresh,2500);
    return () => { mounted = false; window.clearInterval(interval); };
  },[ws,report]);
  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await post<Job>('/exports',{ workspace_id:ws,format,...(format === 'zip' ? {} : { artifact_id:artifact,
        revision_id:revision || (visual ? selectedRevision?.id : undefined),block_id:visual ? block || diagrams[0]?.id : undefined,
        include_images:['docx','pdf'].includes(format) ? includeImages : undefined,
        include_references:['markdown','docx','pdf'].includes(format) ? includeReferences : undefined }) });
      setJobs(await workspaceApi.exports(ws));
    } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  return <div className="workflow">
    <header className="page-heading"><h1>导出</h1><p>导出单篇文档或工作空间归档。</p></header>
    <form className="panel stack" onSubmit={event => void start(event)}>
      <div className="field-grid"><label>文件格式<select value={format} onChange={event => setFormat(event.target.value)}>
        <option value="zip">Workspace ZIP</option><option value="markdown">Markdown</option><option value="json">JSON</option><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="svg">视图 SVG</option><option value="png">视图 PNG</option>
      </select></label>
      {format !== 'zip' && <label>文档<select required value={artifact} onChange={event => { setArtifact(event.target.value); setRevision(''); setBlock(''); }}>
        <option value="">选择文档</option>{artifacts.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
      </select></label>}</div>
      {format !== 'zip' && artifact && <label>文档版本<select value={revision} onChange={event => { setRevision(event.target.value); setBlock(''); }}>
        <option value="">最新已同步版本</option>{revisions.map(item => <option value={item.id} key={item.id}>版本 {item.revision_number} · {new Date(item.created_at).toLocaleString('zh-CN')}</option>)}
      </select></label>}
      {['markdown','docx','pdf'].includes(format) && <label className="check"><input type="checkbox" checked={includeReferences} onChange={event => setIncludeReferences(event.target.checked)} />保留证据与来源引用</label>}
      {['docx','pdf'].includes(format) && <label className="check"><input type="checkbox" checked={includeImages} onChange={event => setIncludeImages(event.target.checked)} />嵌入允许导出的图片</label>}
      {visual && artifact && (diagrams.length ? <label>要导出的视图<select value={block || diagrams[0]?.id} onChange={event => setBlock(event.target.value)}>
        {diagrams.map((item,index) => <option key={item.id} value={item.id}>{String(item.attrs?.title || projectionLabels[item.type as keyof typeof projectionLabels] || '科学图表')} ({index+1})</option>)}
      </select></label> : <p className="muted">此版本中尚无可导出的视图块。可先在正文中添加并保存。</p>)}
      <div><button className="primary" disabled={busy || (visual && !diagrams.length)}>开始导出</button></div>
    </form>
    <ArchiveRestore report={report} onRestored={onRestored} />
    <div className="panel stack"><h2>导出记录</h2>{!jobs.length && <p className="muted">还没有导出记录。</p>}
      {jobs.map(job => <div className="list-item" key={job.id}>
        <span>{job.result?.filename ?? new Date(job.updated_at).toLocaleString('zh-CN')}</span><span>{statusLabel(job.status)}</span>
        {job.result?.download_url && <DownloadLink path={job.result.download_url} label="下载" report={report} />}
        {job.result?.warning && <span>{job.result.warning}</span>}
      </div>)}
    </div>
  </div>;
}
