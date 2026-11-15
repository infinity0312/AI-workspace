import { useEffect, useState, type FormEvent } from 'react';
import type { StudyCard, StudyGoal, StudyRating } from '@akw/contracts';
import { api, errorText, post, type ArtifactSummary } from '../lib/api';

const ratings: { value:StudyRating; label:string }[] = [
  { value:'again',label:'忘记了' },{ value:'hard',label:'很难' },{ value:'good',label:'记得' },{ value:'easy',label:'很容易' },
];

export function StudyPage({ workspace,documents,editable,openArtifact,report,initialArtifact }: {
  workspace:string; initialArtifact?:string; documents:ArtifactSummary[]; editable:boolean; openArtifact:(id:string)=>void; report:(value:string)=>void;
}) {
  const [goals,setGoals] = useState<StudyGoal[]>([]);
  const [cards,setCards] = useState<StudyCard[]>([]);
  const [tab,setTab] = useState<'goals'|'cards'>(initialArtifact ? 'cards' : 'goals');
  const [visibleAnswer,setVisibleAnswer] = useState<string|null>(null);
  const [formOpen,setFormOpen] = useState(Boolean(initialArtifact));
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const path = '/study?workspace_id=' + encodeURIComponent(workspace);
  useEffect(() => {
    const controller = new AbortController();
    void api<{ goals:StudyGoal[]; cards:StudyCard[] }>(path,{ signal:controller.signal })
      .then(data => { setGoals(data.goals); setCards(data.cards); })
      .catch(error => { if (!controller.signal.aborted) report(errorText(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[path,report]);
  async function act(action:()=>Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); }
    catch (error) { report(errorText(error)); }
    finally { setBusy(false); }
  }
  function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const common = { workspace_id:workspace,artifact_id:data.get('artifact') || undefined };
    void act(async () => {
      if (tab === 'goals') {
        const goal = await post<StudyGoal>('/study/goals',{
          ...common,title:data.get('title'),notes:data.get('notes'),target_date:data.get('target') || undefined,
          steps:String(data.get('steps')).split(/\r?\n/).map(line => line.trim()).filter(Boolean),
        });
        setGoals(previous => [goal,...previous]);
      } else {
        const card = await post<StudyCard>('/study/cards',{ ...common,question:data.get('question'),answer:data.get('answer') });
        setCards(previous => [...previous,card]);
      }
      setFormOpen(false);
    });
  }
  function update(goal:StudyGoal,change:{ completed:boolean }|{ step_id:string; done:boolean }) {
    void act(async () => {
      const row = await api<StudyGoal>('/study/goals/' + goal.id,{ method:'PATCH',body:{ version:goal.version,...change },key:crypto.randomUUID() });
      setGoals(previous => previous.map(item => item.id === row.id ? row : item));
    });
  }
  const due = cards.filter(card => new Date(card.due_at).getTime() <= Date.now()).sort((a,b) => a.due_at.localeCompare(b.due_at));
  const current = due[0];
  function review(card:StudyCard,rating:StudyRating) {
    void act(async () => {
      const row = await post<StudyCard>('/study/cards/' + card.id + '/review',{ version:card.version,rating });
      setCards(previous => previous.map(item => item.id === row.id ? row : item));
      setVisibleAnswer(null);
      report('已安排下次复习：' + new Date(row.due_at).toLocaleString());
    });
  }
  function link(id:string|null) {
    const document = documents.find(item => item.id === id);
    return document && <button type="button" onClick={() => openArtifact(document.id)}>{document.title}</button>;
  }
  return <div className="workflow">
    <header className="page-heading"><h1>学习</h1><p>用阶段任务跟踪进度，用间隔复习巩固知识。</p></header>
    <div className="button-row">
      <button aria-pressed={tab === 'goals'} onClick={() => { setTab('goals'); setFormOpen(false); }}>学习目标</button>
      <button aria-pressed={tab === 'cards'} onClick={() => { setTab('cards'); setFormOpen(false); }}>复习卡片（{due.length} 张到期）</button>
      {editable && <button className="primary" onClick={() => setFormOpen(!formOpen)}>{formOpen ? '关闭表单' : tab === 'goals' ? '新建学习目标' : '新建复习卡片'}</button>}
    </div>
    {formOpen && <form className="panel stack" onSubmit={create}>
      {tab === 'goals' ? <>
        <label>目标名称<input name="title" maxLength={200} required /></label>
        <label>目标描述<textarea name="notes" maxLength={3000} /></label>
        <label>目标日期<input type="date" name="target" /></label>
        <label>阶段任务（每行一项，最多 20 项）<textarea name="steps" maxLength={4000} /></label>
      </> : <>
        <label>问题<input name="question" maxLength={400} required /></label>
        <label>答案<textarea name="answer" maxLength={5000} required /></label>
      </>}
      <label>关联文档<select name="artifact" defaultValue={initialArtifact}><option value="">无</option>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <div><button className="primary" disabled={busy}>保存{tab === 'goals' ? '目标' : '卡片'}</button></div>
    </form>}
    {loading ? <p className="muted">正在读取学习记录…</p> : tab === 'goals' ? <>
      {!goals.length && <p className="muted">还没有学习目标。</p>}
      {goals.map(goal => {
        const done = goal.steps.filter(step => step.done).length;
        return <article className="panel stack" key={goal.id}>
          <div><h2>{goal.title}</h2><p className="muted">{goal.status === 'completed' ? '已完成' : '进行中'}{goal.target_date && ' · 目标日期 ' + goal.target_date}</p></div>
          {goal.notes && <p className="excerpt">{goal.notes}</p>}
          {goal.steps.length > 0 && <div className="stack">
            <label>阶段进度 {done}/{goal.steps.length}<progress max={goal.steps.length} value={done} /></label>
            {goal.steps.map(step => <label className="check" key={step.id}><input type="checkbox" checked={step.done} disabled={busy || !editable}
              onChange={event => update(goal,{ step_id:step.id,done:event.target.checked })} />{step.title}</label>)}
          </div>}
          <div className="button-row">{link(goal.artifact_id)}
            {editable && <button disabled={busy} onClick={() => update(goal,{ completed:goal.status !== 'completed' })}>{goal.status === 'completed' ? '重新开启' : '标记完成'}</button>}
          </div>
        </article>;
      })}
    </> : <>
      {current ? <article className="panel stack">
        <h2>{current.question}</h2>
        {visibleAnswer === current.id ? <>
          <p className="excerpt">{current.answer}</p>
          {editable && <div className="button-row">{ratings.map(rating => <button key={rating.value} disabled={busy} onClick={() => review(current,rating.value)}>{rating.label}</button>)}</div>}
        </> : <div><button className="primary" onClick={() => setVisibleAnswer(current.id)}>查看答案</button></div>}
      </article> : <p className="muted">当前没有到期卡片。</p>}
      {cards.length > 0 && <section className="panel stack"><h2>全部卡片</h2>
        {[...cards].sort((a,b) => a.due_at.localeCompare(b.due_at)).map(card => <div className="detail stack" key={card.id}>
          <strong>{card.question}</strong><time dateTime={card.due_at}>{new Date(card.due_at).toLocaleString()}</time>
          <div className="button-row">{link(card.artifact_id)}
            {editable && <button disabled={busy} onClick={() => void act(async () => {
              await post('/study/cards/' + card.id + '/archive',{ version:card.version });
              setCards(previous => previous.filter(item => item.id !== card.id));
            })}>归档卡片</button>}
          </div>
        </div>)}
      </section>}
    </>}
  </div>;
}
