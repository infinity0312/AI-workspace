import { randomUUID } from 'node:crypto';
import { emptyDocument,learningGoalAttrs,type ArtifactDocument,type Block,type PatchInput } from '@akw/contracts';
import type { Sql } from '../platform/database';
import { event } from './access';
import type { Actor } from '../platform/security';
import type { LearningLesson,LearningPlan } from '../quality-engine/learning-quality';
import type { LearningEvidence } from '../runtime/learning-workflow';

type Scope={ workspace_id:string;project_id:string|null };
export function learningHeader(content:ArtifactDocument) {
  return content.blocks.find(block=>block.type==='learning_goal');
}

export async function compileLearning(sql:Sql,actor:Actor,scope:Scope,options:{
  goal:string;plan:LearningPlan;lessons:LearningLesson[];evidence:LearningEvidence[];ids:Map<number,string>;
  prior?:ArtifactDocument;question?:string;
}) {
  const { goal,plan,lessons,evidence,ids,question,prior }=options;
  const related=new Set(prior?.relations.knowledge_node_ids ?? []);
  const blocks:Block[]=[];
  const operations:PatchInput['operations']=[];
  const title=(value:string):Block=>({ id:randomUUID(),type:'heading',attrs:{ level:2 },children:[{ type:'text',text:value }] });
  const citations=(indexes:number[])=>[...new Set(indexes.flatMap(index=>ids.get(index) ?? []))].map(id=>({ type:'citation',attrs:{ evidence_id:id } }));
  const selectedViews=learningGoalAttrs.safeParse(prior && learningHeader(prior)?.attrs);
  const views=new Set([...(selectedViews.success ? selectedViews.data.views : []),...plan.views,'evidence_network']);
  const lessonIds=new Map(lessons.map(lesson=>[lesson.index,randomUUID()]));
  if (prior) {
    const old=learningHeader(prior);
    if (old && selectedViews.success) operations.push({ type:'update_block',block_id:old.id,block:{ ...old,attrs:{
      ...old.attrs,foundation:plan.foundation,basis:selectedViews.data.basis==='provided' && plan.basis==='unknown' ? 'provided' : plan.basis,
      diagnostic:plan.diagnostic,views:[...views],
    } } });
    blocks.push(title('追问 · '+question));
  } else {
    blocks.push({ id:randomUUID(),type:'learning_goal',attrs:{
      version:1,goal,foundation:plan.foundation,basis:plan.basis,diagnostic:plan.diagnostic,views:[...views],
    } });
  }
  async function node(id:string,name:string,type:string,description:string,date:string|null,evidenceId:string|null) {
    await sql.all(`INSERT INTO knowledge_nodes(id,workspace_id,project_id,title,type,description,status,event_date,event_evidence_id)
      VALUES($1,$2,$3,$4,$5,$6,'confirmed',$7,$8)`,[id,scope.workspace_id,scope.project_id,name,type,description,date,evidenceId]);
    await event(sql,actor,scope.workspace_id,'KnowledgeNodeCreated','knowledge_node',id);
    related.add(id);
  }
  for (const lesson of lessons) {
    const id=lessonIds.get(lesson.index)!;
    const prerequisites=lesson.prerequisites.flatMap(index=>lessonIds.get(index) ?? []);
    const refs=citations(lesson.evidence);
    const claimId=randomUUID();
    await sql.all(`INSERT INTO claims(id,workspace_id,statement,scope,status) VALUES($1,$2,$3,$4,'proposed')`,
      [claimId,scope.workspace_id,lesson.title+' · '+lesson.objective,'学习路径']);
    for (const ref of refs) await sql.all('INSERT INTO claim_evidence(claim_id,evidence_id) VALUES($1,$2)',[claimId,ref.attrs.evidence_id]);
    blocks.push({ id,type:'learning_lesson',attrs:{ version:1,title:lesson.title,objective:lesson.objective,prerequisites,
      math:lesson.math,practice:lesson.practice,ai_claim:true,claim_id:claimId },
      children:[{ type:'text',text:lesson.explanation },...refs] });
    if (!views.has('graph_embed')) continue;
    await node(id,lesson.title,'learning_topic',lesson.objective,null,null);
    for (const prerequisite of prerequisites) {
      const edge=randomUUID();
      await sql.all(`INSERT INTO knowledge_edges(id,workspace_id,from_node_id,to_node_id,relation_type,evidence_id,status,created_by)
        VALUES($1,$2,$3,$4,'depends_on',$5,'confirmed',$6)`,[edge,scope.workspace_id,id,prerequisite,refs[0]?.attrs.evidence_id ?? null,actor.user]);
      await event(sql,actor,scope.workspace_id,'KnowledgeEdgeConfirmed','knowledge_edge',edge);
    }
  }
  const visibleNodes=new Set(prior?.blocks.filter(block=>block.type==='graph_embed' && block.attrs?.learning_view===true)
    .flatMap(block=>Array.isArray(block.attrs?.node_ids) ? block.attrs.node_ids : []) ?? []);
  const lead=prior?.blocks.filter(block=>block.type==='learning_lesson' && visibleNodes.has(block.id)).at(-1);
  const added=lessons[0] && lessonIds.get(lessons[0].index);
  if (lead && added && views.has('graph_embed')) {
    const link=randomUUID();
    await sql.all(`INSERT INTO knowledge_edges(id,workspace_id,from_node_id,to_node_id,relation_type,status,created_by)
      VALUES($1,$2,$3,$4,'related_to','confirmed',$5)`,[link,scope.workspace_id,added,lead.id,actor.user]);
    await event(sql,actor,scope.workspace_id,'KnowledgeEdgeConfirmed','knowledge_edge',link);
  }
  const relatedPapers=new Set(prior?.blocks.filter(block=>block.type==='timeline').flatMap(block=>
    Array.isArray(block.attrs?.paper_urls) ? block.attrs.paper_urls.filter((value):value is string=>typeof value==='string') : []) ?? []);
  const timeline:string[]=[];
  if (views.has('timeline')) for (const [index,entry] of evidence.entries()) {
    const material=entry.material;
    const date=material?.published, evidenceId=ids.get(index);
    if (!material || material.kind!=='paper' || !date || !/^\d{4}$/.test(date) || !evidenceId || relatedPapers.has(material.url)) continue;
    const id=randomUUID();
    await node(id,material.title.slice(0,200),'event',material.journal ?? '论文',date,evidenceId);
    relatedPapers.add(material.url);
    timeline.push(id);
  }
  const textbooks=evidence.flatMap((item,index)=>{
    const id=ids.get(index);
    return item.material?.journal?.startsWith('教材') && id ? [{ title:item.title,evidence_id:id }] : [];
  });
  if (textbooks.length && !prior) {
    blocks.push(title('入门教材'),...textbooks.map(item=>({ id:randomUUID(),type:'paragraph',children:[
      { type:'text',text:item.title },{ type:'citation',attrs:{ evidence_id:item.evidence_id } },
    ] })));
  }
  const initialIds=[...lessonIds.values()];
  const upsertView=(type:'graph_embed'|'timeline',title:string,newIds:string[],extra:Block['attrs']={})=>{
    if (!newIds.length) return;
    const old=prior?.blocks.find(block=>block.type===type && block.attrs?.learning_view===true);
    const existing=Array.isArray(old?.attrs?.node_ids) ? old.attrs.node_ids : [];
    const attrs={ view_version:1,title,learning_view:true,node_ids:[...new Set([...existing,...newIds])].slice(0,100),...extra };
    const block={ id:old?.id ?? randomUUID(),type,attrs };
    if (old) operations.push({ type:'update_block',block_id:old.id,block });
    else blocks.push(block);
  };
  if (views.has('graph_embed')) upsertView('graph_embed','概念与先修关系',initialIds);
  upsertView('timeline','文献时间线',timeline,{ paper_urls:[...relatedPapers] });
  if (views.has('table') && lessons.length>1) blocks.push({ id:randomUUID(),type:'table',attrs:{ table_version:1,title:'学习路径与先修要求',
    rows:[['主题','学习后能做到','先修主题'],...lessons.map(lesson=>[lesson.title,lesson.objective,
      lesson.prerequisites.map(index=>lessons.find(item=>item.index===index)?.title).filter(Boolean).join('、') || '从此处开始'])] } });
  if (!prior?.blocks.some(block=>block.type==='evidence_network'))
    blocks.push({ id:randomUUID(),type:'evidence_network',attrs:{ view_version:1,node_ids:[],title:'资料与证据' } });
  let anchor=prior?.blocks.at(-1)?.id ?? null;
  for (const block of blocks) {
    operations.push({ type:'insert_block',after_id:anchor,block });
    anchor=block.id;
  }
  const content=emptyDocument();
  content.blocks=blocks;
  content.relations.knowledge_node_ids=[...related];
  return { content,operations };
}
