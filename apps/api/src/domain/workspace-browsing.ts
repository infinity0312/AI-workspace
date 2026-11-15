import { randomUUID } from 'node:crypto';
import { emptyDocument,type browseRequest,type sourceCollectionInput,type BrowseResponse,type BrowseResult } from '@akw/contracts';
import type { z } from 'zod';
import type { Actor } from '../platform/security';
import type { Database } from '../platform/database';
import type { PublicResearch } from '../runtime/public-research';
import type { SearchResult } from '../runtime/providers';
import type { Services } from '../services';
import { canonicalUrl } from '../platform/public-web';
import { AppError } from '../platform/errors';
import { idempotent,workspace } from './access';
import { assertExternal } from './jobs/external-access';

function webAddress(address:string) {
  try { return canonicalUrl(address).href; } catch { return; }
}

export async function browseWeb(app:{ db:Database;search?:(query:string,signal:AbortSignal)=>Promise<SearchResult[]>;publicResearch?:PublicResearch },actor:Actor,input:z.infer<typeof browseRequest>,outer:AbortSignal):Promise<BrowseResponse> {
  await assertExternal(app.db,actor,input.workspace_id);
  const signal=AbortSignal.any([outer,AbortSignal.timeout(9500)]);
  const found=new Map<string,BrowseResult>();
  function add(title:string,input:string,provider:string,excerpt?:string) {
    const url=webAddress(input);
    if (url && !found.has(url)) found.set(url,{ title:title.trim().slice(0,200) || new URL(url).hostname,url,provider,excerpt });
  }
  const direct=/^https?:\/\/\S+$/i.test(input.query) ? webAddress(input.query) : undefined;
  if (direct) {
    add(new URL(direct).hostname,direct,'用户提供的链接');
    return { results:[...found.values()],query:input.query,coverage:'public_catalogs' };
  }
  if (app.search) {
    try {
      const results=await app.search(input.query,signal);
      for (const row of results) add(row.title,row.url,'网页搜索');
      if (found.size) return { results:[...found.values()],query:input.query,coverage:'web' };
    } catch { outer.throwIfAborted(); }
  }
  if (!app.publicResearch) throw new AppError(503,'BROWSE_PROVIDER_UNAVAILABLE','Public search is not configured');
  const query=input.query.slice(0,100);
  const materials=await app.publicResearch.discover({ chinese:query,english:query },signal).catch(()=>{
    outer.throwIfAborted();return [];
  });
  for (const row of materials) {
    if (row.kind==='image') continue;
    add(row.title,row.url,row.provider,row.text.slice(0,260));
  }
  return { results:[...found.values()].slice(0,12),query:input.query,coverage:'public_catalogs' };
}

export function collectLinks(app:Services,actor:Actor,input:z.infer<typeof sourceCollectionInput>,key?:string) {
  return app.db.transaction(async sql=>{
    await workspace(sql,actor,input.workspace_id,true);
    return idempotent(sql,actor,'browse.collect:'+input.workspace_id,key,input,async()=>{
      const content=emptyDocument();
      const entries=new Map(input.items.map(item=>[canonicalUrl(item.url).href,item.title]));
      content.blocks=[...entries].map(([url,title])=>({ id:randomUUID(),type:'paragraph',
        children:[{ type:'external_link',text:title,attrs:{ url } }] }));
      return app.artifacts.createIn(sql,actor,{ workspace_id:input.workspace_id,title:input.title,kind:'document',content },'user');
    });
  });
}
