import { mindMapForest,type ProjectionEdge,type ProjectionNode } from '@akw/contracts';

/** is_a points from a member to its parent. Reverse it only for visual traversal. */
export function hierarchyProjection(nodes:ProjectionNode[],edges:ProjectionEdge[],root?:string) {
  const hierarchy=edges.filter(edge=>edge.relation_type==='is_a').map(edge=>({ ...edge,from_node_id:edge.to_node_id,to_node_id:edge.from_node_id }));
  const forest=mindMapForest(nodes,hierarchy,root);
  const used=new Set<string>();
  const visit=(branches:typeof forest)=>{ for(const branch of branches){ if(branch.edge) used.add(branch.edge.id);visit(branch.children); } };
  visit(forest);
  return { forest,crosslinks:edges.filter(edge=>!used.has(edge.id)),hasHierarchy:hierarchy.length>0 };
}

/** Stable radial positions describe layout, never a new semantic relationship. */
export function atlasPositions(nodes:ProjectionNode[],focus:string) {
  const sorted=[...nodes].sort((a,b)=>Number(b.id===focus)-Number(a.id===focus) || a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const result=new Map<string,{x:number;y:number}>();
  sorted.forEach((node,index)=>{
    if(index===0 && focus){ result.set(node.id,{ x:400,y:320 });return; }
    const offset=index-(focus ? 1 : 0),ring=Math.floor(offset/10),count=Math.min(10,sorted.length-(focus ? 1 : 0)-ring*10);
    const angle=(offset%10)/Math.max(1,count)*Math.PI*2-Math.PI/2;
    result.set(node.id,{ x:400+Math.cos(angle)*(330+ring*260),y:320+Math.sin(angle)*(190+ring*190) });
  });
  return result;
}

/** A bounded window always retains its explicit navigation center. */
export function focusWindow(nodes:ProjectionNode[],focus:string,limit:number){const current=nodes.find(node=>node.id===focus);return (current?[current,...nodes.filter(node=>node.id!==focus)]:nodes).slice(0,Math.max(1,limit));}
