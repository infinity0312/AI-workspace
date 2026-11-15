import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildChartScene,chartAttrs,chartFromTable,isProjectionType,mindMapForest,projectionAttrs,selectProjection,
  type ArtifactDocument,type Block,type ChartScene,type MindMapBranch,type WorkspaceProjection } from '@akw/contracts';
import { invalid } from '../platform/errors';

const ink = '#182240', border = '#bac8e2', accent = '#394ac7';
const short = (text:string,length:number) => {
  const chars = [...text.replace(/\s+/g,' ')];
  return chars.length > length ? chars.slice(0,length-1).join('') + '…' : chars.join('');
};
// XML 1.0 forbids these control characters in text nodes.
/* eslint-disable no-control-regex */
const xml = (value:string) => value.replace(/[&<>"']/g,char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[char]!))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
/* eslint-enable no-control-regex */
const titles:Record<string,string> = {
  mindmap:'思维导图',timeline:'时间脉络',graph_embed:'关系图谱',dependency_graph:'依赖关系',evidence_network:'证据网络',
};

function graphScene(block:Block,data:WorkspaceProjection):ChartScene {
  const settings = projectionAttrs.parse({ view_version:1,node_ids:[],...block.attrs });
  const title = settings.title || titles[block.type] || '知识视图';
  const { nodes,edges } = selectProjection(data,settings);
  const scene:ChartScene = { width:1080,height:140,title,marks:[],labels:[{ x:540,y:36,text:short(title,46),size:23,align:'center' }] };
  const { marks,labels } = scene;
  const line = (x:number,y:number,toX:number,toY:number,color=border) => {
    marks.push({ kind:'line',points:[{ x,y },{ x:toX,y:toY }],color,width:1.5 });
  };
  const card = (x:number,y:number,width:number,label:string,detail?:string) => {
    marks.push({ kind:'rect',x,y:y-22,width,height:detail ? 47 : 37,color:'#eaf0fc' });
    labels.push({ x:x+12,y:y+1,text:short(label,Math.floor(width/16)-1),size:15 });
    if (detail) labels.push({ x:x+12,y:y+18,text:short(detail,Math.floor(width/13)-2),size:12,color:'#43536c' });
  };
  if (block.type === 'mindmap') {
    let row=0;
    function branch(item:MindMapBranch,depth=0,parent?:{ x:number;y:number }) {
      const x = 32+depth*97,y = 82+row++*56;
      if (parent) line(parent.x+15,parent.y+25,x+8,y-22);
      card(x,y,Math.min(430,1010-x),item.node.title,item.edge?.relation_type || item.node.type);
      item.children.forEach(child => branch(child,depth+1,{ x,y }));
    }
    mindMapForest(nodes,edges,settings.root_id).forEach(item => branch(item));
    scene.height = Math.max(140,92+row*56);
  } else if (block.type === 'timeline') {
    const events = nodes.filter(node => node.event_date).sort((a,b) => a.event_date!.localeCompare(b.event_date!));
    if (events.length) line(207,74,207,85+Math.max(0,events.length-1)*56,accent);
    events.forEach((node,index) => {
      const y = 82+index*56;
      labels.push({ x:177,y:y+1,text:node.event_date!,align:'right',size:15 });
      marks.push({ kind:'dot',x:207,y,r:5,color:accent });
      card(229,y,790,node.title,node.description);
    });
    scene.height = Math.max(140,92+events.length*56);
  } else if (block.type === 'evidence_network') {
    const references = data.references;
    const evidence = new Map((references?.evidence ?? []).map(item => [item.id,item]));
    const rows = (references?.claims ?? []).flatMap(claim => claim.evidence_ids.flatMap(id => {
      const item = evidence.get(id);
      return item ? [{ left:claim.statement,right:item.title,detail:item.page ? '第 '+item.page+' 页' : item.quote }] : [];
    }));
    const cited = new Set((references?.claims ?? []).flatMap(claim => claim.evidence_ids));
    for (const item of evidence.values()) if (item.in_document && !cited.has(item.id)) {
      rows.push({ left:item.block_ids.length ? '正文引用' : '关联来源',right:item.title,detail:item.quote });
    }
    rows.slice(0,100).forEach((row,index) => {
      const y = 82+index*56;
      line(484,y,588,y,accent);
      card(36,y,448,row.left);
      card(588,y,456,row.right,row.detail);
    });
    if (rows.length>100) labels.push({ x:36,y:92+100*56,text:'共 '+rows.length+' 条，图中显示前 100 条。',size:13 });
    scene.height = Math.max(140,118+Math.min(100,rows.length)*56);
  } else {
    const selected = block.type === 'dependency_graph' ? edges.filter(edge => ['depends_on','derived_from'].includes(edge.relation_type)) : edges;
    const positions = new Map(nodes.map((node,index) => [node.id,{ x:42+(index%4)*266,y:84+Math.floor(index/4)*100 }]));
    for (const edge of selected) {
      const from = positions.get(edge.from_node_id)!,to = positions.get(edge.to_node_id)!;
      const x1 = from.x+109, y1 = from.y+25, x2 = to.x+109, y2 = to.y-22;
      line(x1,y1,x2,y2,accent);
      const angle = Math.atan2(y2-y1,x2-x1);
      for (const side of [-1,1]) line(x2,y2,x2-9*Math.cos(angle+side*0.48),y2-9*Math.sin(angle+side*0.48),accent);
    }
    nodes.forEach(node => { const point = positions.get(node.id)!; card(point.x,point.y,218,node.title,node.type); });
    const descriptions = selected.slice(0,100);
    const names = new Map(nodes.map(node => [node.id,node.title]));
    const start = 84+Math.ceil(nodes.length/4)*100;
    descriptions.forEach((edge,index) => labels.push({ x:42,y:start+index*21,size:13,
      text:short(names.get(edge.from_node_id)+' → '+edge.relation_type+' → '+names.get(edge.to_node_id),74) }));
    if (selected.length>100) labels.push({ x:42,y:start+100*21,size:13,text:'共 '+selected.length+' 条关系，文字索引显示前 100 条。' });
    scene.height = Math.max(140,start+descriptions.length*21+24);
  }
  if (!marks.length) labels.push({ x:540,y:88,text:'此视图没有数据',size:15,align:'center' });
  return scene;
}

function svg(scene:ChartScene) {
  const marks = scene.marks.map(mark => {
    if (mark.kind === 'rect') return `<rect x="${mark.x}" y="${mark.y}" width="${mark.width}" height="${mark.height}" fill="${mark.color}"/>`;
    if (mark.kind === 'dot') return `<circle cx="${mark.x}" cy="${mark.y}" r="${mark.r}" fill="${mark.color}"/>`;
    return `<polyline points="${mark.points.map(({ x,y }) => x+','+y).join(' ')}" fill="none" stroke="${mark.color}" stroke-width="${mark.width}"/>`;
  }).join('');
  const labels = scene.labels.map(label => `<text x="${label.x}" y="${label.y}" fill="${label.color || ink}" font-size="${label.size ?? 13}" text-anchor="${label.align === 'center' ? 'middle' : label.align === 'right' ? 'end' : 'start'}">${xml(label.text)}</text>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" font-family="system-ui,sans-serif"><title>${xml(scene.title)}</title><rect width="100%" height="100%" fill="white"/>${marks}${labels}</svg>`);
}

function png(scene:ChartScene) {
  const windowsFont = process.env.WINDIR ? join(process.env.WINDIR,'Fonts','simhei.ttf') : undefined;
  const font = [process.env.AKW_PDF_FONT,windowsFont,'/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']
    .find(file => file && existsSync(file));
  const registered = font && GlobalFonts.registerFromPath(font,'Workspace Export');
  const canvas = createCanvas(scene.width,scene.height);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0,0,scene.width,scene.height);
  for (const mark of scene.marks) {
    context.fillStyle = mark.color;
    if (mark.kind === 'rect') context.fillRect(mark.x,mark.y,mark.width,mark.height);
    else if (mark.kind === 'dot') {
      context.beginPath(); context.arc(mark.x,mark.y,mark.r,0,Math.PI*2); context.fill();
    } else {
      context.strokeStyle = mark.color; context.lineWidth = mark.width; context.beginPath();
      mark.points.forEach(({ x,y },index) => index ? context.lineTo(x,y) : context.moveTo(x,y));
      context.stroke();
    }
  }
  for (const label of scene.labels) {
    context.fillStyle = label.color || ink;
    context.font = `${label.size ?? 13}px ${registered ? '"Workspace Export"' : 'sans-serif'}`;
    context.textAlign = label.align || 'left';
    context.fillText(label.text,label.x,label.y);
  }
  return canvas.toBuffer('image/png');
}

export function isDiagramBlock(block:Block) { return block.type === 'chart' || isProjectionType(block.type); }

export function chartData(block:Block,document:ArtifactDocument) {
  const parsed = chartAttrs.safeParse(block.attrs);
  if (!parsed.success) return;
  const { data } = parsed;
  if (!data.table_id) return data;
  const table = document.blocks.find(item => item.id === data.table_id && item.type === 'table');
  return chartFromTable(table?.attrs?.rows,data);
}

export function renderDiagram(format:'svg'|'png',block:Block,document:ArtifactDocument,projection?:WorkspaceProjection) {
  const chart = chartData(block,document);
  const scene = chart ? buildChartScene(chart) : projection && isProjectionType(block.type) ? graphScene(block,projection) : undefined;
  if (!scene) throw invalid('The visual block has no exportable data');
  return format === 'svg' ? svg(scene) : png(scene);
}
