import { useEffect,useState,type FormEvent } from 'react';
import { learningGoalAttrs,learningLessonAttrs,type ArtifactDetail,type Block,type LearningAssessmentResult,type LearningMastery,type LearningProgress,type WorkspaceSummary } from '@akw/contracts';
import { api,errorText,post,type Job } from '../lib/api';
import { activeRun } from './workflow-status';
import { Latex } from './latex';

const phases:Record<string,string>={ plan:'正在识别学习起点并安排路径…',evidence:'正在查找课程、教材和研究论文…',
  draft:'正在组织讲解、推导和练习…',reviewed:'正在逐项核对讲解、公式与答案…' };
function progress(run:LearningProgress) {
  if (activeRun(run.status)) return phases[run.stage ?? ''] ?? '学习任务正在排队…';
  if (run.status==='COMPLETED') return '学习产物已保存。';
  if (run.status==='PARTIAL') return '已保存通过核对的部分。';
  if (run.result?.warning==='LEARNING_NO_EVIDENCE') return '目前没有找到足以支撑讲解的资料。可缩小主题后重试。';
  if (run.result?.warning==='CONFLICT_ARTIFACT_VERSION') return '这份学习产物有更新，请从新版本继续提问。';
  return '这次生成未保存。可以使用同一目标重试。';
}
export const canUseModel=(workspace:WorkspaceSummary)=>workspace.policy.externalProviderAllowed && ['public','personal'].includes(workspace.policy.sensitivity);

function useRun(id:string|undefined) {
  const [run,setRun]=useState<LearningProgress>();
  const [pollError,setPollError]=useState('');
  const waiting=!run || run.id!==id || activeRun(run.status);
  useEffect(()=>{
    if (!id || !waiting) return;
    const controller=new AbortController();
    let busy=false;
    async function check() {
      if (busy) return;
      busy=true;
      try {
        const row=await api<LearningProgress>('/learning-runs/'+id,{ signal:controller.signal });
        if (!controller.signal.aborted) { setRun(row);setPollError(''); }
      } catch (error) {
        if (!controller.signal.aborted) setPollError(errorText(error));
      } finally { busy=false; }
    }
    void check();
    const timer=window.setInterval(()=>void check(),1600);
    return ()=>{ controller.abort();window.clearInterval(timer); };
  },[id,waiting]);
  return { run:run?.id===id ? run : undefined,pollError,waiting };
}

export function LearningJourney({ artifact,content,synced,workspace,onUpdated,onJump,mastery }: {
  artifact:ArtifactDetail;content:ArtifactDetail['revision']['content_json'];synced:boolean;workspace:WorkspaceSummary;
  onUpdated:(detail:ArtifactDetail)=>Promise<void>;onJump:(id:string)=>void;mastery:LearningMastery;
}) {
  const header=learningGoalAttrs.safeParse(content.blocks.find(block=>block.type==='learning_goal')?.attrs);
  const [id,setId]=useState<string>();
  const [question,setQuestion]=useState('');
  const [background,setBackground]=useState('');
  const [diagnostic,setDiagnostic]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const { run,pollError,waiting }=useRun(id);
  const route='/artifacts/'+artifact.id;
  useEffect(()=>{
    let live=true;
    void api<LearningProgress|null>(route+'/learning-followup').then(row=>{ if (live && row && activeRun(row.status)) setId(row.id); }).catch(()=>{});
    return ()=>{live=false;};
  },[route]);
  useEffect(()=>{
    if (!run?.result?.artifact_id) return;
    const controller=new AbortController();
    void api<ArtifactDetail>(route,{ signal:controller.signal }).then(async value=>{
      if (!controller.signal.aborted) await onUpdated(value);
    }).catch(failure=>{ if (!controller.signal.aborted) setError(errorText(failure)); });
    return ()=>controller.abort();
  },[run?.id,run?.result?.artifact_id,route,onUpdated]);
  if (!header.success) return null;

  async function follow(event:FormEvent) {
    event.preventDefault();
    if (!synced || busy || (id && waiting) || !canUseModel(workspace)) return;
    setBusy(true);setError('');
    try {
      const job=await post<Job>(route+'/learning-followup',{ base_revision_id:artifact.revision.id,question,
        background:background.trim() || undefined,allow_external:true });
      setQuestion('');setBackground('');setDiagnostic(false);setId(job.run_id);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  const lessons=content.blocks.filter(block=>block.type==='learning_lesson');
  const completed=mastery.filter(result=>lessons.some(block=>block.id===result.lesson_id) && result.correct===result.total).length;
  const next=lessons.find(block=>!mastery.some(value=>value.lesson_id===block.id && value.correct===value.total)
    && learningLessonAttrs.safeParse(block.attrs).data?.practice.length);
  return <section className="panel stack" aria-label="学习目标">
    <h2>学习目标</h2><p>{header.data.goal}</p>
    <p><strong>{header.data.basis==='provided' ? '你的学习起点' : '暂定学习起点'}</strong> · {header.data.foundation}</p>
    <div className="button-row"><span>已有 {completed} 个主题通过练习</span>{next && <button onClick={()=>onJump(next.id)}>继续下一节</button>}</div>
    {workspace.role!=='viewer' && <form className="stack" onSubmit={event=>void follow(event)}>
      <label>你想进一步弄清什么？<textarea maxLength={1000} value={question} required rows={2} onChange={event=>setQuestion(event.target.value)} /></label>
      <div className="button-row">
        <button type="button" aria-expanded={diagnostic} onClick={()=>{ setDiagnostic(!diagnostic);if (!diagnostic && !question) setQuestion('请根据我的学习基础调整接下来的学习路径。'); }}>校准学习起点</button>
        <button className="primary" disabled={!synced || busy || Boolean(id && waiting) || !canUseModel(workspace) || !question.trim()}>查证并继续学习</button>
      </div>
      {diagnostic && <label>{header.data.diagnostic}<textarea rows={2} maxLength={500} value={background} onChange={event=>setBackground(event.target.value)} /></label>}
      {canUseModel(workspace) && <small>继续学习会调用外部模型与公开检索，通过核对的内容会追加到同一产物。</small>}
    </form>}
    {run && <p role="status">{progress(run)}</p>}
    {(error || pollError) && <p role="alert">{error || pollError}</p>}
  </section>;
}

export function LearningPractice({ block,artifact,mastery,editable,onGraded }: {
  block:Block;artifact:ArtifactDetail;mastery?:LearningMastery[number];editable:boolean;onGraded:(score:LearningAssessmentResult)=>void;
}) {
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [score,setScore]=useState<LearningAssessmentResult>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const attrs=learningLessonAttrs.safeParse(block.attrs);
  if (!attrs.success || !attrs.data.practice.length) return null;
  const questions=attrs.data.practice;
  async function submit(event:FormEvent) {
    event.preventDefault();
    if (busy || !editable) return;
    setBusy(true);setError('');
    try {
      const result=await post<LearningAssessmentResult>('/artifacts/'+artifact.id+'/learning-mastery',
        { revision_id:artifact.revision.id,lesson_id:block.id,answers:questions.map((_,index)=>answers[index]) });
      setScore(result);onGraded(result);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <details className="detail" aria-label={'练习 · '+attrs.data.title}><summary>练习 · {attrs.data.title}{mastery && ' · '+mastery.correct+'/'+mastery.total}</summary>
    <form className="stack" onSubmit={event=>void submit(event)}>
      {questions.map((question,index)=><fieldset key={index}><legend>{question.question}</legend>
        {question.options.map((name,value)=><label className="check" key={name}><input type="radio" name={block.id+'-'+index}
          checked={answers[index]===value} onChange={()=>{setAnswers(previous=>({ ...previous,[index]:value }));setScore(undefined);}} />{name}</label>)}
        {score && <p>{score.items[index]?.correct ? '答对了。' : '正确选项：'+question.options[score.items[index]!.answer]+'。'}{score.items[index]?.explanation}</p>}
      </fieldset>)}
      <div><button disabled={!editable || busy || score!==undefined || questions.some((_,index)=>answers[index]===undefined)}>检查掌握程度</button></div>
      {score && <p role="status">答对 {score.correct} / {score.total} 题</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
}

export function LessonMath({ block }: { block:Block }) {
  const result=learningLessonAttrs.safeParse(block.attrs);
  return result.success && result.data.math.map((step,index)=><div className="detail" key={index}>
    <Latex display source={step.latex} /><p>{step.explanation}</p>
  </div>);
}
