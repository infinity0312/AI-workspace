import { isProjectionType,type ArtifactDocument,type ProjectionType } from '@akw/contracts';
import type { LocalDocument } from '../lib/local-repository';
import { ArtifactBlockView,type RendererContext } from './artifact-renderer';
import { ArtifactEditor,type TextSelection } from './artifact-editor';
import { projectionLabels,type ProjectionState } from './projection-views';

export type CanvasView = 'document'|'table'|'chart'|ProjectionType;
const canvasLabels:Record<string,string> = { ...projectionLabels,table:'数据表',chart:'科学图表' };
export const isCanvasView = (value:string):value is CanvasView => value === 'document' || Object.hasOwn(canvasLabels,value);

export function DocumentCanvas({ doc,canvasView,onView,projection,workspace,editable,links,report,onSave,onEvidence,onInspect,onSelection,learning }:{
  learning?:RendererContext['learning'];doc:LocalDocument;canvasView:CanvasView;onView:(view:CanvasView)=>void;projection:ProjectionState;
  workspace:string;editable:boolean;links:{ onNode:(id:string)=>void;onSource:(id:string)=>void;onArtifact:(id:string)=>void;onBlock:(id:string)=>void };
  report:(message:string)=>void;onSave:(content:ArtifactDocument)=>Promise<boolean>;onEvidence:(id:string)=>void;
  onInspect:(id:string)=>void;onSelection:(selected:TextSelection)=>void;
}) {
  const blocks=doc.draft.blocks;
  const contextual=Boolean(learning || blocks.some(block=>['weather_forecast','information_summary'].includes(block.type)));
  const selectedBlocks=blocks.filter(block=>block.type===canvasView);
  const viewBlocks=selectedBlocks.length ? selectedBlocks : isProjectionType(canvasView)
    ? [{ id:doc.server.id,type:canvasView,attrs:{ view_version:1,node_ids:doc.draft.relations.knowledge_node_ids.slice(0,100) } }]
    : [];
  return <>
    <div className="button-row" role="group" aria-label="工作区视图">
      <button aria-pressed={canvasView === 'document'} onClick={() => onView('document')}>正文</button>
      {Object.entries(canvasLabels).filter(([view])=>!contextual || blocks.some(block=>block.type===view)).map(([view,label]) => <button key={view} aria-pressed={canvasView === view}
        onClick={() => { if (isCanvasView(view)) onView(view); }}>{label}</button>)}
    </div>
    {canvasView === 'document' ? <ArtifactEditor key={'editor-' + doc.server.id} content={doc.draft} projection={projection} workspace={workspace}
      project={doc.server.project_id} learning={learning} report={report} links={links} editable={editable} onSave={onSave}
      onEvidence={onEvidence} onInspect={onInspect} onSelection={onSelection} /> : <div className="artifact-content">
      {viewBlocks.map(block => <ArtifactBlockView key={block.id} block={block}
        context={{ mode:'document',projection,blocks,onEvidence,...links }} />)}
      {(canvasView === 'table' || canvasView === 'chart') && !selectedBlocks.length &&
        <p className="muted">可在正文编辑模式添加{canvasLabels[canvasView]}。</p>}
    </div>}
  </>;
}
