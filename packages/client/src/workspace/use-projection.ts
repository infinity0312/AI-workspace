import {useEffect,useState} from 'react';
import {workspaceProjection,type WorkspaceProjection} from '@akw/contracts';
import {ApiError,api} from '../lib/api';
import {localRepo} from '../lib/local-repository';
import type {ProjectionState} from './projection-views';
const memory=new Map<string,WorkspaceProjection>();
const pending=new Map<string,Promise<WorkspaceProjection>>();
export function useArtifactProjection(artifact:string|undefined,revision:string|undefined,enabled:boolean,online:boolean,epoch:number):ProjectionState{
  const [state,setState]=useState<ProjectionState&{artifact?:string}>({status:'loading'});
  useEffect(()=>{
    if(!artifact||!enabled)return;
    let cancelled=false;
    const snapshot=artifact+':'+(revision||'unknown'),key=snapshot+':'+epoch;
    void(async()=>{
      let cached:WorkspaceProjection|undefined;
      try{cached=await localRepo.projection(snapshot);}catch{/* Server fallback. */}
      if(cancelled)return;
      const shared=memory.get(key);
      if(shared&&online){setState({artifact,revision,graph:shared,status:'ready'});return;}
      setState({artifact,revision,graph:cached,status:online?'loading':'offline'});
      if(!online)return;
      try{
        let request=pending.get(key);
        if(!request){request=api('/artifacts/'+artifact+'/projection').then(value=>workspaceProjection.parse(value));pending.set(key,request);void request.finally(()=>pending.delete(key)).catch(()=>{});}
        const graph=await request;
        if(cancelled)return;
        memory.set(key,graph);while(memory.size>20)memory.delete(memory.keys().next().value!);
        setState({artifact,revision,graph,status:'ready'});
        await localRepo.cacheProjection(snapshot,graph).catch(()=>{});
      }catch(error){const retained=error instanceof ApiError&&[401,403,404].includes(error.status)?undefined:cached;if(!cancelled)setState({artifact,revision,graph:retained,status:'error'});}
    })();
    return()=>{cancelled=true;};
  },[artifact,revision,enabled,online,epoch]);
  return state.artifact===artifact&&state.revision===revision?state:{status:'loading'};
}
