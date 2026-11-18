import { useState } from 'react';
import type { Graph, Project } from '../lib/api';
import { KnowledgeFlow } from './knowledge-flow';
import { ContextSelector } from './explorer-controls';
export {nodeTypes,relations} from './graph-labels';

export function GraphExplorer({graph,projects,initialNode,openEvidence,onFocus}:{graph:Graph;projects:Project[];initialNode?:string;openEvidence:(id:string)=>void;onFocus:(id:string)=>void}){
  const [project,setProject]=useState('');
  const nodes=graph.nodes.filter(node=>!project || (project==='shared'?!node.project_id:node.project_id===project));
  const valid=new Set(nodes.map(node=>node.id));
  const edges=graph.edges.filter(edge=>valid.has(edge.from_node_id)&&valid.has(edge.to_node_id));
  return <section className="panel stack graph-explorer" aria-label="筛选知识图谱"><div className="section-heading"><div><p className="eyebrow">KNOWLEDGE / FOCUS ATLAS</p><h2>图谱浏览</h2></div><ContextSelector value={project} onChange={setProject} label="项目范围" options={[{value:'',label:'全部项目'},{value:'shared',label:'工作空间共享'},...projects.map(item=>({value:item.id,label:item.name}))]} /></div><KnowledgeFlow key={project} nodes={nodes} edges={edges} root={valid.has(initialNode||'')?initialNode:undefined} viewKey={'workspace:'+project} onEvidence={openEvidence} onFocus={onFocus} /></section>;
}
