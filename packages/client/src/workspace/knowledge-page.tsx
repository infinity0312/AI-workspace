import { useEffect, useState } from 'react';
import { api,errorText,post,type ArtifactSummary,type Graph,type Project } from '../lib/api';
import { GraphExplorer,nodeTypes,relations } from './graph-explorer';
import { ProjectionBlock } from './projection-views';
import { statusLabel } from './workflow-status';

export function Knowledge({ ws, projects, editable, initialNode, openEvidence, openArtifact, report }: { report:(message:string)=>void;
  ws:string; projects:Project[]; editable:boolean; initialNode?:string; openEvidence:(id:string)=>void; openArtifact:(id:string)=>void;
}) {
  const [graph,setGraph] = useState<Graph>({ nodes:[],edges:[] });
  const [title,setTitle] = useState('');
  const [project,setProject] = useState('');
  const [nodeType,setNodeType] = useState('concept');
  const [nodeToEdit,setNodeToEdit] = useState(initialNode ?? '');
  const [focusedNode,setFocusedNode] = useState(initialNode ?? '');
  const [backlinks,setBacklinks] = useState<{ node:string;items:ArtifactSummary[] }>();
  const [edgeToEdit,setEdgeToEdit] = useState('');
  const selectedNode = graph.nodes.find(node => node.id === nodeToEdit);
  const [from,setFrom] = useState('');
  const [to,setTo] = useState('');
  const [relation,setRelation] = useState('related_to');
  const query = '?workspace_id=' + encodeURIComponent(ws);
  useEffect(() => {
    let mounted = true;
    void api<Graph>('/knowledge/graph' + query).then(value => { if (mounted) setGraph(value); }).catch(error => { if (mounted) report(errorText(error)); });
    return () => { mounted = false; };
  },[query,report]);
  async function action(path: string, body: unknown, after?: () => void) {
    try { await post(path,body); setGraph(await api<Graph>('/knowledge/graph' + query)); after?.(); }
    catch (error) { report(errorText(error)); }
  }
  useEffect(() => {
    if (!focusedNode) return;
    const controller = new AbortController();
    void api<ArtifactSummary[]>('/knowledge/nodes/'+focusedNode+'/backlinks',{ signal:controller.signal }).then(items => {
      if (!controller.signal.aborted) setBacklinks({ node:focusedNode,items });
    }).catch(error => { if (!controller.signal.aborted) report(errorText(error)); });
    return () => controller.abort();
  },[focusedNode,report]);
  const nodeTitle = (id: string) => graph.nodes.find(node => node.id === id)?.title ?? '未知节点';
  return <div className="workflow">
    <header className="page-heading"><h1>知识关系</h1><p>维护主题节点与经过审核的关系。</p></header>
    <GraphExplorer key={initialNode ?? ''} graph={graph} projects={projects} initialNode={initialNode} openEvidence={openEvidence} onFocus={setFocusedNode} />
    {focusedNode && backlinks?.node === focusedNode && <section className="panel stack" aria-label="文档反向链接">
      <h2>引用此节点的文档</h2>
      {backlinks.items.map(item => <button key={item.id} onClick={() => openArtifact(item.id)}>{item.title}</button>)}
      {!backlinks.items.length && <p className="muted">还没有文档引用此节点。</p>}
    </section>}
    <ProjectionBlock block={{ id:'workspace-timeline',type:'timeline',attrs:{ view_version:1,node_ids:[] } }}
      projection={{ graph:{ version:1,...graph },status:'ready' }} onEvidence={openEvidence} />
    {editable && <form className="panel stack" onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      void action('/knowledge/nodes',{ workspace_id:ws,project_id:project || null,title,type:nodeType,
        event_date:String(fields.get('date') ?? '').trim() || undefined,event_evidence_id:String(fields.get('date-evidence') ?? '').trim() || undefined,
        description:String(fields.get('description') ?? '') },() => { setTitle(''); form.reset(); });
    }}>
      <h2>新建节点</h2><div className="field-grid">
        <label>节点名称<input required value={title} maxLength={200} onChange={event => setTitle(event.target.value)} /></label>
        <label>节点类型<select value={nodeType} onChange={event => setNodeType(event.target.value)}>{Object.entries(nodeTypes).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>所属项目<select value={project} onChange={event => setProject(event.target.value)}><option value="">工作空间共享</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <label>事件日期（可选）<input name="date" placeholder="YYYY、YYYY-MM 或 YYYY-MM-DD" maxLength={10} /></label>
      <label>日期证据 ID（可选）<input name="date-evidence" maxLength={36} /></label>
      <label>节点描述<textarea name="description" maxLength={4000} /></label>
      <div><button className="primary">创建节点</button></div>
    </form>}
    {editable && graph.nodes.length > 0 && <section className="panel stack">
      <h2>编辑知识节点</h2>
      <label>要编辑的节点<select value={nodeToEdit} onChange={event => setNodeToEdit(event.target.value)}>
        <option value="">选择节点</option>{graph.nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}
      </select></label>
      {selectedNode && <form className="stack" key={selectedNode.id + ':' + selectedNode.version} onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        void api('/knowledge/nodes/' + selectedNode.id,{ method:'PATCH',key:crypto.randomUUID(),body:{ version:selectedNode.version,
          title:fields.get('node-name'),description:fields.get('node-description'),event_date:String(fields.get('node-date') ?? '').trim() || null,
          event_evidence_id:String(fields.get('node-evidence') ?? '').trim() || null } })
          .then(() => api<Graph>('/knowledge/graph' + query)).then(setGraph).catch(error => report(errorText(error)));
      }}>
        <label>节点名称<input name="node-name" maxLength={200} defaultValue={selectedNode.title} required /></label>
        <label>节点描述<textarea name="node-description" maxLength={4000} defaultValue={selectedNode.description} /></label>
        <label>事件日期<input name="node-date" maxLength={10} defaultValue={selectedNode.event_date ?? ''} /></label>
        <label>日期证据 ID<input name="node-evidence" maxLength={36} defaultValue={selectedNode.event_evidence_id ?? ''} /></label>
        <div><button>保存节点</button></div>
      </form>}
    </section>}
    {editable && <form className="panel stack" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void action('/knowledge/edges/suggestions',{ workspace_id:ws,from_node_id:from,to_node_id:to,relation_type:relation === 'custom' ? fields.get('custom-relation') : relation,evidence_id:fields.get('evidence') || undefined }); }}>
      <h2>关系建议</h2><div className="field-grid">
        <label>起点<select required value={from} onChange={event => setFrom(event.target.value)}><option value="">选择节点</option>{graph.nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
        <label>关系类型<select value={relation} onChange={event => setRelation(event.target.value)}>{Object.entries(relations).map(([id,label]) => <option key={id} value={id}>{label}</option>)}<option value="custom">自定义关系</option></select></label>
        <label>终点<select required value={to} onChange={event => setTo(event.target.value)}><option value="">选择节点</option>{graph.nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
      </div>
      {relation === 'custom' && <label>关系名称<input required name="custom-relation" maxLength={100} /></label>}
      <label>证据 ID（可选）<input name="evidence" maxLength={36} /></label>
      <div><button className="primary" disabled={!from || !to || from === to}>提交关系建议</button></div>
      {graph.edges.filter(edge => edge.status === 'proposed').map(edge => <div className="list-item" key={edge.id}><span>{nodeTitle(edge.from_node_id)} → {nodeTitle(edge.to_node_id)} · {edge.relation_type}</span>
        <span>{statusLabel(edge.status)}</span>{edge.status === 'proposed' && <div className="button-row">
          <button type="button" onClick={() => void action('/knowledge/reviews/' + edge.id + '/resolve',{ decision:'confirmed' })}>确认</button>
          <button type="button" onClick={() => void action('/knowledge/reviews/' + edge.id + '/resolve',{ decision:'rejected' })}>拒绝</button>
        </div>}</div>)}
    </form>}
    {editable && <section className="panel stack"><h2>维护已确认关系</h2>
      <label>选择关系<select value={edgeToEdit} onChange={event => setEdgeToEdit(event.target.value)}>
        <option value="">选择关系</option>{graph.edges.filter(edge => edge.status === 'confirmed').map(edge =>
          <option key={edge.id} value={edge.id}>{nodeTitle(edge.from_node_id)} → {relations[edge.relation_type] ?? edge.relation_type} → {nodeTitle(edge.to_node_id)}</option>)}
      </select></label>
      {graph.edges.filter(edge => edge.id === edgeToEdit && edge.status === 'confirmed').map(edge => {
        const change = (action:unknown) => void api('/knowledge/edges/'+edge.id,{ method:'PATCH',key:crypto.randomUUID(),body:{ version:edge.version,action } })
          .then(() => api<Graph>('/knowledge/graph'+query)).then(value => { setGraph(value); setEdgeToEdit(''); }).catch(error => report(errorText(error)));
        return <form key={edge.id} className="stack" onSubmit={event => {
          event.preventDefault();
          const name = new FormData(event.currentTarget).get('relation-name');
          if (name !== edge.relation_type) change({ type:'revise',relation_type:name });
        }}>
          <label>关系名称<input name="relation-name" required maxLength={100} defaultValue={edge.relation_type} /></label>
          <div className="button-row"><button>修改并重新审核</button>
            <button type="button" onClick={() => { if (window.confirm('撤回这条已确认的关系？')) change({ type:'withdraw' }); }}>撤回关系</button>
          </div>
        </form>;
      })}
    </section>}
  </div>;
}
