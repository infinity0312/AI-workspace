import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir,mkdtemp,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { chromium,expect } from '@playwright/test';

if (process.platform!=='win32') throw Error('Run from Windows');
const scratch=resolve('.data','learning-qa');
await mkdir(scratch,{ recursive:true });
const dir=await mkdtemp(join(scratch,'native-'));
const freePort=()=>new Promise((done,reject)=>{
  const socket=createServer();
  socket.once('error',reject);
  socket.listen(0,'127.0.0.1',()=>{ const port=socket.address().port; socket.close(()=>done(port)); });
});
const apiPort=await freePort(), debugPort=await freePort();
const base='http://127.0.0.1:'+apiPort+'/v1', debug='http://127.0.0.1:'+debugPort;
const env={ ...process.env,AKW_PROFILE:'local',AKW_PORT:String(apiPort),AKW_PGLITE_PATH:join(dir,'db'),
  AKW_OBJECTS_PATH:join(dir,'objects'),DATABASE_URL:'',AKW_S3_BUCKET:'',AKW_HARNESS_V2_ENABLED:'false' };
const logs=[];
function boot(exe,args,env){
  const child=spawn(exe,args,{ windowsHide:true,env,stdio:['ignore','pipe','pipe'] });
  for (const output of [child.stdout,child.stderr]) output.on('data',chunk=>{ logs.push(String(chunk).slice(0,800)); });
  return child;
}
async function request(path,body){
  const response=await fetch(base+path,body===undefined ? undefined : { method:'POST',headers:{ 'content-type':'application/json' },body:JSON.stringify(body) });
  const result=await response.json();
  assert.ok(response.ok,JSON.stringify(result));
  return result;
}
let api,app,browser,page;
const now=Date.now();
try {
  api=boot(process.execPath,[resolve('apps/api/dist/apps/api/src/main.js')],env);
  await expect.poll(()=>fetch(base+'/health').then(response=>response.ok).catch(()=>false),{ timeout:20000 }).toBe(true);
  const workspace=await request('/workspaces',{ name:'学习目标 Windows 验收',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  app=boot(resolve('apps/windows/src-tauri/target/debug/akw-desktop.exe'),[],{
    ...env,AKW_DESKTOP_API_PORT:String(apiPort),AKW_DESKTOP_DATA_DIR:join(dir,'desktop'),WEBVIEW2_USER_DATA_FOLDER:join(dir,'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+debugPort+' --remote-debugging-address=127.0.0.1',
  });
  await expect.poll(()=>fetch(debug+'/json/version').then(response=>response.ok).catch(()=>false),{ timeout:20000 }).toBe(true);
  browser=await chromium.connectOverCDP(debug,{ timeout:12000 });
  const context=browser.contexts()[0];
  page=context.pages()[0] ?? await context.waitForEvent('page');
  await page.getByRole('textbox',{ name:'你想查什么、完成什么或学会什么？' }).fill('我想系统学习图神经网络，并了解它在晶体材料物性预测中的应用。请附一张思维导图。');
  const manual=page.getByText('手动组织项目与文档',{ exact:true });
  await expect(manual).toBeVisible();
  await expect(page.getByRole('textbox',{ name:'文档标题' })).toBeHidden();
  await page.getByRole('checkbox',{ name:'允许本次使用外部模型和公开检索' }).check();
  await page.getByRole('button',{ name:'开始任务' }).click();
  await expect(page.getByRole('button',{ name:'打开产物' })).toBeVisible({ timeout:160000 });
  const firstElapsed=(Date.now()-now)/1000;
  await page.getByRole('button',{ name:'打开产物' }).click();
  await expect(page.getByText('暂定学习起点',{ exact:true })).toBeVisible({ timeout:15000 });
  const first=(await request('/artifacts?workspace_id='+workspace.id))[0];
  const path='/artifacts/'+first.id;
  const before=await request(path);
  const projection=await request(path+'/projection');
  const runList=await request('/sync/changes?workspace_id='+workspace.id+'&limit=200');
  const goalJob=runList.changes.find(event=>event.event_type==='RunQueued' && event.payload.kind==='learning');
  const learningRun=await request('/learning-runs/'+goalJob.aggregate_id);
  await writeFile(join(dir,'initial.json'),JSON.stringify({ firstElapsed,before,projection,learningRun },null,2));
  await expect(page.getByRole('heading',{ name:'文献时间线',exact:true })).toBeVisible({ timeout:10000 });
  await expect(page.getByRole('button',{ name:'日期证据' }).first()).toBeVisible();
  await page.getByRole('button',{ name:'日期证据' }).first().click();
  await expect(page.getByRole('heading',{ name:'原文证据' })).toBeVisible();
  await expect(page.getByRole('heading',{ name:'概念与先修关系',exact:true })).toBeVisible({ timeout:10000 });
  await expect(page.getByRole('region',{ name:'主题思维导图',exact:true })).toBeVisible();
  await expect(page.getByRole('group',{ name:'工作区视图' })).toHaveCount(0);
  assert.ok(projection.edges.some(edge=>edge.relation_type==='depends_on'));
  await expect(page.locator('.artifact-content .katex').first()).toBeVisible();
  await expect(page.getByRole('heading',{ name:'入门教材',exact:true })).toBeVisible();
  const lesson=before.revision.content_json.blocks.find(block=>block.type==='learning_lesson' && block.attrs.practice?.length);
  assert.ok(lesson);
  const practice=page.locator('#block-'+lesson.id).locator('details');
  await practice.locator('summary').click();
  const questions=lesson.attrs.practice;
  for (const [index,question] of questions.entries()) await practice.locator('fieldset').nth(index).getByRole('radio').nth(question.answer).check();
  await practice.getByRole('button',{ name:'检查掌握程度' }).click();
  await expect(practice.getByText('答对 '+questions.length+' / '+questions.length+' 题')).toBeVisible();
  const followAt=Date.now();
  await page.getByRole('textbox',{ name:'你想进一步弄清什么？' }).fill('为什么 CGCNN 使用周期邻居，而 ALIGNN 还要构造线图？请给一个三原子夹角的具体例子。');
  await page.getByRole('button',{ name:'查证并继续学习' }).click();
  await expect(page.getByRole('heading',{ name:/追问 · 为什么 CGCNN/ })).toBeVisible({ timeout:160000 });
  await expect(page.getByRole('heading',{ name:'CGCNN 的周期邻居与 ALIGNN 的键角例子',exact:true })).toBeVisible();
  await expect(page.getByText(/两组 AC 的长度分别为/)).toBeVisible();
  const after=await request(path);
  const followup=await request(path+'/learning-followup');
  const mastery=await request(path+'/learning-mastery');
  const updatedProjection=await request(path+'/projection');
  assert.equal(after.revision.parent_revision_id,before.revision.id);
  assert.equal(mastery[0]?.lesson_id,lesson.id);
  assert.equal(mastery[0]?.correct,questions.length);
  const followElapsed=(Date.now()-followAt)/1000;
  await page.screenshot({ path:join(dir,'learning-workspace.png') });
  await writeFile(join(dir,'followup.json'),JSON.stringify({ followElapsed,after,followup,mastery,updatedProjection },null,2));
  console.log(JSON.stringify({ firstElapsed,followElapsed,title:after.title,artifact_id:first.id,revision:after.revision.revision_number,
    lessons:before.revision.content_json.blocks.filter(block=>block.type==='learning_lesson').length,
    nodes:projection.nodes.length,edges:projection.edges.length,mastery:mastery.length,directory:dir }));
} catch (error) {
  if (page) await page.screenshot({ path:join(dir,'failure.png') }).catch(()=>{});
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Evidence directory '+dir);
  console.error(logs.slice(-7).join('\n'));
  process.exitCode=1;
} finally {
  await browser?.close().catch(()=>{});
  app?.kill();
  api?.kill();
}
