import { z } from 'zod';

const id = z.uuid();
const short = z.string().trim().min(1).max(160);
const label = z.string().max(160);
export const chartPoint = z.object({ x:z.number().min(-1e12).max(1e12),y:z.number().min(-1e12).max(1e12),label:label.optional() }).strict();
export const chartAttrs = z.object({
  chart_version:z.literal(1),title:short,kind:z.enum(['bar','line','scatter']),
  x_label:label.default(''),y_label:label.default(''),
  series:z.array(z.object({ name:short,points:z.array(chartPoint).min(1).max(240) }).strict()).min(1).max(6),
  table_id:id.optional(),
});
export type ChartAttrs = z.infer<typeof chartAttrs>;
export const tableAttrs = z.object({ table_version:z.literal(1),title:label.optional(),
  rows:z.array(z.array(z.string().max(4000)).min(1).max(20)).min(1).max(250),
}).passthrough().refine(table => table.rows.every(row => row.length === table.rows[0]!.length),'Every table row must have the same width');

export const checklistAttrs = z.object({ kind:z.literal('checklist'),title:label.optional(),
  items:z.array(z.object({ text:z.string().trim().min(1).max(250),done:z.boolean() }).strict()).min(1).max(60),
}).passthrough();
export const sourceCardAttrs = z.object({ source_id:id,title:label.optional() }).passthrough();
export const artifactEmbedAttrs = z.object({ artifact_id:id,title:label.optional() }).passthrough();
export const knowledgeEmbedAttrs = z.object({ node_id:id,title:label.optional() }).passthrough();
export const imageAnnotation = z.object({ x:z.number().min(0).max(100),y:z.number().min(0).max(100),label:short }).strict();
export const imageAnnotations = z.array(imageAnnotation).max(24);
export const imageAttrs = z.object({ asset_id:id.nullable(),alt:z.string().max(200).optional(),credit:z.string().max(300).optional(),license:label.optional(),caption:z.string().max(2000).optional(),
  evidence_id:id.optional(),annotations:imageAnnotations.optional(),fit:z.enum(['contain','cover']).optional(),position:z.enum(['center','top','bottom']).optional(),width:z.enum(['small','medium','full']).optional(),
}).passthrough();
export const wikiInlineAttrs = z.object({ node_id:id }).passthrough();
export const externalInlineAttrs = z.object({ url:z.url({ protocol:/^https?$/ }).max(2048).refine(value => {
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch { return false; }
},'Use a web address without credentials') }).strict();
export const footnoteInlineAttrs = z.object({ note:z.string().trim().min(1).max(1000) }).strict();

export const workspaceEvidence = z.object({
  id,source_id:id,title:z.string(),quote:z.string(),page:z.number().int().nullable(),
  snapshot_id:id,lifecycle:z.string(),block_ids:z.array(id),in_document:z.boolean(),
});
export const workspaceSource = z.object({
  id,title:z.string(),canonical_url:z.string().nullable(),asset_id:id.nullable(),mime:z.string().nullable(),lifecycle:z.string(),
  metadata:z.object({ author:z.string().optional(),published:z.string().optional(),doi:z.string().optional(),provider:z.string().optional(),journal:z.string().optional() }).passthrough(),
});
export const workspaceClaim = z.object({ id,statement:z.string(),scope:z.string(),status:z.string(),evidence_ids:z.array(id),block_ids:z.array(id).optional() });
export const workspaceArtifactLink = z.object({ id,title:z.string(),kind:z.string(),excerpt:z.string().optional() });
export const workspaceReferences = z.object({
  evidence:z.array(workspaceEvidence),sources:z.array(workspaceSource),claims:z.array(workspaceClaim),artifacts:z.array(workspaceArtifactLink),
});
export type WorkspaceEvidence = z.infer<typeof workspaceEvidence>;
export type WorkspaceSource = z.infer<typeof workspaceSource>;
export type WorkspaceReferences = z.infer<typeof workspaceReferences>;

export function chartFromTable(rows:unknown,chart:ChartAttrs):ChartAttrs|undefined {
  if (!Array.isArray(rows) || !rows.every(Array.isArray) || rows.length < 2 || rows[0]!.length < 2) return;
  const headers = rows[0]!.slice(1,7);
  const series = headers.map((name,col) => ({
    name:String(name).trim().slice(0,160) || '系列 ' + (col+1),
    points:rows.slice(1,241).flatMap((row,index) => {
      const value = row[col+1], name = String(row[0] ?? '').trim().slice(0,160);
      const y = Number(value), x = Number(name);
      return value == null || String(value).trim() === '' || !Number.isFinite(y) || Math.abs(y) > 1e12 ? [] :
        [{ x:name && Number.isFinite(x) && Math.abs(x) <= 1e12 ? x : index+1,y,label:name || undefined }];
    }),
  })).filter(item => item.points.length);
  if (!series.length) return;
  return { ...chart,x_label:chart.x_label || String(rows[0]![0] ?? ''),series };
}
