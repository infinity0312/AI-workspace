export type RequirementStage = 'retrieval'|'evidence'|'answer'|'artifact';
export type RequirementStatus = 'complete'|'partial'|'pending'|'missing'|'blocked'|'not_applicable';

export type RequirementItem = {
  id:string;
  parentId?:string;
  description:string;
  type:'group'|'question'|'source'|'visual_asset';
  mandatory:boolean;
  status:Record<RequirementStage,RequirementStatus>;
  evidenceIds:string[];
  claimIds?:string[];
  sourceIds?:string[];
  blockIds:string[];
};

export type RequirementLedger = {
  version:2;
  items:RequirementItem[];
  mandatory:Record<RequirementStage,{ completed:number;total:number }>;
  gate:'pass'|'pass_with_disclosed_gaps'|'blocked';
  acceptedRevisionId?:string;
};
