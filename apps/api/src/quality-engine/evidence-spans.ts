const segmenter = new Intl.Segmenter(undefined,{ granularity:'sentence' });
const terminal = /[.!?。！？][\s”’"')）\]]*$/u;
const abbreviation = /(?:\bet al|\be\.g|\bi\.e|\bfig|\beq|\bno|\bvol)\.\s*$/i;

function balanced(text:string) {
  const stack:string[] = [];
  const pairs:Record<string,string> = { ')':'(',']':'[','）':'（','】':'【' };
  for (const char of text) {
    if ('([（【'.includes(char)) stack.push(char);
    else if (Object.hasOwn(pairs,char) && stack.pop()!==pairs[char]) return false;
  }
  return stack.length===0;
}

export function completeSentences(text:string,limit:number) {
  const result:{ text:string;start:number;end:number }[] = [];
  let start:number|undefined;
  for (const { segment,index } of segmenter.segment(text)) {
    start ??= index;
    const end=index+segment.length;
    if (end-start>limit) { start=undefined; continue; }
    const value=text.slice(start,end).trim();
    if (!terminal.test(value) || abbreviation.test(value) || !balanced(value)) continue;
    result.push({ text:value,start,end });
    start=undefined;
  }
  return result;
}
