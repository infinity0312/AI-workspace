import type { RequirementItem,RequirementLedger,RequirementStage,RequirementStatus } from '@akw/contracts';
import type { Block } from '@akw/contracts';
import { blockEvidence } from '../domain/ai-evidence';

export type RequirementLeaf = Omit<RequirementItem,'status'> & {
  retrieval:RequirementStatus;evidence:RequirementStatus;answer:RequirementStatus;
};

export function questionPlan(labels:string[]) {
  return labels.map(label=>{
    const position=label.indexOf('>');
    const parent=position>0 ? label.slice(0,position).trim() : '';
    const leaf=position>0 ? label.slice(position+1).trim() : '';
    return parent && leaf ? { label:leaf,parent } : { label };
  });
}

const stages:RequirementStage[]=['retrieval','evidence','answer','artifact'];

export function auditRequirements(leaves:RequirementLeaf[],blocks:Block[]):RequirementLedger {
  const byId=new Map(blocks.map(block=>[block.id,block]));
  const items:RequirementItem[]=leaves.map(({ retrieval,evidence,answer,...item })=>{
    const selected=item.blockIds.map(id=>byId.get(id));
    const located=new Set(selected.flatMap(block=>block ? blockEvidence(block) : []));
    const hasMaterial=item.type!=='visual_asset' || selected.some(block=>block?.type==='image' && typeof block.attrs?.asset_id==='string' &&
      typeof block.attrs?.credit==='string' && Boolean(block.attrs.credit.trim()) && typeof block.attrs?.license==='string' && Boolean(block.attrs.license.trim()));
    const artifact=retrieval==='complete' && evidence==='complete' && answer==='complete' && selected.length && selected.every(Boolean) && item.evidenceIds.length &&
      item.evidenceIds.every(id=>located.has(id)) && hasMaterial ? 'complete' : 'missing';
    const claimIds=selected.flatMap(block=>typeof block?.attrs?.claim_id==='string' ? [block.attrs.claim_id] : []);
    return { ...item,claimIds,status:{ retrieval,evidence,answer,artifact } };
  });
  const required=items.filter(item=>item.mandatory);
  const mandatory=Object.fromEntries(stages.map(stage=>[stage,{
    total:required.length,completed:required.filter(item=>item.status[stage]==='complete').length,
  }])) as RequirementLedger['mandatory'];
  return { version:2,items,mandatory,gate:required.some(item=>item.status.artifact!=='complete') ? 'blocked'
    : items.some(item=>item.status.artifact!=='complete') ? 'pass_with_disclosed_gaps' : 'pass' };
}

export function withRequirementGroups(ledger:RequirementLedger,groups:Map<string,string>) {
  for (const [id,description] of groups) {
    const children=ledger.items.filter(item=>item.parentId===id);
    const required=children.filter(item=>item.mandatory);
    const scored=required.length ? required : children;
    const status=Object.fromEntries(stages.map(stage=>{
      const complete=scored.filter(item=>item.status[stage]==='complete').length;
      return [stage,complete===scored.length ? 'complete' : complete ? 'partial' : 'missing'];
    })) as RequirementItem['status'];
    ledger.items.push({ id,description,type:'group',mandatory:Boolean(required.length),status,
      evidenceIds:[...new Set(children.flatMap(item=>item.evidenceIds))],claimIds:[...new Set(children.flatMap(item=>item.claimIds ?? []))],blockIds:[...new Set(children.flatMap(item=>item.blockIds))] });
  }
  return ledger;
}
