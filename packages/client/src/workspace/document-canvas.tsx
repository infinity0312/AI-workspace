import type { ArtifactDocument } from '@akw/contracts';
import type { LocalDocument } from '../lib/local-repository';
import { type RendererContext } from './artifact-renderer';
import { ArtifactEditor,type TextSelection } from './artifact-editor';
import type { ProjectionState } from './projection-views';

export function DocumentCanvas({ doc,projection,workspace,editable,links,report,onSave,onEvidence,onInspect,onSelection,learning }:{
  learning?:RendererContext['learning'];doc:LocalDocument;projection:ProjectionState;
  workspace:string;editable:boolean;links:{ onNode:(id:string)=>void;onSource:(id:string)=>void;onArtifact:(id:string)=>void;onBlock:(id:string)=>void };
  report:(message:string)=>void;onSave:(content:ArtifactDocument)=>Promise<boolean>;onEvidence:(id:string)=>void;
  onInspect:(id:string)=>void;onSelection:(selected:TextSelection)=>void;
}) {
  return <ArtifactEditor key={'editor-' + doc.server.id} content={doc.draft} projection={projection} workspace={workspace}
      project={doc.server.project_id} learning={learning} report={report} links={links} editable={editable} onSave={onSave}
      onEvidence={onEvidence} onInspect={onInspect} onSelection={onSelection} />;
}
