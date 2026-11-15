import type { ArtifactDetail, ArtifactRevision, ErrorResponse, Mutation, PatchInput, ProjectionNode, ProjectionEdge, RunSummary, WorkspaceSummary } from '@akw/contracts';
import { getPlatform } from './platform';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export async function api<T>(path: string, options: { method?: string; body?: unknown; key?: string; signal?: AbortSignal } = {}): Promise<T> {
  const response = await getPlatform().request({
    path:'/v1' + path, method:options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    body:options.body === undefined ? undefined : JSON.stringify(options.body), key:options.key,
    signal:options.signal ?? AbortSignal.timeout(20_000),
  });
  let value: unknown;
  try { value = JSON.parse(response.body); } catch { value = null; }
  if (response.status < 200 || response.status >= 300) {
    const details = value as ErrorResponse | null;
    throw new ApiError(response.status,details?.error?.code ?? 'NETWORK_ERROR',details?.error?.message ?? '服务暂不可用');
  }
  return value as T;
}
const query = (id: string) => '?workspace_id=' + encodeURIComponent(id);
export type Project = { id: string; name: string; description: string };
export type ArtifactSummary = Pick<ArtifactDetail, 'id'|'title'|'kind'|'project_id'|'canonical_revision_id'>;
export type Source = { id: string; title: string; canonical_url: string | null; status: string; asset_id: string | null; project_id: string | null; sensitivity: string; lifecycle:string; checked_at:string|null; version:number; rights:string; metadata:{ author?:string; published?:string; doi?:string } };
export type SourceDetail = Source & {
  asset_mime?:string|null;
  documents: { id: string; parser_version: string; quality_report: { page_count: number; passage_count: number; warnings: string[] } }[];
  passages: { id: string; document_id: string; page: number | null; ordinal: number; offset_utf16: number; content: string }[];
};
export type Evidence = { id: string; source_id:string; title: string; canonical_url: string | null; parser_version:string; quote:string; metadata?:{ material_kind?:'encyclopedia'|'paper'|'image'|'report'|'dataset'|'web'; provider?:string; author?:string; published?:string; journal?:string; doi?:string; license?:string; license_url?:string }; locator: { page: number | null; passage_ordinal: number; start_utf16: number; end_utf16: number } };
export type Patch = { id: string; status: string; reviewed?:boolean; proposer_type: string; base_revision_id: string; operations: PatchInput['operations'] };
export type Graph = {
  nodes:ProjectionNode[];
  edges:(ProjectionEdge & { version:number })[];
};
export type WorkspaceView = {
  artifacts: ArtifactSummary[]; projects: Project[]; sources: Source[];
};
export type Job = { run_id:string;status:string;status_url:string;events_url:string;runtime_session_id?:string };
export type RunEvent = { sequence: string; event_type: string; payload: Record<string,unknown>; created_at: string };
export type ExportJob = Omit<RunSummary, 'result'> & { result: { warning?: string; download_url?: string; filename?: string } | null };
export const workspaceApi = {
  list: () => api<WorkspaceSummary[]>('/workspaces'),
  view: async (id: string): Promise<WorkspaceView> => {
    const [artifacts,projects,sources] = await Promise.all([
      api<ArtifactSummary[]>('/artifacts' + query(id)),
      api<Project[]>('/workspaces/' + id + '/projects'),
      api<Source[]>('/sources' + query(id)),
    ]);
    return { artifacts,projects,sources };
  },
  artifact: (id: string) => api<ArtifactDetail>('/artifacts/' + id),
  evidence: (id: string) => api<Evidence>('/evidence/' + id),
  runs: (id: string) => api<RunSummary[]>('/research-runs' + query(id)),
  exports: (id: string) => api<ExportJob[]>('/exports' + query(id)),
  changes: (id: string, cursor: string) => api<{ changes: { event_type:string; aggregate_type: string; aggregate_id: string }[]; next_cursor: string; has_more: boolean }>('/sync/changes' + query(id) + '&cursor=' + cursor),
  push: (value: Mutation) => api<{ results: { acknowledged: boolean; revision: ArtifactRevision }[] }>('/sync/mutations', { body: { mutations: [value] } }),
};
export const post = <T>(path: string, body: unknown = {}) => api<T>(path,{ body,key:crypto.randomUUID() });
export const errorText = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : '操作失败';
