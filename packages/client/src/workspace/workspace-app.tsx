import { WorkspaceHome, ProjectsPage, ActivityPage } from './workspace-home';
import { UIIcon } from './ui-icon';
import { workspaceBrand } from './workspace-brand';
import { PanelResize } from './panel-resize';
import { EditorialImage } from './editorial-image';
import { useCallback, useEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react';
import { type ArtifactDetail, type ArtifactDocument, type ArtifactRevision, type LearningMastery, type LearningAssessmentResult, type RunSummary, type SearchHit, type WorkspaceSummary } from '@akw/contracts';
import { ApiError, api, errorText, post, workspaceApi, type Evidence, type Job, type Patch, type WorkspaceView } from '../lib/api';
import { documentStatus, flushWorkspace, localRepo, type LocalDocument } from '../lib/local-repository';
import { BlockProperties,DocumentOutline,DocumentReferences,SourceReader,readPanels,savePanels,type PanelLayout } from './workspace-inspector';
import { useArtifactProjection } from './use-projection';
import { EvidencePanel, type TextSelection } from './artifact-editor';
import { activeRun } from './workflow-status';
import { ExportCenter } from './export-center';
import { Knowledge } from './knowledge-page';
import { canUseModel,LearningJourney } from './learning-experience';
import { ForecastActions } from './task-experience';
import { Research } from './research-page';
import { Sources } from './sources-page';
import { DocumentCanvas } from './document-canvas';
import { aiPresets,SelectionProposals } from './selection-proposals';
import { useDesktop } from './use-desktop';
import { DocumentAnalysis, isAnalysisPatch } from './document-analysis';
import { CaptureInbox, Maintenance, Trash, VersionHistory } from './library-pages';

import { Comments, Members } from './collaboration';
import { StudyPage } from './study-page';
import { SchedulesPage } from './schedules-page';
import { SearchPage } from './search-page';
import { PreferencesPanel, reopenLastDocument, usePreferences } from './preferences';

type Page = 'projects'|'activity'|'home'|'search'|'artifact'|'capture'|'study'|'schedules'|'research'|'sources'|'knowledge'|'maintenance'|'trash'|'exports'|'settings';
const sections: { id: Page; title: string }[] = [
  { id:'home',title:'工作台' },{ id:'projects',title:'项目' },{ id:'activity',title:'活动' },{ id:'search',title:'搜索' },{ id:'capture',title:'收件箱' },{ id:'research',title:'研究' },{ id:'sources',title:'来源' },
  { id:'study',title:'学习' },{ id:'knowledge',title:'知识关系' },{ id:'maintenance',title:'知识维护' },{ id:'schedules',title:'监测' },{ id:'exports',title:'导出' },{ id:'trash',title:'回收站' },{ id:'settings',title:'设置' },
];
const navGroups = [
  { title:'工作空间',ids:['home','projects','sources','activity'] },
  { title:'探索与整理',ids:['search','capture','research','study','knowledge'] },
  { title:'管理',ids:['maintenance','schedules','exports','trash','settings'] },
];
const navIcon:Record<string,string>={ home:'home',projects:'projects',sources:'sources',activity:'activity',search:'search',study:'study',knowledge:'graph',settings:'settings' };
const emptyView: WorkspaceView = { projects:[],artifacts:[],sources:[] };

export function WorkspaceApp() {
  const [list,setList] = useState<WorkspaceSummary[]>([]);
  const [workspaceId,setWorkspaceId] = useState('');
  const [view,setView] = useState<WorkspaceView>(emptyView);
  const [page,setPage] = useState<Page>('home');
  const [artifactId,setArtifactId] = useState('');
  const [doc,setDoc] = useState<LocalDocument | null>(null);
  const isLearning=doc?.draft.blocks.some(block=>block.type==='learning_goal') ?? false;
  const isWeather=doc?.draft.blocks.some(block=>block.type==='weather_forecast') ?? false;
  const isInformation=doc?.draft.blocks.some(block=>block.type==='information_summary') ?? false;
  const [projectionEpoch,setProjectionEpoch] = useState(0);
  const [evidence,setEvidence] = useState<Evidence | null>(null);
  const [selection,setSelection] = useState<TextSelection | null>(null);
  const [patches,setPatches] = useState<Patch[]>([]);
  const [aiJob,setAiJob] = useState<Job | null>(null);
  const [edit,setEdit] = useState(false);
  const [panels,setPanels] = useState<PanelLayout>({ left:218,right:312,leftOpen:true,rightOpen:false });
  const [inspectedBlock,setInspectedBlock] = useState('');
  const [floatingAI,setFloatingAI] = useState<{ left:number;top:number }>();
  const [reader,setReader] = useState('');
  const [readerPage,setReaderPage] = useState<number|null>(null);
  const [jumpTarget,setJumpTarget] = useState('');
  const [researchGoal,setResearchGoal]=useState('');
  const [mastery,setMastery] = useState<LearningMastery>([]);
  const [instruction,setInstruction] = useState('');
  useEffect(() => { setPanels(readPanels()); },[]);
  useEffect(() => {
    if (!jumpTarget) return;
    const frame=requestAnimationFrame(() => {
      const element=document.getElementById('block-' + jumpTarget);
      element?.scrollIntoView({ block:'start' }); element?.focus({ preventScroll:true }); setJumpTarget('');
    });
    return () => cancelAnimationFrame(frame);
  },[jumpTarget]);
  const [showAnalysis,setShowAnalysis] = useState(false);
  const [showHistory,setShowHistory] = useState(false);
  const [showComments,setShowComments] = useState(false);
  const [archived,setArchived] = useState(false);
  const [initialSource,setInitialSource] = useState<string>();
  const [initialClaim,setInitialClaim] = useState<string>();
  const [initialNode,setInitialNode] = useState<string>();
  const [claimEvidence,setClaimEvidence] = useState<{ id:string; quote:string }>();
  const preferences = usePreferences();
  const [online,setOnline] = useState(true);
  const [backendOffline,setBackendOffline] = useState(false);
  const projection = useArtifactProjection(doc?.server.id,doc?.server.revision.id,page === 'artifact',online && !backendOffline,projectionEpoch);
  const [ready,setReady] = useState(false);
  const [notice,setNotice] = useState('');
  const [exportArtifact,setExportArtifact] = useState<string>();
  const [studyArtifact,setStudyArtifact] = useState<string>();
  const [inspector,setInspector] = useState(false);
  const [nav,setNav] = useState(false);
  const workspace = list.find(item => item.id === workspaceId);
  const selectedArtifact = useRef('');
  const selectedWorkspace = useRef('');
  const refreshRunning = useRef(false);
  const cursorRef = useRef('0');
  const report = useCallback((message: string) => setNotice(message),[]);
  const openSources = useCallback(() => { setInitialSource(undefined); setPage('sources'); setNav(false); },[]);
  const openCapture = useCallback(() => { setPage('capture'); setNav(false); },[]);
  const { platform,capture,quickCaptureKey,importQueue } = useDesktop(workspaceId,openSources,openCapture,report);

  const loadView = useCallback(async (id: string) => {
    const fresh = await workspaceApi.view(id);
    await localRepo.cacheView(id,fresh);
    return fresh;
  },[]);
  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const value = await loadView(workspaceId);
    if (selectedWorkspace.current === workspaceId) setView(value);
  },[loadView,workspaceId]);
  const refreshPatches = useCallback(async (id: string) => {
    const result = await api<Patch[]>('/artifacts/' + id + '/patches');
    if (selectedArtifact.current === id) setPatches(result);
  },[]);
  const openArtifact = useCallback((id: string, analysis = false) => {
    setReader(''); setInstruction(''); setInspectedBlock(''); setFloatingAI(undefined);
    setShowAnalysis(analysis);
    setMastery([]);
    setShowHistory(false);
    setShowComments(false);
    setArchived(false);
    selectedArtifact.current = id;
    if (!new URLSearchParams(window.location.search).has('artifact')) localStorage.setItem('akw-last-artifact',id);
    setArtifactId(id);
    setPage('artifact');
    setEvidence(null);
    setSelection(null);
    setNav(false);
    setNotice('');
  },[]);
  function updatePanels(fields:Partial<PanelLayout>) {
    setPanels(previous => { const next={ ...previous,...fields }; savePanels(next); return next; });
  }
  const inspectorOrigin=useRef<HTMLElement|null>(null);
  function showInspector(capture=true) {if(capture)inspectorOrigin.current=document.activeElement as HTMLElement;setInspector(true);updatePanels({rightOpen:true});}
  function closeInspector(){setInspector(false);updatePanels({rightOpen:false});if(page!=='artifact'){setEvidence(null);setReader('');}window.requestAnimationFrame(()=>{if(inspectorOrigin.current?.isConnected)inspectorOrigin.current.focus({preventScroll:true});});}
  useEffect(()=>{if(!inspector||(!evidence&&!reader))return;const frame=window.requestAnimationFrame(()=>document.querySelector<HTMLElement>('.inspector.inspector-open')?.focus({preventScroll:true}));return()=>window.cancelAnimationFrame(frame);},[inspector,evidence,reader,page]);
  function jumpToBlock(id:string) { setFloatingAI(undefined); setJumpTarget(id); }
  function inspectSource(id:string) { setReader(id); setReaderPage(null); setEvidence(null); showInspector(); }
  function inspectNode(id:string) { navigate('knowledge'); setInitialNode(id); }
  function navigate(target: Page) {
    setFloatingAI(undefined); setNotice('');
    setNav(false);
    if (target === 'exports') setExportArtifact(undefined);
    if (target === 'research') setResearchGoal('');
    if (target === 'study') setStudyArtifact(undefined);
    if (target === 'sources') setInitialSource(undefined);
    if (target === 'maintenance') { setInitialClaim(undefined); setClaimEvidence(undefined); }
    if (target === 'knowledge') setInitialNode(undefined);
    setEvidence(null);setReader('');setReaderPage(null);
    setPage(target);
  }
  function openSource(id:string) {
    navigate('sources');
    setInitialSource(id);
  }
  function openClaimDraft(evidence:{ id:string; quote:string }) {
    navigate('maintenance');
    setClaimEvidence(evidence);
  }
  function openHit(hit:SearchHit) {
    switch (hit.kind) {
      case 'artifact': openArtifact(hit.id); break;
      case 'source': openSource(hit.id); break;
      case 'capture': navigate('capture'); break;
      case 'node': navigate('knowledge'); setInitialNode(hit.id); break;
      case 'claim': navigate('maintenance'); setInitialClaim(hit.id); break;
    }
  }
  function chooseWorkspace(id: string) {
    localStorage.setItem('akw-last-workspace',id);
    localStorage.removeItem('akw-last-artifact');
    selectedArtifact.current = '';
    selectedWorkspace.current = id;
    setWorkspaceId(id);
    setArtifactId('');
    setPage('home');
    setDoc(null);
    setNotice('');
  }

  useEffect(() => {
    let mounted = true;
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online',update);
    window.addEventListener('offline',update);
    const select = (items: WorkspaceSummary[]) => {
      if (!mounted) return;
      const params = new URLSearchParams(window.location.search);
      const remembered = params.get('workspace') ?? localStorage.getItem('akw-last-workspace');
      const matching = items.find(item => item.id === remembered) ?? items[0];
      setList(items);
      selectedWorkspace.current = matching?.id ?? '';
      setWorkspaceId(matching?.id ?? '');
      const last = params.get('artifact') ?? (reopenLastDocument() ? localStorage.getItem('akw-last-artifact') : null);
      if (last && matching?.id === remembered) openArtifact(last);
      setReady(true);
    };
    void (async () => {
      try {
        if (!navigator.onLine) throw new Error('离线');
        const items = await workspaceApi.list();
        if (mounted) setBackendOffline(false);
        await localRepo.cacheWorkspaces(items);
        select(items);
      } catch (error) {
        if (error instanceof ApiError && [401,403].includes(error.status)) { select([]); report(errorText(error)); return; }
        if (mounted) setBackendOffline(true);
        const cached = await localRepo.workspaces().catch(() => undefined);
        select(cached ?? []);
        if (mounted && !cached) report(errorText(error));
      }
    })();
    return () => { mounted = false; window.removeEventListener('online',update); window.removeEventListener('offline',update); };
  },[openArtifact,report]);

  useEffect(() => {
    if (!workspaceId) return;
    let mounted = true;
    setView(emptyView);
    void (async () => {
      const cached = await localRepo.view(workspaceId).catch(() => undefined);
      if (!mounted) return;
      if (cached) setView(cached);
      if (!navigator.onLine) return;
      try {
        const value = await loadView(workspaceId);
        if (mounted) setView(value);
      } catch (error) { if (mounted) report(errorText(error)); }
    })();
    return () => { mounted = false; };
  },[workspaceId,loadView,report]);

  useEffect(() => {
    if (!artifactId) return;
    let mounted = true;
    setDoc(null);
    setPatches([]);
    setEdit(false);
    void (async () => {
      const cached = await localRepo.artifact(artifactId).catch(() => undefined);
      if (mounted && cached) setDoc(cached);
      if (!navigator.onLine) return;
      try {
        const local = await localRepo.cacheArtifact(await workspaceApi.artifact(artifactId));
        if (mounted) setDoc(local);
        await refreshPatches(artifactId);
      } catch (error) {
        if (mounted && cached && error instanceof ApiError && error.status === 404) setArchived(true);
        if (mounted && !cached) report(errorText(error));
      }
    })();
    return () => { mounted = false; };
  },[artifactId,refreshPatches,report]);

  useEffect(() => {
    if (!workspaceId || !online) return;
    let mounted = true;
    cursorRef.current = '0';
    const tick = async () => {
      if (!mounted || refreshRunning.current) return;
      refreshRunning.current = true;
      try {
        const after = await localRepo.cursor(workspaceId) ?? cursorRef.current;
        const changes = await workspaceApi.changes(workspaceId,after);
        if (!mounted) return;
        setBackendOffline(false);
        if (changes.changes.length) {
          const fresh = await loadView(workspaceId);
          if (!mounted) return;
          setView(fresh);
          if (changes.changes.some(item => ['knowledge_node','knowledge_edge'].includes(item.aggregate_type))) setProjectionEpoch(value => value + 1);
          if (changes.changes.some(item => ['WorkspaceMemberChanged','WorkspacePolicyChanged'].includes(item.event_type))) {
            const items = await workspaceApi.list();
            await localRepo.cacheWorkspaces(items);
            if (!mounted) return;
            setList(items);
          }
          const id = selectedArtifact.current;
          const touched = changes.changes.filter(item => item.aggregate_type === 'artifact' && item.aggregate_id === id);
          if (id && touched.length) {
            try {
              const local = await localRepo.cacheArtifact(await workspaceApi.artifact(id));
              if (mounted && id === selectedArtifact.current) { setDoc(local); setArchived(false); }
              await refreshPatches(id);
            } catch (error) {
              if (!(error instanceof ApiError && error.status === 404)) throw error;
              if (mounted && id === selectedArtifact.current) setArchived(true);
            }
          }
          await localRepo.cacheCursor(workspaceId,changes.next_cursor);
          cursorRef.current = changes.next_cursor;
        }
        if (workspace?.role !== 'viewer') await flushWorkspace(workspaceId);
        const currentId = selectedArtifact.current;
        if (currentId) {
          const latest = await localRepo.artifact(currentId);
          if (mounted && latest && selectedArtifact.current === currentId) setDoc(latest);
        }
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError && [401,403,404].includes(error.status)) {
          try {
            const items = error.status === 401 ? [] : await workspaceApi.list();
            await localRepo.cacheWorkspaces(items);
            if (!mounted) return;
            setList(items);
            if (!items.some(item => item.id === workspaceId)) {
              const replacement = items[0]?.id ?? '';
              selectedArtifact.current = '';
              selectedWorkspace.current = replacement;
              setWorkspaceId(replacement);
              setArtifactId('');
              setDoc(null);
              setView(emptyView);
              setPage('home');
              report('当前工作空间已不可访问。');
            }
          } catch { setBackendOffline(true); }
        } else setBackendOffline(true);
      } finally { refreshRunning.current = false; }
    };
    void tick();
    const timer = window.setInterval(() => void tick(),3000);
    return () => { mounted = false; window.clearInterval(timer); };
  },[workspaceId,workspace?.role,online,loadView,refreshPatches,report]);

  useEffect(() => {
    if (!aiJob) return;
    let mounted = true;
    const check = async () => {
      try {
        const result = await api<RunSummary>(aiJob.status_url.replace('/v1',''));
        if (!mounted || activeRun(result.status)) return;
        setAiJob(null);
        if (result.status === 'COMPLETED' && selectedArtifact.current) await refreshPatches(selectedArtifact.current);
        else {
          const code=result.result?.warning;
          report(code === 'AI_EDIT_EVIDENCE' ? '这次修改改变了已引用的事实。可补充来源后重新分析。' :
            code === 'AI_EDIT_SCOPE' ? '改写遗漏了原文的适用条件。可缩小选区后重试。' :
            code === 'AI_EDIT_LENGTH' ? '改写未达到要求的篇幅。可换一个选区后重试。' :
            result.status==='CANCELLED' ? 'AI 改写已取消。' : code ?? 'AI 提案未完成');
        }
      } catch (error) { if (mounted) report(errorText(error)); }
    };
    const timer = window.setInterval(() => void check(),1800);
    return () => { mounted = false; window.clearInterval(timer); };
  },[aiJob,refreshPatches,report]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name'));
    try {
      const item = await post<WorkspaceSummary>('/workspaces',{ name });
      const items = await workspaceApi.list();
      await localRepo.cacheWorkspaces(items);
      setList(items);
      chooseWorkspace(item.id);
      form.reset();
    } catch (error) { report(errorText(error)); }
  }
  async function createItem(event: FormEvent<HTMLFormElement>, kind: 'project'|'artifact') {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get('title'));
    try {
      if (kind === 'project') await post('/workspaces/' + workspaceId + '/projects',{ name });
      else {
        const item = await post<ArtifactDetail>('/artifacts',{ workspace_id:workspaceId,project_id:fields.get('project') || null,title:name,kind:fields.get('kind') ?? 'document' });
        await localRepo.cacheArtifact(item);
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        openArtifact(item.id,submitter instanceof HTMLButtonElement && submitter.value === 'analysis');
      }
      await refresh();
      form.reset();
    } catch (error) { report(errorText(error)); }
  }
  async function saveDraft(content: ArtifactDocument) {
    if (!doc) return false;
    const id = doc.server.id;
    try {
      const saved = await localRepo.save(doc,content);
      if (id === selectedArtifact.current) { setDoc(saved); setSelection(null); setNotice(''); }
      if (navigator.onLine) {
        void flushWorkspace(saved.server.workspace_id).then(async () => {
          const updated = await localRepo.artifact(id);
          if (updated && id === selectedArtifact.current) setDoc(updated);
        }).catch(() => {});
      }
      return true;
    } catch (error) {
      report(errorText(error));
      return false;
    }
  }
  async function resolveConflict(keepLocal: boolean) {
    if (!doc) return;
    try {
      const server = await workspaceApi.artifact(doc.server.id);
      const resolved = await localRepo.resolve(server,keepLocal);
      setDoc(resolved);
      if (keepLocal) {
        await flushWorkspace(server.workspace_id);
        setDoc(await localRepo.artifact(server.id) ?? resolved);
      }
    } catch (error) { report(errorText(error)); }
  }
  const updateCurrent=useCallback(async (item:ArtifactDetail)=>{
    const updated = await localRepo.cacheArtifact(item);
    if (selectedArtifact.current === item.id) { setDoc(updated);setProjectionEpoch(value=>value+1); }
    await refresh();
  },[refresh]);
  const learningRevision=doc?.server.revision.id;
  useEffect(()=>{
    if (!isLearning || !artifactId || !learningRevision) return;
    const controller=new AbortController();
    void api<LearningMastery>('/artifacts/'+artifactId+'/learning-mastery',{ signal:controller.signal })
      .then(result=>{ if (!controller.signal.aborted) setMastery(result); }).catch(()=>{});
    return ()=>controller.abort();
  },[isLearning,artifactId,learningRevision]);
  function recordMastery(id:string,score:LearningAssessmentResult) {
    if (!learningRevision) return;
    setMastery(previous=>[...previous.filter(item=>item.lesson_id!==id),{ lesson_id:id,revision_id:learningRevision,
      correct:score.correct,total:score.total,attempts:(previous.find(item=>item.lesson_id===id)?.attempts ?? 0)+1 }]);
  }
  async function trashCurrent() {
    if (!doc || documentStatus(doc) !== 'synced') return;
    try {
      await post('/artifacts/' + doc.server.id + '/trash',{ base_revision_id:doc.server.revision.id });
      localStorage.removeItem('akw-last-artifact');
      selectedArtifact.current = '';
      setArtifactId('');
      await refresh();
      navigate('trash');
      report('文档已移至回收站。');
    } catch (error) { report(errorText(error)); }
  }
  async function loadEvidence(id: string) {
    inspectorOrigin.current=document.activeElement as HTMLElement;
    try { setEvidence(await workspaceApi.evidence(id)); setReader(''); showInspector(false); } catch (error) { report(errorText(error)); }
  }
  async function insertEvidence(id:string) {
    if (!doc || archived || workspace?.role === 'viewer') return;
    const block = { id:crypto.randomUUID(),type:'evidence_reference',attrs:{ evidence_id:id } };
    if (await saveDraft({ ...doc.draft,blocks:[...doc.draft.blocks,block] })) jumpToBlock(block.id);
  }
  function copyArtifactLink() {
    if (!doc || !platform.clipboard) return;
    const url = new URL(platform.kind === 'web' ? window.location.origin : 'http://127.0.0.1:3000');
    url.searchParams.set('workspace',doc.server.workspace_id);
    url.searchParams.set('artifact',doc.server.id);
    void platform.clipboard.write(url.href).then(() => report('已复制文档链接。')).catch(error => report(errorText(error)));
  }
  async function makeProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!doc || !selection) return;
    const data = new FormData(event.currentTarget);
    try {
      setAiJob(await post<Job>('/artifacts/' + doc.server.id + '/ai-patch-runs',{
        ...selection,base_revision_id:doc.server.revision.id,instruction:String(data.get('instruction')),allow_external:true,
      }));
      setSelection(null);
    } catch (error) { report(errorText(error)); }
  }
  async function reviewPatch(id: string, accept: boolean) {
    if (!doc) return;
    try {
      const result = await post<{ revision: ArtifactRevision | null }>('/artifacts/' + doc.server.id + '/patches/' + id + '/' + (accept ? 'accept' : 'reject'));
      if (result.revision) {
        const revision = result.revision;
        setDoc(await localRepo.cacheArtifact({ ...doc.server,canonical_revision_id:revision.id,revision }));
      }
      await refreshPatches(doc.server.id);
    } catch (error) {
      const code=error instanceof ApiError ? error.code : undefined;
      report(code === 'CONFLICT_ANALYSIS_OUTDATED' ? '请使用当前证据规则重新生成提案。' :
        code === 'CONFLICT_ANALYSIS_SOURCE' ? '引用来源已变化，请重新生成提案。' : errorText(error));
    }
  }
  async function updatePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const changed = await api<WorkspaceSummary>('/workspaces/' + workspaceId + '/policy',{
        method:'PATCH',key:crypto.randomUUID(),body:{ sensitivity:data.get('sensitivity'),externalProviderAllowed:data.has('external') },
      });
      const items = list.map(item => item.id === changed.id ? changed : item);
      setList(items);
      await localRepo.cacheWorkspaces(items);
      report('工作空间策略已保存');
    } catch (error) { report(errorText(error)); }
  }
  function copyDocument() {
    if (!doc || !platform.clipboard) return;
    const text = [doc.server.title,...doc.draft.blocks.map(block => block.children?.map(item => item.text ?? '').join('') || String(block.attrs?.latex ?? ''))].join('\n\n');
    void platform.clipboard.write(text).then(() => report('文档正文已复制')).catch(error => report(errorText(error)));
  }
  function separateWindow() {
    if (!doc || !platform.windows) return;
    void platform.windows.openArtifact(doc.server.workspace_id,doc.server.id).catch(error => report(errorText(error)));
  }
  const inspected = doc?.draft.blocks.find(block => block.id === inspectedBlock);
  const localStatus = doc ? documentStatus(doc) : 'synced';
  const status = localStatus === 'conflict' ? '同步冲突' : !online ? '离线'
    : backendOffline ? (platform.kind === 'web' ? '服务断开' : '本地服务断开') : localStatus === 'pending' ? '待同步' : '在线';
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open]')){setNav(false);closeInspector();}
      if ((event.ctrlKey || event.metaKey) && event.key==='k') { event.preventDefault();navigate('search'); }
    };
    window.addEventListener('keydown',keyboard);
    return()=>window.removeEventListener('keydown',keyboard);
  });
  return <div className="app" data-density={preferences.value.density}>
    <a className="skip-link" href="#main-content">跳到主内容</a>
    <header className="top">
      <button className="menu-button" aria-label="打开导航" aria-expanded={nav} onClick={() => setNav(!nav)}><UIIcon name="menu" /></button>
      <button className="brand" onClick={() => navigate('home')} aria-label={workspaceBrand.product+' · 返回工作台'}><span className="brand-mark" aria-hidden="true">{workspaceBrand.monogram}</span><span>{workspaceBrand.name}<small>{workspaceBrand.product}</small></span></button>
      <div className="context-breadcrumb"><span>{workspace?.name ?? '知识工作室'}</span><span aria-hidden="true">/</span><strong>{page==='artifact' ? doc?.server.title ?? '文档' : sections.find(item=>item.id===page)?.title}</strong></div>
      <button className="global-search" onClick={()=>navigate('search')} aria-label="全局搜索"><UIIcon name="search" /><span>搜索空间</span><kbd>Ctrl K</kbd></button>
      <span className="connection" data-status={!online || backendOffline ? 'offline' : localStatus}><span aria-hidden="true" />{status}</span>
      {page === 'artifact' && <button className="desktop-panel-toggle" aria-expanded={panels.leftOpen} onClick={() => updatePanels({ leftOpen:!panels.leftOpen })}>导航</button>}
      {page === 'artifact' && <button className="inspector-toggle" aria-expanded={inspector || panels.rightOpen} onClick={() => {
        if (window.matchMedia('(max-width:1070px)').matches) setInspector(!inspector);
        else updatePanels({ rightOpen:!panels.rightOpen });
      }}>检查器</button>}
    </header>
    <div className={'shell ' + (page === 'artifact' ? 'with-inspector' + (panels.leftOpen ? '' : ' left-collapsed') + (panels.rightOpen ? '' : ' right-collapsed') : '')}
      style={{ '--sidebar-width':panels.left+'px','--inspector-width':panels.right+'px' } as CSSProperties}>
      {nav && <button className="nav-scrim" aria-label="关闭导航" onClick={()=>setNav(false)} />}
      <aside className={'sidebar ' + (nav ? 'mobile-open' : '')}>
        <div className="sidebar-caption"><span>你的知识空间</span><button className="mobile-nav-close" aria-label="关闭导航面板" onClick={()=>setNav(false)}><UIIcon name="close" /></button></div>
        <label>工作空间<select value={workspaceId} onChange={event => chooseWorkspace(event.target.value)}>
          {!workspaceId && <option value="">选择工作空间</option>}
          {list.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        {page === 'artifact' && doc && <DocumentOutline content={doc.draft} jump={jumpToBlock} />}
        {page === 'artifact' && Boolean(projection.graph?.nodes.length) && <details className="outline"><summary>知识节点</summary>
          <nav aria-label="文档知识节点">{projection.graph?.nodes.slice(0,12).map(node => <button key={node.id} onClick={() => inspectNode(node.id)}>{node.title}</button>)}
            <button onClick={() => navigate('knowledge')}>浏览知识图谱</button></nav>
        </details>}
        <nav aria-label="主导航">{navGroups.map(group=><div className="nav-group" key={group.title}><p>{group.title}</p>{group.ids.map(id=>sections.find(item=>item.id===id)!).map(item=><button key={item.id} aria-current={page===item.id ? 'page' : undefined} className={page===item.id ? 'selected' : ''} onClick={()=>navigate(item.id)}><UIIcon name={navIcon[item.id] ?? 'sources'} />{item.title}</button>)}</div>)}</nav>
        {view.artifacts.length > 0 && <div className="side-documents"><h2>文档</h2>
          {view.artifacts.map(item => <button key={item.id} className={page === 'artifact' && artifactId === item.id ? 'selected' : ''} onClick={() => openArtifact(item.id)}>{item.title}</button>)}
        </div>}
        {page==='artifact' && <PanelResize side="left" width={panels.left} onChange={left=>updatePanels({ left })} />}
      </aside>
      <main className="canvas" id="main-content" tabIndex={-1}>
        {(!online || backendOffline) && <div className="connection-art-notice" role="status"><EditorialImage asset={!online ? 'offline-preserved' : 'error-recovery'} /><p>{!online ? '当前离线，已保存的文档仍可继续阅读和编辑。' : '连接暂时中断，本机草稿会保留，服务恢复后继续同步。'}</p></div>}
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>关闭</button></div>}
        {!ready ? <p className="muted">正在打开工作台…</p> : !workspace ? <div className="workflow">
          <header className="page-heading"><h1>创建工作空间</h1><p>从一个学习主题或研究方向开始。</p></header>
          <form className="panel stack" onSubmit={event => void createWorkspace(event)}><label>工作空间名称<input required maxLength={200} name="name" placeholder="例如：材料与图神经网络" /></label><div><button className="primary">创建工作空间</button></div></form>
        </div> : <>
          {page === 'projects' && <ProjectsPage view={view} onOpen={openArtifact} onCreate={()=>{ navigate('home');requestAnimationFrame(()=>{ const el=document.getElementById('manual-create') as HTMLDetailsElement|null;if(el){ el.open=true;el.scrollIntoView({ block:'start' }); } }); }} />}
          {page === 'activity' && <ActivityPage workspace={workspaceId} online={online && !backendOffline} onOpen={openArtifact} onResearch={()=>navigate('research')} />}
          {page === 'home' && <WorkspaceHome workspace={workspace} view={view} online={online && !backendOffline} onOpen={openArtifact} onSettings={()=>navigate('settings')} onProjects={()=>navigate('projects')} onSources={()=>navigate('sources')} onActivity={()=>navigate('activity')}>
            <details className="manual-create" id="manual-create"><summary>手动组织项目与文档</summary><div className="home-grid">
              <form className="panel stack" onSubmit={event => void createItem(event,'project')}><h2>项目</h2>
                <label>项目名称<input required name="title" maxLength={200} /></label><div><button>创建项目</button></div>
                {view.projects.map(project => <p className="project-row" key={project.id}>{project.name}</p>)}
              </form>
              <form className="panel stack" onSubmit={event => void createItem(event,'artifact')}><h2>新建文档</h2>
                <label>文档标题<input required name="title" maxLength={200} /></label>
                <label>类型<select name="kind"><option value="document">正式文档</option><option value="note">知识笔记</option></select></label>
                <label>项目<select name="project"><option value="">工作空间共享</option>{view.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                <div className="button-row"><button>创建空白文档</button><button className="primary" value="analysis">创建并分析</button></div>
              </form>
            </div></details>
          </WorkspaceHome>}
          {page === 'artifact' && (!doc || doc.server.id !== artifactId ? <p className="muted">正在打开文档…</p> : <article className="document">
            <header className="page-heading">
              <span className="muted">{view.projects.find(project => project.id === doc.server.project_id)?.name ?? workspace.name}</span>
              <h1>{doc.server.title}</h1>
              <small className="muted">最近同步 <time dateTime={doc.server.revision.created_at}>{new Date(doc.server.revision.created_at).toLocaleString('zh-CN')}</time></small>
              <div className="section-heading">
                <span className="muted">版本 {doc.server.revision.revision_number} · {localStatus === 'pending' ? '修改已保存在此设备' : localStatus === 'conflict' ? '需要合并' : '已同步'}</span>
                <div className="button-row">
                  {!archived && !isLearning && !isWeather && !isInformation && workspace.role !== 'viewer' && <button className="primary" aria-expanded={showAnalysis} onClick={() => setShowAnalysis(!showAnalysis)}>
                    {patches.some(patch => patch.status === 'proposed' && isAnalysisPatch(patch)) ? '查看 AI 分析' : 'AI 生成分析'}
                  </button>}
                  {!archived && <button onClick={() => { setFloatingAI(undefined); setEdit(!edit); }}>{edit ? '阅读模式' : '编辑模式'}</button>}
                  {!archived && <button aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>批注</button>}
                  {!archived && <button aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>版本记录</button>}
                  {platform.capabilities.separateWindows && <button onClick={separateWindow}>独立窗口</button>}
                  {platform.kind !== 'web' && platform.clipboard && <button onClick={copyDocument}>复制正文</button>}
                  {!archived && !isWeather && !isInformation && workspace.role!=='viewer' && <button onClick={()=>{ navigate('study');setStudyArtifact(doc.server.id); }}>制作复习卡</button>}
                  <button onClick={() => { setExportArtifact(doc.server.id); setPage('exports'); }}>导出</button>
                  {platform.clipboard && <button onClick={copyArtifactLink}>复制文档链接</button>}
                </div>
              </div>
            </header>
            {archived && <div className="notice"><span>服务端文档已移至回收站，本机草稿仍保留。</span><button onClick={() => navigate('trash')}>打开回收站</button></div>}
            {localStatus === 'conflict' && !archived && <div className="notice conflict"><p>服务器和本机都有修改。本机草稿已保留。</p>
              <div className="button-row"><button onClick={() => { if (window.confirm('确认保留本机完整草稿并重新提交？')) void resolveConflict(true); }}>保留本机草稿</button>
              <button onClick={() => { if (window.confirm('确认放弃本机待同步草稿？')) void resolveConflict(false); }}>采用服务器版本</button></div></div>}
            {!archived && isWeather && workspace.role!=='viewer' && <div className="button-row">
              {doc.server.revision.content_json.blocks.filter(block=>block.type==='weather_forecast').map(block=>
                <ForecastActions key={block.id} artifact={doc.server} blockId={block.id}
                  enabled={online && !backendOffline && localStatus==='synced' && canUseModel(workspace)} onUpdated={updateCurrent} />)}
            </div>}
            {!archived && isLearning && <LearningJourney key={doc.server.id} artifact={doc.server} content={doc.draft} workspace={workspace}
              mastery={mastery} synced={localStatus==='synced' && online && !backendOffline} onUpdated={updateCurrent} onJump={jumpToBlock} />}
            {!archived && showAnalysis && workspace.role !== 'viewer' && <DocumentAnalysis key={'analysis-' + doc.server.id} artifact={doc.server} workspace={workspace}
              sources={view.sources} patches={patches} projection={projection} synced={localStatus === 'synced' && online && !backendOffline}
              openSettings={() => navigate('settings')} refreshPatches={refreshPatches}
              onEvidence={id => void loadEvidence(id)} onBlock={jumpToBlock} onReview={reviewPatch} />}
            {!archived && showHistory && <VersionHistory key={'history-' + doc.server.id} artifact={doc.server} editable={workspace.role !== 'viewer'}
              projection={projection} onEvidence={id => void loadEvidence(id)} synced={localStatus === 'synced' && online && !backendOffline} onUpdate={updateCurrent} onTrash={trashCurrent} report={report} />}
            {!archived && showComments && <Comments key={'comments-' + doc.server.id} artifact={doc.server} editable={workspace.role !== 'viewer'} owner={workspace.role === 'owner'}
              synced={localStatus === 'synced' && online && !backendOffline} report={report} />}
            {floatingAI && <div className="selection-toolbar button-row" role="group" aria-label="选区快捷操作" style={floatingAI}
              onKeyDown={event => { if (event.key === 'Escape') setFloatingAI(undefined); }}>
              {Object.entries(aiPresets).slice(0,5).map(([label,preset]) => <button key={label} onClick={() => {
                setInstruction(preset); setFloatingAI(undefined); showInspector();
              }}>{label}</button>)}
              <button onClick={() => { setFloatingAI(undefined); showInspector(); }}>更多</button>
              <button onClick={() => setFloatingAI(undefined)} aria-label="关闭选区工具栏">×</button>
            </div>}
            <DocumentCanvas doc={doc} projection={projection} workspace={workspaceId} report={report}
              links={{ onNode:id=>{ if (isLearning && doc.draft.blocks.some(block=>block.id===id)) jumpToBlock(id);else inspectNode(id); },
                onSource:inspectSource,onArtifact:openArtifact,onBlock:jumpToBlock }}
              learning={isLearning ? { artifact:doc.server,mastery,onGraded:recordMastery,
                editable:!archived && workspace.role!=='viewer' && localStatus==='synced' && online && !backendOffline } : undefined}
              editable={!archived && edit && workspace.role !== 'viewer'} onSave={saveDraft} onEvidence={id => void loadEvidence(id)}
              onInspect={id => { setInspectedBlock(id); showInspector(); }} onSelection={selected => {
                if (workspace.role === 'viewer' || archived) return;
                setSelection(selected); setInstruction(''); setInspectedBlock(selected.block_id);
                const range=window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0).getBoundingClientRect() : undefined;
                if (range && window.innerWidth >= 1071) setFloatingAI({ left:Math.min(Math.max(12,range.left),window.innerWidth-390),top:Math.min(window.innerHeight-50,Math.max(68,range.top-46)) });
                else showInspector();
              }} />
          </article>)}
          {page === 'search' && <SearchPage key={workspaceId} workspace={workspaceId} view={view} online={online && !backendOffline} onOpen={openHit} />}
          {page === 'schedules' && <SchedulesPage key={workspaceId} workspace={workspace} sources={view.sources} openSource={openSource}
            openResearch={() => navigate('research')} report={report} />}
          {page === 'study' && <StudyPage key={workspaceId+':'+(studyArtifact ?? '')} initialArtifact={studyArtifact} workspace={workspaceId} documents={view.artifacts} editable={workspace.role !== 'viewer'} openArtifact={openArtifact} report={report} />}
          {page === 'research' && <Research key={workspaceId} initialGoal={researchGoal} ws={workspace} projects={view.projects} sources={view.sources} openArtifact={openArtifact} report={report} />}
          {page === 'sources' && <Sources key={workspaceId} ws={workspaceId} projects={view.projects} sources={view.sources} refresh={refresh} report={report}
            desktop={importQueue} capture={null} initialSource={initialSource} openArtifact={openArtifact} openClaimDraft={openClaimDraft} editable={workspace.role !== 'viewer'} />}
          {page === 'capture' && <CaptureInbox key={workspaceId} workspace={workspaceId} projects={view.projects} capture={capture} editable={workspace.role !== 'viewer'}
            refresh={refresh} openArtifact={openArtifact} openSource={openSource} report={report} />}
          {page === 'maintenance' && <Maintenance key={workspaceId + (claimEvidence?.id ?? '')} workspace={workspaceId} editable={workspace.role !== 'viewer'}
            initialClaim={initialClaim} claimEvidence={claimEvidence} openSource={openSource} openEvidence={id => void loadEvidence(id)} openKnowledge={() => navigate('knowledge')} report={report} />}
          {page === 'trash' && <Trash key={workspaceId} workspace={workspaceId} editable={workspace.role !== 'viewer'} open={openArtifact} refresh={refresh} report={report} />}
          {page === 'knowledge' && <Knowledge key={workspaceId} ws={workspaceId} projects={view.projects} editable={workspace.role !== 'viewer'} initialNode={initialNode}
            openEvidence={id => void loadEvidence(id)} openArtifact={openArtifact} report={report} />}
          {page === 'exports' && <ExportCenter key={workspaceId} ws={workspaceId} artifacts={view.artifacts} initial={exportArtifact} report={report} onRestored={async id => {
            const items = await workspaceApi.list();
            await localRepo.cacheWorkspaces(items);
            setList(items);
            chooseWorkspace(id);
          }} />}
          {page === 'settings' && <div className="workflow"><header className="page-heading"><h1>设置</h1></header>
            {platform.kind === 'windows' && <div className="panel stack"><h2>Windows 桌面</h2><p>{quickCaptureKey ? '快速捕获 ' + quickCaptureKey + '，也可通过系统托盘进入。' : '通过系统托盘进入快速捕获。'}</p><p>文档工作副本和待同步变更保存在本机 SQLite 中。</p></div>}
            <PreferencesPanel {...preferences} />
            <Members key={workspace.id} workspace={workspace.id} owner={workspace.role === 'owner'} report={report} />
            {workspace.role === 'owner' && <form className="panel stack" key={workspace.id + workspace.policy.externalProviderAllowed + workspace.policy.sensitivity} onSubmit={event => void updatePolicy(event)}>
              <h2>数据策略</h2>
              <label>敏感级别<select name="sensitivity" defaultValue={workspace.policy.sensitivity}>
                <option value="public">公开</option><option value="personal">个人</option><option value="sensitive">敏感</option><option value="restricted">受限</option>
              </select></label>
              <label className="check"><input type="checkbox" name="external" defaultChecked={workspace.policy.externalProviderAllowed} />允许单独授权外部模型和搜索</label>
              <div><button className="primary">保存策略</button></div>
            </form>}
            <form className="panel stack" onSubmit={event => void createWorkspace(event)}><h2>新建工作空间</h2>
              <label>名称<input name="name" required maxLength={200} /></label><div><button>创建工作空间</button></div>
            </form>
          </div>}
        </>}
      </main>
      {page!=='artifact'&&inspector&&(evidence||reader)&&<aside className="inspector read-only-inspector inspector-open" tabIndex={-1} aria-label="只读检查器"><div className="section-heading"><h2>检查器</h2><button onClick={closeInspector}>关闭检查器</button></div>{reader&&<SourceReader key={reader} sourceId={reader} firstPage={readerPage} onClose={()=>setReader('')} report={report}/>}<EvidencePanel evidence={evidence} close={()=>setEvidence(null)} read={item=>{setReader(item.source_id);setReaderPage(item.locator.page);}} propose={workspace&&workspace.role!=='viewer'?openClaimDraft:undefined} report={report}/></aside>}
      {page === 'artifact' && doc && <aside tabIndex={-1} aria-label="检查器" className={'inspector ' + (inspector ? 'inspector-open' : '')}>
        <PanelResize side="right" width={panels.right} onChange={right=>updatePanels({ right })} />
        <div className="section-heading"><h2>检查器</h2><button onClick={closeInspector}>关闭检查器</button></div>
        <details><summary>画布布局</summary><div className="stack">
          <label>导航宽度<input type="range" min={180} max={340} value={panels.left} onChange={event => updatePanels({ left:Number(event.target.value) })} /></label>
          <label>检查器宽度<input type="range" min={250} max={500} value={panels.right} onChange={event => updatePanels({ right:Number(event.target.value) })} /></label>
        </div></details>
        {reader && <SourceReader key={reader} sourceId={reader} firstPage={readerPage} onClose={() => setReader('')} report={report} />}
        <EvidencePanel evidence={evidence} close={() => setEvidence(null)} propose={workspace && workspace.role !== 'viewer' ? openClaimDraft : undefined}
          read={item => { setReader(item.source_id); setReaderPage(item.locator.page); }}
          insert={workspace && workspace.role !== 'viewer' && !archived ? id => void insertEvidence(id) : undefined} report={report} />
        {inspected && doc && <BlockProperties block={inspected} editable={workspace?.role !== 'viewer' && !archived} onClose={() => setInspectedBlock('')}
          onChange={block => void saveDraft({ ...doc.draft,blocks:doc.draft.blocks.map(item => item.id === block.id ? block : item) })} />}
        <DocumentReferences projection={projection.graph} content={doc.draft} onSource={inspectSource} onNode={inspectNode} onEvidence={id => void loadEvidence(id)} />
        <SelectionProposals aiJob={aiJob} selection={selection} patches={patches}
          canGenerate={Boolean(workspace?.policy.externalProviderAllowed)} synced={localStatus === 'synced'}
          instruction={instruction} onInstruction={setInstruction} onReview={reviewPatch} onGenerate={makeProposal} onResearch={selected => {
            const text=doc.draft.blocks.find(block => block.id === selected.block_id)?.children?.[selected.inline_index]?.text ?? '';
            navigate('research'); setResearchGoal(text.slice(selected.start_utf16,selected.end_utf16).slice(0,2800));
          }} />
      </aside>}
    </div>
    <nav className="mobile-primary-nav" aria-label="快捷切换">{['home','projects','sources','activity'].map(id=>sections.find(item=>item.id===id)!).map(item=><button key={item.id} aria-current={page===item.id ? 'page' : undefined} onClick={()=>navigate(item.id)}><UIIcon name={navIcon[item.id] ?? 'sources'} /><span>{item.id==='sources' ? '资料库' : item.title}</span></button>)}</nav>
  </div>;
}
