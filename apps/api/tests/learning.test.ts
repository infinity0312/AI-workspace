import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArtifactDetail,LearningAssessmentResult,LearningMastery,LearningProgress,WorkspaceProjection } from '@akw/contracts';
import { openDatabase,migrate } from '../src/platform/database';
import { services } from '../src/services';
import { createApp } from '../src/http/app';
import { crystalAngleLesson } from '../src/quality-engine/learning-examples';
import { decodeLearningDraft,reviewedLessons } from '../src/quality-engine/learning-quality';
import type { PublicMaterial } from '../src/runtime/public-research';

const text='Neighborhood aggregation updates the representation of a node using information from adjacent nodes. A permutation-invariant operation such as summation makes the aggregate independent of the ordering of the neighbors.';
const source:PublicMaterial={ kind:'paper',provider:'Public Web',title:'Learning fixture source',text,url:'https://example.edu/learning-fixture',
  published:'2022',journal:'Synthetic benchmark' };
const goal='Learn aggregation and connect it to a regression example.';
const plan={ title:'Learning fixture',foundation:'Start with linear algebra',basis:'provided',diagnostic:'Have you used matrix multiplication?',
  queries:[{ chinese:'聚合',english:'aggregation' }],views:['graph_embed','timeline','table'] };
const draft={ lessons:['Node neighbors','Neighbor aggregation','Graph regression'].map((title,index)=>({
  title,objective:'Explain '+title.toLowerCase(),explanation:text,evidence:[0],prerequisites:index ? [index-1] : [],
  math:[{ latex:'h = x_1 + x_2',explanation:'Add the two scalar features.' }],
  practice:[{ question:'Which operation ignores the order of two scalar inputs?',options:['Subtraction','Summation','Keep first'],answer:1,
    explanation:'Swapping the terms of a sum leaves its value unchanged.' }],
})) };
const approved={ lessons:[0,1,2].map(index=>({ index,body:true,math:[0],practice:[0] })) };

test('a paper attribution error or fabricated evidence index cannot pass learning review',()=>{
  const bad={ ...draft.lessons[0],explanation:'ALIGNN 的线图节点天然对应一个键角。' };
  const candidate={ lessons:[bad,{ ...draft.lessons[1],evidence:[8] }] };
  const decoded=decodeLearningDraft(JSON.stringify(candidate),2,5);
  assert.equal(decoded.length,1);
  assert.deepEqual(reviewedLessons(JSON.stringify(approved),decoded),[]);
  const question='CGCNN 与 ALIGNN 三原子夹角';
  const origins=[{ id:'cg',kind:'paper',title:'CGCNN',text:'from the connection of atoms',material:{ ...source,url:'https://arxiv.org/abs/1710.10324' } },
    { id:'al',kind:'paper',title:'ALIGNN',text:'line graph corresponding to bond angles',material:{ ...source,url:'https://arxiv.org/abs/2106.01829' } }];
  assert.equal(crystalAngleLesson(question,origins.slice(0,1)),undefined);
  assert.match(crystalAngleLesson(question,origins)?.explanation ?? '',/√2 和 2/);
});

test('a learning goal produces one cited artifact, grades privately, and continues the same revision chain',async t=>{
  const db=await openDatabase({});
  await migrate(db);
  const state=services(db,{ async put(){},async get(){ return Buffer.alloc(0); } },{
    publicResearch:{ async discover(){ return [source]; }, async image(){ throw Error('Unexpected image'); } },
    model:{ async generate(system,data){
      const payload=data as { question?:string };
      const result=system.startsWith('Design a learning') ? plan : system.startsWith('Write a focused') ?
        payload.question ? { lessons:[{ ...draft.lessons[0],title:'Worked follow-up' }] } : draft : approved;
      return { text:JSON.stringify(result),input:30,output:30,provider:'fixture',model:'fixture' };
    } },
  });
  const app=await createApp(state,true);
  t.after(async()=>{ await app.close();await db.close(); });
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl()+'/v1';
  async function call<T>(path:string,body?:unknown,expected=body===undefined?200:201):Promise<T> {
    const response=await fetch(base+path,body===undefined ? undefined :
      { method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(body) });
    const data=await response.json();
    assert.equal(response.status,expected,JSON.stringify(data));
    return data;
  }
  const blocked=await call<{id:string}>('/workspaces',{ name:'Local only' });
  await call('/learning-runs',{ workspace_id:blocked.id,goal,allow_external:true },403);
  const ws=await call<{id:string}>('/workspaces',{ name:'Learning fixture',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  const queued=await call<{run_id:string}>('/learning-runs',{ workspace_id:ws.id,goal,allow_external:true },202);
  const signal=new AbortController().signal;
  assert.equal(await state.jobs.next(signal),true);
  const run=await call<LearningProgress>('/learning-runs/'+queued.run_id);
  assert.equal(run.status,'COMPLETED',JSON.stringify(run));
  const route='/artifacts/'+run.result!.artifact_id;
  const artifact=await call<ArtifactDetail>(route);
  const blocks=artifact.revision.content_json.blocks;
  const heading=blocks[0]!;
  assert.equal(heading.attrs?.basis,'unknown');
  assert.equal(heading.attrs?.goal,goal);
  const lessons=blocks.filter(block=>block.type==='learning_lesson');
  assert.equal(lessons.length,3);
  assert.deepEqual(lessons[1]?.attrs?.prerequisites,[lessons[0]!.id]);
  const projection=await call<WorkspaceProjection>(route+'/projection');
  assert.equal(projection.edges.filter(edge=>edge.relation_type==='depends_on').length,2);
  assert.ok(projection.nodes.some(node=>node.event_date==='2022' && node.event_evidence_id));
  assert.ok(projection.references?.claims.some(claim=>claim.block_ids?.includes(lessons[0]!.id)));
  const graded=await call<LearningAssessmentResult>(route+'/learning-mastery',{ revision_id:artifact.revision.id,
    lesson_id:lessons[0]!.id,answers:[1] },200);
  assert.equal(graded.correct,1);
  await db.all("INSERT INTO users(id) VALUES('another-user')");
  await db.all("INSERT INTO tenant_memberships(tenant_id,user_id) VALUES('local-tenant','another-user')");
  await db.all("INSERT INTO workspace_memberships(workspace_id,user_id,role) VALUES($1,'another-user','viewer')",[ws.id]);
  assert.deepEqual(await state.learning.mastery({ tenant:'local-tenant',user:'another-user' },artifact.id),[]);
  const follow=await call<{run_id:string}>(route+'/learning-followup',{ question:'A worked example',background:'I know matrix multiplication',
    base_revision_id:artifact.revision.id,allow_external:true },202);
  assert.equal(await state.jobs.next(signal),true);
  const followRun=await call<LearningProgress>('/learning-runs/'+follow.run_id);
  assert.equal(followRun.result?.artifact_id,artifact.id,JSON.stringify(followRun));
  const after=await call<ArtifactDetail>(route);
  assert.equal(after.revision.revision_number,2);
  assert.equal(after.revision.parent_revision_id,artifact.revision.id);
  assert.ok(after.revision.content_json.blocks.some(block=>block.attrs?.title==='Worked follow-up'));
  assert.equal(after.revision.content_json.blocks[0]?.attrs?.basis,'provided');
  assert.equal((await call<LearningMastery>(route+'/learning-mastery'))[0]?.correct,1);
  await call(route+'/learning-followup',{ question:'An older revision',base_revision_id:artifact.revision.id,allow_external:true },409);
});
