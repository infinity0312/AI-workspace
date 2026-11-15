import { useEffect, useState, type FormEvent } from 'react';
import { assetMimeForName, fileExtensions, type ArtifactDetail, type ArtifactRevision, type CaptureAction, type CaptureItem, type ClaimReview } from '@akw/contracts';
import { api, errorText, post, type ArtifactSummary, type Project } from '../lib/api';
import { readFileBase64 } from '../lib/files';
import { ExternalLink } from './native-actions';

const scope = (ws: string) => '?workspace_id=' + encodeURIComponent(ws);
export const lifecycleLabel = (status: string) => ({
  active:'正常',updated:'内容有更新',inaccessible:'无法访问',retracted:'已撤回',archived:'已归档',
} as Record<string,string>)[status] ?? status;
const claimLabel = (status: string) => ({
  proposed:'待复核',needs_review:'需要重新复核',supported:'支持',partially_supported:'部分支持',disputed:'有争议',
  unsupported:'缺乏支持',outdated:'过时',retracted:'已撤回',
} as Record<string,string>)[status] ?? status;

type CaptureProps = {
  workspace:string; projects:Project[]; capture:{ text:string; id:number }|null; editable:boolean;
  refresh:()=>Promise<void>; openArtifact:(id:string)=>void; openSource:(id:string)=>void; report:(message:string)=>void;
};
export function CaptureInbox({ workspace,projects,capture,editable,refresh,openArtifact,openSource,report }: CaptureProps) {
  const [items,setItems] = useState<CaptureItem[]>([]);
  const [filter,setFilter] = useState<CaptureItem['status']>('inbox');
  const [kind,setKind] = useState('text');
  const [value,setValue] = useState('');
  const [project,setProject] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    void api<CaptureItem[]>('/capture-items' + scope(workspace)).then(data => { if (mounted) setItems(data); })
      .catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[workspace,report]);
  useEffect(() => {
    if (capture) { setKind('text'); setValue(capture.text.slice(0,200000)); }
  },[capture]);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      let fields: Record<string,unknown> = kind === 'url' ? { url:value } : { text:value };
      if (kind === 'file') {
        const file = data.get('file');
        if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024) throw new Error('请选择不超过 8 MiB 的资料。');
        const mime = assetMimeForName(file.name);
        if (!mime) throw new Error('文件类型暂不支持。');
        const asset = await post<{ id:string }>('/assets',{
          workspace_id:workspace,name:file.name,mime,data_base64:await readFileBase64(file),visibility:'capture',
        });
        fields = { asset_id:asset.id };
      }
      const item = await post<CaptureItem>('/capture-items',{
        workspace_id:workspace,title:data.get('title'),rights:data.get('rights'),sensitivity:data.get('sensitivity'),...fields,
      });
      setItems(before => [item,...before.filter(existing => existing.id !== item.id)]);
      setFilter('inbox'); setValue(''); form.reset();
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  async function act(item: CaptureItem,action: CaptureAction['action']) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await post<CaptureItem>('/capture-items/' + item.id + '/process',{ action,project_id:project || null });
      setItems(before => before.map(existing => existing.id === updated.id ? updated : existing));
      if (updated.result_id && updated.result_kind === 'source') {
        const target = await api<{ status:string }>('/sources/' + updated.result_id);
        if (target.status !== 'parsed') await post('/sources/' + updated.result_id + '/ingest');
      }
      await refresh();
      if (action === 'note' || action === 'source') report(action === 'note' ? '已转为知识笔记。' : '已加入来源库。');
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="workflow">
    <header className="page-heading"><h1>资料收件箱</h1><p>先保存资料，再决定归入哪个项目。</p></header>
    {editable && <form className="panel stack" onSubmit={event => void add(event)}>
      <div className="field-grid">
        <label>资料标题<input name="title" maxLength={200} required /></label>
        <label>资料类型<select value={kind} onChange={event => setKind(event.target.value)}><option value="text">文本</option><option value="url">链接</option><option value="file">文件</option></select></label>
      </div>
      {kind === 'file' ? <label>选择资料<input name="file" type="file" accept={fileExtensions} required /></label>
        : kind === 'url' ? <label>资料链接<input type="url" value={value} onChange={event => setValue(event.target.value)} required /></label>
          : <label>资料正文<textarea value={value} onChange={event => setValue(event.target.value)} maxLength={200000} required /></label>}
      <div className="field-grid">
        <label>资料权利<select name="rights"><option value="unknown">未确认</option><option value="user_owned">本人拥有</option><option value="public_license">公开许可</option><option value="restricted">限制分发</option></select></label>
        <label>敏感级别<select name="sensitivity" defaultValue="personal"><option value="public">公开</option><option value="personal">个人</option><option value="sensitive">敏感</option><option value="restricted">受限</option></select></label>
      </div>
      <div><button className="primary" disabled={busy}>保存到收件箱</button></div>
    </form>}
    <section className="panel stack">
      <div className="field-grid"><label>收件箱状态<select value={filter} onChange={event => setFilter(event.target.value as CaptureItem['status'])}>
        <option value="inbox">待整理</option><option value="processed">已处理</option><option value="dismissed">暂时移开</option>
      </select></label>
      {filter === 'inbox' && editable && <label>整理到项目<select value={project} onChange={event => setProject(event.target.value)}><option value="">工作空间共享</option>{projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}</div>
      {items.filter(item => item.status === filter).map(item => <article className="detail stack" key={item.id}>
        <h2>{item.title}</h2>
        {item.url && <ExternalLink url={item.url} label="打开链接" report={report} />}
        {item.text_body && <p className="excerpt">{item.text_body.slice(0,500)}</p>}
        <div className="button-row">
          {item.status === 'inbox' && editable && <>
            {!item.asset_id && <button disabled={busy} onClick={() => void act(item,'note')}>转为知识笔记</button>}
            <button disabled={busy} onClick={() => void act(item,'source')}>加入来源库</button>
            <button disabled={busy} onClick={() => void act(item,'dismiss')}>暂时移开</button>
          </>}
          {item.status === 'dismissed' && editable && <button disabled={busy} onClick={() => void act(item,'reopen')}>放回收件箱</button>}
          {item.result_id && <button onClick={() => item.result_kind === 'note' ? openArtifact(item.result_id!) : openSource(item.result_id!)}>打开整理结果</button>}
        </div>
      </article>)}
      {!items.some(item => item.status === filter) && <p className="muted">这里暂时没有资料。</p>}
    </section>
  </div>;
}

type MaintenanceResponse = {
  claims: { id:string; statement:string; status:string; version:number; evidence_count:number }[];
  sources: { id:string; title:string; lifecycle:string }[];
  pending_edges:number;
};
export function Maintenance({ workspace,editable,initialClaim,claimEvidence,openSource,openEvidence,openKnowledge,report }: {
  workspace:string; editable:boolean; initialClaim?:string; claimEvidence?:{ id:string; quote:string }; openSource:(id:string)=>void; openEvidence:(id:string)=>void; openKnowledge:()=>void;
  report:(message:string)=>void;
}) {
  const [summary,setSummary] = useState<MaintenanceResponse>();
  const [claim,setClaim] = useState<ClaimReview>();
  const [filter,setFilter] = useState('pending');
  const [draft,setDraft] = useState(claimEvidence);
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    void api<MaintenanceResponse>('/knowledge/maintenance' + scope(workspace)).then(result => { if (mounted) setSummary(result); })
      .catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[workspace,report]);
  useEffect(() => {
    if (!initialClaim) return;
    const controller = new AbortController();
    void api<ClaimReview>('/knowledge/claims/' + initialClaim,{ signal:controller.signal }).then(setClaim)
      .catch(error => { if (!controller.signal.aborted) report(errorText(error)); });
    return () => controller.abort();
  },[initialClaim,report]);
  async function open(id:string) {
    try { setClaim(await api<ClaimReview>('/knowledge/claims/' + id)); }
    catch (error) { report(errorText(error)); }
  }
  async function review(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claim || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await post('/knowledge/claims/' + claim.id + '/review',{ decision:data.get('decision'),reason:data.get('reason'),version:claim.version });
      await open(claim.id);
      setSummary(await api<MaintenanceResponse>('/knowledge/maintenance' + scope(workspace)));
      form.reset();
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  async function createClaim(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const row = await post<{ id:string }>('/knowledge/claims',{
        workspace_id:workspace,statement:fields.get('statement'),scope:fields.get('scope'),evidence_ids:[draft.id],
      });
      setDraft(undefined);
      await open(row.id);
      setSummary(await api<MaintenanceResponse>('/knowledge/maintenance' + scope(workspace)));
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  const visible = summary?.claims.filter(item => filter === 'all' || ['proposed','needs_review'].includes(item.status));
  return <div className="workflow">
    <header className="page-heading"><h1>知识维护</h1><p>复核证据、来源变化和关系建议。</p></header>
    {editable && draft && <form className="panel stack" onSubmit={event => void createClaim(event)}>
      <div className="section-heading"><h2>从证据提议结论</h2><button type="button" onClick={() => setDraft(undefined)}>取消</button></div>
      <blockquote>{draft.quote}</blockquote>
      <label>结论<textarea name="statement" required maxLength={1200} /></label>
      <label>适用范围<input name="scope" maxLength={800} /></label>
      <div><button className="primary" disabled={busy}>保存待复核结论</button></div>
    </form>}
    <section className="panel stack">
      <h2>来源异常</h2>
      {summary?.sources.map(item => <div className="list-item" key={item.id}><button onClick={() => openSource(item.id)}>{item.title}</button><span>{lifecycleLabel(item.lifecycle)}</span></div>)}
      {summary && !summary.sources.length && <p className="muted">目前没有需要关注的来源变化。</p>}
      {Boolean(summary?.pending_edges) && <div><button onClick={openKnowledge}>审核 {summary?.pending_edges} 条关系建议</button></div>}
    </section>
    <section className="panel stack">
      <div className="section-heading"><h2>结论</h2><label>状态<select value={filter} onChange={event => setFilter(event.target.value)}><option value="pending">待复核</option><option value="all">全部</option></select></label></div>
      {visible?.map(item => <div className="list-item" key={item.id}>
        <button onClick={() => void open(item.id)}>{item.statement}</button><span>{claimLabel(item.status)} · {item.evidence_count} 条证据</span>
      </div>)}
      {visible && !visible.length && <p className="muted">没有符合筛选条件的结论。</p>}
      {claim && <div className="detail stack" key={claim.id}>
        <div className="section-heading"><h3>{claim.statement}</h3><button onClick={() => setClaim(undefined)}>关闭</button></div>
        <p>{claim.scope}</p><p>{claimLabel(claim.status)}</p>
        {claim.evidence.map(item => <div key={item.id}><button onClick={() => openEvidence(item.id)}>{item.title} · {lifecycleLabel(item.lifecycle)}</button><blockquote>{item.quote}</blockquote></div>)}
        {editable && <form className="stack" onSubmit={event => void review(event)}>
          <label>复核结论<select name="decision">{['supported','partially_supported','disputed','unsupported','outdated','retracted'].map(item => <option key={item} value={item}>{claimLabel(item)}</option>)}</select></label>
          <label>判断依据<textarea name="reason" maxLength={1500} /></label>
          <div><button className="primary" disabled={busy}>保存复核</button></div>
        </form>}
        {claim.reviews.map(item => <p key={item.id} className="muted">{new Date(item.created_at).toLocaleString('zh-CN')} · {claimLabel(item.decision)} {item.reason}</p>)}
      </div>}
    </section>
  </div>;
}

import { ArtifactBlockView } from './artifact-renderer';
import type { ProjectionState } from './projection-views';

export function VersionHistory({ artifact,editable,synced,projection,onEvidence,onUpdate,onTrash,report }: {
  artifact:ArtifactDetail; editable:boolean; synced:boolean; projection?:ProjectionState; onEvidence:(id:string)=>void; onUpdate:(item:ArtifactDetail)=>Promise<void>;
  onTrash:()=>Promise<void>; report:(message:string)=>void;
}) {
  const [revisions,setRevisions] = useState<ArtifactRevision[]>([]);
  const [preview,setPreview] = useState<ArtifactRevision>();
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    void api<ArtifactRevision[]>('/artifacts/' + artifact.id + '/revisions').then(result => { if (mounted) setRevisions(result); })
      .catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[artifact.id,artifact.revision.id,report]);
  async function rename(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!synced || busy) return;
    const title = new FormData(event.currentTarget).get('title');
    setBusy(true);
    try {
      const item = await api<ArtifactDetail>('/artifacts/' + artifact.id + '/metadata',{
        method:'PATCH',key:crypto.randomUUID(),body:{ title,expected_title:artifact.title,base_revision_id:artifact.revision.id },
      });
      await onUpdate(item);
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!preview || !synced || busy) return;
    setBusy(true);
    try {
      const result = await post<{ revision:ArtifactRevision }>('/artifacts/' + artifact.id + '/revisions/restore',{
        base_revision_id:artifact.revision.id,revision_id:preview.id,
      });
      await onUpdate({ ...artifact,revision:result.revision,canonical_revision_id:result.revision.id });
      setPreview(undefined);
      report('已将历史正文恢复为新版本。');
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  return <section className="panel stack" aria-label="版本与文档管理">
    <h2>版本与文档管理</h2>
    {editable && <form className="stack" key={artifact.title} onSubmit={event => void rename(event)}>
      <label>文档名称<input name="title" required maxLength={200} defaultValue={artifact.title} /></label>
      <div><button disabled={!synced || busy}>保存名称</button></div>
    </form>}
    {revisions.map(item => <div className="list-item" key={item.id}>
      <button onClick={() => setPreview(item)}>版本 {item.revision_number}{item.id === artifact.revision.id ? ' · 当前' : ''}</button>
      <span>{new Date(item.created_at).toLocaleString('zh-CN')} · {item.author_type === 'agent' ? 'AI' : '用户'}</span>
    </div>)}
    {preview && <div className="detail stack">
      <h3>版本 {preview.revision_number} 预览</h3>
      {preview.content_json.blocks.length ? preview.content_json.blocks.map(block => <ArtifactBlockView key={block.id} block={block}
        context={{ mode:'history',onEvidence,projection }} />) : <p className="muted">该版本没有正文。</p>}
      {editable && preview.id !== artifact.revision.id && <div><button disabled={!synced || busy} onClick={() => void restore()}>恢复为新版本</button></div>}
    </div>}
    {editable && <div><button disabled={!synced || busy} onClick={() => {
      if (window.confirm('将本文档移至回收站？可以稍后恢复。')) void onTrash();
    }}>移至回收站</button></div>}
    {!synced && <p className="muted">本机修改同步完成后可以管理版本。</p>}
  </section>;
}

export function Trash({ workspace,editable,open,refresh,report }: {
  workspace:string; editable:boolean; open:(id:string)=>void; refresh:()=>Promise<void>; report:(message:string)=>void;
}) {
  const [items,setItems] = useState<(ArtifactSummary & { deleted_at:string })[]>([]);
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    void api<typeof items>('/workspaces/' + workspace + '/trash').then(result => { if (mounted) setItems(result); })
      .catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[workspace,report]);
  async function restore(item:ArtifactSummary) {
    if (busy) return;
    setBusy(true);
    try {
      await post('/artifacts/' + item.id + '/restore',{ base_revision_id:item.canonical_revision_id });
      setItems(before => before.filter(row => row.id !== item.id));
      await refresh();
      open(item.id);
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="workflow">
    <header className="page-heading"><h1>回收站</h1></header>
    <section className="panel stack">
      {items.map(item => <div className="list-item" key={item.id}><strong>{item.title}</strong><span>{new Date(item.deleted_at).toLocaleString('zh-CN')}</span>
        {editable && <button disabled={busy} onClick={() => void restore(item)}>恢复文档</button>}</div>)}
      {!items.length && <p className="muted">回收站为空。</p>}
    </section>
  </div>;
}
