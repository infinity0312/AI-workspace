import { DocumentMergeConflict, mergeArtifactDocuments, sameContent, type ArtifactDetail, type ArtifactDocument, type ArtifactRevision, type Mutation, type WorkspaceSummary, type WorkspaceProjection } from '@akw/contracts';
import { ApiError, workspaceApi, type WorkspaceView } from './api';
import { getPlatform, type StoreName } from './platform';

export interface LocalDocument {
  server: ArtifactDetail;
  draft: ArtifactDocument;
  pending?: Mutation;
  sent?: ArtifactDocument;
  conflict?: boolean;
  conflictCode?: string;
  localVersion: number;
}
function open() {
  return new Promise<IDBDatabase>((resolve,reject) => {
    const request = indexedDB.open('akw-local-v1',1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents');
      request.result.createObjectStore('metadata');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function load<T>(store: StoreName, key: string): Promise<T | undefined> {
  const storage = getPlatform().storage;
  if (storage) {
    const result = await storage.read(store,key);
    return result === null ? undefined : JSON.parse(result) as T;
  }
  const db = await open();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(store,'readonly');
    const read = tx.objectStore(store).get(key);
    tx.oncomplete = () => { db.close(); resolve(read.result as T | undefined); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
async function write<T>(store: StoreName, key: string, update: (before: T | undefined) => T): Promise<T> {
  const storage = getPlatform().storage;
  if (storage) {
    for (let retry = 0; retry < 8; retry++) {
      const prior = await storage.read(store,key);
      const value = update(prior === null ? undefined : JSON.parse(prior) as T);
      if (await storage.compareExchange(store,key,prior,JSON.stringify(value))) return value;
    }
    throw new Error('本地数据库正在处理其他修改，请重试。');
  }
  const db = await open();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(store,'readwrite');
    const table = tx.objectStore(store);
    const request = table.get(key);
    let next: T;
    let error: unknown;
    request.onsuccess = () => {
      try {
        next = update(request.result as T | undefined);
        table.put(next,key);
      } catch (caught) {
        error = caught;
        tx.abort();
      }
    };
    tx.oncomplete = () => { db.close(); resolve(next); };
    tx.onabort = () => { db.close(); reject(error ?? tx.error); };
  });
}
const equal = sameContent;
function isDirty(doc: LocalDocument) { return !equal(doc.draft,doc.server.revision.content_json); }
export const localRepo = {
  workspaces: () => load<WorkspaceSummary[]>('metadata','workspaces'),
  cacheWorkspaces: (list: WorkspaceSummary[]) => write('metadata','workspaces',() => list),
  view: (id: string) => load<WorkspaceView>('metadata','view:' + id),
  cacheView: (id: string,value: WorkspaceView) => write('metadata','view:' + id,() => value),
  projection:(id:string) => load<WorkspaceProjection>('metadata','projection:' + id),
  cacheProjection:(id:string,graph:WorkspaceProjection) => write('metadata','projection:' + id,() => graph),
  cursor: (id: string) => load<string>('metadata','cursor:' + id),
  cacheCursor: (id: string,value: string) => write<string>('metadata','cursor:' + id,current =>
    current && BigInt(current)>BigInt(value) ? current : value),
  artifact: (id: string) => load<LocalDocument>('documents',id),
  cacheArtifact: (server: ArtifactDetail) => write<LocalDocument>('documents',server.id,before => {
    if (before?.conflictCode === 'CONFLICT_ARTIFACT_DELETED') return { ...before,conflict:false,conflictCode:undefined };
    if (before && (before.pending || isDirty(before) || before.server.revision.revision_number > server.revision.revision_number)) return before;
    if (before?.server.revision.id === server.revision.id) return before.server.title === server.title ? before : { ...before,server };
    return { server,draft:server.revision.content_json,localVersion:(before?.localVersion ?? 0) + 1 };
  }),
  save: (doc: LocalDocument, draft: ArtifactDocument) => write<LocalDocument>('documents',doc.server.id,before => {
    if (before && before.localVersion !== doc.localVersion) throw new Error('另一标签页已更新本地文档，请重新打开后编辑。');
    return { ...(before ?? doc), draft,localVersion:doc.localVersion + 1 };
  }),
  resolve: (server: ArtifactDetail, keepLocal: boolean) => write<LocalDocument>('documents',server.id,before => ({
    server, draft: keepLocal && before ? before.draft : server.revision.content_json,
    localVersion:(before?.localVersion ?? 0) + 1,
  })),
};

async function flushOne(id: string) {
  let doc = await localRepo.artifact(id);
  if (!doc || doc.conflict || (!doc.pending && !isDirty(doc))) return doc;
  if (!doc.pending) {
    const device = await write<string>('metadata','device',current => current ?? crypto.randomUUID());
    const seq = await write<number>('metadata','sequence:' + device,current => (current ?? 0) + 1);
    doc = await write<LocalDocument>('documents',id,before => {
      const current = before ?? doc!;
      if (current.pending || current.conflict || !isDirty(current)) return current;
      const value: Mutation = {
        mutation_id: crypto.randomUUID(),workspace_id:current.server.workspace_id,device_id:device,
        entity_type:'artifact',entity_id:id,operation:'patch',base_version:current.server.revision.revision_number,
        client_sequence:seq,payload:{ base_revision_id:current.server.revision.id,operations:[{ type:'replace_document',content:current.draft }] },
        schema_version:'1.0',created_at:new Date().toISOString(),
      };
      return { ...current,pending:value,sent:current.draft };
    });
  }
  const sent = doc.pending;
  if (!sent) return doc;
  try {
    const ack = (await workspaceApi.push(sent)).results[0];
    if (!ack?.acknowledged) throw new Error('服务器未确认变更');
    return write<LocalDocument>('documents',id,before => {
      if (!before || before.pending?.mutation_id !== sent.mutation_id) return before ?? doc!;
      const revision: ArtifactRevision = ack.revision;
      const updated = { ...before.server,canonical_revision_id:revision.id,revision };
      try {
        const draft = before.sent && !equal(before.draft,before.sent)
          ? mergeArtifactDocuments(before.sent,revision.content_json,before.draft) : revision.content_json;
        return { server:updated,draft,localVersion:before.localVersion + 1 };
      } catch (error) {
        if (!(error instanceof DocumentMergeConflict)) throw error;
        return { server:updated,draft:before.draft,conflict:true,localVersion:before.localVersion + 1 };
      }
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return write<LocalDocument>('documents',id,before => ({ ...(before ?? doc!),conflict:true,conflictCode:error.code }));
    }
    throw error;
  }
}
async function browserDocuments() {
  const db = await open();
  return new Promise<LocalDocument[]>((resolve,reject) => {
    const tx = db.transaction('documents','readonly');
    const req = tx.objectStore('documents').getAll();
    tx.oncomplete = () => { db.close(); resolve(req.result as LocalDocument[]); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function flushWorkspace(workspaceId: string) {
  if (!navigator.onLine) return;
  const run = async () => {
    const storage = getPlatform().storage;
    const documents = storage ? (await storage.list('documents')).map(value => JSON.parse(value) as LocalDocument) : await browserDocuments();
    const pending = documents.filter(doc => doc.server.workspace_id === workspaceId && (doc.pending || isDirty(doc)) && !doc.conflict)
      .sort((a,b) => (a.pending?.client_sequence ?? Infinity) - (b.pending?.client_sequence ?? Infinity));
    for (const doc of pending) await flushOne(doc.server.id);
  };
  if (navigator.locks) await navigator.locks.request('akw-sync',run);
  else await run();
}
export const documentStatus = (doc: LocalDocument) => doc.conflict ? 'conflict' : isDirty(doc) || doc.pending ? 'pending' : 'synced';
