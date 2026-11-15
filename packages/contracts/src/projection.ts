import { z } from 'zod';
import { workspaceReferences } from './workspace-blocks';

const uuid = z.uuid();
export const chronologyDate = z.string().refine(value => /^(?!0000)\d{4}$/.test(value) ||
  /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(value) || (/^(?!0000)\d{4}-/.test(value) && z.iso.date().safeParse(value).success),
  'Use YYYY, YYYY-MM, or YYYY-MM-DD');
export const knowledgeNodeType = z.enum(['concept','method','theory','algorithm','source','person','organization','material','dataset','paper','claim','learning_topic','project_topic','event']);
export const projectionNode = z.object({
  id:uuid,project_id:uuid.nullable(),title:z.string(),type:z.string(),description:z.string(),
  event_date:chronologyDate.nullable(),event_evidence_id:uuid.nullable(),version:z.number().int().positive(),
});
export const projectionEdge = z.object({
  id:uuid,from_node_id:uuid,to_node_id:uuid,relation_type:z.string(),evidence_id:uuid.nullable(),status:z.string(),
});
export const workspaceProjection = z.object({ version:z.literal(1),scope_project_id:uuid.nullable().optional(),references:workspaceReferences.optional(),nodes:z.array(projectionNode),edges:z.array(projectionEdge) }).strict();
export type ProjectionNode = z.infer<typeof projectionNode>;
export type ProjectionEdge = z.infer<typeof projectionEdge>;
export type WorkspaceProjection = z.infer<typeof workspaceProjection>;
export const projectionAttrs = z.object({
  view_version:z.literal(1),title:z.string().trim().max(160).optional(),
  node_ids:z.array(uuid).max(100).refine(ids => new Set(ids).size === ids.length,'Node IDs must be unique'),
  root_id:uuid.optional(),
}).passthrough().refine(input => !input.root_id || !input.node_ids.length || input.node_ids.includes(input.root_id),'Root node must be included');
export type ProjectionAttrs = z.infer<typeof projectionAttrs>;
export const projectionTypes = ['mindmap','timeline','graph_embed','dependency_graph','evidence_network'] as const;
export type ProjectionType = typeof projectionTypes[number];
export function isProjectionType(type:string):type is ProjectionType {
  return (projectionTypes as readonly string[]).includes(type);
}
export const edgeChange = z.object({
  version:z.number().int().positive(),
  action:z.discriminatedUnion('type',[
    z.object({ type:z.literal('withdraw') }).strict(),
    z.object({ type:z.literal('revise'),relation_type:z.string().trim().min(1).max(100) }).strict(),
  ]),
}).strict();
export const nodeUpdate = z.object({
  version:z.number().int().positive(),title:z.string().trim().min(1).max(200).optional(),type:knowledgeNodeType.optional(),
  description:z.string().max(4000).optional(),event_date:chronologyDate.nullable().optional(),event_evidence_id:uuid.nullable().optional(),
}).strict().refine(input => Object.keys(input).some(key => key !== 'version'),'Choose a field to update');

export function projectionReferences(blocks:readonly { type:string; attrs?:unknown; children?:readonly { type:string; attrs?:Record<string,unknown> }[] }[],related:readonly string[] = []) {
  const ids = new Set(related);
  for (const block of blocks) {
    const linked = block.children?.flatMap(node => node.type === 'wiki_link' ? [node.attrs?.node_id] : []) ?? [];
    if (block.type === 'knowledge_embed') linked.push((block.attrs as { node_id?:string }|undefined)?.node_id);
    for (const value of linked) if (uuid.safeParse(value).success) ids.add(value as string);
    if (!isProjectionType(block.type)) continue;
    const parsed = projectionAttrs.safeParse(block.attrs);
    if (!parsed.success) continue;
    for (const id of parsed.data.node_ids) ids.add(id);
    if (parsed.data.root_id) ids.add(parsed.data.root_id);
  }
  return [...ids].slice(0,2000);
}

export function selectProjection(data:WorkspaceProjection,attrs:ProjectionAttrs) {
  const ids = new Set(attrs.node_ids);
  const nodes = ids.size ? data.nodes.filter(node => ids.has(node.id)) : data.nodes.filter(node =>
    data.scope_project_id === undefined || node.project_id === null || node.project_id === data.scope_project_id || node.id === attrs.root_id);
  const present = new Set(nodes.map(node => node.id));
  return { nodes,edges:data.edges.filter(edge => edge.status === 'confirmed' && present.has(edge.from_node_id) && present.has(edge.to_node_id)) };
}

export type MindMapBranch = { node:ProjectionNode; edge?:ProjectionEdge; children:MindMapBranch[] };
export function mindMapForest(nodes:ProjectionNode[],edges:ProjectionEdge[],rootId?:string):MindMapBranch[] {
  const adjacency = new Map<string,ProjectionEdge[]>();
  const byId = new Map(nodes.map(node => [node.id,node]));
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from_node_id) ?? [];
    neighbors.push(edge);
    adjacency.set(edge.from_node_id,neighbors);
  }
  const visited = new Set<string>();
  const expand = (node:ProjectionNode,edge?:ProjectionEdge,depth = 0):MindMapBranch => {
    visited.add(node.id);
    const children:MindMapBranch[] = [];
    if (depth < 7) for (const link of adjacency.get(node.id) ?? []) {
      const child = byId.get(link.to_node_id);
      if (child && !visited.has(child.id)) children.push(expand(child,link,depth+1));
    }
    return { node,edge,children };
  };
  const incoming = new Set(edges.map(edge => edge.to_node_id));
  const ordered = [...nodes].sort((a,b) => Number(b.id === rootId)-Number(a.id === rootId) ||
    Number(incoming.has(a.id))-Number(incoming.has(b.id)) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const forest:MindMapBranch[] = [];
  for (const node of ordered) if (!visited.has(node.id)) forest.push(expand(node));
  return forest;
}
