import { useState } from 'react';
import { KnowledgeFlow } from './knowledge-flow';
import { EvidenceNetwork } from './reference-views';
import { mindMapForest, projectionAttrs, selectProjection, type Block, type MindMapBranch, type ProjectionEdge, type WorkspaceProjection } from '@akw/contracts';
import { relations } from './graph-explorer';

export type ProjectionState = { graph?:WorkspaceProjection; status:'loading'|'ready'|'offline'|'error' };
export const projectionLabels:Record<string,string> = { mindmap:'思维导图',timeline:'时间脉络',graph_embed:'关系图谱',dependency_graph:'依赖图',evidence_network:'证据网络' };
const relationLabel = (edge:ProjectionEdge) => relations[edge.relation_type] ?? edge.relation_type;

function TreeBranch({ branch,onEvidence }:{ branch:MindMapBranch; onEvidence:(id:string)=>void }) {
  return <li>
    <div className="map-node"><strong>{branch.node.title}</strong>
      {branch.edge && <span className="muted">{relationLabel(branch.edge)}</span>}
      {branch.node.description && <span>{branch.node.description}</span>}
      {branch.edge?.evidence_id && <button className="citation" onClick={() => onEvidence(branch.edge!.evidence_id!)}>关系证据</button>}
    </div>
    {branch.children.length > 0 && <ul>{branch.children.map(child => <TreeBranch key={child.node.id} branch={child} onEvidence={onEvidence} />)}</ul>}
  </li>;
}

export function ProjectionBlock({ block,projection,onEvidence,onNode,onSource,onBlock }:{ block:Block; projection?:ProjectionState;
  onEvidence:(id:string)=>void; onNode?:(id:string)=>void; onSource?:(id:string)=>void; onBlock?:(id:string)=>void }) {
  const [group,setGroup] = useState<'event'|'year'|'month'>('event');
  const attrs = projectionAttrs.safeParse(block.attrs);
  if (!attrs.success && block.attrs?.view_version != null) return <p className="muted">当前版本无法读取此视图。</p>;
  const settings = attrs.success ? attrs.data : { view_version:1 as const,node_ids:[],title:undefined,root_id:undefined };
  const label = projectionLabels[block.type] ?? '知识视图';
  const graph = projection?.graph;
  const selected = graph ? selectProjection(graph,settings) : null;
  const timeline = selected?.nodes.filter(node => node.event_date).sort((a,b) =>
    a.event_date!.localeCompare(b.event_date!) || a.title.localeCompare(b.title));
  return <section className="projection-block stack" aria-label={settings.title || label}>
    <h3>{settings.title || label}</h3>
    {projection?.status === 'offline' && graph && <span className="muted">本机缓存</span>}
    {block.type === 'evidence_network' ? <EvidenceNetwork references={graph?.references} onEvidence={onEvidence} onSource={onSource} onBlock={onBlock} /> : !selected ? <p className="muted">{projection?.status === 'loading' ? '正在加载知识数据…' : '知识数据暂不可用。'}</p> :
      !selected.nodes.length ? <p className="muted">在「知识关系」创建节点后，即可在此引用。</p> :
      block.type === 'timeline' ? timeline?.length ? <>
        <label>时间粒度<select value={group} onChange={event => setGroup(event.target.value as typeof group)}>
          <option value="event">逐事件</option><option value="year">按年</option><option value="month">按年月</option>
        </select></label>
        <ol className="projection-timeline">{timeline.map((node,index) => {
          const precision = group === 'year' ? 4 : group === 'month' ? 7 : 10;
          const bucket = node.event_date!.slice(0,precision);
          return <li key={node.id}>
            {(group === 'event' || timeline[index-1]?.event_date?.slice(0,precision) !== bucket) &&
              <time dateTime={bucket}>{bucket}</time>}
            <strong>{node.title}</strong>{group !== 'event' && node.event_date !== bucket && <small> · {node.event_date}</small>}
            {node.description && <p>{node.description}</p>}
            {node.event_evidence_id && <button className="citation" onClick={() => onEvidence(node.event_evidence_id!)}>日期证据</button>}
          </li>;
        })}</ol>
      </> : <p className="muted">为知识节点添加事件日期后，即可在此查看时间脉络。</p> :
      block.type === 'mindmap' ? <ul className="projection-mindmap">{mindMapForest(selected.nodes,selected.edges,settings.root_id).map(branch =>
        <TreeBranch key={branch.node.id} branch={branch} onEvidence={onEvidence} />)}</ul> :
      <KnowledgeFlow nodes={selected.nodes} edges={block.type === 'dependency_graph' ? selected.edges.filter(edge => ['depends_on','derived_from'].includes(edge.relation_type)) : selected.edges}
        viewKey={block.id + ':' + block.type} root={settings.root_id} onEvidence={onEvidence} onNode={onNode} />}
  </section>;
}
