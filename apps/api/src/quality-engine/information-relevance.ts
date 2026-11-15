import type { PublicMaterial } from '../runtime/public-research';

const stop=new Set('what which where how why when does with from about usually typical common use uses used applications application summary introduction basics overview comparison compare'.split(' '));
const words=(value:string)=>[...new Set((value.toLowerCase().match(/[a-z][a-z\d-]{2,}/g) ?? []).filter(word=>!stop.has(word)))];
const han=(value:string)=>[...new Set((value.match(/\p{Script=Han}{2,}/gu) ?? []).flatMap(run=>
  Array.from({ length:Math.max(1,run.length-2) },(_,index)=>run.slice(index,index+3))))];

export function rankInformationSources(materials:PublicMaterial[],terms:{ chinese:string;english:string }) {
  const english=words(terms.english).slice(0,8);
  const chinese=han(terms.chinese).slice(0,12);
  function score(value:string) {
    const candidates=words(value), lower=value.toLowerCase();
    const hits=english.filter(term=>candidates.some(word=>word===term || word===term+'s' || word+'s'===term)).length;
    const adjacent=english.some((term,index)=>english[index+1] && lower.includes(term+' '+english[index+1]));
    const phrases=chinese.filter(term=>value.includes(term)).length;
    const strongEnglish=english.length>0 && (hits===english.length ||
      (english.length>=4 && hits>=Math.ceil(english.length*0.6) && adjacent));
    return (strongEnglish ? hits+1 : 0)+(phrases>=Math.min(2,chinese.length) ? phrases*2 : 0);
  }
  return materials.map(item=>({ item,score:score(item.title)*3+score(item.text) }))
    .filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score).map(entry=>entry.item);
}
