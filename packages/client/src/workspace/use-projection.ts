import { useEffect, useState } from 'react';
import { workspaceProjection, type WorkspaceProjection } from '@akw/contracts';
import { ApiError, api } from '../lib/api';
import { localRepo } from '../lib/local-repository';
import type { ProjectionState } from './projection-views';

export function useArtifactProjection(artifact:string|undefined,revision:string|undefined,enabled:boolean,online:boolean,epoch:number):ProjectionState {
  const [state,setState] = useState<ProjectionState & { artifact?:string }>({ status:'loading' });
  useEffect(() => {
    if (!artifact || !enabled) return;
    const controller = new AbortController();
    const signal = controller.signal;
    void (async () => {
      let cached:WorkspaceProjection|undefined;
      try { cached = await localRepo.projection(artifact); } catch { /* Fetch from the server. */ }
      if (signal.aborted) return;
      setState({ artifact,graph:cached,status:online ? 'loading' : 'offline' });
      if (!online) return;
      try {
        const graph = workspaceProjection.parse(await api('/artifacts/' + artifact + '/projection',{ signal }));
        if (signal.aborted) return;
        setState({ artifact,graph,status:'ready' });
        await localRepo.cacheProjection(artifact,graph).catch(() => {});
      } catch (error) {
        const retained = error instanceof ApiError && [401,403,404].includes(error.status) ? undefined : cached;
        if (!signal.aborted) setState({ artifact,graph:retained,status:retained ? 'offline' : 'error' });
      }
    })();
    return () => controller.abort();
  },[artifact,revision,enabled,online,epoch]);
  return state.artifact === artifact ? state : { status:'loading' };
}
