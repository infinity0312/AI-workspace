import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasPositions,hierarchyProjection } from '../../../packages/client/src/workspace/projection-adapter';
import type { ProjectionNode,ProjectionEdge } from '@akw/contracts';

const node=(id:string):ProjectionNode=>({ id,title:id,type:'concept',description:'',project_id:null,event_date:null,event_evidence_id:null,version:1 });
const edge=(id:string,from:string,to:string,relation='is_a'):ProjectionEdge=>({ id,from_node_id:from,to_node_id:to,relation_type:relation,evidence_id:null,status:'confirmed' });
test('frontend hierarchy preserves child-to-parent semantics and every non-tree edge',()=>{
  const nodes=['parent','child','other'].map(node);
  const edges=[edge('a','child','parent'),edge('b','child','other'),edge('c','parent','child'),edge('d','other','parent','supports')];
  const result=hierarchyProjection(nodes,edges,'parent');
  assert.equal(result.forest[0]?.node.id,'parent');
  assert.equal(result.forest[0]?.children[0]?.node.id,'child');
  assert.ok(result.crosslinks.some(item=>item.id==='d'));
  const traversed:string[]=[];
  const walk=(branches:typeof result.forest)=>{ for(const branch of branches){ if(branch.edge) traversed.push(branch.edge.id);walk(branch.children); } };
  walk(result.forest);
  assert.deepEqual([...traversed,...result.crosslinks.map(item=>item.id)].sort(),edges.map(item=>item.id).sort());
  assert.equal(edges[0]?.from_node_id,'child','adapter must not mutate canonical data');
});
test('frontend does not invent a hierarchy from dependency or support relations',()=>{
  const result=hierarchyProjection([node('a'),node('b')],[edge('dep','a','b','depends_on')]);
  assert.equal(result.hasHierarchy,false);
  assert.equal(result.forest.length,2);
  assert.equal(result.crosslinks.length,1);
});
test('atlas initial layout is reproducible for reordered input and finite for a single node',()=>{
  const nodes=['a','b','c'].map(node);
  const first=atlasPositions(nodes,'a'),second=atlasPositions([...nodes].reverse(),'a');
  for(const item of nodes) assert.deepEqual(first.get(item.id),second.get(item.id));
  const one=atlasPositions([node('a')],'a').get('a')!;
  assert.ok(Number.isFinite(one.x) && Number.isFinite(one.y));
});
