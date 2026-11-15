import assert from 'node:assert/strict';
import { spawn,execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp,mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join,resolve } from 'node:path';
import { chromium,expect } from '@playwright/test';

const serial=process.env.AKW_ANDROID_QA_SERIAL ?? 'emulator-5570';
assert.match(serial,/^emulator-\d+$/,'Use a dedicated Android emulator');
const adbPath=resolve('.data/tooling/android-sdk/platform-tools/adb.exe');
const adb=(...args)=>execFileSync(adbPath,['-s',serial,...args],{ encoding:'utf8',timeout:25000 }).trim();
const packageName='com.akw.workspace';
const backendPort=4202,devtoolsPort=9230;
const endpoint='http://127.0.0.1:'+backendPort+'/v1';
const base=resolve('.data','v2-android');
await mkdir(base,{ recursive:true });
const fixture=await mkdtemp(join(base,'run-'));
const script=resolve('apps/api/dist/apps/api/src/main.js');
let service, browser;
async function requireFree(port) {
  await new Promise((resolve,reject)=>{
    const socket=createServer();
    socket.once('error',reject);
    socket.listen(port,'127.0.0.1',()=>socket.close(error=>error ? reject(error) : resolve()));
  });
}
async function start() {
  await requireFree(backendPort);
  service=spawn(process.execPath,[script],{ env:{ ...process.env,AKW_PORT:String(backendPort),AKW_PROFILE:'local',
    DATABASE_URL:'',AKW_S3_BUCKET:'',DEEPSEEK_API_KEY:'',AKW_HARNESS_V2_ENABLED:'false',AKW_PGLITE_PATH:join(fixture,'db'),
    AKW_OBJECTS_PATH:join(fixture,'objects') },windowsHide:true,stdio:'ignore' });
  await expect.poll(async()=>fetch(endpoint+'/health').then(response=>response.ok).catch(()=>false),{timeout:25000}).toBe(true);
}
async function stop() {
  if (!service?.pid || service.exitCode!==null || service.signalCode!==null) return;
  const done=new Promise(resolve=>service.once('exit',resolve));
  service.kill();
  await done;
}
async function call(path,data) {
  const response=await fetch(endpoint+path,data ? { method:'POST',body:JSON.stringify(data),headers:{'Content-Type':'application/json'} } : undefined);
  assert.ok(response.ok,path+' '+response.status);
  return response.json();
}
async function open() {
  const pid=adb('shell','pidof',packageName);
  adb('forward','tcp:'+devtoolsPort,'localabstract:webview_devtools_remote_'+pid);
  await expect.poll(async()=>{
    try { browser=await chromium.connectOverCDP('http://127.0.0.1:'+devtoolsPort,{ timeout:1500,noDefaults:true }); }
    catch { return false; }
    return true;
  },{timeout:20000}).toBe(true);
  return browser.contexts()[0].pages()[0];
}
const text='在 Android SQLite 离线保存并重启。';
await requireFree(devtoolsPort);
try {
  await start();
  const ws=await call('/workspaces',{ name:'Android v2 验收 '+randomUUID().slice(0,6) });
  const artifact=await call('/artifacts',{ workspace_id:ws.id,title:'Android 离线验收' });
  adb('reverse','tcp:4100','tcp:'+backendPort);
  adb('shell','am','force-stop',packageName);
  adb('shell','am','start','-W','-n',packageName+'/.MainActivity');
  let page=await open();
  await page.evaluate(({ workspaceId,artifactId })=>{
    localStorage.setItem('akw-last-workspace',workspaceId);
    localStorage.setItem('akw-last-artifact',artifactId);
  },{ workspaceId:ws.id,artifactId:artifact.id });
  await page.reload();
  await expect(page.getByRole('heading',{name:'Android 离线验收',exact:true})).toBeVisible({timeout:25000});
  assert.match(adb('shell','run-as',packageName,'ls','databases'),/akw-local\.db/);
  await stop();
  await expect(page.getByText('本地服务断开',{exact:true})).toBeVisible({timeout:25000});
  await page.getByRole('button',{name:'编辑模式'}).click();
  await page.getByRole('button',{name:'添加内容块'}).click();
  await page.getByRole('textbox',{name:'内容',exact:true}).fill(text);
  await page.getByRole('button',{name:'保存内容块'}).click();
  await expect(page.getByText(text,{exact:true})).toBeVisible();
  await expect(page.getByText(/修改已保存在此设备/)).toBeVisible();
  await browser.close();
  browser=undefined;
  adb('shell','am','force-stop',packageName);
  adb('shell','am','start','-W','-n',packageName+'/.MainActivity');
  page=await open();
  await expect(page.getByText(text,{exact:true})).toBeVisible({timeout:25000});
  await start();
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible({timeout:25000});
  const result=await call('/artifacts/'+artifact.id);
  assert.equal(result.revision.content_json.blocks[0]?.children?.[0]?.text,text);
  console.log('Android API '+adb('shell','getprop','ro.build.version.sdk')+': APK launch, native SQLite, offline save, force-stop/relaunch and resync passed.');
} finally {
  await browser?.close().catch(()=>{});
  await stop();
  try { adb('forward','--remove','tcp:'+devtoolsPort); } catch { /* No forwarding to remove. */ }
  try { adb('reverse','--remove','tcp:4100'); } catch { /* No forwarding to remove. */ }
}
