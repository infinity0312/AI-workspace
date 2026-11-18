import {projectionLabels} from './projection-views';
import type { ArtifactDocument } from '@akw/contracts';
import type { LocalDocument } from '../lib/local-repository';
import { type RendererContext } from './artifact-renderer';
import { ArtifactEditor,type TextSelection } from './artifact-editor';
import type { ProjectionState } from './projection-views';
import {AtlasArt} from './atlas-art';
import {ControlPopover} from './explorer-controls';

export function DocumentCanvas({ doc,projection,workspace,editable,links,report,onSave,onEvidence,onInspect,onSelection,learning }:{
  learning?:RendererContext['learning'];doc:LocalDocument;projection:ProjectionState;
  workspace:string;editable:boolean;links:{ onNode:(id:string)=>void;onSource:(id:string)=>void;onArtifact:(id:string)=>void;onBlock:(id:string)=>void };
  report:(message:string)=>void;onSave:(content:ArtifactDocument)=>Promise<boolean>;onEvidence:(id:string)=>void;
  onInspect:(id:string)=>void;onSelection:(selected:TextSelection)=>void;
}) {
  const blocks=doc.draft.blocks;
  const modules=blocks.filter(block=>Object.hasOwn(projectionLabels,block.type)||['table','chart','learning_lesson','guide_step'].includes(block.type));
  const groups=[['组织与探索',['mindmap','graph_embed','dependency_graph','timeline']],['验证与数据',['evidence_network','table','chart']],['阅读与学习',['learning_lesson','guide_step']]] as const;
  const jump=(id:string)=>links.onBlock(id);
  const label=(block:typeof blocks[number])=>String(block.attrs?.title||projectionLabels[block.type]||({chart:'科学图表',table:'数据表',guide_step:'操作步骤',learning_lesson:'学习章节'} as Record<string,string>)[block.type]||'内容块');
  const evidence=projection.graph?.references?.evidence.filter(item=>item.in_document)||[];
  const picker=<div className="atlas-grouped-index">{groups.map(([title,kinds])=>{const items=modules.filter(block=>(kinds as readonly string[]).includes(block.type));return items.length>0&&<section key={title}><h4>{title}</h4>{items.map(block=><button key={block.id} onClick={event=>{const dialog=event.currentTarget.closest('dialog');if(dialog){dialog.close();requestAnimationFrame(()=>jump(block.id));}else jump(block.id);}}>{label(block)}</button>)}</section>;})}</div>;
  const wide=modules.some(block=>['graph_embed','timeline','mindmap','dependency_graph','evidence_network','chart','table'].includes(block.type));
  const menus=<div className="atlas-grouped-menus">{groups.map(([title,kinds])=>{const items=modules.filter(block=>(kinds as readonly string[]).includes(block.type));return items.length>0&&<ControlPopover key={title} label={title+' · '+items.length}><div className="atlas-subindex">{items.map(block=><button key={block.id} onClick={event=>{event.currentTarget.closest('dialog')?.close();requestAnimationFrame(()=>jump(block.id));}}>{label(block)}</button>)}</div></ControlPopover>;})}</div>;
  return <>
    {modules.length>0&&<><nav className="artifact-module-index atlas-desktop-index" aria-label="文档内容索引"><span>本篇内容 / Revision {doc.server.revision.revision_number}</span>{menus}</nav><div className="atlas-mobile-index"><ControlPopover label={'本篇内容 · '+modules.length+' 项'} drawer>{picker}</ControlPopover><small>Revision {doc.server.revision.revision_number}</small></div></>}
    <div className={'atlas-document-frame'+(wide?' has-wide-view':'')}><div className="atlas-manuscript">
    {(learning||blocks.some(block=>block.type==='guide_step'))&&<div className="atlas-publication-note"><p className="eyebrow">{learning?'LEARNING FOLIO':'FIELD MANUAL'} / 阅读与实践</p><p>{learning?'沿着章节建立理解，再用独立练习核对。':'按实际步骤阅读，随时返回资料与依据。'}</p></div>}
    <div className="atlas-print-rule" aria-hidden="true"/>
    <ArtifactEditor key={'editor-' + doc.server.id} content={doc.draft} projection={projection} workspace={workspace}
      project={doc.server.project_id} learning={learning} report={report} links={links} editable={editable} onSave={onSave}
      onEvidence={onEvidence} onInspect={onInspect} onSelection={onSelection} />
    </div><aside className="atlas-document-notes" aria-label="文稿边注"><p className="eyebrow">MARGIN / SOURCES</p><p>一份研究文稿，<br/>也应保留它的来路。</p>{projection.status==='loading'&&!projection.graph?<small>正在读取引用…</small>:<small>正文引用 / {evidence.length} 段</small>}{evidence.slice(0,3).map(item=><button key={item.id} onClick={()=>onEvidence(item.id)}>{item.title}{item.page!=null?' · '+item.page+' 页':''}</button>)}<figure><AtlasArt asset={learning?'aa_learning_botanical_01':'aa_document_notebook_01'}/><figcaption>概念插画<br/>内容以正文和来源为准</figcaption></figure></aside></div>
  </>;
}
