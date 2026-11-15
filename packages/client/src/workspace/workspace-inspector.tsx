import { useEffect, useState } from 'react';
import type { ArtifactDocument,Block,WorkspaceProjection } from '@akw/contracts';
import { api,errorText,type SourceDetail } from '../lib/api';
import { DownloadLink,ExternalLink,sourcePageLabel } from './native-actions';
import { PdfPreview } from './pdf-preview';

export function DocumentOutline({ content,jump }:{ content:ArtifactDocument; jump:(id:string)=>void }) {
  const headings=content.blocks.filter(block => ['heading','learning_lesson','guide_step'].includes(block.type)).map(block => ({
    id:block.id,level:Number(block.attrs?.level ?? (block.type==='learning_lesson' ? 3 : 2)),title:
      ['learning_lesson','guide_step'].includes(block.type) ? String(block.attrs?.title ?? '') : block.children?.map(node=>node.text ?? '').join('') || '未命名标题',
  }));
  if (!headings.length) return null;
  return <details className="outline"><summary>文档目录</summary><nav aria-label="文档目录">{headings.map(item =>
    <button key={item.id} data-subheading={item.level>2} onClick={() => jump(item.id)}>{item.title}</button>)}</nav></details>;
}

export function SourceReader({ sourceId,firstPage,onClose,report }:{ sourceId:string; firstPage?:number|null; onClose:()=>void; report:(message:string)=>void }) {
  const [source,setSource] = useState<SourceDetail>();
  const [error,setError] = useState('');
  const [showPdf,setShowPdf] = useState(Boolean(firstPage));
  const [page,setPage] = useState<number|null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void api<SourceDetail>('/sources/' + sourceId,{ signal:controller.signal }).then(value => {
      setSource(value); setPage(firstPage ?? value.passages.find(item => item.page != null)?.page ?? null);
    }).catch(problem => { if (!controller.signal.aborted) setError(errorText(problem)); });
    return () => controller.abort();
  },[sourceId,firstPage]);
  const latest=source?.documents[0];
  const passages=source?.passages.filter(item => item.document_id === latest?.id) ?? [];
  const pages=[...new Set(passages.flatMap(item => item.page == null ? [] : [item.page]))].sort((a,b)=>a-b);
  return <section className="stack">
    <div className="section-heading"><h3>来源阅读</h3><button onClick={onClose}>关闭来源</button></div>
    {error ? <p role="alert">{error}</p> : !source ? <p className="muted">正在读取来源…</p> : <>
      <h4>{source.title}</h4>
      <p>{[source.metadata.author,source.metadata.published,source.metadata.doi && 'DOI ' + source.metadata.doi].filter(Boolean).join(' · ')}</p>
      <div className="button-row">
        {source.canonical_url && <ExternalLink url={source.canonical_url} label="打开原网页" report={report} />}
        {source.asset_mime === 'application/pdf' && <button aria-expanded={showPdf} onClick={() => setShowPdf(!showPdf)}>{showPdf ? '关闭 PDF 预览' : '阅读 PDF'}</button>}
        {source.asset_id && <DownloadLink path={'/v1/assets/' + source.asset_id + '/download'} label="下载原文件" report={report} />}
      </div>
      {showPdf && source.asset_id && source.asset_mime === 'application/pdf' && <PdfPreview key={source.asset_id+':'+page} asset={source.asset_id} firstPage={page} />}
      {pages.length > 0 && <label>定位原文页<select value={page ?? ''} onChange={event => setPage(Number(event.target.value))}>
        {pages.map(number => <option key={number} value={number}>{sourcePageLabel(number,latest?.parser_version)}</option>)}
      </select></label>}
      {passages.filter(item => page == null || item.page === page).slice(0,30).map(item => <p className="excerpt" key={item.id}>{item.content}</p>)}
      {!passages.length && <p className="muted">此来源尚无可读文本。</p>}
    </>}
  </section>;
}

export function DocumentReferences({ projection,content,onSource,onNode,onEvidence }:{
  projection?:WorkspaceProjection; content:ArtifactDocument; onSource:(id:string)=>void; onNode:(id:string)=>void; onEvidence:(id:string)=>void;
}) {
  const references = projection?.references;
  const cited = references?.evidence.filter(item => item.in_document) ?? [];
  const ids = new Set([...content.relations.source_ids,...cited.map(item => item.source_id),...content.blocks.flatMap(block =>
    block.type === 'source_embed' && typeof block.attrs?.source_id === 'string' ? [block.attrs.source_id] : [])]);
  const nodeIds = new Set([...content.relations.knowledge_node_ids,...content.blocks.flatMap(block => [
    ...(typeof block.attrs?.node_id === 'string' ? [block.attrs.node_id] : []),
    ...(block.children ?? []).flatMap(item => item.type === 'wiki_link' && typeof item.attrs?.node_id === 'string' ? [item.attrs.node_id] : []),
  ])]);
  return <section className="stack">
    <h3>文档关联</h3>
    {references?.sources.filter(item => ids.has(item.id)).map(item => <button key={item.id} onClick={() => onSource(item.id)}>{item.title}</button>)}
    {projection?.nodes.filter(item => nodeIds.has(item.id)).map(item => <button key={item.id} onClick={() => onNode(item.id)}>{item.title}</button>)}
    {cited.slice(0,8).map(item => <button className="citation" key={item.id} onClick={() => onEvidence(item.id)}>原文证据 · {item.title}</button>)}
    {!ids.size && !nodeIds.size && <p className="muted">插入来源、证据或知识链接后会出现在这里。</p>}
  </section>;
}

export function BlockProperties({ block,editable,onChange,onClose }:{ block:Block;editable:boolean;onChange:(block:Block)=>void;onClose:()=>void }) {
  return <section className="stack"><div className="section-heading"><h3>内容块属性</h3><button onClick={onClose}>关闭属性</button></div>
    <small className="muted">{block.type} · {block.id}</small>
    {block.type === 'heading' && <label>标题级别<select disabled={!editable} value={Number(block.attrs?.level ?? 2)} onChange={event =>
      onChange({ ...block,attrs:{ ...block.attrs,level:Number(event.target.value) } })}>
      {[2,3,4,5,6].map(level => <option key={level} value={level}>H{level}</option>)}
    </select></label>}
    {block.type === 'code_block' && <form className="stack" key={block.id} onSubmit={event => {
      event.preventDefault(); const language=String(new FormData(event.currentTarget).get('language') ?? '').trim();
      onChange({ ...block,attrs:{ ...block.attrs,language } });
    }}><label>代码语言<input name="language" disabled={!editable} maxLength={60} defaultValue={String(block.attrs?.language ?? '')} /></label>
      {editable && <div><button>保存属性</button></div>}
    </form>}
    {!['heading','code_block'].includes(block.type) && <p className="muted">可在正文中编辑此内容块及其设置。</p>}
  </section>;
}

export type PanelLayout = { left:number;right:number;leftOpen:boolean;rightOpen:boolean };
const layoutKey='akw-workspace-panels-v1';
export function readPanels():PanelLayout {
  const defaults={ left:218,right:312,leftOpen:true,rightOpen:true };
  try {
    const data=JSON.parse(localStorage.getItem(layoutKey) ?? '{}') as Partial<PanelLayout>;
    const width=(value:number|undefined,base:number,min:number,max:number) => Number.isFinite(value) ? Math.min(max,Math.max(min,value!)) : base;
    return { left:width(data.left,218,180,340),right:width(data.right,312,250,500),leftOpen:data.leftOpen!==false,rightOpen:data.rightOpen!==false };
  } catch { return defaults; }
}
export function savePanels(layout:PanelLayout) { localStorage.setItem(layoutKey,JSON.stringify(layout)); }
