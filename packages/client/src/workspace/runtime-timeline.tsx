import { useEffect,useState } from 'react';
import { api,post } from '../lib/api';

type TimelineEvent={ event_id:string;sequence:string;event_type:string;payload:Record<string,unknown>;created_at:string };
type EventPage={ events:TimelineEvent[];next_cursor:string;has_more:boolean };
const steps:Record<string,string>={
  'document.plan':'规划检索问题','document.repair-plan':'修复检索计划','document.draft':'起草分析',
  'document.verify':'核对主张与引用','document.repair-format':'修复结果格式','document.repair-coverage':'补答缺失问题',
  'document.repair-grounding':'修复证据匹配','research.answer':'生成回答','research.synthesize':'整理研究资料',
  'research.verify':'核对研究摘要','selection.rewrite':'生成改写','selection.verify':'核对改写内容',
  'selection.repair-scope':'恢复适用条件','selection.repair-length':'调整改写长度',
};
function eventLabel(event:TimelineEvent) {
  if (event.event_type==='step.started') return steps[String(event.payload.prompt_id)] ?? '运行分析步骤';
  if (event.event_type==='turn.resumed') return '任务已从检查点恢复';
  if (event.event_type==='tool.started') return '读取当前任务的原文片段';
  if (event.event_type==='tool.finished') return event.payload.status==='completed' ? '已读取原文片段' : '证据读取被拦截';
  if (event.event_type==='context.compacted') return '缩减可按需读取的证据预览';
  if (event.event_type==='model.failed') return '本次模型调用未完成';
  if (event.event_type==='quality.finding') return '质量校验拦截';
  if (event.event_type==='artifact.proposed') return '提案已生成';
  if (event.event_type==='turn.finished') return event.payload.status==='CANCELLED' ? '任务已取消' : '任务已结束';
  return undefined;
}
export function RuntimeTimeline({ runId,active,cancellable=false }:{ runId:string;active:boolean;cancellable?:boolean }) {
  const [rows,setRows]=useState<TimelineEvent[]>([]);
  const [pending,setPending]=useState(false);
  const [failure,setFailure]=useState(false);
  useEffect(()=>{
    let mounted=true,busy=false,cursor='0';
    const abort=new AbortController();
    const load=async ()=>{
      if (busy) return;
      busy=true;
      try {
        for (let index=0;index<6 && mounted;index++) {
          const page=await api<EventPage>('/runtime-runs/'+runId+'/events?cursor='+cursor,{ signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15_000)]) });
          if (!mounted) return;
          cursor=page.next_cursor;
          if (page.events.length) setRows(previous=>[...new Map([...previous,...page.events].map(event=>[event.event_id,event])).values()]);
          if (!page.has_more) break;
        }
      } catch { /* Temporary network failures are retried while the task is active. */ }
      finally { busy=false; }
    };
    void load();
    const timer=active ? window.setInterval(()=>void load(),1500) : undefined;
    return ()=>{ mounted=false;abort.abort();if (timer!==undefined) window.clearInterval(timer); };
  },[runId,active]);
  const visible=rows.flatMap(event=>{ const label=eventLabel(event);return label ? [{ event,label }] : []; });
  async function cancel() {
    setPending(true);setFailure(false);
    try { await post('/runtime-runs/'+runId+'/cancel',{}); }
    catch { setFailure(true);setPending(false); }
  }
  return <div className="stack">
    {cancellable && active && <div><button type="button" disabled={pending} onClick={()=>void cancel()}>取消本次任务</button></div>}
    {failure && <p role="alert">暂时无法取消，请刷新任务状态。</p>}
    {visible.length>0 && <details><summary>查看运行过程</summary>
      <ol className="timeline">{visible.map(({ event,label })=><li key={event.event_id}>
        <span>{new Date(event.created_at).toLocaleTimeString('zh-CN')}</span><strong>{label}</strong>
      </li>)}</ol>
    </details>}
  </div>;
}
