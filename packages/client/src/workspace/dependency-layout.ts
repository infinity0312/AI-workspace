import type {ProjectionEdge,ProjectionNode} from '@akw/contracts';
/** SCC condensation gives deterministic layers, preserving real cycles and IDs. */
export function dependencyLayout(nodes:ProjectionNode[],input:ProjectionEdge[]) {
  const ids=new Set(nodes.map(node=>node.id));
  const edges=input.filter(edge=>edge.relation_type==='depends_on'&&ids.has(edge.from_node_id)&&ids.has(edge.to_node_id));
  const adjacency=new Map(nodes.map(node=>[node.id,[] as string[]]));
  for(const edge of edges)adjacency.get(edge.to_node_id)!.push(edge.from_node_id);
  const index=new Map<string,number>(),low=new Map<string,number>(),stack:string[]=[],active=new Set<string>(),components:string[][]=[];let next=0;
  function visit(id:string){index.set(id,next);low.set(id,next++);stack.push(id);active.add(id);for(const target of [...adjacency.get(id)!].sort()){if(!index.has(target)){visit(target);low.set(id,Math.min(low.get(id)!,low.get(target)!));}else if(active.has(target))low.set(id,Math.min(low.get(id)!,index.get(target)!));}if(low.get(id)===index.get(id)){const component:string[]=[];let member:string;do{member=stack.pop()!;active.delete(member);component.push(member);}while(member!==id);components.push(component.sort());}}
  for(const id of [...ids].sort())if(!index.has(id))visit(id);
  const group=new Map<string,number>();components.forEach((items,i)=>items.forEach(id=>group.set(id,i)));
  const level=new Map<number,number>();
  function rank(id:number):number{if(level.has(id))return level.get(id)!;const parents=edges.filter(edge=>group.get(edge.from_node_id)===id&&group.get(edge.to_node_id)!==id).map(edge=>group.get(edge.to_node_id)!);const value=parents.length?1+Math.max(...parents.map(rank)):0;level.set(id,value);return value;}
  components.forEach((_,i)=>rank(i));
  const positions=new Map<string,{x:number;y:number}>();
  const groups:{ids:string[];x:number;y:number;width:number;height:number;cyclic:boolean}[]=[];
  const layers=[...new Set(components.map((_,i)=>rank(i)))].sort((a,b)=>a-b);let x=28;
  for(const layer of layers){let y=28,maxWidth=250;
    const units=components.map((members,i)=>({members,i})).filter(unit=>rank(unit.i)===layer).sort((a,b)=>a.members[0]!.localeCompare(b.members[0]!));
    for(const unit of units){const cyclic=unit.members.length>1||edges.some(edge=>edge.from_node_id===unit.members[0]&&edge.to_node_id===unit.members[0]);
      const radius=cyclic&&unit.members.length>1?Math.max(175,unit.members.length*290/(2*Math.PI)):0,width=radius?radius*2+260:cyclic?300:250,height=radius?radius*2+150:cyclic?230:150;
      if(radius)unit.members.forEach((id,i)=>{const angle=i/unit.members.length*Math.PI*2-Math.PI/2;positions.set(id,{x:x+width/2+Math.cos(angle)*radius-110,y:y+height/2+Math.sin(angle)*radius-40});});
      else positions.set(unit.members[0]!,{x:x+(width-220)/2,y:y+(cyclic?76:20)});
      groups.push({ids:unit.members,x,y,width,height,cyclic});maxWidth=Math.max(maxWidth,width);y+=height+30;
    }x+=maxWidth+100;
  }
  return {edges,positions,groups,cycles:groups.filter(group=>group.cyclic).map(group=>group.ids),width:Math.max(540,...groups.map(group=>group.x+group.width+28)),height:Math.max(320,...groups.map(group=>group.y+group.height+28))};
}

/** Route to card boundaries; opposed cycle edges use opposite arcs. */
export function dependencyPath(from:{x:number;y:number},to:{x:number;y:number},curved=false){
  const ax=from.x+110,ay=from.y+56,bx=to.x+110,by=to.y+56,dx=bx-ax,dy=by-ay;
  if(!dx&&!dy)return `M${ax+110},${ay} C${ax+180},${ay-115} ${ax-180},${ay-115} ${ax-110},${ay}`;
  const first=Math.min(110/Math.max(.001,Math.abs(dx)),56/Math.max(.001,Math.abs(dy))),last=Math.min(110/Math.max(.001,Math.abs(dx)),56/Math.max(.001,Math.abs(dy)));
  const sx=ax+dx*first,sy=ay+dy*first,tx=bx-dx*last,ty=by-dy*last,length=Math.hypot(dx,dy),bend=curved?32:0;
  return `M${sx},${sy} Q${(sx+tx)/2-dy/length*bend},${(sy+ty)/2+dx/length*bend} ${tx},${ty}`;
}
