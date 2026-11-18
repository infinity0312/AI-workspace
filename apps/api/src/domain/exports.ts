import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { strToU8, zipSync } from 'fflate';
import PDFDocument from 'pdfkit';
import { imageSize } from 'image-size';
import { weatherAttrs,guideStepAttrs,informationAttrs,taskGapAttrs,checklistAttrs,learningLessonAttrs,learningGoalAttrs,isProjectionType, mindMapForest, projectionAttrs, projectionReferences, selectProjection,
  type ArtifactDocument, type Block, type MindMapBranch, type WorkspaceProjection, type exportInput } from '@akw/contracts';
import type { z } from 'zod';
import type { Actor } from '../platform/security';
import { sha256 } from '../platform/security';
import type { Database } from '../platform/database';
import type { ObjectStore } from '../platform/objects';
import { AppError } from '../platform/errors';
import { workspace } from './access';
import { Artifacts } from './artifacts';
import type { Knowledge } from './knowledge';
import { chartData,isDiagramBlock,renderDiagram } from './diagram-export';
import { artifactReferences } from './workspace-references';

export type ExportInput = z.infer<typeof exportInput>;
export interface ExportResult { filename: string; mime: string; size_bytes: number; checksum: string; storage_key: string }
const ref = (item: Block) => item.type === 'evidence_reference' ? '[证据 ' + String(item.attrs?.evidence_id ?? '') + ']' : '';
function blockText(item: Block):string {
  const gap=item.type==='task_gap' ? taskGapAttrs.safeParse(item.attrs) : undefined;
  if (gap?.success) return gap.data.goal+' · 资料覆盖不完整';
  const weather=item.type==='weather_forecast' ? weatherAttrs.safeParse(item.attrs) : undefined;
  if (weather?.success) {
    const { place,timezone,captured_at,expires_at,current,days,hours }=weather.data;
    const metrics=(now:typeof current)=>now ? [now.time,now.temperature ?? '—',now.apparent ?? '—',now.humidity ?? '—',now.wind ?? '—'].join(' | ') : '';
    return [place.name+' · '+place.area+' · '+timezone,'Open-Meteo / CC BY 4.0 · 已整理',
      '获取 '+captured_at+' · 刷新间隔至 '+expires_at,metrics(current),
      '日期 | 最低 °C | 最高 °C | 最高降水概率 %',
      ...days.map(day=>[day.date,day.low ?? '—',day.high ?? '—',day.precipitation ?? '—'].join(' | ')),
      '当地时间 | 气温 °C | 降水概率 %',
      ...hours.map(hour=>[hour.time,hour.temperature ?? '—',hour.precipitation ?? '—'].join(' | ')),
      blockText({ ...item,type:'paragraph' })].filter(Boolean).join('\n');
  }
  const guide=item.type==='guide_step' ? guideStepAttrs.safeParse(item.attrs) : undefined;
  if (guide?.success) return guide.data.number+'. '+guide.data.title+'\n'+blockText({ ...item,type:'paragraph' });
  const summary=item.type==='information_summary' ? informationAttrs.safeParse(item.attrs) : undefined;
  if (summary?.success) return [summary.data.goal,blockText({ ...item,type:'paragraph' }),summary.data.scope].join('\n');
  const lesson=item.type==='learning_lesson' ? learningLessonAttrs.safeParse(item.attrs) : undefined;
  if (lesson?.success) {
    const content=blockText({ ...item,type:'paragraph' });
    return [lesson.data.title,lesson.data.objective,content,...lesson.data.math.flatMap(step=>[step.latex,step.explanation]),
      ...lesson.data.practice.flatMap(question=>[question.question,...question.options])].join('\n');
  }
  const goal=item.type==='learning_goal' ? learningGoalAttrs.safeParse(item.attrs) : undefined;
  if (goal?.success) return [goal.data.goal,goal.data.foundation,goal.data.diagnostic].join('\n');
  if (item.type === 'image' || item.type === 'figure') return [item.attrs?.caption,item.attrs?.alt,item.attrs?.credit,item.attrs?.license,
    Array.isArray(item.attrs?.annotations) ? item.attrs.annotations.map((note,index) => typeof note === 'object' && note && 'label' in note ? (index+1)+'. '+String(note.label) : '').filter(Boolean).join(' / ') : '',typeof item.attrs?.evidence_id === 'string' ? '[证据 ' + item.attrs.evidence_id + ']' : ''].filter(Boolean).join(' · ');
  const checklist = item.type === 'interactive' ? checklistAttrs.safeParse(item.attrs) : undefined;
  if (checklist?.success) return [checklist.data.title,...checklist.data.items.map(row => '- ['+(row.done ? 'x' : ' ')+'] '+row.text)].filter(Boolean).join('\n');
  if (item.type === 'table' && Array.isArray(item.attrs?.rows)) return item.attrs.rows.filter(Array.isArray).map(row => row.join(' | ')).join('\n');
  if (['bullet_list','ordered_list'].includes(item.type) && Array.isArray(item.attrs?.items))
    return item.attrs.items.map((text,index) => (item.type === 'ordered_list' ? (index+1)+'. ' : '- ')+String(text)).join('\n');
  if (item.type === 'markdown' && typeof item.attrs?.markdown === 'string') return item.attrs.markdown;
  return ref(item) || (item.children ?? []).map(node => node.type === 'citation' ? '[证据 ' + String(node.attrs?.evidence_id ?? '') + ']' :
    node.type === 'footnote' ? '（脚注：' + String(node.attrs?.note ?? '') + '）' :
    node.type === 'external_link' ? String(node.text ?? '') + ' (' + String(node.attrs?.url ?? '') + ')' :
    node.type === 'math_inline' ? '$' + String(node.attrs?.latex ?? node.text ?? '') + '$' : node.text ?? '').join('')
    || (typeof item.attrs?.latex === 'string' ? item.attrs.latex : typeof item.attrs?.title === 'string' ? item.attrs.title : '');
}
function markdown(title: string, content: ArtifactDocument) {
  return '# ' + title.replace(/[\r\n]+/g, ' ') + '\n\n' + content.blocks.map(item => {
    if (item.type === 'heading') return '#'.repeat(Math.min(6, Math.max(2, Number(item.attrs?.level) || 2))) + ' ' + blockText(item);
    if (item.type === 'divider') return '---';
    if (item.type === 'quote') return blockText(item).split('\n').map(line => '> ' + line).join('\n');
    if (item.type === 'math_block') return '$$\n' + blockText(item) + '\n$$';
    if (item.type === 'code_block') {
      const language = typeof item.attrs?.language === 'string' ? item.attrs.language.replace(/[^a-z0-9+#_-]/gi,'') : '';
      return '~~~' + language + '\n' + blockText(item) + '\n~~~';
    }
    if (item.type === 'table' && Array.isArray(item.attrs?.rows)) {
      const rows = item.attrs.rows.filter(Array.isArray).map(row => row.map(cell => String(cell).replaceAll('|','\\|').replaceAll('\n',' ')));
      if (rows[0]) return [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map(row => '| ' + row.join(' | ') + ' |').join('\n');
    }
    if (!['paragraph','evidence_reference'].includes(item.type) && !blockText(item)) return '[' + item.type + ']';
    return blockText(item);
  }).join('\n\n') + '\n';
}
type ExportImage = { bytes:Buffer; format:'png'|'jpg'; width:number; height:number };
async function pdf(title: string, content: ArtifactDocument,images:Map<string,ExportImage>) {
  const fontCandidates = [
    process.env.AKW_PDF_FONT,
    process.env.WINDIR ? join(process.env.WINDIR, 'Fonts', 'simhei.ttf') : undefined,
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ];
  const font = fontCandidates.find(candidate => candidate && existsSync(candidate));
  const text = markdown(title, content);
  if (!font && [...text].some(character => character.codePointAt(0)! > 0x024f)) throw new AppError(422, 'VALIDATION_PDF_FONT', 'Configure AKW_PDF_FONT for Unicode PDF export');
  return new Promise<Buffer>((resolve,reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 54, info: { Title: title } });
    const chunks: Buffer[] = [];
    document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    if (font?.endsWith('.ttc')) document.font(font, 'NotoSansCJKsc-Regular');
    else if (font) document.font(font);
    document.fontSize(21).text(title).moveDown();
    for (const block of content.blocks) {
      const image = images.get(block.id);
      if (image) {
        if (document.y + image.height + 45 > document.page.height - document.page.margins.bottom) document.addPage();
        document.image(image.bytes,{ width:image.width,height:image.height });
        document.moveDown(0.35);
      }
      document.fontSize(block.type === 'heading' ? 15 : 11).text(blockText(block) || '[' + block.type + ']').moveDown(0.5);
    }
    document.end();
  });
}
async function docx(title: string, content: ArtifactDocument,images:Map<string,ExportImage>) {
  return Packer.toBuffer(new Document({
    sections: [{ children: [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      ...content.blocks.flatMap(block => {
        const image = images.get(block.id);
        return [
          ...(image ? [new Paragraph({ children:[new ImageRun({ type:image.format,data:image.bytes,
            transformation:{ width:image.width,height:image.height } })] })] : []),
          new Paragraph({
            ...(block.type === 'heading' ? { heading: HeadingLevel.HEADING_2 } : {}),
            children:[new TextRun(blockText(block) || '[' + block.type + ']')],
          }),
        ];
      }),
    ] }],
  }));
}

function flattenProjections(document:ArtifactDocument,projection:WorkspaceProjection,includeReferences:boolean):ArtifactDocument {
  const labels:Record<string,string> = { mindmap:'思维导图',timeline:'时间脉络',graph_embed:'关系图谱',dependency_graph:'依赖关系',evidence_network:'证据网络' };
  const citation = (id?:string|null) => id && includeReferences ? ' [证据 ' + id + ']' : '';
  function tree(branch:MindMapBranch,depth = 0):string[] {
    return ['  '.repeat(depth) + '• ' + branch.node.title + (branch.node.description ? ' · ' + branch.node.description : '') + citation(branch.edge?.evidence_id),
      ...branch.children.flatMap(child => tree(child,depth+1))];
  }
  const blocks = document.blocks.flatMap(block => {
    if (block.type === 'chart') {
      const chart = chartData(block,document);
      if (!chart) return [block];
      return [{ ...block,type:'paragraph',children:[{ type:'text',text:[chart.title,`${chart.x_label} / ${chart.y_label}`,
        ...chart.series.map(series => series.name + ': ' + series.points.map(point => `${point.label ?? point.x}=${point.y}`).join(', '))].join('\n') }] }];
    }
    if (!isProjectionType(block.type)) return [block];
    const settings = projectionAttrs.safeParse({ view_version:1,node_ids:[],...block.attrs });
    if (!settings.success) return [block];
    const { nodes,edges } = selectProjection(projection,settings.data);
    const titles = new Map(nodes.map(node => [node.id,node.title]));
    const lines = block.type === 'timeline'
      ? nodes.filter(node => node.event_date).sort((a,b) => a.event_date!.localeCompare(b.event_date!))
        .map(node => [node.event_date,node.title,node.description].filter(Boolean).join(' · ') + citation(node.event_evidence_id))
      : block.type === 'mindmap' ? (()=>{const forest=mindMapForest(nodes,edges.filter(edge=>edge.relation_type==='is_a').map(edge=>({...edge,from_node_id:edge.to_node_id,to_node_id:edge.from_node_id})),settings.data.root_id);const used=new Set<string>();function collect(branch:MindMapBranch){if(branch.edge)used.add(branch.edge.id);branch.children.forEach(collect);}forest.forEach(collect);return [...forest.flatMap(branch=>tree(branch)),...edges.filter(edge=>!used.has(edge.id)).map(edge=>'交叉关系 / '+titles.get(edge.from_node_id)+' → '+edge.relation_type+' → '+titles.get(edge.to_node_id)+citation(edge.evidence_id))];})()
      : block.type === 'evidence_network' ? (projection.references?.evidence ?? []).filter(item => item.in_document)
        .map(item => item.title + ' · ' + item.quote + citation(item.id))
      : (block.type === 'dependency_graph' ? edges.filter(edge => edge.relation_type === 'depends_on') : edges).map(edge => titles.get(edge.from_node_id) + ' → ' + edge.relation_type + ' → ' + titles.get(edge.to_node_id) + citation(edge.evidence_id));
    const textBlock = (text:string,type:string):Block => ({ id:randomUUID(),type,children:[{ type:'text',text }] });
    return [textBlock(settings.data.title || labels[block.type] || '知识视图','heading'),...lines.map(line => textBlock(line,'paragraph'))];
  });
  return { ...document,blocks };
}

export class Exports {
  constructor(private readonly db: Database, private readonly artifacts: Artifacts, private readonly objects: ObjectStore,private readonly knowledge:Knowledge) {}
  async create(actor: Actor, input: ExportInput): Promise<ExportResult> {
    let data: Buffer;
    let filename: string;
    let mime: string;
    if (input.format === 'zip') {
      data = await this.archive(actor, input.workspace_id);
      filename = 'workspace-' + input.workspace_id + '.zip';
      mime = 'application/zip';
    } else {
      const artifact = await this.artifacts.atRevision(actor,input.artifact_id!,input.revision_id);
      if (artifact.workspace_id !== input.workspace_id) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Artifact unavailable');
      const formats = {
        markdown: ['md','text/markdown;charset=utf-8'],
        json: ['json','application/json'],
        pdf: ['pdf','application/pdf'],
        svg: ['svg','image/svg+xml'],
        png: ['png','image/png'],
        docx: ['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      };
      const [extension, type] = formats[input.format] as [string, string];
      filename = 'artifact-' + artifact.id + '.' + extension;
      mime = type;
      const { title, revision } = artifact;
      let content = revision.content_json;
      if (input.format === 'json') data = Buffer.from(JSON.stringify(artifact,null,2));
      else {
        const hasGraph = content.blocks.some(block => isProjectionType(block.type));
        const graph = hasGraph ? await this.knowledge.projection(actor,artifact.workspace_id,artifact.project_id,
          projectionReferences(content.blocks,content.relations.knowledge_node_ids)) : { version:1 as const,nodes:[],edges:[] };
        const projection = content.blocks.some(block => block.type === 'evidence_network') ?
          { ...graph,references:await artifactReferences(this.db,artifact) } : graph;
        if (input.format === 'svg' || input.format === 'png') {
          const block = content.blocks.find(item => isDiagramBlock(item) && (!input.block_id || item.id === input.block_id));
          if (!block) throw new AppError(422,'VALIDATION_EXPORT_BLOCK','Select a saved diagram or chart block to export');
          data = renderDiagram(input.format,block,content,projection);
        } else {
          const includeReferences = input.include_references !== false;
          if (!includeReferences) content = {
            ...content,blocks:content.blocks.filter(block => !['evidence_reference','source_embed','evidence_network'].includes(block.type))
              .map(block => ({ ...block,attrs:block.attrs ? Object.fromEntries(Object.entries(block.attrs).filter(([key]) => key !== 'evidence_id')) : undefined,
                children:block.children?.filter(node => node.type !== 'citation') })),
          };
          content = flattenProjections(content,projection,includeReferences);
          if (input.format === 'pdf' || input.format === 'docx') {
            const images = input.include_images === false ? new Map<string,ExportImage>() : await this.exportImages(input.workspace_id,content);
            data = input.format === 'pdf' ? await pdf(title,content,images) : await docx(title,content,images);
          } else data = Buffer.from(markdown(title,content));
        }
      }
    }
    const checksum = sha256(data);
    const storage_key = input.workspace_id + '/' + checksum;
    await this.objects.put(storage_key,data,mime);
    return { filename, mime, size_bytes: data.length, checksum, storage_key };
  }
  read(result: ExportResult) { return this.objects.get(result.storage_key); }

  private async exportImages(ws:string,document:ArtifactDocument) {
    const blocks = document.blocks.filter(block => ['image','figure'].includes(block.type) && typeof block.attrs?.asset_id === 'string');
    const images = new Map<string,ExportImage>();
    if (!blocks.length) return images;
    const rows = await this.db.all<{ id:string; storage_key:string; mime:string }>(`SELECT a.id,a.storage_key,a.mime FROM assets a
      WHERE a.workspace_id=$1 AND a.visibility='workspace' AND a.id::text=ANY($2::text[]) AND a.mime IN ('image/png','image/jpeg')
      AND (a.export_rights IN ('user_owned','public_license') OR EXISTS(SELECT 1 FROM sources s WHERE s.asset_id=a.id AND s.rights IN ('user_owned','public_license')))
      AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.asset_id=a.id AND s.rights IN ('restricted','unknown'))`,
      [ws,[...new Set(blocks.map(block => block.attrs!.asset_id))]]);
    for (const row of rows) {
      const bytes = await this.objects.get(row.storage_key);
      const { width,height } = imageSize(bytes);
      if (!width || !height) continue;
      const scale = Math.min(1,420 / width,300 / height);
      const image:ExportImage = { bytes,format:row.mime === 'image/png' ? 'png' : 'jpg',
        width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)) };
      for (const block of blocks) if (block.attrs?.asset_id === row.id) images.set(block.id,image);
    }
    return images;
  }

  private async archive(actor: Actor, id: string) {
    const data = await this.db.transaction(async sql => {
      const access = await workspace(sql, actor, id);
      await sql.all('SELECT id FROM workspaces WHERE id=$1 FOR SHARE', [id]);
      const workspaceQueries = {
        'projects/projects.json': 'SELECT * FROM projects WHERE workspace_id=$1',
        'projects/relations.json': 'SELECT * FROM project_relations WHERE workspace_id=$1',
        'artifacts/artifacts.json': 'SELECT * FROM artifacts WHERE workspace_id=$1',
        'artifacts/revisions.json': 'SELECT r.* FROM artifact_revisions r JOIN artifacts a ON a.id=r.artifact_id WHERE a.workspace_id=$1',
        'knowledge/nodes.json': 'SELECT * FROM knowledge_nodes WHERE workspace_id=$1',
        'knowledge/edges.json': 'SELECT * FROM knowledge_edges WHERE workspace_id=$1',
        'knowledge/claims.json': 'SELECT * FROM claims WHERE workspace_id=$1',
        'knowledge/claim_evidence.json': 'SELECT ce.* FROM claim_evidence ce JOIN claims c ON c.id=ce.claim_id WHERE c.workspace_id=$1',
        'artifacts/comments.json': 'SELECT c.* FROM artifact_comments c JOIN artifacts a ON a.id=c.artifact_id WHERE a.workspace_id=$1',
        'knowledge/claim_reviews.json': 'SELECT r.* FROM claim_reviews r JOIN claims c ON c.id=r.claim_id WHERE c.workspace_id=$1',
        'sources/sources.json': 'SELECT * FROM sources WHERE workspace_id=$1',
        'sources/evidence.json': 'SELECT e.* FROM evidence e JOIN sources s ON s.id=e.source_id WHERE s.workspace_id=$1',
        'sources/snapshots.json': 'SELECT ss.* FROM source_snapshots ss JOIN sources s ON s.id=ss.source_id WHERE s.workspace_id=$1',
        'sources/documents.json': 'SELECT d.* FROM documents d JOIN sources s ON s.id=d.source_id WHERE s.workspace_id=$1',
        'sources/passages.json': "SELECT p.id,p.document_id,p.ordinal,p.page,p.offset_utf16,CASE WHEN s.rights IN ('user_owned','public_license') THEN p.content ELSE NULL END AS content FROM passages p JOIN documents d ON d.id=p.document_id JOIN sources s ON s.id=d.source_id WHERE s.workspace_id=$1",
      };
      const entries: Record<string,unknown> = { 'workspace/workspace.json': { id, name: access.name, policy: access.policy } };
      for (const [file,query] of Object.entries(workspaceQueries)) entries[file] = await sql.all(query,[id]);
      const privateQueries = {
        'study/goals.json': 'SELECT * FROM study_goals WHERE workspace_id=$1 AND user_id=$2',
        'study/steps.json': 'SELECT s.* FROM study_steps s JOIN study_goals g ON g.id=s.goal_id WHERE g.workspace_id=$1 AND g.user_id=$2',
        'study/cards.json': 'SELECT * FROM study_cards WHERE workspace_id=$1 AND user_id=$2',
        'study/reviews.json': 'SELECT r.* FROM study_reviews r JOIN study_cards c ON c.id=r.card_id WHERE c.workspace_id=$1 AND c.user_id=$2',
        'capture/items.json': `SELECT c.* FROM capture_items c WHERE c.workspace_id=$1 AND c.user_id=$2 AND (
          c.url IS NOT NULL OR (c.rights IN ('user_owned','public_license') AND (c.text_body IS NOT NULL OR EXISTS (
            SELECT 1 FROM assets a WHERE a.id=c.asset_id AND (a.visibility='workspace' OR a.owner_id=$2)
            AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.asset_id=a.id AND s.rights IN ('restricted','unknown'))
          ))))`,
      };
      for (const [file,query] of Object.entries(privateQueries)) entries[file] = await sql.all(query,[id,actor.user]);
      const assets = await sql.all<{ id: string; filename: string; mime: string; storage_key:string; size_bytes:number; allowed:boolean; visibility:'workspace'|'capture';export_rights:string }>(`SELECT a.id,a.filename,a.mime,a.storage_key,a.size_bytes,a.visibility,a.export_rights,
        (a.export_rights IN ('user_owned','public_license') OR EXISTS(SELECT 1 FROM sources s WHERE s.asset_id=a.id AND s.rights IN ('user_owned','public_license')) OR EXISTS(
         SELECT 1 FROM capture_items c WHERE c.asset_id=a.id AND c.user_id=$2 AND c.rights IN ('user_owned','public_license')))
        AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.asset_id=a.id AND s.rights IN ('restricted','unknown')) AS allowed
        FROM assets a WHERE a.workspace_id=$1 AND (a.visibility='workspace' OR (a.owner_id=$2 AND EXISTS(
        SELECT 1 FROM capture_items c WHERE c.asset_id=a.id AND c.user_id=$2 AND c.rights IN ('user_owned','public_license'))))`, [id,actor.user]);
      return { entries, assets };
    });
    const files: Record<string, Uint8Array> = {};
    for (const [name,value] of Object.entries(data.entries)) files[name] = strToU8(JSON.stringify(value));
    if (Object.values(files).reduce((sum, file) => sum + file.length, 0) + data.assets.filter(a => a.allowed).reduce((sum, a) => sum + a.size_bytes, 0) > 64 * 1024 * 1024) {
      throw new AppError(422, 'VALIDATION_ARCHIVE_SIZE', 'Workspace exceeds the local archive size limit');
    }
    const assets = [];
    for (const asset of data.assets) {
      const path = asset.allowed ? 'assets/' + asset.id : null;
      if (path) files[path] = await this.objects.get(asset.storage_key);
      assets.push({ id: asset.id, filename: asset.filename, mime: asset.mime, size_bytes: asset.size_bytes, path, visibility:asset.visibility, export_rights:asset.export_rights, exclusion: path ? null : 'source_rights' });
    }
    const checksums = Object.fromEntries(Object.entries(files).map(([name,bytes]) => [name,sha256(Buffer.from(bytes))]));
    files['manifest.json'] = strToU8(JSON.stringify({
      format: 'akw-workspace', version: '1.0', workspace_id: id, created_at: new Date().toISOString(),
      schema_versions: { artifact: '1.0' }, checksum_algorithm: 'sha256', datasets: Object.keys(data.entries), assets,
    }));
    checksums['manifest.json'] = sha256(Buffer.from(files['manifest.json']));
    files['checksums.json'] = strToU8(JSON.stringify(checksums));
    const archive = Buffer.from(zipSync(files,{ level:3 }));
    if (archive.length > 8 * 1024 * 1024) throw new AppError(422,'VALIDATION_ARCHIVE_SIZE','The compressed workspace exceeds the 8 MiB restore limit');
    return archive;
  }
}

export function exportFilename(result: ExportResult) {
  return dirname(result.filename) === '.' ? result.filename : randomUUID();
}
