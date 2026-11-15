import { useEffect, useState } from 'react';
import { errorText, workspaceApi } from '../lib/api';
import { getPlatform, type ImportSelection } from '../lib/platform';
import { activeRun, statusLabel } from './workflow-status';

const finished = (status: string) => ['COMPLETED','PARTIAL','FAILED','BUDGET_EXHAUSTED'].includes(status);

export function useDesktop(workspaceId: string, openSources: () => void, openCapture:()=>void, report: (message: string) => void) {
  const platform = getPlatform();
  const [selection,setSelection] = useState<ImportSelection>({ files:[],skipped:0 });
  const [capture,setCapture] = useState<{ text:string;id:number } | null>(null);
  const [quickCaptureKey,setQuickCaptureKey] = useState<string | null>(null);
  const file = platform.file;
  useEffect(() => {
    if (!file && !platform.windows) return;
    let mounted = true;
    const cleanup: (() => void)[] = [];
    function subscribe(task: Promise<() => void>) {
      void task.then(unsubscribe => {
        if (mounted) cleanup.push(unsubscribe);
        else unsubscribe();
      }).catch(error => { if (mounted) report(errorText(error)); });
    }
    if (file) subscribe(file.subscribe(incoming => {
      if (!mounted) return;
      setSelection(before => ({ files:[...before.files,...incoming.files],skipped:incoming.skipped }));
      openSources();
    }));
    void platform.windows?.quickCaptureKey?.().then(key => { if (mounted) setQuickCaptureKey(key); }).catch(() => {});
    if (platform.windows) subscribe(platform.windows.onQuickCapture(() => {
      if (!mounted) return;
      openCapture();
      void platform.clipboard?.read().then(text => {
        if (mounted) setCapture({ text,id:Date.now() });
      }).catch(() => {});
    }));
    return () => { mounted = false; for (const release of cleanup) release(); };
  },[file,platform,openSources,openCapture,report]);

  const notifications = platform.notifications;
  useEffect(() => {
    if (!notifications || !workspaceId || new URLSearchParams(window.location.search).has('artifact')) return;
    const statuses = new Map<string,string>();
    const started = Date.now();
    let mounted = true;
    let inFlight = false;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const runs = await workspaceApi.runs(workspaceId);
        if (!mounted) return;
        await notifications.activity(runs.filter(run => activeRun(run.status)).length).catch(() => {});
        for (const run of runs) {
          const prior = statuses.get(run.id);
          statuses.set(run.id,run.status);
          if (!finished(run.status) || (prior !== undefined && finished(prior))) continue;
          if (prior === undefined && Date.parse(run.updated_at) < started) continue;
          await notifications.show('研究任务' + statusLabel(run.status),Array.from(run.goal).slice(0,120).join('')).catch(() => {});
        }
      } catch { /* The next poll will retry the loopback connection. */ }
      finally { inFlight = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(),3500);
    return () => { mounted = false; window.clearInterval(timer); void notifications.activity(0).catch(() => {}); };
  },[notifications,workspaceId]);

  async function pick(directory: boolean) {
    if (!file) return;
    try {
      const incoming = await file.pick(directory);
      setSelection(before => ({ files:[...before.files,...incoming.files],skipped:incoming.skipped }));
    } catch (error) { report(errorText(error)); }
  }
  function remove(id: string) {
    const selected = selection.files.find(item => item.id === id);
    if (file && selected) void file.discard(selected).catch(() => {});
    setSelection(before => ({ ...before,files:before.files.filter(item => item.id !== id) }));
  }
  return {
    platform,
    capture,
    quickCaptureKey,
    importQueue:file ? { ...selection, pick:(directory: boolean) => void pick(directory), remove } : undefined,
  };
}
