import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { unzipSync } from 'fflate';
import { artifactDocument, emptyDocument, type ArtifactComment, type ArtifactDetail, type CaptureItem, type Schedule, type StudyCard, type StudyGoal, type WorkspaceProjection, type ArtifactRevision, type DocumentAnalysisRun, type Mutation, type PatchInput } from '@akw/contracts';
import { createApp } from '../src/http/app';
import { applyPatch } from '../src/domain/artifacts';
import { migrate, openDatabase, type Database } from '../src/platform/database';
import type { ObjectStore } from '../src/platform/objects';
import { sha256 } from '../src/platform/security';
import { supportsAnalysisStatement,supportsNumbers } from '../src/quality-engine/evidence-checks';
import { completeSentences } from '../src/quality-engine/evidence-spans';
import { htmlText } from '../src/domain/html-text';
import { compatibleResearchScope,meetsImageAttribution } from '../src/quality-engine/document-quality';
import { researchDocument } from '../src/runtime/document-research';
import { ensureIdentity } from '../src/domain/access';
import { services, type Services } from '../src/services';

let db: Database;
let service: Services;
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const local = { tenant:'local-tenant',user:'local-user' };
const controller = new AbortController();
let interruptVerifier:AbortController|undefined;
const paragraph = (text: string) => ({ id:randomUUID(),type:'paragraph',children:[{ type:'text',text }] });
const content = (...texts: string[]) => artifactDocument.parse({ ...emptyDocument(),blocks:texts.map(paragraph) });
const binary = new Map<string,Buffer>();
const objects: ObjectStore = {
  async put(key,bytes) { binary.set(key,bytes); },
  async get(key) { const data = binary.get(key); assert.ok(data); return data; },
};

before(async () => {
  db = await openDatabase({});
  await migrate(db);
  await migrate(db);
  service = services(db,objects,{ model: {
    async generate(instruction,data) {
      const input = data as { goal:string; instruction?:string; selection?:string; after?:string;
        evidence?:{ id:string; kind:string }[]; excerpt_options?:{ id:string;text:string }[] };
      const evidence_ids = input.goal === 'Invalid citations' ? [randomUUID()] :
        (input.evidence ?? []).filter(item => item.kind !== 'image').slice(0,2).map(item => item.id);
      if (['Resume fixture','Recover blank draft'].includes(input.goal) && instruction.startsWith('You are the final evidence checker') && interruptVerifier) {
        const abort = interruptVerifier;
        interruptVerifier = undefined;
        abort.abort();
        abort.signal.throwIfAborted();
      }
      if (input.goal==='Recover blank draft' && instruction.startsWith('Write a concise') && !instruction.includes('prior candidates'))
        return { text:'   ',input:40,output:20,model:'test',provider:'test',finishReason:'stop' };
      const repair = input.goal === 'Needs repair';
      const statement = (text:string) => ({ kind:'statement',text,evidence_ids });
      const output = instruction.startsWith('Plan public research') ? { chinese:'样本主题',english:'Fixture topic',
        facets:input.goal === 'Cross language retrieval' ? [{ label:'数据校准',chinese:'数据校准',english:'thermal calibration' }] : undefined } :
        instruction.startsWith('You are the final evidence checker') ? { approved_claims:['1.1','3.1'],answers:input.goal === 'Cross language retrieval' ? [{ facet:0,claim_key:'1.1' }] : [],
          approved_images:input.evidence?.filter(item => item.kind === 'image').map(item => item.id) ?? [] } :
        instruction.startsWith('Rewrite only') ? { text:input.instruction?.includes('90%') ? 'All conditions save 90%.' :
          input.instruction?.includes('all conditions') ? 'All conditions save energy.' : 'The tested unit used less energy.' } :
        instruction.startsWith('Review an edit') ? { supported:!input.after?.includes('All conditions') } :
          { sections:[{ title:'Analysis',facet:input.goal === 'Cross language retrieval' ? 0 : undefined,claims:[
              repair && instruction.includes('prior candidates') ? { kind:'quote',excerpt_id:input.excerpt_options?.[0]?.id } :
                statement(repair ? 'Observed 9 kg.' : 'Test analysis proposal')] },
            { title:'Gate rejection',claims:[statement('This unsupported sentence should be discarded.')] },
            { title:'待核实',claims:[statement('This unresolved section should be discarded.')] }] };
      return { text:JSON.stringify(output),input:40,output:20,model:'test',provider:'test' };
    },
  },publicResearch:{
    async discover(query) {
      assert.equal(query.english,'Fixture topic');
      return [
        { kind:'encyclopedia',provider:'Wikipedia',title:'Fixture encyclopedia',url:'https://en.wikipedia.org/wiki/Test_fixture',text:'A synthetic research fixture is an input designed for a repeatable test.' },
        { kind:'paper',provider:'Crossref',title:'Fixture paper',url:'https://doi.org/10.1000/workspace-fixture',text:'Fixture paper. Abstract excerpt: The trial reports a repeatable synthetic measurement.',doi:'10.1000/workspace-fixture',journal:'Fixture Journal',published:'2024' },
        { kind:'image',provider:'Wikimedia Commons',title:'Fixture photograph',url:'https://commons.wikimedia.org/wiki/File:Fixture_photo.png',
          text:'Fixture photograph. Public domain.',image:{ url:'https://upload.wikimedia.org/wikipedia/commons/fixture.png',license:'Public domain',licenseUrl:'',credit:'Fixture photographer' } },
      ];
    },
    async image() { return { mime:'image/png',bytes:await readFile('tests/fixtures/ocr-atlas.png') }; },
  } });
  app = await createApp(service,true);
  await app.listen(0,'127.0.0.1');
  base = await app.getUrl() + '/v1';
});
after(async () => {
  controller.abort();
  await app?.close();
  await db?.close();
});
async function request<T>(path: string, body?: unknown, expected = body === undefined ? 200 : 201, key?: string) {
  const response = await fetch(base + path,{
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type':'application/json', ...(key ? { 'Idempotency-Key':key } : {}) },
    body:body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.status,expected,JSON.stringify(value));
  return value as T;
}
test('OpenAPI serves shared editing and restore contracts',async () => {
  const contract = await request<{ openapi:string; paths:Record<string,unknown>; components:{ schemas:Record<string,unknown> } }>('/openapi.json');
  assert.equal(contract.openapi,'3.1.0');
  assert.ok(contract.paths['/imports/dry-run']);
  assert.ok(contract.paths['/sync/mutations']);
  assert.ok(contract.paths['/study']);
  assert.ok(contract.paths['/schedules']);
  assert.ok(contract.paths['/artifacts/{id}/comments']);
  assert.ok(contract.components.schemas.ArtifactDocument);
});

const workspace = (name: string) => request<{ id:string }>('/workspaces',{ name });
const artifact = (ws: string,...texts: string[]) => request<ArtifactDetail>('/artifacts',{ workspace_id:ws,title:'Test artifact',content:content(...texts) });
const baseMutation = (a: ArtifactDetail, doc: ArtifactDetail['revision']['content_json'], seq = 1): Mutation => ({
  mutation_id:randomUUID(),workspace_id:a.workspace_id,device_id:randomUUID(),entity_type:'artifact',entity_id:a.id,operation:'patch',
  base_version:a.revision.revision_number,client_sequence:seq,payload:{ base_revision_id:a.revision.id,operations:[{ type:'replace_document',content:doc }] },
  schema_version:'1.0',created_at:new Date().toISOString(),
});

test('workspace and artifact writes are idempotent and tenant scoped',async () => {
  const key = randomUUID();
  const a = await request<{ id:string }>('/workspaces',{ name:'研究一' },201,key);
  const b = await request<{ id:string }>('/workspaces',{ name:'研究一' },201,key);
  assert.deepEqual(a,b);
  const conflict = await request<{ error:{ code:string; trace_id:string } }>('/workspaces',{ name:'另一个' },409,key);
  assert.equal(conflict.error.code,'CONFLICT_IDEMPOTENCY');
  assert.ok(conflict.error.trace_id);
  await assert.rejects(service.workspaces.get({ tenant:'tenant-other',user:local.user },a.id),/Workspace unavailable/);
  const item = await artifact(a.id,'一份资料');
  assert.equal(item.revision.revision_number,1);
  await assert.rejects(service.artifacts.get({ tenant:local.tenant,user:'not-a-member' },item.id),/Workspace unavailable/);
});

test('patch preserves grapheme boundaries, proposals and immutable revisions',async () => {
  const ws = await workspace('Patch');
  const item = await artifact(ws.id,'A👩‍🔬B');
  const original = item.revision.content_json;
  const operation = { type:'replace_text_range' as const,block_id:original.blocks[0]!.id,inline_index:0,start_utf16:1,end_utf16:6,
    expected_text:'👩‍🔬',expected_sha256:sha256('👩‍🔬'),text:'研究者' };
  assert.throws(() => applyPatch(original,[{ ...operation,end_utf16:2 }]),/grapheme/);
  const proposal = await request<{ id:string }>('/artifacts/' + item.id + '/patches',{ base_revision_id:item.revision.id,operations:[operation] });
  assert.equal((await request<ArtifactDetail>('/artifacts/' + item.id)).revision.id,item.revision.id);
  const outcome = await request<{ revision:ArtifactRevision }>('/artifacts/' + item.id + '/patches/' + proposal.id + '/accept',{},200);
  assert.equal(outcome.revision.content_json.blocks[0]?.children?.[0]?.text,'A研究者B');
  const revisions = await request<ArtifactRevision[]>('/artifacts/' + item.id + '/revisions');
  assert.equal(revisions.length,2);
  assert.equal(revisions[1]?.content_json.blocks[0]?.children?.[0]?.text,'A👩‍🔬B');
});

test('sync merges distinct blocks, replays an ACK, exposes same-block conflicts, and advances cursor',async () => {
  const ws = await workspace('Sync');
  const item = await artifact(ws.id,'甲','乙');
  const localCopy = structuredClone(item.revision.content_json);
  const otherCopy = structuredClone(item.revision.content_json);
  const conflictCopy = structuredClone(item.revision.content_json);
  localCopy.blocks[0]!.children![0]!.text = '甲本地';
  otherCopy.blocks[1]!.children![0]!.text = '乙远端';
  conflictCopy.blocks[0]!.children![0]!.text = '甲冲突';
  const firstMutation = baseMutation(item,localCopy);
  const push = (mutation: Mutation,status = 200) => request<{ results:{ acknowledged:boolean; revision:ArtifactRevision }[] }>('/sync/mutations',{ mutations:[mutation] },status);
  const first = await push(firstMutation);
  assert.deepEqual(await push(firstMutation),first);
  assert.equal(first.results[0]?.acknowledged,true);
  assert.equal(Object.hasOwn(first.results[0]!,'cursor'),false);
  const merged = (await push(baseMutation(item,otherCopy))).results[0]!;
  assert.deepEqual(merged.revision.content_json.blocks.map(block => block.children?.[0]?.text),['甲本地','乙远端']);
  await push(baseMutation(item,conflictCopy),409);
  const page = await request<{ changes:{ event_type:string }[]; next_cursor:string }>('/sync/changes?workspace_id=' + ws.id + '&limit=2');
  assert.equal(page.changes.length,2);
  const tail = await request<{ changes:{ event_type:string }[] }>('/sync/changes?workspace_id=' + ws.id + '&cursor=' + page.next_cursor);
  assert.equal(tail.changes.filter(item => item.event_type === 'ArtifactRevisionCommitted').length,2);
  const snapshot = await request<{ artifacts:{ revision_number:number }[] }>('/sync/snapshot',{ workspace_id:ws.id },200);
  assert.equal(snapshot.artifacts[0]?.revision_number,3);
});

test('device sequence advances transactionally and retries keep the original acknowledgement',async ()=>{
  const ws=await workspace('Device checkpoint');
  const item=await artifact(ws.id,'first');
  const update=baseMutation(item,content('second'),4);
  const mutate=(mutation:Mutation,status=200)=>request('/sync/mutations',{ mutations:[mutation] },status);
  const accepted=await mutate(update);
  assert.deepEqual(await mutate(update),accepted);
  const skipped=await mutate({ ...update,mutation_id:randomUUID(),client_sequence:3 },409);
  assert.match(JSON.stringify(skipped),/CONFLICT_DEVICE_SEQUENCE/);
  assert.equal((await request<ArtifactDetail>('/artifacts/'+item.id)).revision.revision_number,2);
});

test('distinct Unicode text ranges in the same block merge safely',async () => {
  const ws = await workspace('Unicode merge');
  const item = await artifact(ws.id,'甲👩‍🔬乙');
  const left = structuredClone(item.revision.content_json);
  const right = structuredClone(item.revision.content_json);
  left.blocks[0]!.children![0]!.text = '左👩‍🔬乙';
  right.blocks[0]!.children![0]!.text = '甲👩‍🔬右';
  await request('/sync/mutations',{ mutations:[baseMutation(item,left)] },200);
  await request('/sync/mutations',{ mutations:[baseMutation(item,right)] },200);
  const merged = await request<ArtifactDetail>('/artifacts/' + item.id);
  assert.equal(merged.revision.content_json.blocks[0]?.children?.[0]?.text,'左👩‍🔬右');
});

test('ingestion and worker produce traceable research, five export formats, and an inspectable archive',async () => {
  const ws = await workspace('研究与导出');
  const source = await request<{ id:string; status:string }>('/sources',{
    workspace_id:ws.id,title:'学习笔记',text:'Graph neural networks aggregate information from adjacent nodes.\n\n第二段保留中文。',rights:'user_owned',
  });
  assert.equal(source.status,'parsed');
  const job = await request<{ run_id:string }>('/research-runs',{ workspace_id:ws.id,goal:'Graph neural networks',source_ids:[source.id] },202);
  await request('/research-runs/' + job.run_id + '/pause',{},200);
  assert.equal(await service.jobs.next(controller.signal),false);
  await request('/research-runs/' + job.run_id + '/resume',{},200);
  assert.equal(await service.jobs.next(controller.signal),true);
  const done = await request<{ status:string; result:{ artifact_id:string } }>('/research-runs/' + job.run_id);
  assert.equal(done.status,'PARTIAL');
  const item = await request<ArtifactDetail>('/artifacts/' + done.result.artifact_id);
  const quote = item.revision.content_json.blocks.find(block => block.type === 'quote');
  const reference = quote?.children?.find(node => node.type === 'citation')?.attrs?.evidence_id;
  assert.equal(typeof reference,'string');
  const evidence = await request<{ source_id:string; quote:string; locator:{ start_utf16:number } }>('/evidence/' + reference);
  assert.equal(evidence.source_id,source.id);
  assert.match(evidence.quote,/Graph neural networks/);
  assert.equal(evidence.locator.start_utf16,0);

  for (const [format,signature] of [['markdown','# '],['json','{'],['pdf','%PDF-'],['docx','PK'],['zip','PK']] as const) {
    const ascii = format === 'pdf' ? await artifact(ws.id,'A PDF paragraph') : item;
    const job = await request<{ run_id:string }>('/exports',{
      workspace_id:ws.id,format,...(format === 'zip' ? {} : { artifact_id:ascii.id }),
    },202);
    assert.equal(await service.jobs.next(controller.signal),true);
    const output = await request<{ status:string; result:unknown }>('/exports/' + job.run_id);
    assert.equal(output.status,'COMPLETED',JSON.stringify(output));
    const response = await fetch(base + '/exports/' + job.run_id + '/download');
    assert.equal(response.status,200);
    const data = Buffer.from(await response.arrayBuffer());
    assert.equal(data.subarray(0,signature.length).toString(),signature);
    assert.equal(response.headers.get('x-content-checksum'),sha256(data));
    if (format === 'zip') {
      const files = unzipSync(data);
      const checksums = JSON.parse(Buffer.from(files['checksums.json']!).toString()) as Record<string,string>;
      assert.ok(files['artifacts/revisions.json']);
      assert.ok(files['sources/evidence.json']);
      assert.equal(checksums['manifest.json'],sha256(Buffer.from(files['manifest.json']!)));
      const archive = data.toString('base64');
      const inspection = await request<{ checksum:string; counts:{ evidence:number } }>('/imports/dry-run',{ data_base64:archive },200);
      assert.equal(inspection.checksum,sha256(data));
      assert.ok(inspection.counts.evidence > 0);
      const restored = await request<{ id:string }>('/imports',{ data_base64:archive,confirm_checksum:inspection.checksum,name:'已恢复的工作空间' });
      assert.notEqual(restored.id,ws.id);
      const imported = await request<{ id:string; title:string }[]>('/artifacts?workspace_id=' + restored.id);
      const recovered = await request<ArtifactDetail>('/artifacts/' + imported.find(artifact => artifact.title === item.title)!.id);
      assert.notEqual(recovered.id,item.id);
      const restoredQuote = recovered.revision.content_json.blocks.find(block => block.type === 'quote');
      const newEvidenceId = restoredQuote?.children?.find(node => node.type === 'citation')?.attrs?.evidence_id;
      assert.notEqual(newEvidenceId,reference);
      const restoredEvidence = await request<{ quote:string }>('/evidence/' + newEvidenceId);
      assert.equal(restoredEvidence.quote,evidence.quote);
    }
  }
});

test('document analysis creates a gated proposal, preserves existing text, and rejects fabricated citations',async () => {
  const blocked = await workspace('No external analysis permission');
  const blank = await artifact(blocked.id);
  const createRun = (item: ArtifactDetail, input: object, expected = 202, key?: string) =>
    request<{ run_id:string }>('/artifacts/' + item.id + '/analysis-runs',{
      base_revision_id:item.revision.id,goal:'Analyze the trial',allow_external:true,use_web:false,...input,
    },expected,key);
  await createRun(blank,{},403);
  const ws = await request<{ id:string }>('/workspaces',{
    name:'Approved analysis',policy:{ sensitivity:'personal',externalProviderAllowed:true },
  });
  const item = await artifact(ws.id,'User text to preserve');
  const source = await request<{ id:string }>('/sources',{
    workspace_id:ws.id,title:'Synthetic fixture',text:'A synthetic trial returned 7 successful tests out of 9.',
  });
  const restricted = await request<{ id:string }>('/sources',{
    workspace_id:ws.id,title:'Restricted fixture',text:'This source is protected.',sensitivity:'restricted',
  });
  await createRun(item,{ source_id:restricted.id },403);
  await createRun(item,{ base_revision_id:randomUUID() },409);
  const key = randomUUID();
  const queued = await createRun(item,{ source_id:source.id },202,key);
  assert.deepEqual(await createRun(item,{ source_id:source.id },202,key),queued);
  assert.equal(await service.jobs.next(controller.signal),true);
  const result = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + queued.run_id);
  assert.equal(result.status,'COMPLETED');
  assert.equal(result.result?.grounded,true);
  assert.equal((await request<ArtifactDetail>('/artifacts/' + item.id)).revision.id,item.revision.id);
  const runs = await request<DocumentAnalysisRun[]>('/artifacts/' + item.id + '/analysis-runs');
  assert.equal(runs[0]?.result?.patch_id,result.result?.patch_id);
  const { revision } = await request<{ revision:ArtifactRevision }>('/artifacts/' + item.id + '/patches/' + result.result?.patch_id + '/accept',{},200);
  assert.equal(revision.revision_number,2);
  assert.deepEqual(revision.content_json.blocks[0],item.revision.content_json.blocks[0]);
  const reference = revision.content_json.blocks.flatMap(block => block.children ?? []).find(child => child.type === 'citation')?.attrs?.evidence_id;
  const evidence = await request<{ source_id:string }>('/evidence/' + reference);
  assert.equal(evidence.source_id,source.id);

  const failure = await createRun({ ...item,revision },{ goal:'Invalid citations',source_id:source.id });
  assert.equal(await service.jobs.next(controller.signal),true);
  const failed = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + failure.run_id);
  assert.equal(failed.status,'FAILED');
  assert.equal(failed.result?.warning,'PROVIDER_ANALYSIS_INVALID');
  const patches = await request<{ operations:PatchInput['operations'] }[]>('/artifacts/' + item.id + '/patches');
  assert.equal(patches.length,1);
});

test('role and project scope checks prevent implicit authorization',async () => {
  const ws = await workspace('Project scope');
  const a = await request<{ id:string }>('/workspaces/' + ws.id + '/projects',{ name:'A' });
  const b = await request<{ id:string }>('/workspaces/' + ws.id + '/projects',{ name:'B' });
  const source = await request<{ id:string }>('/sources',{ workspace_id:ws.id,project_id:b.id,title:'B',text:'Scoped content.' });
  await request('/research-runs',{ workspace_id:ws.id,project_id:a.id,source_ids:[source.id],goal:'Test' },404);
  await request('/projects/' + a.id + '/relations',{ to_project_id:b.id });
  const run = await request<{ run_id:string }>('/research-runs',{ workspace_id:ws.id,project_id:a.id,source_ids:[source.id],goal:'Test' },202);
  await request('/research-runs/' + run.run_id + '/cancel',{},200);
});

test('capture, version restoration, trash and private learning survive archive recovery',async () => {
  const ws = await workspace('Product archive');
  const other = { tenant:local.tenant,user:'product-archive-viewer' };
  await db.transaction(sql => ensureIdentity(sql,other));
  await service.collaboration.member(local,ws.id,{ user_id:other.user,role:'editor',version:0 });
  const captureKey = randomUUID();
  const captured = await request<CaptureItem>('/capture-items',{
    workspace_id:ws.id,title:'Collected note',text:'Original source note.',rights:'user_owned',
  },201,captureKey);
  assert.equal((await service.library.captures(other,ws.id)).length,0);
  assert.equal((await service.library.search(other,ws.id,'Original source')).length,0);
  assert.equal((await request<{ kind:string }[]>('/search?workspace_id=' + ws.id + '&q=Original%20source'))[0]!.kind,'capture');
  assert.equal((await service.sync.changes(other,ws.id,'0',200)).changes.some(row => (row as Record<string,unknown>).aggregate_id === captured.id),false);
  await assert.rejects(service.library.processCapture(other,captured.id,{ action:'note' }),/Capture unavailable/);
  const converted = await request<CaptureItem>('/capture-items/' + captured.id + '/process',{ action:'note' },200);
  assert.equal(converted.result_kind,'note');
  assert.equal((await service.library.search(other,ws.id,'Original source'))[0]?.kind,'artifact');
  const document = await request<ArtifactDetail>('/artifacts/' + converted.result_id);
  const update = await request<ArtifactRevision>('/artifacts/' + document.id + '/revisions',{
    base_revision_id:document.revision.id,operations:[{ type:'replace_document',content:content('Revision two') }],
  });
  const { revision:restoredRevision } = await request<{ revision:ArtifactRevision }>('/artifacts/' + document.id + '/revisions/restore',{
    base_revision_id:update.id,revision_id:document.revision.id,
  },200);
  const restored = { ...document,revision:restoredRevision,canonical_revision_id:restoredRevision.id };
  assert.equal(restored.revision.revision_number,3);
  assert.deepEqual(restored.revision.content_json,document.revision.content_json);
  const comment = await service.collaboration.comment(other,document.id,{
    revision_id:restored.revision.id,block_id:restored.revision.content_json.blocks[0]!.id,body:'Revision-specific comment',
  });
  await service.collaboration.updateComment(local,document.id,comment.id,{ resolved:true,version:comment.version });
  const goal = await request<StudyGoal>('/study/goals',{ workspace_id:ws.id,title:'Read this note',artifact_id:document.id,steps:['Read'] });
  const completed = await service.study.updateGoal(local,goal.id,{ version:goal.version,step_id:goal.steps[0]!.id,done:true });
  assert.equal(completed.status,'completed');
  await assert.rejects(service.study.updateGoal(local,goal.id,{ version:goal.version,step_id:goal.steps[0]!.id,done:false }),/Learning goal changed/);
  assert.equal((await service.study.overview(local,ws.id)).goals[0]!.steps[0]!.done,true);
  const card = await request<StudyCard>('/study/cards',{ workspace_id:ws.id,artifact_id:document.id,question:'What was stored?',answer:'A note' });
  const key = randomUUID();
  const reviewed = await request<StudyCard>('/study/cards/' + card.id + '/review',{ version:card.version,rating:'good' },200,key);
  assert.equal(reviewed.interval_minutes,1440);
  assert.equal(reviewed.due,false);
  assert.equal((await request<StudyCard>('/study/cards/' + card.id + '/review',{ version:card.version,rating:'good' },200,key)).due_at,reviewed.due_at);
  assert.equal((await service.study.overview(other,ws.id)).cards.length,0);
  await request('/artifacts/' + document.id + '/trash',{ base_revision_id:restored.revision.id },200);
  await request('/artifacts/' + document.id,undefined,404);
  const deletedMutation = baseMutation(restored,content('Saved on another device'));
  await assert.rejects(service.sync.submit(local,deletedMutation),{ code:'CONFLICT_ARTIFACT_DELETED' });
  const output = await service.jobs.export(local,{ workspace_id:ws.id,format:'zip' });
  assert.equal(await service.jobs.next(controller.signal),true);
  const zip = await fetch(base + '/exports/' + output.run_id + '/download');
  assert.equal(zip.status,200);
  const archive = Buffer.from(await zip.arrayBuffer()).toString('base64');
  const inspected = await request<{ checksum:string; counts:Record<string,number> }>('/imports/dry-run',{ data_base64:archive },200);
  assert.equal(inspected.counts.comments,1);
  assert.equal(inspected.counts.studyCards,1);
  const copy = await request<{ id:string }>('/imports',{ data_base64:archive,confirm_checksum:inspected.checksum });
  const trash = await request<{ id:string; canonical_revision_id:string }[]>('/workspaces/' + copy.id + '/trash');
  assert.equal(trash.length,1);
  await request('/artifacts/' + trash[0]!.id + '/restore',{ base_revision_id:trash[0]!.canonical_revision_id },200);
  const learned = await request<{ goals:StudyGoal[]; cards:StudyCard[] }>('/study?workspace_id=' + copy.id);
  assert.equal(learned.goals[0]!.artifact_id,trash[0]!.id);
  assert.equal(learned.goals[0]!.status,'completed');
  assert.equal(learned.cards[0]!.due_at,reviewed.due_at);
  const copiedComments = await request<{ comments:ArtifactComment[] }>('/artifacts/' + trash[0]!.id + '/comments');
  assert.equal(copiedComments.comments[0]!.original_author_id,other.user);
  assert.ok(copiedComments.comments[0]!.resolved_at);
  assert.equal((await request<CaptureItem[]>('/capture-items?workspace_id=' + copy.id))[0]!.result_id,trash[0]!.id);
  await request('/artifacts/' + document.id + '/restore',{ base_revision_id:restored.revision.id },200);
  assert.equal((await service.sync.submit(local,deletedMutation)).acknowledged,true);
});

test('source withdrawal keeps evidence and changes dependent claims and retrieval',async () => {
  const ws = await workspace('Source maintenance');
  const source = await request<{ id:string; version:number }>('/sources',{
    workspace_id:ws.id,title:'Maintenance source',rights:'user_owned',text:'Snapshot supports a material claim for maintenance.',
  });
  const run = await request<{ run_id:string }>('/research-runs',{ workspace_id:ws.id,goal:'material claim',source_ids:[source.id] },202);
  await service.jobs.next(controller.signal);
  const job = await request<{ status:string; result:{ artifact_id:string } }>('/research-runs/' + run.run_id);
  assert.ok(['COMPLETED','PARTIAL'].includes(job.status),JSON.stringify(job));
  const generated = await request<ArtifactDetail>('/artifacts/' + job.result.artifact_id);
  const evidence = generated.revision.content_json.blocks.flatMap(block => block.children ?? []).find(item => item.type === 'citation')?.attrs?.evidence_id;
  assert.equal(typeof evidence,'string');
  await request('/knowledge/claims',{ workspace_id:ws.id,statement:'A manual claim',evidence_ids:[evidence] });
  const maintenance = await request<{ claims:{ id:string; version:number }[] }>('/knowledge/maintenance?workspace_id=' + ws.id);
  assert.ok(maintenance.claims.length);
  const claim = maintenance.claims[0]!;
  await request('/knowledge/claims/' + claim.id + '/review',{ decision:'supported',version:claim.version,reason:'Verified snapshot' },200);
  const withdrawn = await request<{ lifecycle:string; flagged_claims:number }>('/sources/' + source.id + '/lifecycle',{ action:'retract',version:source.version },200);
  assert.equal(withdrawn.lifecycle,'retracted');
  assert.ok(withdrawn.flagged_claims > 0);
  const after = await request<{ status:string; version:number; evidence:{ id:string }[]; reviews:{ reason:string }[] }>('/knowledge/claims/' + claim.id);
  assert.equal(after.status,'needs_review');
  assert.equal(after.reviews[0]!.reason,'Verified snapshot');
  await request('/evidence/' + after.evidence[0]!.id);
  await request('/knowledge/claims/' + claim.id + '/review',{ decision:'supported',version:after.version },422);
});

test('monitor queue avoids duplicate jobs and respects changed workspace policy',async () => {
  const ws = await workspace('Monitor');
  const edit = { tenant:local.tenant,user:'monitor-editor' };
  const outsider = { tenant:'other-tenant',user:'monitor-outsider' };
  await db.transaction(async sql => { await ensureIdentity(sql,edit); await ensureIdentity(sql,outsider); });
  await assert.rejects(service.collaboration.member(local,ws.id,{ user_id:outsider.user,role:'editor',version:0 }),/Tenant account unavailable/);
  const member = await service.collaboration.member(local,ws.id,{ user_id:edit.user,role:'editor',version:0 });
  await assert.rejects(service.collaboration.member(edit,ws.id,{ user_id:edit.user,role:'viewer',version:member.version }),/Permission denied/);
  const row = await request<Schedule>('/schedules',{
    workspace_id:ws.id,title:'Repeat check',cadence_hours:1,target:{ kind:'research',goal:'Compare study notes' },
  });
  await db.all("UPDATE research_schedules SET next_run_at=now()-interval '1 minute' WHERE id=$1",[row.id]);
  await service.schedules.enqueueDue();
  const [first] = await request<Schedule[]>('/schedules?workspace_id=' + ws.id);
  assert.ok(first?.last_job_id);
  await db.all("UPDATE research_schedules SET next_run_at=now()-interval '1 minute' WHERE id=$1",[row.id]);
  await service.schedules.enqueueDue();
  const [second] = await service.schedules.list(local,ws.id);
  assert.equal(second?.last_job_id,first.last_job_id);
  assert.equal(second?.last_skip_reason,'previous_run_active');
  await service.jobs.command(local,first.last_job_id,'cancel');
  await service.workspaces.updatePolicy(local,ws.id,{ externalProviderAllowed:true,sensitivity:'personal' });
  const privateMonitor = await service.schedules.create(edit,{
    workspace_id:ws.id,title:'External research',cadence_hours:24,target:{ kind:'research',goal:'Synthetic topic',allow_external:true },
  });
  assert.equal((await service.schedules.list(local,ws.id)).some(item => item.id === privateMonitor.id),false);
  await service.workspaces.updatePolicy(local,ws.id,{ externalProviderAllowed:false,sensitivity:'personal' });
  await db.all("UPDATE research_schedules SET next_run_at=now()-interval '1 minute' WHERE id=$1",[privateMonitor.id]);
  await service.schedules.enqueueDue();
  const [stopped] = await service.schedules.list(edit,ws.id);
  assert.equal(stopped?.enabled,false);
  assert.equal(stopped?.last_skip_reason,'policy_or_access');
  await service.collaboration.member(local,ws.id,{ user_id:edit.user,role:'remove',version:member.version });
  await assert.rejects(service.schedules.list(edit,ws.id),/Workspace unavailable/);
});

test('web analysis writes only checked claims and preserves paper and image provenance in an archive',async () => {
  const ws = await request<{ id:string }>('/workspaces',{
    name:'Multimedia research',policy:{ sensitivity:'personal',externalProviderAllowed:true },
  });
  const item = await artifact(ws.id,'Keep my text.');
  const run = await request<{ run_id:string }>('/artifacts/' + item.id + '/analysis-runs',{
    base_revision_id:item.revision.id,goal:'Fixture topic',allow_external:true,
  },202);
  assert.equal(await service.jobs.next(controller.signal),true);
  const output = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + run.run_id);
  assert.equal(output.status,'COMPLETED',JSON.stringify(output));
  assert.equal(output.result?.grounded,true);
  const pending = await request<ArtifactDetail>('/artifacts/' + item.id);
  assert.equal(pending.revision.id,item.revision.id);
  const { revision } = await request<{ revision:ArtifactRevision }>('/artifacts/' + item.id + '/patches/' + output.result?.patch_id + '/accept',{},200);
  const blocks = revision.content_json.blocks;
  assert.deepEqual(blocks[0],item.revision.content_json.blocks[0]);
  assert.equal(blocks.filter(block => block.attrs?.analysis_verified === true).length,1);
  assert.doesNotMatch(JSON.stringify(blocks),/待核实|Gate rejection|unresolved section/);
  assert.match(JSON.stringify(blocks),/Fixture paper.*10.1000\/workspace-fixture/);
  const image = blocks.find(block => block.type === 'image');
  assert.equal(image?.attrs?.license,'Public domain');
  const original = await request<{ mime:string; data_base64:string }>('/assets/' + image?.attrs?.asset_id + '/preview');
  assert.equal(original.mime,'image/png');
  assert.ok(original.data_base64.length > 0);
  const outside = await workspace('Unaffiliated artifacts');
  await request('/artifacts',{ workspace_id:outside.id,title:'Wrong image scope',content:{ ...emptyDocument(),blocks:[image] } },422);
  const excerpt = await request<{ canonical_url:string }>('/evidence/' + image?.attrs?.evidence_id);
  assert.match(excerpt.canonical_url,/^https:\/\/commons\.wikimedia\.org\//);

  const word = await service.jobs.export(local,{ workspace_id:ws.id,format:'docx',artifact_id:item.id });
  await service.jobs.next(controller.signal);
  const docx = await fetch(base + '/exports/' + word.run_id + '/download');
  assert.equal(docx.status,200);
  assert.ok(Object.keys(unzipSync(new Uint8Array(await docx.arrayBuffer()))).some(path => /^word\/media\/[^/]+$/.test(path)));

  const archive = await service.jobs.export(local,{ workspace_id:ws.id,format:'zip' });
  await service.jobs.next(controller.signal);
  const response = await fetch(base + '/exports/' + archive.run_id + '/download');
  assert.equal(response.status,200);
  const data_base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
  const inspect = await request<{ checksum:string }>('/imports/dry-run',{ data_base64 },200);
  const copy = await request<{ id:string }>('/imports',{ data_base64,confirm_checksum:inspect.checksum });
  const [summary] = await request<{ id:string }[]>('/artifacts?workspace_id=' + copy.id);
  const recovered = await request<ArtifactDetail>('/artifacts/' + summary!.id);
  const restored = recovered.revision.content_json.blocks.find(block => block.type === 'image');
  assert.notEqual(restored?.attrs?.asset_id,image?.attrs?.asset_id);
  assert.deepEqual(await request('/assets/' + restored?.attrs?.asset_id + '/preview'),original);
  const source = await request<{ canonical_url:string }>('/evidence/' + restored?.attrs?.evidence_id);
  assert.equal(source.canonical_url,excerpt.canonical_url);
});

test('analysis with no usable evidence creates no proposal',async () => {
  const ws = await request<{ id:string }>('/workspaces',{ name:'No sources',policy:{ sensitivity:'personal',externalProviderAllowed:true } });
  const doc = await artifact(ws.id);
  const job = await request<{ run_id:string }>('/artifacts/' + doc.id + '/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'Evidence is required',allow_external:true,use_web:false,
  },202);
  assert.equal(await service.jobs.next(controller.signal),true);
  const result = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + job.run_id);
  assert.equal(result.status,'FAILED');
  assert.equal(result.result?.warning,'ANALYSIS_NO_EVIDENCE');
  assert.deepEqual(await request('/artifacts/' + doc.id + '/patches'),[]);
});

test('knowledge projections share canonical nodes, respect project scope and survive archive restoration',async () => {
  const ws = await workspace('Composable knowledge');
  const other = await workspace('Projection outsider');
  const localProject = await request<{ id:string }>('/workspaces/' + ws.id + '/projects',{ name:'Local' });
  const unrelated = await request<{ id:string }>('/workspaces/' + ws.id + '/projects',{ name:'Unrelated' });
  const shared = await request<{ id:string; version:number }>('/knowledge/nodes',{
    workspace_id:ws.id,title:'Baseline event',type:'event',event_date:'2020',
  });
  const localNode = await request<{ id:string; version:number }>('/knowledge/nodes',{
    workspace_id:ws.id,project_id:localProject.id,title:'Second event',type:'event',event_date:'2021-04-12',
  });
  const unrelatedNode = await request<{ id:string }>('/knowledge/nodes',{
    workspace_id:ws.id,project_id:unrelated.id,title:'Unrelated event',type:'event',event_date:'2022',
  });
  const outsider = await request<{ id:string }>('/knowledge/nodes',{ workspace_id:other.id,title:'Foreign event',type:'event',event_date:'1999' });
  const edge = await request<{ id:string }>('/knowledge/edges/suggestions',{
    workspace_id:ws.id,from_node_id:shared.id,to_node_id:localNode.id,relation_type:'related_to',
  });
  await request('/knowledge/reviews/' + edge.id + '/resolve',{ decision:'confirmed' },200);
  const blocks = ['mindmap','timeline','graph_embed'].map(type => ({
    id:randomUUID(),type,attrs:{ view_version:1,title:type,node_ids:[shared.id,localNode.id],root_id:shared.id },
  }));
  const artifact = await request<ArtifactDetail>('/artifacts',{
    workspace_id:ws.id,project_id:localProject.id,title:'Knowledge document',content:{ ...emptyDocument(),blocks },
  });
  const view = await request<WorkspaceProjection>('/artifacts/' + artifact.id + '/projection');
  assert.equal(view.version,1);
  assert.deepEqual(new Set(view.nodes.map(node => node.id)),new Set([shared.id,localNode.id]));
  assert.deepEqual(view.edges.map(item => item.id),[edge.id]);
  const foreign = { ...blocks[0],attrs:{ view_version:1,node_ids:[outsider.id] } };
  const hidden = { ...blocks[0],attrs:{ view_version:1,node_ids:[unrelatedNode.id] } };
  for (const block of [foreign,hidden]) await request('/artifacts',{
    workspace_id:ws.id,project_id:localProject.id,title:'Wrong scope',content:{ ...emptyDocument(),blocks:[block] },
  },422);
  const changed = await service.knowledge.updateNode(local,localNode.id,{ version:localNode.version,event_date:'2021-05' });
  assert.equal(changed.version,2);
  assert.equal((await request<WorkspaceProjection>('/artifacts/' + artifact.id + '/projection')).nodes.find(node => node.id === localNode.id)?.event_date,'2021-05');
  const markdown = await service.jobs.export(local,{ workspace_id:ws.id,format:'markdown',artifact_id:artifact.id });
  await service.jobs.next(controller.signal);
  const markdownResponse = await fetch(base + '/exports/' + markdown.run_id + '/download');
  assert.equal(markdownResponse.status,200);
  assert.match(await markdownResponse.text(),/2021-05 · Second event/);
  const backup = await service.jobs.export(local,{ workspace_id:ws.id,format:'zip' });
  await service.jobs.next(controller.signal);
  const response = await fetch(base + '/exports/' + backup.run_id + '/download');
  assert.equal(response.status,200);
  const data_base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
  const inspected = await request<{ checksum:string }>('/imports/dry-run',{ data_base64 },200);
  const restored = await request<{ id:string }>('/imports',{ data_base64,confirm_checksum:inspected.checksum });
  const [summary] = await request<{ id:string }[]>('/artifacts?workspace_id=' + restored.id);
  const saved = await request<ArtifactDetail>('/artifacts/' + summary!.id);
  const restoredView = await request<WorkspaceProjection>('/artifacts/' + saved.id + '/projection');
  const ids = saved.revision.content_json.blocks[0]?.attrs?.node_ids as string[];
  assert.equal(ids.length,2);
  assert.ok(ids.every(id => restoredView.nodes.some(node => node.id === id)));
  assert.ok(restoredView.nodes.some(node => node.event_date === '2021-05'));
});

test('workspace retrieval recalls reviewed evidence without importing sensitive or linked project context',async () => {
  const ws = await request<{ id:string }>('/workspaces',{ name:'Scoped RAG',policy:{ externalProviderAllowed:true,sensitivity:'personal' } });
  const project = await request<{ id:string }>('/workspaces/' + ws.id + '/projects',{ name:'Project A' });
  const linked = await request<{ id:string }>('/workspaces/' + ws.id + '/projects',{ name:'Project B' });
  await request('/projects/' + project.id + '/relations',{ to_project_id:linked.id });
  const source = await request<{ id:string; version:number }>('/sources',{
    workspace_id:ws.id,project_id:project.id,title:'Calibration record',text:'仪器读数为 7.2 千克。',rights:'user_owned',
  });
  const detail = await request<{ passages:{ id:string; content:string }[] }>('/sources/' + source.id);
  const passage = detail.passages[0]!;
  const proof = await request<{ id:string }>('/sources/' + source.id + '/evidence',{ passage_id:passage.id,start_utf16:0,end_utf16:passage.content.length });
  const claim = await request<{ id:string; version:number }>('/knowledge/claims',{ workspace_id:ws.id,statement:'质量校准通过',evidence_ids:[proof.id] });
  await request('/knowledge/claims/' + claim.id + '/review',{ decision:'supported',version:claim.version },200);
  const sensitive = await request<{ id:string }>('/sources',{
    workspace_id:ws.id,project_id:project.id,title:'Sensitive fixture',text:'质量校准敏感资料。',sensitivity:'sensitive',
  });
  const foreign = await request<{ id:string }>('/sources',{
    workspace_id:ws.id,project_id:linked.id,title:'Linked fixture',text:'质量校准项目资料。',
  });
  const hits = await service.knowledge.retrieve(local,ws.id,[],'质量校准',project.id,undefined,{ corpus:true,external:true });
  assert.equal(hits.length,1);
  assert.equal(hits[0]?.memory_id,proof.id);
  assert.equal(hits[0]?.recalled,true);
  assert.equal(hits[0]?.source_id,source.id);
  const related = await request<{ id:string }>('/knowledge/nodes',{ workspace_id:ws.id,project_id:project.id,title:'光伏模块',type:'concept' });
  const measured = await request<{ id:string }>('/knowledge/nodes',{ workspace_id:ws.id,project_id:project.id,title:'量测',type:'concept' });
  const edge = await request<{ id:string }>('/knowledge/edges/suggestions',{ workspace_id:ws.id,from_node_id:related.id,to_node_id:measured.id,relation_type:'depends_on',evidence_id:proof.id });
  assert.equal((await service.knowledge.retrieve(local,ws.id,[],'光伏模块有何依赖关系',project.id,undefined,{ corpus:true,external:true })).length,0);
  await request('/knowledge/reviews/' + edge.id + '/resolve',{ decision:'confirmed' },200);
  assert.equal((await service.knowledge.retrieve(local,ws.id,[],'光伏模块有何依赖关系',project.id,undefined,{ corpus:true,external:true }))[0]?.memory_id,proof.id);
  await db.all('UPDATE passages SET embedding=$2::vector,embedding_profile=$3 WHERE id=$1',[passage.id,'[1,0,0]','fixture-model']);
  assert.equal((await service.knowledge.retrieve(local,ws.id,[],'unrelated query',project.id,[1,0,0],{ corpus:true,external:true,embeddingProfile:'fixture-model' }))[0]?.id,passage.id);
  assert.equal((await service.knowledge.retrieve(local,ws.id,[],'unrelated query',project.id,[1,0,0],{ corpus:true,external:true,embeddingProfile:'different-model' })).length,0);
  assert.equal((await service.knowledge.retrieve(local,ws.id,[foreign.id],'质量校准',project.id,undefined,{ external:true }))[0]?.source_id,foreign.id);
  assert.equal((await service.knowledge.retrieve(local,ws.id,[sensitive.id],'质量校准',project.id,undefined,{ external:true })).length,0);
  const doc = await request<ArtifactDetail>('/artifacts',{ workspace_id:ws.id,project_id:project.id,title:'质量校准' });
  const analysis = await request<{ run_id:string }>('/artifacts/' + doc.id + '/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'质量校准',allow_external:true,use_web:false,use_workspace:true,
  },202);
  await service.jobs.next(controller.signal);
  const completed = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + analysis.run_id);
  assert.equal(completed.status,'COMPLETED');
  const { revision } = await request<{ revision:ArtifactRevision }>('/artifacts/' + doc.id + '/patches/' + completed.result?.patch_id + '/accept',{},200);
  assert.ok(revision.content_json.blocks.some(block => block.children?.some(node => node.attrs?.evidence_id === proof.id)));
  await request('/sources/' + source.id + '/lifecycle',{ action:'retract',version:source.version },200);
  assert.equal((await service.knowledge.retrieve(local,ws.id,[],'质量校准',project.id,undefined,{ corpus:true,external:true })).length,0);
});

test('numeric gate rejects unsupported values and units and permits one checked repair',async () => {
  assert.equal(supportsNumbers('测得 7.20 千克',['The recorded value was 7.2 kg.']),true);
  assert.equal(supportsNumbers('测得 7.20 克',['The recorded value was 7.2 kg.']),false);
  assert.equal(supportsNumbers('达 9%',['The result was 7 percent.']),false);
  const ws = await request<{ id:string }>('/workspaces',{ name:'Repair fixture',policy:{ externalProviderAllowed:true,sensitivity:'personal' } });
  const source = await request<{ id:string }>('/sources',{ workspace_id:ws.id,title:'Weight record',text:'The measured value was 7 kg.' });
  const doc = await artifact(ws.id);
  const job = await request<{ run_id:string }>('/artifacts/' + doc.id + '/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'Needs repair',allow_external:true,use_web:false,source_id:source.id,
  },202);
  await service.jobs.next(controller.signal);
  const result = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + job.run_id);
  assert.equal(result.status,'COMPLETED',JSON.stringify(result));
  const events = await request<{ events:{ event_type:string; payload:{ stage?:string } }[] }>('/artifact-analysis-runs/' + job.run_id + '/events');
  assert.equal(events.events.filter(event => event.event_type === 'AnalysisStageCompleted' && event.payload.stage === 'repair').length,1);
  assert.ok(events.events.some(event => event.event_type === 'AnalysisStageCompleted' && event.payload.stage === 'recheck'));
  const { revision } = await request<{ revision:ArtifactRevision }>('/artifacts/' + doc.id + '/patches/' + result.result?.patch_id + '/accept',{},200);
  assert.match(JSON.stringify(revision.content_json.blocks),/The measured value was 7 kg/);
  assert.ok(revision.content_json.blocks.some(block => block.type === 'quote'));
  assert.doesNotMatch(JSON.stringify(revision.content_json.blocks),/Observed 9 kg/);
});

test('lease recovery reuses a persisted analysis draft and reruns only the interrupted stage',async () => {
  const ws = await request<{ id:string }>('/workspaces',{ name:'Resume analysis',policy:{ externalProviderAllowed:true,sensitivity:'personal' } });
  const source = await request<{ id:string }>('/sources',{ workspace_id:ws.id,title:'Resume source',text:'Checkpoint recovery retains a completed draft.' });
  const doc = await artifact(ws.id);
  const job = await request<{ run_id:string }>('/artifacts/' + doc.id + '/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'Resume fixture',allow_external:true,use_web:false,source_id:source.id,
  },202);
  interruptVerifier = new AbortController();
  const interrupted = interruptVerifier.signal;
  assert.equal(await service.jobs.next(interrupted),true);
  assert.equal(interrupted.aborted,true);
  const suspended = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + job.run_id);
  assert.equal(suspended.status,'RUNNING');
  assert.deepEqual(await request('/artifacts/' + doc.id + '/patches'),[]);
  await db.all("UPDATE jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[job.run_id]);
  assert.equal(await service.jobs.next(controller.signal),true);
  const final = await request<DocumentAnalysisRun>('/artifact-analysis-runs/' + job.run_id);
  assert.equal(final.status,'COMPLETED',JSON.stringify(final));
  const log = await request<{ events:{ event_type:string; payload:{ stage?:string } }[] }>('/artifact-analysis-runs/' + job.run_id + '/events');
  const started = log.events.filter(event => event.event_type === 'AnalysisStageStarted');
  assert.equal(started.filter(event => event.payload.stage === 'context').length,1);
  assert.equal(started.filter(event => event.payload.stage === 'draft').length,1);
  assert.equal(started.filter(event => event.payload.stage === 'verdict').length,2);
  assert.equal((await request<unknown[]>('/artifacts/' + doc.id + '/patches')).length,1);
});

test('web text preserves numeric exponents from HTML and MathML',()=>{
  const markup='<p>Strain: <a:math><a:mn>1.0</a:mn><a:mo>×</a:mo><a:msup><a:mrow><a:mn>10</a:mn></a:mrow><a:mrow><a:mo>−</a:mo><a:mn>21</a:mn></a:mrow></a:msup></a:math>.</p><p>Area: 4 m<sup>2</sup>.</p>';
  assert.match(htmlText(markup),/Strain: 1\.0×10\^\(−21\)\./);
  assert.match(htmlText(markup),/Area: 4 m\^\(2\)\./);
});

test('web text drops hidden and active content and preserves table labels',() => {
  const text=htmlText('<nav>navigation</nav><main><p>Useful &amp; verified.</p><p hidden>concealed</p><script>inject</script><p style="display:none">forged</p><table><tr><th>Metric</th><td>5.5%</td></tr></table></main>');
  assert.match(text,/Useful & verified/);
  assert.match(text,/Metric \| 5\.5%/);
  assert.doesNotMatch(text,/navigation|concealed|inject|forged/);
});

test('quote extraction keeps citation parentheses and refuses clipped statements',() => {
  const whole='Capacity decreased by 5.5% for the central system (Smith et al. 2023).';
  assert.deepEqual(completeSentences(whole,650).map(item => item.text),[whole]);
  assert.deepEqual(completeSentences('Capacity decreased by 5.5% (Smith et al.',650),[]);
  assert.equal(supportsNumbers('减少5个百分点',['The decrease was 5 percent.']),false);
  assert.equal(supportsNumbers('节电百分之九十',['The observed decline was 5.5%.']),false);
  const goal='寒冷地区住宅热泵供暖和电阻供暖对比';
  assert.equal(compatibleResearchScope(goal,'Defrost Control for Full Electric Vehicles'),false);
  assert.equal(compatibleResearchScope(goal,'ComStock Measure Documentation: Air-Source Heat Pump Boiler'),false);
  assert.equal(compatibleResearchScope(goal,'A field study of residential heating'),true);
  assert.equal(compatibleResearchScope(goal+'，也比较电动车', 'Defrost Control for Full Electric Vehicles'),true);
});

test('visual exports select an immutable revision and honor image rights',async () => {
  const ws = await request<{ id:string }>('/workspaces',{ name:'Visual exports' });
  const png = await readFile('tests/fixtures/ocr-atlas.png');
  const upload = await request<{ id:string }>('/assets',{ workspace_id:ws.id,name:'experiment.png',mime:'image/png',
    data_base64:png.toString('base64'),export_rights:'user_owned' });
  const title = 'Plot <script>&';
  const chart = { id:randomUUID(),type:'chart',attrs:{ chart_version:1,title,kind:'scatter',series:[{ name:'sample',points:[{ x:1,y:7 }] }] } };
  const item = await request<ArtifactDetail>('/artifacts',{ workspace_id:ws.id,title:'Visual document',content:{
    ...emptyDocument(),blocks:[chart,{ id:randomUUID(),type:'image',attrs:{ asset_id:upload.id,alt:'experiment' } }],
  } });
  await service.artifacts.edit(local,item.id,{ base_revision_id:item.revision.id,operations:[{ type:'remove_block',block_id:chart.id }] });
  async function download(format:'svg'|'png'|'zip'|'docx') {
    const job = await service.jobs.export(local,format === 'zip' ? { workspace_id:ws.id,format } : {
      workspace_id:ws.id,artifact_id:item.id,revision_id:item.revision.id,
      block_id:format === 'docx' ? undefined : chart.id,format,
    });
    await service.jobs.next(controller.signal);
    const response = await fetch(base + '/exports/' + job.run_id + '/download');
    assert.equal(response.status,200,await response.clone().text().then(value => value.slice(0,240)));
    return response;
  }
  const svg = await download('svg');
  assert.match(svg.headers.get('content-type') ?? '',/image\/svg\+xml/);
  const text = await svg.text();
  assert.ok(text.includes('Plot &lt;script&gt;&amp;'));
  assert.ok(!text.includes('<script>'));
  const bitmap = Buffer.from(await (await download('png')).arrayBuffer());
  assert.equal(bitmap.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const archive = unzipSync(new Uint8Array(await (await download('zip')).arrayBuffer()));
  assert.deepEqual(Buffer.from(archive['assets/'+upload.id]!),png);
  const restoredWord = unzipSync(new Uint8Array(await (await download('docx')).arrayBuffer()));
  assert.ok(Object.keys(restoredWord).some(file => file.startsWith('word/media/') && file.endsWith('.png')));
});


test('cited AI edits fail closed on new quantities, widened scope and changed evidence',async () => {
  const ws = await request<{ id:string }>('/workspaces',{
    name:'Cited editing',policy:{ externalProviderAllowed:true,sensitivity:'public' },
  });
  const source = await request<{ id:string }>('/sources',{
    workspace_id:ws.id,title:'Test conditions',text:'The tested unit used less energy during the measurement window.',
  });
  const detail = await request<{ version:number;passages:{ id:string;content:string }[] }>('/sources/'+source.id);
  const passage = detail.passages[0]!;
  const proof = await request<{ id:string }>('/sources/'+source.id+'/evidence',{
    passage_id:passage.id,start_utf16:0,end_utf16:passage.content.length,
  });
  const block={ id:randomUUID(),type:'paragraph',children:[
    { type:'text',text:'The tested unit used less energy.' },
    { type:'citation',attrs:{ evidence_id:proof.id } },
  ] };
  const doc=await request<ArtifactDetail>('/artifacts',{ workspace_id:ws.id,title:'Cited edit',content:{ ...emptyDocument(),blocks:[block] } });
  async function edit(instruction:string) {
    const job=await request<{ run_id:string }>('/artifacts/'+doc.id+'/ai-patch-runs',{
      base_revision_id:doc.revision.id,block_id:block.id,inline_index:0,start_utf16:0,
      end_utf16:block.children[0]!.text!.length,instruction,allow_external:true,
    },202);
    await service.jobs.next(controller.signal);
    return request<DocumentAnalysisRun>('/ai-patch-runs/'+job.run_id);
  }
  for (const instruction of ['Add 90% savings','Expand to all conditions']) {
    const rejected=await edit(instruction);
    assert.equal(rejected.result?.warning,'AI_EDIT_EVIDENCE');
  }
  assert.deepEqual(await request('/artifacts/'+doc.id+'/patches'),[]);
  const allowed=await edit('Rewrite clearly');
  assert.equal(allowed.status,'COMPLETED');
  const proposalPath='/artifacts/'+doc.id+'/patches/'+allowed.result?.patch_id;
  await request('/sources/'+source.id+'/lifecycle',{ action:'archive',version:detail.version },200);
  const failure=await request<{ error:{ code:string } }>(proposalPath+'/accept',{},409);
  assert.equal(failure.error.code,'CONFLICT_ANALYSIS_SOURCE');
  assert.equal((await request<ArtifactDetail>('/artifacts/'+doc.id)).revision.id,doc.revision.id);
});

test('legacy and tampered AI proposals cannot authorize changes',async () => {
  const ws=await request<{ id:string }>('/workspaces',{ name:'Proposal integrity',policy:{ externalProviderAllowed:true,sensitivity:'public' } });
  const doc=await artifact(ws.id,'Original text');
  const block=doc.revision.content_json.blocks[0]!;
  const job=await request<{ run_id:string }>('/artifacts/'+doc.id+'/ai-patch-runs',{
    base_revision_id:doc.revision.id,block_id:block.id,inline_index:0,start_utf16:0,end_utf16:8,instruction:'Rewrite',allow_external:true,
  },202);
  await service.jobs.next(controller.signal);
  const state=await request<DocumentAnalysisRun>('/ai-patch-runs/'+job.run_id);
  assert.equal(state.status,'COMPLETED');
  const patchId=state.result?.patch_id;
  const path='/artifacts/'+doc.id+'/patches/'+patchId+'/accept';
  await db.all("UPDATE artifact_patches SET operations=jsonb_set(operations,'{0,text}',to_jsonb('tampered'::text)) WHERE id=$1",[patchId]);
  const tampered=await request<{ error:{ code:string } }>(path,{},409);
  assert.equal(tampered.error.code,'CONFLICT_ANALYSIS_OUTDATED');
  await db.all('UPDATE artifact_patches SET ai_validation=NULL WHERE id=$1',[patchId]);
  const legacy=await request<{ error:{ code:string } }>(path,{},409);
  assert.equal(legacy.error.code,'CONFLICT_ANALYSIS_OUTDATED');
  assert.equal((await request<ArtifactDetail>('/artifacts/'+doc.id)).revision.id,doc.revision.id);
});

test('named photo credit requirements reject anonymous attributions',() => {
  assert.equal(meetsImageAttribution('找一张有署名和许可的照片。','Unknown author'),false);
  assert.equal(meetsImageAttribution('找一张有署名和许可的照片。','Wikimedia Commons'),false);
  assert.equal(meetsImageAttribution('请注明作者。','Fixture Photographer'),true);
  assert.equal(meetsImageAttribution('找一张可用的公有领域照片。','Unknown author'),true);
});

test('analysis accepts exact cited technical identifiers while retaining numeric gates',() => {
  const quotes=['FIPS 202 specifies SHA3-256 with a 256-bit digest. The Model-A test took place at 24 °C.'];
  assert.equal(supportsAnalysisStatement('FIPS 202 将 SHA3‑256 定义为固定长度哈希函数。',quotes),true);
  assert.equal(supportsAnalysisStatement('FIPS 180-4 定义了 SHA3-512。',quotes),false);
  assert.equal(supportsAnalysisStatement('SHA3-256 输出 256 位。',quotes),false);
  assert.equal(supportsAnalysisStatement('该设备在 24 °C 下节电 12%。',quotes),false);
});

test('partial evidence triggers one focused repair and unchecked headings are removed',async () => {
  const id=randomUUID();
  const stages:string[]=[];
  const result=await researchDocument({
    goal:'Describe the field trial and compare its cost.',
    planLocal:true,
    source:async () => [{ id,title:'Field trial',quote:'The test used a monitored residence. No cost data was collected.',kind:'source' }],
    stage:async (name,work) => { stages.push(name);return work(); },
    model:async (prompt,value) => {
      if (prompt==='document.plan') return '{"wrong_key":"unsupported format"}';
      if (prompt==='document.repair-plan') return JSON.stringify({ chinese:'住宅试验',english:'field trial',
        facets:[{ label:'试验地点',chinese:'试验地点',english:'field trial site' },{ label:'成本',chinese:'成本',english:'trial cost' }] });
      if (prompt==='document.verify') {
        const { sections }=value as { sections:{ facet:number }[] };
        return JSON.stringify({ approved_claims:sections[0]?.facet===0 ? ['1.1'] : [],answers:[{ facet:0,claim_key:'1.1' },{ facet:1,claim_key:'1.1' }] });
      }
      const { missing_facets }=value as { missing_facets?:number[] };
      if (missing_facets) assert.deepEqual(missing_facets,[1]);
      return JSON.stringify({ sections:[{ title:'Unverified 90% cost advantage',facet:missing_facets ? 1 : 0,
        claims:[{ kind:'statement',text:missing_facets ? 'The trial proved cost savings.' : 'The test used a monitored residence.',evidence_ids:[id] }] }] });
    },
  });
  assert.deepEqual(stages,['plan','plan_repair','context','draft','verdict','repair','recheck']);
  assert.deepEqual(result.coverage,{ requested:2,supported:1 });
  assert.deepEqual(result.requirements,[{ id:'REQ-001',label:'试验地点',targets:[{ section:0,claim:0 }] },{ id:'REQ-002',label:'成本',targets:[] }]);
  assert.equal(result.report.sections.length,1);
  assert.equal(result.report.sections[0]?.title,'研究发现');
  assert.equal(result.report.sections[0]?.claims[0]?.text,'The test used a monitored residence.');
});

test('planned English facets recall uploaded passages and track coverage',async () => {
  const ws=await request<{ id:string }>('/workspaces',{ name:'Cross-language evidence',policy:{ externalProviderAllowed:true,sensitivity:'public' } });
  await request('/sources',{ workspace_id:ws.id,title:'Instrumentation record',text:'Thermal calibration improved repeatability in the measurements.' });
  const doc=await artifact(ws.id);
  const job=await request<{ run_id:string }>('/artifacts/'+doc.id+'/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'Cross language retrieval',allow_external:true,use_web:false,use_workspace:true,
  },202);
  await service.jobs.next(controller.signal);
  const state=await request<DocumentAnalysisRun>('/artifact-analysis-runs/'+job.run_id);
  assert.equal(state.status,'COMPLETED');
  assert.deepEqual(state.result?.coverage,{ requested:1,supported:1 });
  const events=await request<{ events:{ event_type:string; payload:{ evidence_count:number;query_count:number } }[] }>(
    '/artifact-analysis-runs/'+job.run_id+'/events');
  const retrieval=events.events.find(row => row.event_type==='KnowledgeRetrieved');
  assert.equal(retrieval?.payload.evidence_count,1);
  assert.ok((retrieval?.payload.query_count ?? 0)>1);
  const ledger=events.events.find(row => row.event_type==='RequirementLedgerRecorded')?.payload as unknown as
    { patch_id:string;requirements:{ id:string;label:string;status:string;blocks:{ block_id:string;evidence_ids:string[] }[] }[] };
  assert.equal(ledger.patch_id,state.result?.patch_id);
  assert.equal(ledger.requirements[0]?.id,'REQ-001');
  assert.equal(ledger.requirements[0]?.label,'数据校准');
  assert.equal(ledger.requirements[0]?.status,'supported');
  const entry=ledger.requirements[0]?.blocks[0];
  const patches=await request<{ id:string;operations:PatchInput['operations'] }[]>('/artifacts/'+doc.id+'/patches');
  const block=patches.find(patch => patch.id===ledger.patch_id)?.operations.find(
    operation => operation.type==='insert_block' && operation.block.id===entry?.block_id);
  assert.ok(block?.type==='insert_block');
  assert.deepEqual(block.block.children?.filter(node => node.type==='citation').map(node => node.attrs?.evidence_id),entry?.evidence_ids);
});

test('task contracts block changed input and model traces explain a repaired blank response',async () => {
  const ws=await request<{ id:string }>('/workspaces',{ name:'Auditable model invocation',policy:{ externalProviderAllowed:true,sensitivity:'public' } });
  const source=await request<{ id:string }>('/sources',{ workspace_id:ws.id,title:'Fixture',text:'A monitored residence used a synthetic calibration protocol.' });
  const doc=await artifact(ws.id);
  const enqueue=()=>request<{ run_id:string }>('/artifacts/'+doc.id+'/analysis-runs',{
    base_revision_id:doc.revision.id,goal:'Recover blank draft',allow_external:true,use_web:false,source_id:source.id,
  },202);
  const changed=await enqueue();
  await db.all("UPDATE jobs SET input=jsonb_set(input,'{body,goal}',to_jsonb($2::text)) WHERE id=$1",[changed.run_id,'Changed objective']);
  await service.jobs.next(controller.signal);
  const failure=await request<DocumentAnalysisRun>('/artifact-analysis-runs/'+changed.run_id);
  assert.equal(failure.result?.warning,'QUALITY_CONTRACT_MISMATCH');
  type Audit={ event_type:string;payload:Record<string,unknown> };
  const log=(id:string)=>request<{ events:Audit[] }>('/artifact-analysis-runs/'+id+'/events');
  const blocked=await log(changed.run_id);
  assert.equal(blocked.events.some(row => row.event_type==='ContextSnapshotCreated'),false);
  assert.equal(blocked.events.find(row => row.event_type==='QualityGateFailed')?.payload.code,'Q001');

  const original=await enqueue();
  interruptVerifier=new AbortController();
  const interrupted=interruptVerifier.signal;
  await service.jobs.next(interrupted);
  assert.equal(interrupted.aborted,true);
  await db.all("UPDATE jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[original.run_id]);
  await service.jobs.next(controller.signal);
  const run=await request<DocumentAnalysisRun>('/artifact-analysis-runs/'+original.run_id);
  assert.equal(run.status,'COMPLETED');
  const { events }=await log(original.run_id);
  const contexts=events.filter(row => row.event_type==='ContextSnapshotCreated').map(row => row.payload);
  assert.deepEqual(contexts.map(row => row.prompt_id),['document.plan','document.draft','document.repair-format','document.verify','document.verify']);
  assert.equal(contexts[0]?.artifact_revision_id,doc.revision.id);
  assert.match(String(contexts[0]?.context_hash),/^[a-f0-9]{64}$/);
  assert.notEqual(contexts[1]?.context_hash,contexts[2]?.context_hash);
  assert.ok(Array.isArray(contexts[1]?.evidence_snapshots) && contexts[1].evidence_snapshots.length===1);
  const invocations=events.filter(row => row.event_type==='ModelInvocationCompleted' && row.payload.prompt_id==='document.draft');
  assert.equal(invocations[0]?.payload.outcome,'rejected');
  assert.deepEqual(invocations[0]?.payload.finding,{
    code:'Q012',severity:'blocking',stage:'provider',reason:'PROVIDER_OUTPUT_EMPTY',remediation:'inspect_provider_status',
  });
  assert.equal(invocations[0]?.payload.output_tokens,20);
  assert.doesNotMatch(JSON.stringify(events),/synthetic calibration protocol|Recover blank draft|Test analysis proposal/);
});

