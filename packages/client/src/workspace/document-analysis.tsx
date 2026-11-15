import { useEffect, useState, type FormEvent } from 'react';
import type { ArtifactDetail, DocumentAnalysisRun, RequirementLedger, RequirementStage, RequirementStatus, WorkspaceSummary } from '@akw/contracts';
import { ApiError, api, errorText, post, type Job, type Patch, type Source } from '../lib/api';
import { ArtifactBlockView } from './artifact-renderer';
import type { ProjectionState } from './projection-views';
import { activeRun, statusLabel } from './workflow-status';
import { RuntimeTimeline } from './runtime-timeline';

export function isAnalysisPatch(patch: Patch) {
  return patch.operations.some(operation => operation.type === 'insert_block' && typeof operation.block.attrs?.analysis_run_id === 'string');
}

const errors: Record<string,string> = {
  PROVIDER_UNAVAILABLE:'本机后端尚未配置 DeepSeek。',
  PROVIDER_AUTH_FAILED:'DeepSeek 拒绝了当前密钥，请检查后端配置。',
  PROVIDER_BALANCE:'DeepSeek 账户余额不足。',
  PROVIDER_RATE_LIMIT:'DeepSeek 暂时限流，请稍后重试。',
  PROVIDER_ANALYSIS_INVALID:'本次未生成可引用的分析。请重试或换一份来源。',
  ANALYSIS_REQUIRED_SOURCE:'这次没有取得或引用全部指定原始来源。可先导入资料，再重新生成。',
  ANALYSIS_REQUIRED_IMAGE:'本次未能交付所要求的署名许可图片。',
  ANALYSIS_ARTIFACT_INCOMPLETE:'提案缺少必需内容，未生成可写入的版本。',
  ANALYSIS_REQUIRED_QUESTIONS:'这次缺少必答问题的证据，未生成可写入的提案。',
  PROVIDER_STREAM_INTERRUPTED:'模型连接中断，请重试。',
  ANALYSIS_NO_EVIDENCE:'没有找到足够支持分析的资料。请试试更具体的主题，或选择参考来源。',
  CONFLICT_ANALYSIS_SOURCE:'部分来源已变更，请重新生成分析。',
  CONFLICT_ANALYSIS_OUTDATED:'这份提案使用了旧的证据校验规则，请重新生成。',
  VALIDATION_ANALYSIS_SOURCE:'请先解析选中的来源。',
  VALIDATION_ANALYSIS_SOURCE_EMPTY:'所选来源没有可读取的文本段落。',
  PERMISSION_ANALYSIS_SOURCE:'选中的来源禁止发送给外部模型。',
  PERMISSION_DENIED:'当前工作空间策略不允许调用外部模型。',
  CONFLICT_ARTIFACT_VERSION:'文档版本已变化。请等待同步完成后重新生成分析。',
};
const description = (code: string) => Object.hasOwn(errors,code) ? errors[code] : undefined;
type Props = {
  artifact: ArtifactDetail; workspace: WorkspaceSummary; sources: Source[]; patches: Patch[];
  synced:boolean; projection?:ProjectionState; openSettings: () => void; refreshPatches: (id: string) => Promise<void>;
  onEvidence: (id: string) => void; onBlock:(id:string)=>void; onReview: (id: string,accept: boolean) => Promise<void>;
};
const stageLabels:Record<RequirementStage,string>={ retrieval:'来源',evidence:'证据',answer:'回答',artifact:'产物' };
const statusLabels:Record<RequirementStatus,string>={ complete:'已覆盖',partial:'部分覆盖',pending:'尚无对应记录',missing:'缺失',blocked:'受阻',not_applicable:'不适用' };

function RequirementPanel({ ledger,onEvidence,onBlock }:{
  ledger:RequirementLedger;onEvidence:(id:string)=>void;onBlock:(id:string)=>void;
}) {
  const stages=Object.keys(stageLabels) as RequirementStage[];
  const groups=new Map(ledger.items.filter(item=>item.type==='group').map(item=>[item.id,item.description]));
  return <details open={ledger.gate==='blocked' || undefined}>
    <summary>要求覆盖</summary>
    {ledger.mandatory.answer.total>0 && <p>{stages.map(stage=>stageLabels[stage]+' '+ledger.mandatory[stage].completed+'/'+ledger.mandatory[stage].total).join(' · ')}</p>}
    <ul>{ledger.items.filter(item=>item.type!=='group').map(item=><li key={item.id}>
      <strong>{item.parentId ? groups.get(item.parentId)+' / ' : ''}{item.description}</strong>
      <p>{stages.map(stage=>stageLabels[stage]+' '+statusLabels[item.status[stage]]).join(' · ')}</p>
      {item.evidenceIds.map((id,index)=><button type="button" key={id} onClick={()=>onEvidence(id)}>证据 {index+1}</button>)}
      {ledger.acceptedRevisionId && item.blockIds.map((id,index)=><button type="button" key={id} onClick={()=>onBlock(id)}>正文位置 {index+1}</button>)}
    </li>)}</ul>
  </details>;
}

export function DocumentAnalysis({ artifact,workspace,sources,patches,synced,projection,openSettings,refreshPatches,onEvidence,onBlock,onReview }: Props) {
  const [goal,setGoal] = useState(artifact.title);
  const [source,setSource] = useState('');
  const [audience,setAudience] = useState<''|'beginner'|'high_school'|'undergraduate'|'postgraduate'|'specialist'>('');
  const [questions,setQuestions]=useState('');
  const [sourceLinks,setSourceLinks]=useState('');
  const [requireImage,setRequireImage]=useState(false);
  const [useWeb,setUseWeb] = useState(true);
  const [useWorkspace,setUseWorkspace] = useState(false);
  const [includeDocument,setIncludeDocument] = useState(false);
  const [allowed,setAllowed] = useState(false);
  const [busy,setBusy] = useState(false);
  const [reviewing,setReviewing] = useState(false);
  const [run,setRun] = useState<DocumentAnalysisRun | null>(null);
  const [failure,setFailure] = useState('');
  const canExternal = workspace.policy.externalProviderAllowed && ['public','personal'].includes(workspace.policy.sensitivity);
  const choices = sources.filter(item => item.status === 'parsed' && ['active','updated'].includes(item.lifecycle) && ['public','personal'].includes(item.sensitivity) && item.rights !== 'restricted' &&
    (item.project_id === null || item.project_id === artifact.project_id));
  const pending = run && activeRun(run.status);
  const patch = patches.find(item => item.id === run?.result?.patch_id) ?? patches.find(item => item.status === 'proposed' && isAnalysisPatch(item));
  const checked = patch?.reviewed !== false && patch?.operations.some(operation => operation.type === 'insert_block' && operation.block.attrs?.analysis_verified === true);
  const stale = patch && patch.base_revision_id !== artifact.revision.id;
  const existingText = artifact.revision.content_json.blocks.some(block => block.children?.some(node => node.type === 'text' && node.text?.trim()));

  useEffect(() => {
    let mounted = true;
    void api<DocumentAnalysisRun[]>('/artifacts/' + artifact.id + '/analysis-runs').then(runs => {
      if (!mounted) return;
      const latest = runs[0];
      if (latest) setRun(previous => previous ?? latest);
      if (latest?.result?.patch_id) void refreshPatches(artifact.id).catch(() => {});
    }).catch(() => {});
    return () => { mounted = false; };
  },[artifact.id,refreshPatches]);

  const pendingId = pending ? run.id : null;
  useEffect(() => {
    if (!pendingId) return;
    let mounted = true;
    let polling = false;
    const check = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await api<DocumentAnalysisRun>('/artifact-analysis-runs/' + pendingId);
        if (!mounted) return;
        if (result.result?.patch_id) await refreshPatches(artifact.id);
        if (mounted) setRun(result);
      } catch {
        // The run remains queued on the service and will be polled again.
      } finally { polling = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(),1500);
    return () => { mounted = false; window.clearInterval(timer); };
  },[artifact.id,pendingId,refreshPatches]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!canExternal || !allowed || !synced || busy || pending || (!useWeb && !source && !useWorkspace)) return;
    setBusy(true);
    setFailure('');
    try {
      const lines=(value:string)=>[...new Set(value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean))];
      const requiredQuestions=lines(questions),requiredSourceUrls=lines(sourceLinks);
      if (requiredQuestions.length>5 || requiredQuestions.some(item=>item.length>100) || requiredSourceUrls.length>4) {
        setFailure('请填写最多五项必答问题（每项最多 100 字）和四条来源链接。');return;
      }
      if (requiredSourceUrls.some(item=>!URL.canParse(item) || new URL(item).protocol!=='https:')) {
        setFailure('指定来源请填写完整的 HTTPS 链接。');return;
      }
      const queued = await post<Job>('/artifacts/' + artifact.id + '/analysis-runs',{
        base_revision_id:artifact.revision.id,goal,audience:audience || undefined,
        ...(source && choices.some(item => item.id === source) ? { source_id:source } : {}),
        include_document:existingText && includeDocument,use_web:useWeb,use_workspace:useWorkspace,allow_external:true,
        ...(requiredQuestions.length ? { required_questions:requiredQuestions } : {}),
        ...(requiredSourceUrls.length ? { required_source_urls:requiredSourceUrls } : {}),
        ...(requireImage ? { require_licensed_image:true } : {}),
      });
      setRun({ id:queued.run_id,goal,status:'QUEUED',result:null,runtime_session_id:queued.runtime_session_id });
      setAllowed(false);
    } catch (error) {
      setFailure(error instanceof ApiError ? description(error.code) ?? error.message : errorText(error));
    } finally { setBusy(false); }
  }

  async function review(accept: boolean) {
    if (!patch || reviewing) return;
    setReviewing(true);
    try {
      await onReview(patch.id,accept);
      if (accept && run?.result?.patch_id===patch.id) {
        const current=await api<DocumentAnalysisRun>('/artifact-analysis-runs/'+run.id).catch(()=>null);
        if (current) setRun(current);
      }
    } finally { setReviewing(false); }
  }
  const warning = run?.result?.warning;
  return <section className="panel stack" aria-label="生成文档分析">
    <h2>AI 生成分析</h2>
    {!canExternal ? <div className="stack">
      <p>当前工作空间的数据策略尚未允许使用外部模型。</p>
      {workspace.role === 'owner' && <div><button onClick={openSettings}>打开数据策略设置</button></div>}
    </div> : <form className="stack" onSubmit={event => void generate(event)}>
      <label>分析目标<textarea required maxLength={1500} value={goal} onChange={event => setGoal(event.target.value)} /></label>
      <label>面向读者<select value={audience} onChange={event=>setAudience(event.target.value as typeof audience)}>
        <option value="">按分析目标判断</option><option value="beginner">初学者</option><option value="high_school">高中生</option>
        <option value="undergraduate">大学生</option><option value="postgraduate">研究生</option><option value="specialist">专业研究者</option>
      </select></label>
      <label className="check"><input type="checkbox" checked={useWeb} onChange={event => setUseWeb(event.target.checked)} />查找互联网资料，包括百科、论文和可引用图片</label>
      <label className="check"><input type="checkbox" checked={useWorkspace} onChange={event => setUseWorkspace(event.target.checked)} />检索当前项目和共享资料，包括已确认结论的原文</label>
      <label>工作空间参考资料<select value={source} onChange={event => setSource(event.target.value)}>
        <option value="">不指定工作空间资料</option>
        {choices.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
      </select></label>
      <details>
        <summary>验收要求</summary>
        <label>必答问题（每行一项）<textarea value={questions} onChange={event=>setQuestions(event.target.value)} maxLength={600} /></label>
        <p className="muted">可用「问题组 &gt; 子问题」把复合要求分成多行。</p>
        <label className="check"><input type="checkbox" checked={requireImage} onChange={event=>setRequireImage(event.target.checked)} />必须附上相关的署名许可图片</label>
        <label>必须引用的 HTTPS 链接（每行一条）<textarea value={sourceLinks} onChange={event=>setSourceLinks(event.target.value)} maxLength={8200} /></label>
      </details>
      {existingText && <label className="check"><input type="checkbox" checked={includeDocument} onChange={event => setIncludeDocument(event.target.checked)} />同时使用当前文档的正文节选</label>}
      <label className="check"><input required type="checkbox" checked={allowed} onChange={event => setAllowed(event.target.checked)} />允许本次输入用于联网检索和分析</label>
      {!synced && <p className="muted">同步本机修改后可以生成分析。</p>}
      <div><button className="primary" disabled={!allowed || !synced || busy || Boolean(pending) || (!useWeb && !source && !useWorkspace)}>生成分析提案</button></div>
    </form>}
    {failure && <p role="alert">{failure}</p>}
    {pending && <p role="status">分析{statusLabel(run.status)}…</p>}
    {run?.runtime_session_id && <RuntimeTimeline key={run.id} runId={run.id} active={Boolean(pending)} cancellable />}
    {run?.status==='CANCELLED' && <p role="status">分析已取消。</p>}
    {run?.result?.requirement_ledger?.items.length ? <RequirementPanel ledger={run.result.requirement_ledger} onEvidence={onEvidence} onBlock={onBlock} /> : null}
    {!run?.result?.requirement_ledger && Boolean(run?.result?.coverage?.requested) && <p className="muted">有证据回答 {run?.result?.coverage?.supported} / {run?.result?.coverage?.requested} 个检索问题。</p>}
    {warning && <p role="alert">{description(warning) ?? '本次未生成分析，请重试。'}</p>}
    {Boolean(run?.result?.missing_requirements?.length) && <ul>{run?.result?.missing_requirements?.map(item=><li key={item}>{item}</li>)}</ul>}
    {patch?.status === 'accepted' && <p role="status">分析已写入当前文档。</p>}
    {patch?.status === 'rejected' && <p role="status">本次分析提案已拒绝。</p>}
    {patch?.status === 'proposed' && !checked && <p>请重新生成分析。</p>}
    {patch?.status === 'proposed' && checked && <section className="detail stack analysis-preview" aria-label="分析提案预览">
      <h3>分析提案预览</h3>
      {patch.operations.map(operation => operation.type === 'insert_block' && <ArtifactBlockView key={operation.block.id}
        block={operation.block} context={{ mode:'proposal',onEvidence,projection }} />)}
      {stale && <p>文档版本已更新。请针对当前版本重新生成分析。</p>}
      <div className="button-row">
        <button className="primary" disabled={!synced || Boolean(stale) || reviewing} onClick={() => void review(true)}>写入当前文档</button>
        <button disabled={reviewing} onClick={() => void review(false)}>拒绝提案</button>
      </div>
    </section>}
  </section>;
}
