import {AtlasHeading} from './atlas-art';
import {MindMapStructure} from './mindmap-structure';
import {PrimarySearch} from './explorer-controls';
import { EditorialEmpty } from './editorial-image';
import { useEffect,useState } from 'react';
import { KnowledgeFlow } from './knowledge-flow';
import {Chronicle} from './chronicle';
import {DependencyView} from './dependency-view';
import { EvidenceNetwork } from './reference-views';
import { projectionAttrs,selectProjection,type Block,type MindMapBranch,type ProjectionEdge,type ProjectionNode,type WorkspaceProjection } from '@akw/contracts';
import { hierarchyProjection } from './projection-adapter';
import { nodeTypes,relations } from './graph-explorer';

export type ProjectionState = { graph?:WorkspaceProjection; revision?:string; status:'loading'|'ready'|'offline'|'error' };
export const projectionLabels:Record<string,string> = { mindmap:'思维导图',timeline:'时间脉络',graph_embed:'关系图谱',dependency_graph:'依赖图',evidence_network:'证据网络' };
const relationLabel=(edge:ProjectionEdge)=>relations[edge.relation_type] ?? edge.relation_type;

function TreeBranch({ branch,onEvidence,onNode,expanded,depth=0,level=99 }:{ branch:MindMapBranch;onEvidence:(id:string)=>void;onNode?:(id:string)=>void;expanded:boolean;depth?:number;level?:number }) {
  const [closed,setClosed]=useState(!expanded||depth>=level);
  const open=!closed;
  return <li id={'mind-root-'+branch.node.id}><div className="map-node">
    {branch.children.length>0 && <button className="map-collapse" aria-expanded={open} aria-label={(open ? '折叠' : '展开')+branch.node.title} onClick={()=>setClosed(!open)}>{open ? '−' : '+'}</button>}
    {onNode ? <button onClick={()=>onNode(branch.node.id)}><strong>{branch.node.title}</strong></button> : <strong>{branch.node.title}</strong>}
    <small className="muted">{nodeTypes[branch.node.type] ?? branch.node.type}</small>
    {branch.edge?.evidence_id && <button className="citation" onClick={()=>onEvidence(branch.edge!.evidence_id!)}>关系证据</button>}
    {branch.node.description && <p>{branch.node.description}</p>}
    </div>{open && branch.children.length>0 && <ul>{branch.children.map(child=><TreeBranch key={child.node.id} branch={child} onEvidence={onEvidence} onNode={onNode} expanded={expanded} depth={depth+1} level={level} />)}</ul>}</li>;
}

function MindMap({ nodes,edges,root,onEvidence,onNode,editable,workspace,onIncludeNode }:{onIncludeNode?:(id:string)=>void;editable?:boolean;workspace?:string; nodes:ProjectionNode[];edges:ProjectionEdge[];root?:string;onEvidence:(id:string)=>void;onNode?:(id:string)=>void }) {
  const [expanded,setExpanded]=useState(true),[epoch,setEpoch]=useState(0);
  const [query,setQuery]=useState(''),[level,setLevel]=useState(99);
  const [localRoot,setLocalRoot]=useState(root);
  const initialRoot=root;
  const [mode,setMode]=useState<'map'|'outline'>('map');
  useEffect(()=>{if(window.matchMedia('(max-width:767px)').matches){setMode('outline');setLevel(1);setEpoch(value=>value+1);}},[]);
  const { forest,crosslinks,hasHierarchy }=hierarchyProjection(nodes,edges,localRoot);
  const names=new Map(nodes.map(node=>[node.id,node.title]));
  return <div className="stack atlas-branching">
    <AtlasHeading code="BRANCHING KNOWLEDGE / STRUCTURE" title="让主题，长出清楚的分支。" description="层级与交叉引用分开呈现，折叠只改变当前阅读范围。" asset="aa_mindmap_branching_01"/>
    {!hasHierarchy && <p className="muted">当前内容没有明确层级结构。以下保留独立节点，关系请查看图谱或交叉关系索引。</p>}
    <PrimarySearch label="搜索思维节点" value={query} onChange={setQuery} /><div className="button-row"><button aria-pressed={mode==='map'} onClick={()=>setMode('map')}>图形视图</button><button aria-pressed={mode==='outline'} onClick={()=>setMode('outline')}>大纲视图</button><button onClick={()=>{ setExpanded(true);setLevel(99);setEpoch(epoch+1); }}>展开全部分支</button><button onClick={()=>{ setExpanded(false);setEpoch(epoch+1); }}>折叠全部分支</button><button onClick={()=>{setExpanded(true);setLevel(1);setEpoch(epoch+1);}}>展开一级</button><button onClick={()=>{setLocalRoot(initialRoot||forest[0]?.node.id);setQuery('');setExpanded(true);setLevel(1);setEpoch(epoch+1);document.getElementById('mind-root-'+(initialRoot||forest[0]?.node.id))?.scrollIntoView({block:'center'});}}>回到根节点</button></div>
    {query && <ul className="node-index">{nodes.filter(node=>node.title.includes(query)).map(node=><li key={node.id}><button onClick={()=>onNode?.(node.id)}>{node.title}</button></li>)}</ul>}
    <div className="mindmap-viewport" tabIndex={mode==='map' ? 0 : undefined} role="region" aria-label="思维分支，可切换大纲视图"><ul className={'projection-mindmap '+(mode==='map' ? 'mindmap-graphic' : '')} key={epoch}>{forest.map(branch=><TreeBranch key={branch.node.id} branch={branch} onEvidence={onEvidence} onNode={onNode} expanded={expanded} level={level} />)}</ul></div>
    {editable&&workspace&&<MindMapStructure nodes={nodes} workspace={workspace} root={localRoot} onIncludeNode={onIncludeNode}/>}
    {crosslinks.length>0 && <details open><summary>交叉关系与非层级关系（{crosslinks.length}）</summary><p className="projection-caption">多父节点、环及非层级边在此完整保留；树形排布不表示新增事实。</p><ul className="projection-edges">{crosslinks.map(edge=><li key={edge.id}><span>{names.get(edge.from_node_id)} — {relationLabel(edge)} → {names.get(edge.to_node_id)}</span>{edge.evidence_id && <button className="citation" onClick={()=>onEvidence(edge.evidence_id!)}>关系证据</button>}</li>)}</ul></details>}
  </div>;
}

export const ProjectionViewRegistry=Object.freeze({
  graph_embed:{label:'关系图谱',Component:KnowledgeFlow},
  mindmap:{label:'思维导图',Component:MindMap},
  timeline:{label:'时间脉络',Component:Chronicle},
  dependency_graph:{label:'依赖图',Component:DependencyView},
});

export function ProjectionBlock({ block,projection,onEvidence,onNode,onSource,onBlock,editable,workspace,onUpdate }:{onUpdate?:(block:Block)=>void;editable?:boolean;workspace?:string; block:Block;projection?:ProjectionState;
  onEvidence:(id:string)=>void;onNode?:(id:string)=>void;onSource?:(id:string)=>void;onBlock?:(id:string)=>void }) {
  const attrs=projectionAttrs.safeParse(block.attrs);
  if (!attrs.success && block.attrs?.view_version!=null) return <p className="muted">当前版本无法读取此视图。原始数据已保留。</p>;
  const settings=attrs.success ? attrs.data : { view_version:1 as const,node_ids:[],title:undefined,root_id:undefined };
  const label=projectionLabels[block.type] ?? '知识视图',graph=projection?.graph;
  const selected=graph ? selectProjection(graph,settings) : null;
  const View=Object.hasOwn(ProjectionViewRegistry,block.type)?ProjectionViewRegistry[block.type as keyof typeof ProjectionViewRegistry].Component:undefined;
  return <section className="projection-block stack" aria-label={settings.title || label}><h3>{settings.title || label}</h3>
    {projection?.status==='loading'&&graph&&<p role="status">正在检查更新，保留上次有效视图。</p>}
    {projection?.status==='offline' && graph && <span className="muted">本机缓存 · Revision {projection.revision?.slice(0,8) || '版本未标记'} · 联网后更新</span>}
    {projection?.status==='error' && graph && <p role="status">更新知识数据失败，当前显示上次缓存。</p>}
    {block.type==='evidence_network' && !graph ? <p role="status">{projection?.status==='loading'?'正在加载证据数据…':'证据数据不可用，可继续阅读正文。'}</p> : block.type==='evidence_network' ? <EvidenceNetwork references={graph?.references} onEvidence={onEvidence} onSource={onSource} onBlock={onBlock} /> : !selected ? <p className="muted" role="status">{projection?.status==='loading' ? '正在加载知识数据…' : '知识数据暂不可用，可返回正文继续阅读。'}</p> : !selected.nodes.length ? <EditorialEmpty asset={block.type==='timeline' ? 'timeline-empty' : block.type==='mindmap' ? 'mindmap-empty' : 'collection-empty'} title="在「知识关系」创建节点后，即可在此引用。" /> : View ? <View nodes={selected.nodes} edges={selected.edges} viewKey={block.id+':'+block.type} root={settings.root_id} onEvidence={onEvidence} onNode={onNode} {...(block.type==='mindmap'?{editable,workspace,onIncludeNode:(id:string)=>{if(settings.node_ids.length&&!settings.node_ids.includes(id))onUpdate?.({...block,attrs:{...block.attrs,node_ids:[...settings.node_ids,id]}});}}:{})} /> : <p>此视图暂不支持，原始数据已保留。</p>}

  </section>;
}
