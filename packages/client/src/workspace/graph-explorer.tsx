import { useEffect, useRef, useState } from 'react';
import type { Graph, Project } from '../lib/api';

export const nodeTypes:Record<string,string> = { concept:'概念',method:'方法',theory:'理论',algorithm:'算法',source:'来源',person:'人物',organization:'机构',
  material:'资料',dataset:'数据集',paper:'论文',claim:'结论',learning_topic:'学习主题',project_topic:'项目主题',event:'事件' };
export const relations:Record<string,string> = { related_to:'相关',depends_on:'依赖',supports:'支持',contradicts:'矛盾',is_a:'属于',derived_from:'派生自',causes:'导致',applies_to:'适用于',contrasts_with:'对比' };
const statuses:Record<string,string> = { confirmed:'已确认',proposed:'待审核',rejected:'已拒绝' };

export function GraphExplorer({ graph,projects,initialNode,openEvidence,onFocus }:{
  graph:Graph; projects:Project[]; initialNode?:string; openEvidence:(id:string)=>void; onFocus:(id:string)=>void;
}) {
  const [filter,setFilter] = useState('');
  const [project,setProject] = useState('');
  const [type,setType] = useState('');
  const [relation,setRelation] = useState('');
  const [status,setStatus] = useState('confirmed');
  const [focus,setFocus] = useState(initialNode ?? '');
  useEffect(() => { onFocus(focus); },[focus,onFocus]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nodes = graph.nodes.filter(node => (!type || node.type === type) &&
    (!project || (project === 'shared' ? !node.project_id : project === node.project_id)) &&
    (!filter.trim() || (node.title + ' ' + node.description).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())));
  const valid = new Set(nodes.map(node => node.id));
  const selected = graph.nodes.find(node => node.id === focus);
  const edges = graph.edges.filter(edge => (!relation || relation === edge.relation_type) && (!status || status === edge.status) &&
    (focus ? (edge.from_node_id === focus && valid.has(edge.to_node_id)) || (edge.to_node_id === focus && valid.has(edge.from_node_id))
      : valid.has(edge.from_node_id) && valid.has(edge.to_node_id)));
  const neighbors = focus ? [...new Set(edges.map(edge => edge.from_node_id === focus ? edge.to_node_id : edge.from_node_id))] : [];
  const shown = nodes.filter(node => !focus || neighbors.includes(node.id)).slice(0,12);
  useEffect(() => {
    if (!selected || !canvas.current || !shown.length) return;
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    const { width,height } = canvas.current;
    ctx.clearRect(0,0,width,height);
    const style = getComputedStyle(canvas.current);
    const ink = style.getPropertyValue('--ink').trim();
    const brand = style.getPropertyValue('--brand').trim();
    ctx.font = '15px system-ui';
    ctx.textAlign = 'center';
    const draw = (x:number,y:number,title:string,active:boolean) => {
      ctx.fillStyle = active ? brand : ink;
      ctx.beginPath(); ctx.arc(x,y,active ? 10 : 6,0,2*Math.PI); ctx.fill();
      ctx.fillText(title.length > 16 ? title.slice(0,15) + '…' : title,x,y+25,138);
    };
    shown.forEach((node,index) => {
      const angle = 2*Math.PI*index/shown.length - Math.PI/2;
      const x = width/2 + width*0.34*Math.cos(angle);
      const y = height/2 + height*0.32*Math.sin(angle);
      ctx.beginPath(); ctx.strokeStyle = style.getPropertyValue('--line').trim();
      ctx.moveTo(width/2,height/2); ctx.lineTo(x,y); ctx.stroke();
      draw(x,y,node.title,false);
    });
    draw(width/2,height/2,selected.title,true);
  },[selected,shown]);
  return <section className="panel stack" aria-label="筛选知识图谱">
    <h2>图谱浏览</h2>
    <div className="field-grid">
      <label>节点关键词<input value={filter} onChange={event => setFilter(event.target.value)} /></label>
      <label>项目范围<select value={project} onChange={event => setProject(event.target.value)}>
        <option value="">全部项目</option><option value="shared">工作空间共享</option>{projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>节点类型<select value={type} onChange={event => setType(event.target.value)}>
        <option value="">全部类型</option>{Object.entries(nodeTypes).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>关系类型<select value={relation} onChange={event => setRelation(event.target.value)}>
        <option value="">全部关系</option>{[...new Set(graph.edges.map(edge => edge.relation_type))].map(id => <option key={id} value={id}>{relations[id] ?? id}</option>)}</select></label>
      <label>审核状态<select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">全部状态</option>{Object.entries(statuses).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>聚焦节点<select value={focus} onChange={event => setFocus(event.target.value)}>
        <option value="">查看筛选结果</option>{selected && !valid.has(selected.id) && <option value={selected.id}>{selected.title}</option>}
        {nodes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    </div>
    {selected && <div className="detail stack"><h3>{selected.title}</h3>{selected.description && <p>{selected.description}</p>}
      {shown.length > 0 && <canvas ref={canvas} className="graph-preview" width={690} height={320} aria-hidden="true" />}</div>}
    <p className="muted">{focus ? neighbors.length : nodes.length} 个节点 · {edges.length} 条匹配关系</p>
    {!focus && <div className="button-row">{shown.map(node => <button key={node.id} onClick={() => setFocus(node.id)}>{node.title}</button>)}</div>}
    {edges.slice(0,100).map(edge => {
      const from = graph.nodes.find(node => node.id === edge.from_node_id);
      const to = graph.nodes.find(node => node.id === edge.to_node_id);
      return <div className="list-item" key={edge.id}>
        <button onClick={() => setFocus(edge.from_node_id)}>{from?.title ?? '起点'}</button>
        <span>{relations[edge.relation_type] ?? edge.relation_type} →</span>
        <button onClick={() => setFocus(edge.to_node_id)}>{to?.title ?? '终点'}</button>
        <span>{statuses[edge.status] ?? edge.status}</span>
        {edge.evidence_id && <button onClick={() => openEvidence(edge.evidence_id!)}>查看证据</button>}
      </div>;
    })}
  </section>;
}
