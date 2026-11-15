import { useState } from 'react';
import { projectionAttrs, type Block } from '@akw/contracts';
import { projectionLabels, type ProjectionState } from './projection-views';

export function ProjectionEditor({ block,projection,save,close }:{
  block:Block; projection?:ProjectionState; save:(block:Block)=>void; close:()=>void;
}) {
  const parsed = projectionAttrs.safeParse(block.attrs);
  const original = parsed.success ? parsed.data : undefined;
  const [title,setTitle] = useState(original?.title ?? '');
  const [ids,setIds] = useState(original?.node_ids ?? []);
  const [root,setRoot] = useState(original?.root_id ?? '');
  const [error,setError] = useState('');
  const nodes = projection?.graph?.nodes ?? [];
  const known = new Set(nodes.map(node => node.id));
  const missing = ids.filter(id => !known.has(id));
  return <form className="block-edit" onSubmit={event => {
    event.preventDefault();
    const settings = { ...block.attrs,view_version:1,title:title.trim(),node_ids:ids };
    if (root && (!ids.length || ids.includes(root))) Object.assign(settings,{ root_id:root });
    else delete (settings as Record<string,unknown>).root_id;
    const value = projectionAttrs.safeParse(settings);
    if (!value.success) { setError('每个视图最多可选 100 个节点。'); return; }
    save({ ...block,attrs:settings });
  }}>
    <label>视图标题<input value={title} maxLength={160} placeholder={projectionLabels[block.type]} onChange={event => setTitle(event.target.value)} /></label>
    {nodes.length > 0 && <label>包含的节点（留空显示当前项目和共享节点）<select multiple size={Math.min(7,Math.max(3,nodes.length))}
      value={ids.filter(id => known.has(id))} onChange={event => setIds([...missing,...Array.from(event.target.selectedOptions,item => item.value)])}>
      {nodes.map(node => <option key={node.id} value={node.id}>{node.title}{node.event_date && ' · ' + node.event_date}</option>)}
    </select></label>}
    {missing.length > 0 && <button type="button" onClick={() => setIds(ids.filter(id => known.has(id)))}>移除 {missing.length} 个当前不可见的节点</button>}
    {block.type !== 'timeline' && nodes.length > 0 && <label>起始节点<select value={root} onChange={event => setRoot(event.target.value)}>
      <option value="">自动选择</option>{nodes.filter(node => !ids.length || ids.includes(node.id)).map(node => <option key={node.id} value={node.id}>{node.title}</option>)}
    </select></label>}
    {error && <p role="alert">{error}</p>}
    <div className="button-row"><button className="primary">保存视图设置</button><button type="button" onClick={close}>取消</button></div>
  </form>;
}
