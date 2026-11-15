import { randomUUID } from 'node:crypto';
import type { ArtifactDocument, Block, PatchInput } from '@akw/contracts';
import { isTextBoundary } from './artifacts';
import { blockEvidence } from './ai-evidence';
import { auditRequirements,withRequirementGroups,type RequirementLeaf } from '../quality-engine/requirement-ledger';
import type { AnalysisReport,Requirement } from '../quality-engine/document-quality';
import type { CheckedAnalysis } from '../runtime/document-research';
import type { PublicMaterial } from '../runtime/public-research';

export function boundedText(value: string, limit: number) {
  let end = Math.min(value.length,limit);
  while (!isTextBoundary(value,end)) end--;
  return value.slice(0,end);
}

export function documentText(content: ArtifactDocument) {
  let text = '';
  for (const block of content.blocks) {
    if (text.length >= 3200) break;
    for (const child of block.children ?? []) {
      if (child.type !== 'text' || !child.text) continue;
      text += boundedText(child.text,3200 - text.length);
      if (text.length >= 3200) break;
    }
    if (text.length && text.length < 3200) text += '\n';
  }
  return text.trim();
}

function claimInlines(text:string):NonNullable<Block['children']> {
  const pattern=/(?<![\w.])([+-]?\d+(?:\.\d+)?)\s*[×x]\s*10\^\(([−+-]?\d{1,4})\)/gu;
  const children:NonNullable<Block['children']>=[];
  let position=0;
  for (const match of text.matchAll(pattern)) {
    if (position<match.index) children.push({ type:'text',text:text.slice(position,match.index) });
    const mantissa=match[1]!,exponent=Number(match[2]!.replace('−','-'));
    children.push({ type:'math_inline',text:match[0],attrs:{ latex:mantissa+'\\times 10^{'+exponent+'}',mantissa,exponent } });
    position=match.index+match[0].length;
  }
  if (position<text.length) children.push({ type:'text',text:text.slice(position) });
  return children;
}

type SavedMaterial = { material:PublicMaterial; evidence_id:string; asset_id?:string };
const titleBlock = (title:string,level:number,attrs:Block['attrs'] = {}):Block => ({
  id:randomUUID(),type:'heading',attrs:{ level,...attrs },children:[{ type:'text',text:title }],
});
export function analysisPatch(content:ArtifactDocument,runId:string,report:AnalysisReport,saved:SavedMaterial[],
  coverage:CheckedAnalysis['coverage'],requirements:Requirement[]) {
  const blocks:Block[] = [titleBlock('AI 分析',2,{ analysis_run_id:runId,analysis_verified:true })];
  if (coverage.supported<coverage.requested) blocks.push({ id:randomUUID(),type:'paragraph',children:[
    { type:'text',text:'资料覆盖：有来源支持 '+coverage.supported+' / '+coverage.requested+' 个检索问题。' },
  ] });
  const requirementBlocks=new Map<string,{ block_id:string;evidence_ids:string[] }[]>();
  const requirementByClaim=new Map<string,string[]>();
  for (const { id,targets } of requirements) for (const { section,claim } of targets) {
    const key=section+':'+claim;
    requirementByClaim.set(key,[...(requirementByClaim.get(key) ?? []),id]);
  }
  for (const [index,section] of report.sections.entries()) {
    blocks.push(titleBlock(section.title,3),...section.claims.map((claim,position):Block => {
      const id=randomUUID();
      for (const requirement of requirementByClaim.get(index+':'+position) ?? []) {
        const references=requirementBlocks.get(requirement) ?? [];
        references.push({ block_id:id,evidence_ids:claim.evidence_ids });
        requirementBlocks.set(requirement,references);
      }
      return { id,type:claim.kind==='quote' ? 'quote' : 'paragraph',attrs:{ ai_claim:true,claim_id:randomUUID() },
        children:[...claimInlines(claim.text),...claim.evidence_ids.map(id => ({ type:'citation',attrs:{ evidence_id:id } }))] };
    }));
  }
  const images = saved.filter(item => item.material.image && item.asset_id);
  if (images.length) blocks.push(titleBlock('相关图片',3),...images.map(({ material,evidence_id,asset_id }):Block => ({
    id:randomUUID(),type:'image',attrs:{ asset_id:asset_id!,evidence_id,alt:material.title,credit:material.image!.credit,
      license:material.image!.license,license_url:material.image!.licenseUrl },
  })));
  const papers = saved.filter(item => item.material.kind === 'paper');
  if (papers.length) blocks.push(titleBlock('参考论文',3),...papers.map(({ material,evidence_id }):Block => ({
    id:randomUUID(),type:'paragraph',children:[
      { type:'text',text:[material.title,material.journal,material.published,material.doi && 'DOI ' + material.doi].filter(Boolean).join(' · ') },
      { type:'citation',attrs:{ evidence_id } },
    ],
  })));
  const reports = saved.filter(item => ['report','dataset','web'].includes(item.material.kind));
  if (reports.length) blocks.push(titleBlock('机构报告与原始资料',3),...reports.map(({ material,evidence_id }):Block => ({
    id:randomUUID(),type:'paragraph',children:[
      { type:'text',text:[material.title,material.provider,material.published].filter(Boolean).join(' · ') },
      { type:'citation',attrs:{ evidence_id } },
    ],
  })));
  if (!content.blocks.some(block=>block.type==='evidence_network')) {
    blocks.push({ id:randomUUID(),type:'evidence_network',attrs:{ view_version:1,node_ids:[] } });
  }
  let afterId = content.blocks.at(-1)?.id ?? null;
  const operations:PatchInput['operations']=blocks.map(block => {
    const insertion = { type:'insert_block' as const,after_id:afterId,block };
    afterId = block.id;
    return insertion;
  });
  return { operations,requirementBlocks,blocks };
}

export function analysisLedger(checked:CheckedAnalysis,patch:ReturnType<typeof analysisPatch>,ids:ReadonlyMap<string,string>) {
  const fulfillment=checked.fulfillment;
  if (!fulfillment) return;
  const groups=new Map<string,string>();
  const leaves:RequirementLeaf[]=checked.requirements.map((item,index)=>{
    const parent=fulfillment.questions[index]?.parent;
    let parentId:string|undefined;
    if (parent) {
      parentId=[...groups].find(([,name])=>name===parent)?.[0] ?? 'GROUP-'+(groups.size+1);
      groups.set(parentId,parent);
    }
    const matched=patch.requirementBlocks.get(item.id) ?? [];
    const complete=matched.length>0;
    return { id:item.id,parentId,description:item.label,type:'question',mandatory:fulfillment.mandatoryQuestions,
      retrieval:complete ? 'complete' : 'pending',evidence:complete ? 'complete' : 'pending',answer:complete ? 'complete' : 'missing',
      evidenceIds:[...new Set(matched.flatMap(row=>row.evidence_ids))],blockIds:matched.map(row=>row.block_id) };
  });
  function bind(referenceIds:string[],type:'source'|'visual_asset') {
    const evidenceIds=[...new Set(referenceIds.flatMap(id=>type==='visual_asset' ? ids.has(id) ? [ids.get(id)!] : [] : [ids.get(id) ?? id]))];
    const wanted=new Set(evidenceIds);
    const relevant=patch.blocks.filter(block=>(type==='visual_asset' ? block.type==='image' : block.attrs?.ai_claim===true) &&
      blockEvidence(block).some(id=>wanted.has(id)));
    return { evidenceIds,blockIds:relevant.map(block=>block.id) };
  }
  fulfillment.sources.forEach((source,index)=>{
    leaves.push({ id:'SOURCE-'+(index+1),description:source.label,type:'source',mandatory:true,
      retrieval:source.retrieved ? 'complete' : 'missing',evidence:source.evidenceIds.length ? 'complete' : 'missing',
      answer:source.usedIds.length ? 'complete' : 'missing',...bind(source.usedIds,'source') });
  });
  if (fulfillment.visual) {
    const { mandatory,retrieved,approvedIds }=fulfillment.visual;
    leaves.push({ id:'VISUAL-1',description:'相关的署名许可图片',type:'visual_asset',mandatory,
      retrieval:retrieved ? 'complete' : 'missing',evidence:approvedIds.length ? 'complete' : 'missing',
      answer:approvedIds.length ? 'complete' : 'missing',...bind(approvedIds,'visual_asset') });
  }
  return withRequirementGroups(auditRequirements(leaves,patch.blocks),groups);
}
