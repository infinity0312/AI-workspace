import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MarkerType, ReactFlow, useNodesState, type Node } from '@xyflow/react';
import type { ProjectionEdge, ProjectionNode } from '@akw/contracts';
import { nodeTypes,relations } from './graph-explorer';

export function KnowledgeFlow({ nodes,edges,root,viewKey,onEvidence,onNode }:{
  nodes:ProjectionNode[]; edges:ProjectionEdge[]; root?:string; viewKey:string; onEvidence:(id:string)=>void; onNode?:(id:string)=>void;
}) {
  const [focus,setFocus] = useState(root ?? '');
  const [query,setQuery] = useState('');
  const [relation,setRelation] = useState('');
  const byId = useMemo(() => new Map(nodes.map(node => [node.id,node])),[nodes]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const neighborhood = new Set([focus,...edges.filter(edge => edge.from_node_id === focus || edge.to_node_id === focus)
      .flatMap(edge => [edge.from_node_id,edge.to_node_id])]);
    return nodes.filter(node => (!focus || neighborhood.has(node.id)) && (!term || (node.title+' '+node.description).toLocaleLowerCase().includes(term))).slice(0,70);
  },[nodes,edges,focus,query]);
  const filtered = useMemo(() => {
    const ids = new Set(visible.map(node => node.id));
    return edges.filter(edge => ids.has(edge.from_node_id) && ids.has(edge.to_node_id) && (!relation || edge.relation_type === relation));
  },[visible,edges,relation]);
  const stored = 'akw-graph-layout:' + viewKey;
  const initial = useMemo(() => {
    let saved:Record<string,{x:number;y:number}> = {};
    try { saved = JSON.parse(localStorage.getItem(stored) ?? '{}'); } catch { /* Use the default grid. */ }
    return visible.map((node,index):Node => ({
      id:node.id,data:{ label:<div className="flow-node-label"><strong>{node.title}</strong><small>{nodeTypes[node.type] ?? node.type}</small></div> },
      position:Number.isFinite(saved[node.id]?.x) && Number.isFinite(saved[node.id]?.y) ? saved[node.id]! :
        { x:(index%4)*208,y:Math.floor(index/4)*116 },
      className:node.id === focus ? 'flow-node-focused' : '',
    }));
  },[visible,focus,stored]);
  const [flow,setFlow,change] = useNodesState(initial);
  useEffect(() => { setFlow(initial); },[initial,setFlow]);
  const flowEdges = useMemo(() => filtered.map(edge => ({
    id:edge.id,source:edge.from_node_id,target:edge.to_node_id,label:relations[edge.relation_type] ?? edge.relation_type,
    markerEnd:{ type:MarkerType.ArrowClosed },animated:false,
  })),[filtered]);
  const current = byId.get(focus);
  return <div className="stack">
    <div className="field-grid">
      <label>查找节点<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>聚焦节点<select value={focus} onChange={event => setFocus(event.target.value)}><option value="">全部节点</option>
        {nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
      <label>关系类型<select value={relation} onChange={event => setRelation(event.target.value)}><option value="">全部关系</option>
        {[...new Set(edges.map(edge => edge.relation_type))].map(type => <option key={type} value={type}>{relations[type] ?? type}</option>)}</select></label>
    </div>
    {visible.length ? <div className="workspace-flow" aria-label="交互图谱">
      <ReactFlow nodes={flow} edges={flowEdges} onNodesChange={change} nodesConnectable={false} deleteKeyCode={null}
        onNodeDoubleClick={(_event,node) => setFocus(node.id)} panOnScroll={false} zoomOnScroll={false}
        onNodeDragStop={(_event,node) => {
          try {
            const saved = JSON.parse(localStorage.getItem(stored) ?? '{}');
            localStorage.setItem(stored,JSON.stringify({ ...saved,[node.id]:node.position }));
          } catch { /* Layout is optional device state. */ }
        }} fitView minZoom={0.15} maxZoom={2}>
        <Background /><Controls showInteractive={false} />
      </ReactFlow>
    </div> : <p className="muted">没有匹配的节点。</p>}
    {current && <div className="detail"><strong>{current.title}</strong><p>{current.description}</p>
      {onNode && <button onClick={() => onNode(current.id)}>打开知识节点</button>}</div>}
    {filtered.length ? <details open={filtered.length <= 8}><summary>关系明细（{filtered.length}）</summary>
      <ul className="projection-edges">{filtered.map(edge => <li key={edge.id}>
        <button onClick={() => setFocus(edge.from_node_id)}>{byId.get(edge.from_node_id)?.title}</button>
        <span>{relations[edge.relation_type] ?? edge.relation_type} →</span>
        <button onClick={() => setFocus(edge.to_node_id)}>{byId.get(edge.to_node_id)?.title}</button>
        {edge.evidence_id && <button className="citation" onClick={() => onEvidence(edge.evidence_id!)}>关系证据</button>}
      </li>)}</ul></details> : <p className="muted">此范围暂无已确认的关系。</p>}
  </div>;
}
