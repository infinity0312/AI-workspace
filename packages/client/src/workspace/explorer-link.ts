export type ExplorerLink={focus:string;types:string[];relations:string[];statuses:string[];mode:string};
export function readExplorerLink(url:string,scope:string,allowed:{nodes:string[];types:string[];relations:string[];statuses:string[]}):ExplorerLink|undefined{
  const params=new URL(url).searchParams;if(params.get('atlas_scope')!==scope)return;
  const values=(key:string,valid:string[])=>(params.get(key)||'').split(',').filter(value=>valid.includes(value));
  const focus=params.get('atlas_focus')||'',mode=params.get('atlas_mode')||'map';
  return {focus:allowed.nodes.includes(focus)?focus:'',types:values('atlas_types',allowed.types),relations:values('atlas_relations',allowed.relations),statuses:values('atlas_statuses',allowed.statuses),mode:['map','index','clusters'].includes(mode)?mode:'map'};
}
export function writeExplorerLink(url:string,scope:string,state:ExplorerLink){const target=new URL(url);target.searchParams.set('atlas_scope',scope);for(const [key,value]of Object.entries({focus:state.focus,types:state.types.join(','),relations:state.relations.join(','),statuses:state.statuses.join(','),mode:state.mode})){if(value)target.searchParams.set('atlas_'+key,value);else target.searchParams.delete('atlas_'+key);}return target.toString();}
