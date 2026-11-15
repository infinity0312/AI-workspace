import { useState, type FormEvent } from 'react';
import { assetMimeForName, fileExtensions } from '@akw/contracts';
import { api, errorText, type Job, type Project, type Source } from '../lib/api';
import { getPlatform, type NativeFile } from '../lib/platform';

export function DownloadLink({ path, label, report }: { path: string; label: string; report: (message: string) => void }) {
  const download = getPlatform().download;
  if (!download) return <a href={'/api' + path}>{label}</a>;
  return <button type="button" onClick={() => { void download(path).catch(error => report(errorText(error))); }}>{label}</button>;
}

export function ExternalLink({ url, label, report }: { url: string; label: string; report: (message: string) => void }) {
  const nativeOpen = getPlatform().openExternal;
  return <a href={url} target="_blank" rel="noreferrer" onClick={event => {
    if (!nativeOpen) return;
    event.preventDefault();
    void nativeOpen(url).catch(error => report(errorText(error)));
  }}>{label}</a>;
}

type BatchProps = {
  workspace: string; files: NativeFile[]; skipped: number; projects: Project[];
  select: (directory: boolean) => void; remove: (id: string) => void; refresh: () => Promise<void>;
  report: (message: string) => void; onQueued: (jobs: Job[]) => void;
};

export function NativeImportQueue({ workspace,files,skipped,projects,select,remove,refresh,report,onQueued }: BatchProps) {
  const [project,setProject] = useState('');
  const [rights,setRights] = useState('unknown');
  const [busy,setBusy] = useState(false);
  const platformFile = getPlatform().file;
  if (!platformFile) return null;
  async function importBatch(event: FormEvent) {
    event.preventDefault();
    if (!platformFile || busy || !files.length) return;
    setBusy(true);
    const jobs: Job[] = [];
    let success = 0;
    let latestError = '';
    try {
      for (const file of files) {
        try {
          const mime = assetMimeForName(file.name);
          if (!mime) throw new Error('不支持的文件类型');
          const data_base64 = await platformFile.read(file);
          const asset = await api<{ id: string }>('/assets',{
            key:'native.asset.' + file.id,
            body:{ workspace_id:workspace,name:file.name,mime,data_base64 },
          });
          const source = await api<Source>('/sources',{
            key:'native.source.' + file.id,
            body:{ workspace_id:workspace,project_id:project || null,title:file.name,asset_id:asset.id,rights,sensitivity:'personal' },
          });
          if (source.status !== 'parsed') jobs.push(await api<Job>('/sources/' + source.id + '/ingest',{
            key:'native.ingest.' + file.id,body:{},
          }));
          remove(file.id);
          success++;
        } catch (error) { latestError = file.name + ' · ' + errorText(error); }
      }
      onQueued(jobs);
      await refresh();
      if (latestError) report('已提交 ' + success + ' / ' + files.length + ' 个文件。' + latestError);
      else if (success) report('已提交 ' + success + ' 个文件，后台正在解析。');
    } catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  return <form className="panel stack" onSubmit={event => void importBatch(event)} aria-label="Windows 文件导入">
    <div><h2>Windows 文件导入</h2><p className="muted">将资料拖入窗口，也可以选择文件或文件夹。</p></div>
    <div className="button-row"><button type="button" disabled={busy} onClick={() => select(false)}>选择文件</button><button type="button" disabled={busy} onClick={() => select(true)}>选择文件夹</button></div>
    {skipped > 0 && <p className="muted">跳过 {skipped} 项不受支持或超过限制的内容。</p>}
    {files.length > 0 && <>
      <div className="field-grid">
        <label>导入到项目<select value={project} disabled={busy} onChange={event => setProject(event.target.value)}>
          <option value="">工作空间共享</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>资料权利<select value={rights} disabled={busy} onChange={event => setRights(event.target.value)}>
          <option value="unknown">未确认</option><option value="user_owned">本人拥有内容</option><option value="public_license">公开许可</option><option value="restricted">限制再分发</option>
        </select></label>
      </div>
      {files.map(file => <div className="list-item" key={file.id}>
        <span>{file.name}</span><span>{Math.max(1,Math.ceil(file.size / 1024))} KiB</span>
        <button type="button" disabled={busy} onClick={() => remove(file.id)}>移除</button>
      </div>)}
      <div><button className="primary" disabled={busy}>{busy ? '正在导入…' : '导入到工作空间'}</button></div>
    </>}
  </form>;
}

export const supportedFileTypes = fileExtensions;
export function sourcePageLabel(page: number | null, parser?: string) {
  if (!page) return '';
  if (parser?.includes('/pptx/')) return '幻灯片 ' + page + ' · ';
  if (parser?.includes('/xlsx/')) return '工作表 ' + page + ' · ';
  if (parser?.startsWith('tesseract/')) return '图片 ' + page + ' · ';
  return '第 ' + page + ' 页 · ';
}
