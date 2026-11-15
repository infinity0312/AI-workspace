import { useEffect, useState, type FormEvent } from 'react';
import type { ArtifactComment, ArtifactDetail, WorkspaceMember } from '@akw/contracts';
import { api, errorText, post } from '../lib/api';

const roles = { owner:'所有者',editor:'可编辑',viewer:'只读' };

export function Members({ workspace,owner,report }: { workspace:string; owner:boolean; report:(text:string)=>void }) {
  const [rows,setRows] = useState<WorkspaceMember[]>([]);
  const [busy,setBusy] = useState(false);
  const path = '/workspaces/' + workspace + '/members';
  useEffect(() => {
    const controller = new AbortController();
    void api<WorkspaceMember[]>(path,{ signal:controller.signal }).then(setRows)
      .catch(error => { if (!controller.signal.aborted) report(errorText(error)); });
    return () => controller.abort();
  },[path,report]);
  async function change(event:FormEvent<HTMLFormElement>,row?:WorkspaceMember) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const role = data.get('role');
    const user = row?.user_id ?? String(data.get('user'));
    if (role === 'remove' && !window.confirm('移除该成员的工作空间访问权限？')) return;
    setBusy(true);
    try {
      await api(path,{ method:'PATCH',body:{ user_id:user,role,version:row?.version ?? 0 },key:crypto.randomUUID() });
      setRows(await api<WorkspaceMember[]>(path));
      if (!row) form.reset();
      report('成员权限已更新。');
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  return <section className="panel stack">
    <h2>工作空间成员</h2>
    {rows.map(row => <div className="detail stack" key={row.user_id}>
      <strong>{row.user_id}</strong>
      {owner && row.role !== 'owner' ? <form className="button-row" key={row.version} onSubmit={event => void change(event,row)}>
        <label>权限<select name="role" defaultValue={row.role}><option value="editor">可编辑</option><option value="viewer">只读</option><option value="remove">移除</option></select></label>
        <button disabled={busy}>保存权限</button>
      </form> : <span>{roles[row.role]}</span>}
    </div>)}
    {owner && <form className="field-grid" onSubmit={event => void change(event)}>
      <label>现有租户账号 ID<input name="user" maxLength={128} required /></label>
      <label>初始权限<select name="role"><option value="viewer">只读</option><option value="editor">可编辑</option></select></label>
      <div><button disabled={busy}>添加成员</button></div>
    </form>}
  </section>;
}

export function Comments({ artifact,editable,owner,synced,report }: {
  artifact:ArtifactDetail; editable:boolean; owner:boolean; synced:boolean; report:(text:string)=>void;
}) {
  const [items,setItems] = useState<ArtifactComment[]>([]);
  const [user,setUser] = useState('');
  const [busy,setBusy] = useState(false);
  const path = '/artifacts/' + artifact.id + '/comments';
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await api<{ comments:ArtifactComment[]; current_user:string }>(path);
        if (active) { setItems(result.comments); setUser(result.current_user); }
      } catch (error) { if (active) report(errorText(error)); }
    }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); },15000);
    return () => { active = false; clearInterval(timer); };
  },[path,report]);
  async function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const comment = await post<ArtifactComment>(path,{ revision_id:artifact.revision.id,block_id:data.get('block') || undefined,body:data.get('comment') });
      setItems(previous => [comment,...previous.filter(item => item.id !== comment.id)]);
      form.reset();
    } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  async function resolve(item:ArtifactComment) {
    if (busy) return;
    setBusy(true);
    try {
      const row = await api<ArtifactComment>(path + '/' + item.id,{ method:'PATCH',key:crypto.randomUUID(),body:{ version:item.version,resolved:!item.resolved_at } });
      setItems(previous => previous.map(existing => existing.id === row.id ? row : existing));
    } catch (error) { report(errorText(error)); } finally { setBusy(false); }
  }
  const blocks = artifact.revision.content_json.blocks;
  return <section className="panel stack">
    <h2>文档批注</h2>
    {editable && (synced ? <form className="stack" onSubmit={event => void add(event)}>
      <label>批注位置<select name="block"><option value="">整篇文档</option>
        {blocks.map((block,index) => <option key={block.id} value={block.id}>{index+1}. {block.children?.map(child => child.text ?? '').join('').slice(0,56) || block.type}</option>)}</select></label>
      <label>批注内容<textarea name="comment" maxLength={3000} required /></label>
      <div><button disabled={busy}>添加批注</button></div>
    </form> : <p className="muted">当前文档同步后可添加批注。</p>)}
    {!items.length && <p className="muted">暂无批注。</p>}
    {items.map(item => {
      const block = blocks.findIndex(candidate => candidate.id === item.block_id);
      return <article className="detail stack" key={item.id}>
        <div className="section-heading"><strong>{item.original_author_id ?? item.author_id}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>
        <p className="excerpt">{item.body}</p>
        <div className="button-row"><span className="muted">{item.revision_id !== artifact.revision.id ? '历史版本' : block >= 0 ? '当前版本 · 第 ' + (block+1) + ' 块' : '整篇文档'} · {item.resolved_at ? '已解决' : '待处理'}</span>
          {editable && (owner || user === item.author_id) && <button disabled={busy} onClick={() => void resolve(item)}>{item.resolved_at ? '重新开启批注' : '标记已解决'}</button>}
        </div>
      </article>;
    })}
  </section>;
}
