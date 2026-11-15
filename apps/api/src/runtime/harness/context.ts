import type { PromptId } from '../../quality-engine/prompts';
import { prompts } from '../../quality-engine/prompts';
import type { ChatMessage } from './adapter';
import type { RuntimeFlags } from './session';

const skills = {
  document:{ id:'source-analysis.v1',summary:'Compare the supplied evidence and preserve the stated conditions.',
    body:'Distinguish the requested source from secondary commentary. Preserve metric, units, location, operating conditions, and attribution. Mark gaps only from observed evidence.' },
  selection:{ id:'faithful-edit.v1',summary:'Retain source qualifiers when rewriting a cited passage.',
    body:'Preserve explicit qualifiers and the direction and strength of every cited claim. A shortened sentence must keep the boundary of the original result.' },
} as const;

export function runtimePrompt(prompt:PromptId,data:unknown,flags:RuntimeFlags) {
  const skill=flags.skills ? (prompt==='document.draft' ? skills.document : prompt==='selection.rewrite' ? skills.selection : undefined) : undefined;
  const sections=[{ id:'task.v'+prompts[prompt].version,text:prompts[prompt].system }];
  if (skill) sections.push({ id:skill.id,text:skill.body });
  const system=sections.map(section=>section.text).join('\n\n');
  const evidence=(data && typeof data==='object' && 'evidence' in data && Array.isArray(data.evidence)) ? data.evidence : [];
  const excerpts=new Map<string,{id:string;title:string;quote:string;kind:string}>();
  if (flags.tools && prompt==='document.draft') for(const item of evidence) {
    if (item && typeof item.id==='string' && typeof item.title==='string' && typeof item.quote==='string' &&
      typeof item.kind==='string' && item.kind!=='image') excerpts.set(item.id,{ id:item.id,title:item.title,quote:item.quote,kind:item.kind });
  }
  let payload=data,trimmedIds:string[]=[];
  if (flags.compaction && excerpts.size && data && typeof data==='object') {
    const condensed=evidence.map(item=>{
      if (!excerpts.has(item.id) || item.quote.length<=880) return item;
      return { ...item,quote:Array.from(item.quote).slice(0,560).join(''),excerpt_truncated:true };
    });
    const next={ ...data,evidence:condensed };
    if (Buffer.byteLength(JSON.stringify(next))<Buffer.byteLength(JSON.stringify(data))) {
      payload=next;
      trimmedIds=condensed.filter(item=>item.excerpt_truncated===true).map(item=>item.id);
    }
  }
  const user=JSON.stringify(payload);
  const messages:ChatMessage[]=[{ role:'system',content:system },{ role:'user',content:user }];
  return { messages,sections:sections.map(item=>item.id),skill:skill?.id,excerpts,
    compaction:trimmedIds.length ? { strategy:'excerpt_preview.v1' as const,before_bytes:Buffer.byteLength(JSON.stringify(data)),
      after_bytes:Buffer.byteLength(user),evidence_count:trimmedIds.length,evidence_ids:trimmedIds } : undefined };
}
