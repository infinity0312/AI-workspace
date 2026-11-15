import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir,mkdtemp,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { chromium,expect } from '@playwright/test';

if (process.platform!=='win32') throw Error('Run from Windows');
const data=resolve('.data','productivity-qa');
await mkdir(data,{ recursive:true });
const out=await mkdtemp(join(data,'native-'));
const port=()=>new Promise((resolve,reject)=>{
  const server=createServer();
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{ const value=server.address().port;server.close(()=>resolve(value)); });
});
const apiPort=await port(),debugPort=await port();
const base='http://127.0.0.1:'+apiPort+'/v1',debug='http://127.0.0.1:'+debugPort;
const env={ ...process.env,AKW_PROFILE:'local',AKW_PORT:String(apiPort),AKW_PGLITE_PATH:join(out,'db'),
  AKW_OBJECTS_PATH:join(out,'objects'),DATABASE_URL:'',AKW_S3_BUCKET:'' };
const log=[];
const launch=(command,args,configuration)=>{
  const child=spawn(command,args,{ env:configuration,stdio:['ignore','pipe','pipe'],windowsHide:true });
  for(const stream of [child.stdout,child.stderr]) stream.on('data',chunk=>log.push(chunk.toString().slice(0,400)));
  return child;
};
async function req(path,data) {
  const response=await fetch(base+path,data ? { method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(data) } : {});
  const result=await response.json();
  assert.ok(response.ok,JSON.stringify(result));
  return result;
}
let api,desktop,browser,page,workspaceId;
try {
  api=launch(process.execPath,[resolve('apps/api/dist/apps/api/src/main.js')],env);
  await expect.poll(()=>fetch(base+'/health').then(response=>response.ok).catch(()=>false),{ timeout:20000 }).toBe(true);
  const ws=await req('/workspaces',{ name:'Windows 生产力工作台验收',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  workspaceId=ws.id;
  desktop=launch(resolve('apps/windows/src-tauri/target/debug/akw-desktop.exe'),[],{ ...env,AKW_DESKTOP_API_PORT:String(apiPort),
    AKW_DESKTOP_DATA_DIR:join(out,'desktop'),WEBVIEW2_USER_DATA_FOLDER:join(out,'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+debugPort+' --remote-debugging-address=127.0.0.1' });
  await expect.poll(()=>fetch(debug+'/json/version').then(response=>response.ok).catch(()=>false),{ timeout:20000 }).toBe(true);
  browser=await chromium.connectOverCDP(debug);
  const context=browser.contexts()[0];page=context.pages()[0] ?? await context.waitForEvent('page');
  const input=page.getByRole('textbox',{ name:'你想查什么、完成什么或学会什么？' });
  const open=page.getByRole('button',{ name:'打开产物',exact:true });
  const go=page.getByRole('button',{ name:'开始任务',exact:true });
  const permission=page.getByRole('checkbox',{ name:'允许本次使用外部模型和公开检索' });
  async function submit(text) {
    await input.fill(text);
    await permission.check();
    const previous=await page.evaluate(id=>localStorage.getItem('akw-task:'+id),workspaceId);
    const start=Date.now();
    await go.click();
    await page.waitForFunction(({ id,previous })=>{
      const current=localStorage.getItem('akw-task:'+id);
      return current && current!==previous;
    },{ id:workspaceId,previous });
    const id=await page.evaluate(id=>localStorage.getItem('akw-task:'+id),workspaceId);
    assert.ok(id,'The server must acknowledge a task');
    return { start,id };
  }
  async function run(text) {
    const { start,id }=await submit(text);
    await expect.poll(()=>req('/tasks/'+id).then(run=>run.status),{ timeout:85000 }).toMatch(/^(COMPLETED|PARTIAL)$/);
    await expect(open).toBeVisible({ timeout:12000 });
    const elapsed=(Date.now()-start)/1000;
    await open.click();
    return elapsed;
  }
  const weatherSeconds=await run('北京未来三天天气');
  const forecast=page.getByRole('region',{ name:'天气预报' });
  await expect(forecast.getByRole('table',{ name:'逐日预报' }).getByRole('row')).toHaveCount(4);
  await forecast.getByText('逐小时预报',{ exact:true }).click();
  await expect(forecast.getByRole('table',{ name:/小时预报/ }).getByRole('row')).toHaveCount(25);
  await forecast.getByRole('button',{ name:'证据',exact:true }).click();
  await expect(page.getByRole('heading',{ name:'原文证据' })).toBeVisible();
  const initial=(await req('/artifacts?workspace_id='+ws.id)).find(item=>item.title.includes('北京'));
  const baseWeather=await req('/artifacts/'+initial.id);
  const refreshAt=Date.now();
  await page.getByRole('button',{ name:'刷新预报' }).click();
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible({ timeout:22000 });
  const refreshSeconds=(Date.now()-refreshAt)/1000;
  const after=await req('/artifacts/'+initial.id);
  assert.equal(after.revision.parent_revision_id,baseWeather.revision.id);
  await page.screenshot({ path:join(out,'weather.png') });
  await page.getByRole('button',{ name:'工作台',exact:true }).click();
  await submit('Springfield 明天天气');
  const options=page.getByRole('list',{ name:'可能的地点' });
  await expect(options).toBeVisible({ timeout:20000 });
  await options.getByRole('button',{ name:/Illinois/ }).click();
  await expect(input).toHaveValue('Springfield 明天天气');
  await permission.check();
  await go.click();
  await expect(open).toBeVisible({ timeout:22000 });
  await open.click();
  const qualified=page.getByRole('region',{ name:'天气预报' });
  await expect(qualified.getByText(/Illinois/)).toBeVisible();
  await expect(qualified.getByRole('region',{ name:'当前天气' })).toHaveCount(0);
  await expect(qualified.getByRole('table',{ name:'逐日预报' }).getByRole('row')).toHaveCount(2);
  await page.getByRole('button',{ name:'工作台',exact:true }).click();
  const guideSeconds=await run('Windows 11 如何截图？');
  await expect(page.getByRole('heading',{ name:'Windows 截图操作指南',exact:true })).toBeVisible();
  await expect(page.getByRole('heading',{ name:'1. 打开截图选区' })).toBeVisible();
  await expect(page.getByRole('heading',{ name:'3. 检查并保存' })).toBeVisible();
  await expect(page.getByRole('button',{ name:'制作复习卡' })).toHaveCount(0);
  await page.screenshot({ path:join(out,'guide.png') });
  await page.getByRole('button',{ name:'工作台',exact:true }).click();
  const informationSeconds=await run('什么是图神经网络？它通常用于哪些任务？');
  await expect(page.getByRole('region',{ name:'问题与答案' })).toBeVisible();
  await page.screenshot({ path:join(out,'information.png') });
  await page.getByRole('button',{ name:'工作台',exact:true }).click();
  const compositeGoal='北京明天天气；Windows 11 如何截图？；打开网页 https://example.org/';
  const compositeSeconds=await run(compositeGoal);
  await expect(page.getByRole('region',{ name:'天气预报' })).toBeVisible();
  await expect(page.getByRole('heading',{ name:'1. 打开截图选区' })).toBeVisible();
  await expect(page.getByRole('link',{ name:'example.org' })).toHaveAttribute('href','https://example.org/');
  await page.screenshot({ path:join(out,'composite.png') });
  await page.getByRole('button',{ name:'工作台',exact:true }).click();
  await input.fill('https://example.org/reference');
  await permission.check();
  await page.getByRole('button',{ name:'浏览来源' }).click();
  const list=page.getByRole('region',{ name:'网页结果' });
  await expect(list.getByRole('link',{ name:'打开原网页' })).toHaveAttribute('href','https://example.org/reference');
  await list.getByRole('button',{ name:'收藏' }).click();
  await expect(page.getByText('已收藏 · example.org',{ exact:true })).toBeVisible();
  await list.getByRole('checkbox',{ name:'加入选集' }).check();
  await list.getByRole('button',{ name:'保存 1 个来源为产物' }).click();
  await expect(page.getByRole('link',{ name:'example.org',exact:true })).toBeVisible();
  assert.equal((await req('/capture-items?workspace_id='+ws.id))[0]?.url,'https://example.org/reference');
  const workspaceArtifacts=await req('/artifacts?workspace_id='+ws.id);
  const guide=await req('/artifacts/'+workspaceArtifacts.find(item=>item.title==='Windows 截图操作指南').id);
  const ambiguity=workspaceArtifacts.find(item=>/Springfield/.test(item.title));
  assert.ok(ambiguity);
  const results={ weatherSeconds,refreshSeconds,guideSeconds,informationSeconds,compositeSeconds,baseWeather,after,guide,qualified:await req('/artifacts/'+ambiguity.id) };
  await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({ out,weatherSeconds,refreshSeconds,guideSeconds,informationSeconds,compositeSeconds,guideSteps:guide.revision.content_json.blocks.filter(block=>block.type==='guide_step').length }));
} catch (error) {
  await page?.screenshot({ path:join(out,'failure.png') }).catch(()=>{});
  console.error(error.message,'\n',out,'\n',log.slice(-4).join('\n'));
  process.exitCode=1;
} finally {
  await browser?.close().catch(()=>{});
  desktop?.kill();api?.kill();
}
