import { Parser } from 'htmlparser2';

const hiddenTags = new Set(['head','script','style','noscript','template','svg','iframe','form','nav','footer']);
const paragraphTags = /^(?:article|aside|blockquote|br|div|h[1-6]|li|p|section|table|tr)$/;
const hiddenStyle = /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important)?\s*(?:;|$)/i;

export function htmlText(input:string,limit=1_500_000) {
  const hidden:boolean[] = [];
  const scripts:{ tag:string;depth:number;children:number }[] = [];
  let mathDepth=0;
  const output:string[] = [];
  let remaining=limit;
  const append=(text:string) => {
    if (!remaining) return;
    const excerpt=text.slice(0,remaining);
    remaining-=excerpt.length;
    output.push(excerpt);
  };
  const parser=new Parser({
    onopentag(tag,attrs) {
      const name=tag.split(':').at(-1);
      const parent=scripts.at(-1);
      const omit=Boolean(hidden.at(-1)) || hiddenTags.has(tag) || name==='annotation' || name==='annotation-xml' ||
        Object.hasOwn(attrs,'hidden') ||
        attrs['aria-hidden']?.toLowerCase()==='true' || hiddenStyle.test(attrs.style ?? '');
      hidden.push(omit);
      if (omit) return;
      if (parent?.depth===hidden.length-1) {
        parent.children++;
        if (parent.children===2) append(parent.tag==='msup' ? '^(' : '_(');
      }
      if (name==='math') mathDepth++;
      if (name==='msup' || name==='msub') scripts.push({ tag:name,depth:hidden.length,children:0 });
      if (tag==='sup' || tag==='sub') append(tag==='sup' ? '^(' : '_(');
      if (paragraphTags.test(tag)) append('\n\n');
    },
    ontext(text) { if (!hidden.at(-1)) append(mathDepth ? text.trim() : text); },
    onclosetag(tag) {
      const depth=hidden.length;
      if (!hidden.pop()) {
        const name=tag.split(':').at(-1);
        if (name==='math') mathDepth--;
        const script=scripts.at(-1);
        if (script?.depth===depth) {
          if (script.children>=2) append(')');
          scripts.pop();
        }
        if (tag==='sup' || tag==='sub') append(')');
        if (paragraphTags.test(tag)) append('\n\n');
        else if (tag==='td' || tag==='th') append(' | ');
      }
    },
  });
  parser.end(input);
  return output.join('').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n(?: *\n){2,}/g,'\n\n').trim();
}
