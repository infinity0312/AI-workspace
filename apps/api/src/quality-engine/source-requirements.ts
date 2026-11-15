export type SourceRequirement =
  | { type:'nobel';label:string }
  | { type:'fips';label:string;number:string }
  | { type:'doi';label:string;doi:string }
  | { type:'url';label:string;url:string };

export const safeDoi = (value:string|undefined) => value && /^10\.\d{4,9}\/[\x21-\x7E]{1,140}$/.test(value) ? value.toLowerCase() : undefined;

export function mentionedDois(text:string) {
  const matches=text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]{1,140}/gi) ?? [];
  return [...new Set(matches.map(match=>safeDoi(match.replace(/[.,;:]+$/,'').replace(/\)+$/,end=>{
    const closes=match.split(')').length-1,opens=match.split('(').length-1;
    return end.slice(0,Math.max(0,end.length-Math.max(0,closes-opens)));
  }))).filter(doi=>doi!==undefined))].slice(0,3);
}

export function requiredSources(goal:string,urls:string[]=[]):SourceRequirement[] {
  const dois=new Set(mentionedDois(goal));
  const requirements:SourceRequirement[]=urls.flatMap((url):SourceRequirement[]=>{
    try {
      const target=new URL(url);
      const doi=target.hostname==='doi.org' && safeDoi(decodeURIComponent(target.pathname.slice(1)));
      if (doi) { dois.add(doi);return []; }
    } catch { /* Invalid addresses are rejected by the input schema. */ }
    return [{ type:'url',label:url,url }];
  });
  for (const doi of dois) requirements.push({ type:'doi',label:'DOI '+doi,doi });
  if (/(?:诺贝尔奖官网|nobelprize\.org)/i.test(goal)) requirements.push({ type:'nobel',label:'诺贝尔奖官方资料' });
  if (/NIST|原始标准/i.test(goal)) {
    for(const number of new Set([...goal.matchAll(/\bFIPS\s+(\d{2,4}(?:-\d{1,2})?)\b/gi)].map(match=>match[1]!)))
      requirements.push({ type:'fips',label:'FIPS '+number,number });
  }
  return requirements.slice(0,8);
}
export function meetsSourceRequirement(requirement:SourceRequirement,value:string|null|undefined) {
  if (!value) return false;
  try {
    const url=new URL(value);
    if (url.protocol!=='https:' || url.username || url.password || url.port) return false;
    if (requirement.type==='url') {
      const required=new URL(requirement.url);
      required.hash='';
      url.hash='';
      return url.href===required.href;
    }
    if (requirement.type==='doi') return url.hostname==='doi.org' && safeDoi(decodeURIComponent(url.pathname.slice(1)))===requirement.doi;
    if (requirement.type==='nobel') return ['www.nobelprize.org','nobelprize.org','api.nobelprize.org'].includes(url.hostname);
    if (!['nvlpubs.nist.gov','csrc.nist.gov'].includes(url.hostname)) return false;
    const segments=url.pathname.toLowerCase().split('/');
    return segments.includes(requirement.number) || segments.includes('nist.fips.'+requirement.number+'.pdf') ||
      segments.includes('fips'+requirement.number+'.pdf');
  } catch { return false; }
}
