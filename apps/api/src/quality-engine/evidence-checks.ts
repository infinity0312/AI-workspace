export const unresolved = /待核实|待复核|未经(?:资料)?验证|尚待(?:验证|核实)|仍需(?:验证|核实)|需要(?:进一步)?核实|pending verification|unverified (?:draft|claim)/i;

const units:Record<string,string> = {
  '%':'percent','％':'percent',percent:'percent','百分比':'percent',
  '个百分点':'percentage-point','百分点':'percentage-point','percentage points':'percentage-point','percentage point':'percentage-point',
  kwh:'kWh','千瓦时':'kWh','度电':'kWh','°f':'fahrenheit','华氏度':'fahrenheit',
  kg:'kg','千克':'kg',g:'g','克':'g',mg:'mg','毫克':'mg',
  km:'km','千米':'km','公里':'km',cm:'cm','厘米':'cm',mm:'mm','毫米':'mm',m:'m','米':'m',
  ms:'ms','毫秒':'ms',s:'s','秒':'s',min:'min','分钟':'min',h:'h','小时':'h','°c':'celsius','摄氏度':'celsius',
};
const values = /(?<![\d])[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*(percentage points?\b|percent\b|[%％]|°[cf]|摄氏度|华氏度|个百分点|百分点|百分比|kwh\b|千瓦时|度电|千克|毫克|克|千米|公里|厘米|毫米|米|毫秒|分钟|小时|秒|(?:kg|mg|km|cm|mm|ms|min|g|m|s|h)\b))?/gi;
function mentions(text:string) {
  return [...text.normalize('NFKC').matchAll(values)].flatMap(match => {
    const numeric = match[0].match(/^[-−]?[\d,]+(?:\.\d+)?/)?.[0];
    if (!numeric) return [];
    const decimal=numeric.replaceAll(',','').replace('−','-');
    const [whole,fraction='']=decimal.replace(/^-/,'').split('.');
    const magnitude=(whole!.replace(/^0+(?=\d)/,'') || '0')+(fraction.replace(/0+$/,'') ? '.'+fraction.replace(/0+$/,'') : '');
    return [{ value:(decimal.startsWith('-') && magnitude!=='0' ? '-' : '')+magnitude,unit:units[(match[1] ?? '').toLowerCase()] }];
  });
}

const written = /百分之[零〇一二两三四五六七八九十百千点]+|[零〇一二两三四五六七八九十百千点]+(?:个百分点|倍|摄氏度|华氏度|千瓦时|度电|千克)/gu;
const writtenQuantities = (text:string) => [...text.matchAll(written)].map(item => item[0]);
export function hasQuantities(text:string) { return mentions(text).length>0 || writtenQuantities(text).length>0; }

const identifier = /\b(?:(?:FIPS|RFC|ISO(?:\/IEC)?|IEEE|NIST SP) +\d[\d-]*|[a-z][a-z0-9]*(?:-[a-z0-9]+)+|[a-z]{2,}\d+)\b/gi;
const normalizeIdentifiers = (text:string) => text.normalize('NFKC').replace(/[\u2010-\u2014\u2212]/g,'-').toLowerCase();
const isMeasurementSuffix = /^(?:[%°]|个百分点|百分点|位|千瓦时|度电|摄氏度|华氏度|千克)/u;

export function supportsAnalysisStatement(text:string,quotes:string[]) {
  const known=new Set(quotes.flatMap(quote => normalizeIdentifiers(quote).match(identifier) ?? []).filter(value => /\d/.test(value)));
  const prose=normalizeIdentifiers(text).replace(identifier,(value:string,offset:number,whole:string) =>
    known.has(value) && !isMeasurementSuffix.test(whole.slice(offset+value.length)) ? ' ' : value);
  // Padding with zeros is a specific mechanism and needs a cited description of it.
  const zeroPadding=/补零|零填充|填充零|\bzero[\s-]pad/i;
  if (zeroPadding.test(text) && !quotes.some(quote=>zeroPadding.test(quote) ||
    /(?:append|followed by|padding).{0,55}(?:zero bits|zeroes|zeros|zero bit)/i.test(quote))) return false;
  const kmacAttribution=/\bKMAC\b.{0,90}\bFIPS 202\b|\bFIPS 202\b.{0,90}\bKMAC\b/i;
  const directKmacDefinition=/\bFIPS 202\b[^.!?]{0,70}\b(?:specifies|defines|standardizes)\s+(?:the\s+)?KMAC\b|\bKMAC\b[^.!?]{0,70}\b(?:defined|specified|standardized)\s+(?:in|by)\s+FIPS 202\b/i;
  if (kmacAttribution.test(text) && /规定|定义|标准化|指定|\b(?:defines?|specified|standardizes?)\b/i.test(text) &&
    !quotes.some(quote=>directKmacDefinition.test(quote))) return false;
  const absoluteDifferent=/总是不同|一定不同|必然不同|(?:绝不|不可能)(?:会)?(?:有|产生|得到)?(?:相同|一样)|\b(?:never (?:match|collide)|always (?:produce )?different)\b/i;
  if (/\bsha-256\b/.test(normalizeIdentifiers(text)) && /\bsha3-256\b/.test(normalizeIdentifiers(text)) && absoluteDifferent.test(text)) return false;
  return !hasQuantities(prose);
}

export function sameQuantities(before:string,after:string) {
  const signature=(text:string)=>mentions(text).map(item => item.value+'/'+(item.unit ?? '')).join('|')+';'+
    writtenQuantities(text).join('|');
  return signature(before)===signature(after);
}

export function supportsNumbers(text:string,quotes:string[]) {
  const observed = quotes.flatMap(mentions);
  const writtenInEvidence = new Set(quotes.flatMap(writtenQuantities));
  return writtenQuantities(text).every(value => writtenInEvidence.has(value)) &&
    mentions(text).every(value => observed.some(known => value.value === known.value && (!value.unit || value.unit === known.unit)));
}
