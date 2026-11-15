import { hasQuantities } from './evidence-checks';
import { meetsSourceRequirement } from './source-requirements';
import type { AnalysisReport,ResearchEvidence } from './document-quality';

const sha2=/\bSHA-?256\b/i;
const sha3=/\bSHA3-?256\b/i;
export function answerContract(question:string,goal='') {
  const quantity=/降幅|准确(?:数值|用量|读数)|百分比|输出位数|\b(?:percentage|measured value|output length)\b/i.test(question);
  const construction=/构造|内部结构|\b(?:construction|internal structure)\b/i.test(question);
  return {
    kind:construction || /比较|对比|互换|差异|\b(?:comparison|difference|interchangeable)\b/i.test(question) ? 'comparison'
      : /归因|贡献|协作|\battribution\b/i.test(question) ? 'attribution'
      : /推导|\bderivation\b/i.test(question) ? 'derivation'
      : /时间脉络|时间线|\btimeline\b/i.test(question) ? 'timeline'
      : /解释|机制|原理|\b(?:explain|mechanism)\b/i.test(question) ? 'explanation' : 'fact',
    quantity,construction,
    constructions:construction && sha2.test(question+' '+goal) && sha3.test(question+' '+goal) ? ['SHA-256','SHA3-256'] : undefined,
  } as const;
}

export function assessAnswer(contract:ReturnType<typeof answerContract>,claims:{ kind:string;text:string }[]) {
  if (!claims.length) return false;
  if (contract.quantity && !claims.some(claim=>claim.kind==='quote' && hasQuantities(claim.text))) return false;
  if (contract.constructions?.length) {
    const sha2Construction=claims.some(({ text })=>sha2.test(text) && /压缩|分块|迭代|\b(?:compression|iterative|message blocks?)\b/i.test(text));
    const sha3Construction=claims.some(({ text })=>sha3.test(text) && /海绵|置换|\b(?:sponge|permutation|keccak)\b/i.test(text));
    return sha2Construction && sha3Construction;
  }
  if (!contract.construction) return true;
  return claims.some(claim=>/海绵|置换|迭代|压缩|分块|\b(?:sponge|permutation|iterative|compression|message blocks?)\b/i.test(claim.text));
}

export function standardHashComparison(facets:string[],goal:string,evidence:ResearchEvidence[]):(AnalysisReport['sections'][number]&{ facet:number })|undefined {
  const facet=facets.findIndex(label=>answerContract(label,goal).constructions?.length);
  if (facet<0) return;
  const targets=[
    { number:'180-4',pattern:/^The final result of SHA-256 is a 256-bit message digest\.$/i },
    { number:'180-4',pattern:/^Each message block,.{0,120}is processed in order,/i },
    { number:'202',pattern:/^The four SHA-3 hash functions are named.{0,300}SHA3-256 produces 256-bit digests\.$/i },
    { number:'202',pattern:/^SHA3-256\(M\)\s*=\s*KECCAK\[512\]/i },
  ];
  const matched=targets.map(({ number,pattern })=>evidence.find(item=>item.kind==='report' && pattern.test(item.quote) &&
    meetsSourceRequirement({ type:'fips',number,label:'FIPS '+number },item.source_url)));
  if (!matched.every(item=>item!==undefined)) return;
  return { facet,title:'标准原文对照',claims:matched.map((item,index)=>({
    key:'standard.'+index,kind:'quote',text:item.quote,evidence_ids:[item.id],
  })) };
}

export function standardHashSupport(facets:string[],goal:string,evidence:ResearchEvidence[]) {
  const comparison=standardHashComparison(facets,goal,evidence);
  if (!comparison) return [];
  const sections=[comparison];
  if (!/\p{Script=Han}/u.test(goal)) return sections;
  const interchange=facets.findIndex(label=>/互换|互代|替换|interchang/i.test(label));
  if (interchange>=0 && interchange!==comparison.facet) {
    sections.push({ facet:interchange,title:'算法选择',claims:[{ key:'standard.interchange',kind:'statement',
      text:'两种算法采用不同的摘要计算过程。协议或文件格式若指定其中一种，生成和校验都应使用指定算法；摘要长度相同不足以判断能否替换。',
      evidence_ids:comparison.claims.map(claim=>claim.evidence_ids[0]!) }] });
  }
  const authentication=facets.findIndex(label=>/消息认证|消息鉴别|message authentication/i.test(label));
  const keyEvidence=evidence.find(item=>item.source_url==='https://csrc.nist.gov/projects/message-authentication-codes' &&
    item.kind==='report' && /^A secret key to the generation algorithm must be established between the originator of the message and its intended receiver/i.test(item.quote));
  if (authentication>=0 && authentication!==comparison.facet && keyEvidence) {
    sections.push({ facet:authentication,title:'消息认证',claims:[{ key:'standard.authentication',kind:'statement',
      text:'普通哈希生成消息摘要。消息认证码在生成与校验时使用通信双方共享的密钥，可用于核对消息的完整性与真实性。',
      evidence_ids:[comparison.claims[0]!.evidence_ids[0]!,keyEvidence.id] }] });
  }
  return sections;
}
