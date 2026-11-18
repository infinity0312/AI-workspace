import {AtlasArt} from './atlas-art';
import {ActiveFilterTokens,EmptyFilterResult,FacetBar,FacetPopover,PrimarySearch,ResultSummary} from './explorer-controls';
import { useEffect, useState, type FormEvent } from 'react';
import type { StudyCard, StudyGoal, StudyRating } from '@akw/contracts';
import { api, errorText, post, type ArtifactSummary } from '../lib/api';

const ratings: { value:StudyRating; label:string }[] = [
  { value:'again',label:'忘记了' },{ value:'hard',label:'很难' },{ value:'good',label:'记得' },{ value:'easy',label:'很容易' },
];

export function StudyPage({ workspace,documents,editable,openArtifact,report,initialArtifact }: {
  workspace:string; initialArtifact?:string; documents:ArtifactSummary[]; editable:boolean; openArtifact:(id:string)=>void; report:(value:string)=>void;
}) {
  const [search,setSearch]=useState(''),[states,setStates]=useState<string[]>([]);
  const [goals,setGoals] = useState<StudyGoal[]>([]);
  const [cards,setCards] = useState<StudyCard[]>([]);
  const [tab,setTab] = useState<'goals'|'cards'>(initialArtifact ? 'cards' : 'goals');
  const [visibleAnswer,setVisibleAnswer] = useState<string|null>(null);
  const [formOpen,setFormOpen] = useState(Boolean(initialArtifact));
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError]=useState(''),[loadEpoch,setLoadEpoch]=useState(0);
  const path = '/study?workspace_id=' + encodeURIComponent(workspace);
  useEffect(() => {
    const controller = new AbortController();setLoading(true);
    void api<{ goals:StudyGoal[]; cards:StudyCard[] }>(path,{ signal:controller.signal })
      .then(data => { setGoals(data.goals); setCards(data.cards);setLoadError(''); })
      .catch(error => { if (!controller.signal.aborted){report(errorText(error));setLoadError(errorText(error));} })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[path,report,loadEpoch]);
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
  const matchedCards=cards.filter(card=>(card.question+' '+card.answer).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const due = cards.filter(card=>(card.question+' '+card.answer).toLocaleLowerCase().includes(search.toLocaleLowerCase())).filter(card => new Date(card.due_at).getTime() <= Date.now()).sort((a,b) => a.due_at.localeCompare(b.due_at));
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
  return <div className="workflow atlas-study">
    <header className="page-heading atlas-page-heading"><div><p className="eyebrow">A JOURNEY THROUGH KNOWLEDGE</p><h1>学习</h1><p>用目标组织章节，用复习巩固理解。</p></div><figure><AtlasArt asset={tab==='cards'?'aa_learning_fossil_01':'aa_learning_seed_capsule_01'}/><figcaption>概念插画</figcaption></figure></header>
    <div className="button-row">
      <button aria-pressed={tab === 'goals'} onClick={() => { setTab('goals'); setFormOpen(false); }}>学习目标</button>
      <button aria-pressed={tab === 'cards'} onClick={() => { setTab('cards'); setStates([]); setFormOpen(false); }}>复习卡片（{due.length} 张到期）</button>
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
    <PrimarySearch value={search} onChange={setSearch} label="搜索学习主题或卡片"/>{tab==='goals'&&<FacetBar><FacetPopover label="目标状态" values={states} onChange={setStates} options={[{value:'active',label:'进行中'},{value:'completed',label:'已完成'}]}/></FacetBar>}<ActiveFilterTokens tokens={[...(search?[{key:'q',label:'搜索：'+search,remove:()=>setSearch('')}]:[]),...states.map(value=>({key:value,label:value==='completed'?'已完成':'进行中',remove:()=>setStates(states.filter(item=>item!==value))}))]} onClear={()=>{setSearch('');setStates([]);}}/><ResultSummary>{tab==='goals'?goals.length+' 个学习目标':cards.length+' 张卡片 · '+due.length+' 张当前到期'}</ResultSummary>
    {loadError&&<div role="alert"><p>学习记录暂不可读取：{loadError}</p><button onClick={()=>setLoadEpoch(value=>value+1)}>重试学习记录</button></div>}
    {loading&&!goals.length&&!cards.length ? <p className="muted">正在读取学习记录…</p> : loadError&&!goals.length&&!cards.length ? null : tab === 'goals' ? <>
      {!goals.length && <section className="atlas-learning-empty"><p className="eyebrow">LEARNING / 00</p><h3>还没有学习目标。</h3><p className="muted">从一个想弄清楚的问题开始，安排章节与复习。</p></section>}
      {goals.length>0&&!goals.some(goal=>(!states.length||states.includes(goal.status==='completed'?'completed':'active'))&&(goal.title+' '+goal.notes).toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&<EmptyFilterResult empty={false} subject="学习目标" onClear={()=>{setSearch('');setStates([]);}}/>}
      {goals.filter(goal=>(!states.length||states.includes(goal.status==='completed'?'completed':'active'))&&(goal.title+' '+goal.notes).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(goal => {
        const done = goal.steps.filter(step => step.done).length;
        return <article className="panel stack atlas-learning-chapter" key={goal.id}>
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
      {cards.length>0&&!matchedCards.length&&<EmptyFilterResult empty={false} subject="复习卡片" onClear={()=>setSearch('')}/>}
      {current ? <article className="panel stack">
        <h2>{current.question}</h2>
        {visibleAnswer === current.id ? <>
          <p className="excerpt">{current.answer}</p>
          {editable && <div className="button-row">{ratings.map(rating => <button key={rating.value} disabled={busy} onClick={() => review(current,rating.value)}>{rating.label}</button>)}</div>}
        </> : <div><button className="primary" onClick={() => setVisibleAnswer(current.id)}>查看答案</button></div>}
      </article> : <p className="muted">{!cards.length?'还没有复习卡片。':matchedCards.length?'当前没有到期卡片。':'请调整搜索条件。'}</p>}
      {matchedCards.length > 0 && <section className="panel stack"><h2>全部卡片</h2>
        {[...cards].filter(card=>(card.question+' '+card.answer).toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b) => a.due_at.localeCompare(b.due_at)).map(card => <div className="detail stack" key={card.id}>
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
