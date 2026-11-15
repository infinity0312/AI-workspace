import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';

if (process.platform !== 'win32') throw new Error('Windows desktop smoke test requires Windows and WebView2');
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch = process.env.AKW_WINDOWS_TEST_DIR ?? join(root,'.data');
await mkdir(scratch,{ recursive:true });
const runDir = await mkdtemp(join(scratch,'native-test-'));
const exe = process.env.AKW_WINDOWS_SMOKE_EXE ?? join(root,'apps','windows','src-tauri','target','debug','akw-desktop.exe');
const apiScript = join(root,'apps','api','dist','apps','api','src','main.js');
const handles = new Set();
const freePort = () => new Promise((resolve,reject) => {
  const server = createServer();
  server.once('error',reject);
  server.listen(0,'127.0.0.1',() => {
    const port = server.address().port;
    server.close(error => error ? reject(error) : resolve(port));
  });
});
const apiPort = await freePort();
const debugPort = await freePort();
const base = 'http://127.0.0.1:' + apiPort;
const endpoint = 'http://127.0.0.1:' + debugPort;

function launch(command, args, env) {
  const handle = spawn(command,args,{ cwd:root,env:{ ...process.env,...env },stdio:['ignore','pipe','pipe'] });
  let log = '';
  handle.stdout.on('data',data => { log = (log + data.toString()).slice(-5000); });
  handle.stderr.on('data',data => { log = (log + data.toString()).slice(-5000); });
  const info = { handle, log:() => log };
  handle.on('error',error => { log = error.message; });
  handles.add(info);
  return info;
}
async function stop(info) {
  const { handle } = info;
  if (handle.exitCode !== null || handle.signalCode !== null || !handle.pid) return;
  const exit = new Promise(resolve => handle.once('exit',resolve));
  handle.kill();
  await Promise.race([exit,delay(5000)]);
}
function request(path, data) {
  return fetch(base + '/v1' + path,{
    method:data === undefined ? 'GET' : 'POST',
    headers:{ 'Content-Type':'application/json' },
    body:data === undefined ? undefined : JSON.stringify(data),
    signal:AbortSignal.timeout(2500),
  });
}
async function healthy(url,info) {
  for (let i=0;i<75;i++) {
    if (info.handle.exitCode !== null) throw new Error('Process exited: ' + info.log());
    try { if ((await fetch(url,{ signal:AbortSignal.timeout(700) })).ok) return; } catch { /* Ready on a later iteration. */ }
    await delay(300);
  }
  throw new Error('Readiness timed out: ' + info.log());
}
async function startApi() {
  const info = launch(process.execPath,[apiScript],{
    AKW_PORT:String(apiPort), AKW_PROFILE:'local', DATABASE_URL:'',
    AKW_PGLITE_PATH:join(runDir,'backend'), AKW_OBJECTS_PATH:join(runDir,'objects'), DEEPSEEK_API_KEY:'',
  });
  await healthy(base + '/v1/health',info);
  return info;
}
async function startApp() {
  const info = launch(exe,[],{
    AKW_DESKTOP_API_PORT:String(apiPort), AKW_DESKTOP_DATA_DIR:join(runDir,'desktop'),
    WEBVIEW2_USER_DATA_FOLDER:join(runDir,'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=' + debugPort + ' --remote-debugging-address=127.0.0.1',
  });
  await healthy(endpoint + '/json/version',info);
  let browser;
  for (let attempt=0;attempt<12 && !browser;attempt++) {
    try { browser = await chromium.connectOverCDP(endpoint,{ timeout:2000 }); }
    catch { await delay(350); }
  }
  if (!browser) throw new Error('WebView2 debugger unavailable: ' + info.log());
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? await ctx.waitForEvent('page',{ timeout:15000 });
  await page.locator('.brand').waitFor({ timeout:15000 });
  return { ...info,browser,ctx,page };
}
const native = (page, command, input = {}) => page.evaluate(({ command,input }) => window.__TAURI_INTERNALS__.invoke(command,input),{ command,input });
let oldClipboard;
let active;
try {
  let api = await startApi();
  active = await startApp();
  let { page } = active;
  page.on('pageerror',error => console.error('WebView error:',error.message));
  await expect(page.getByRole('heading',{ name:'创建工作空间' })).toBeVisible({ timeout:15000 });
  await page.getByRole('textbox',{ name:'工作空间名称' }).fill('Windows 原生验收');
  await page.getByRole('button',{ name:'创建工作空间' }).click();
  await expect(page.getByRole('heading',{ name:'Windows 原生验收' })).toBeVisible();
  await page.getByText('手动组织项目与文档',{ exact:true }).click();
  await page.getByRole('textbox',{ name:'文档标题' }).fill('离线草稿');
  await page.getByRole('button',{ name:'创建空白文档' }).click();
  await expect(page.getByRole('heading',{ name:'离线草稿' })).toBeVisible();
  const spaces = await (await request('/workspaces')).json();
  const workspace = spaces[0].id;
  const artifacts = await (await request('/artifacts?workspace_id=' + workspace)).json();
  const artifact = artifacts[0].id;

  // Stop only the isolated fixture API. Verify the installed desktop can save and reopen a SQLite draft without it.
  await stop(api);
  await expect(page.getByText('本地服务断开',{ exact:true })).toBeVisible({ timeout:20000 });
  await page.getByRole('button',{ name:'编辑模式' }).click();
  await page.getByRole('button',{ name:'添加内容块' }).click();
  await page.getByRole('textbox',{ name:'内容',exact:true }).fill('原生 SQLite 离线记录。');
  await page.getByRole('button',{ name:'保存内容块' }).click();
  await expect(page.locator('.artifact-block p').getByText('原生 SQLite 离线记录。',{ exact:true })).toBeVisible();
  await expect(page.getByText(/修改已保存在此设备/)).toBeVisible();
  const local = JSON.parse(await native(page,'sqlite_read',{ store:'documents',key:artifact }));
  assert.equal(local.draft.blocks[0].children[0].text,'原生 SQLite 离线记录。');
  assert.equal(local.server.revision.revision_number,1);
  assert.ok((await readFile(join(runDir,'desktop','workspace.sqlite3'))).subarray(0,15).toString().startsWith('SQLite format'));
  await stop(active);
  await expect.poll(async () => {
    try { return (await fetch(endpoint + '/json/version',{ signal:AbortSignal.timeout(500) })).ok; }
    catch { return false; }
  },{ timeout:15000 }).toBe(false);

  active = await startApp();
  page = active.page;
  await expect(page.getByText('原生 SQLite 离线记录。',{ exact:true })).toBeVisible({ timeout:20000 });
  api = await startApi();
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible({ timeout:20000 });
  const revision = await (await request('/artifacts/' + artifact)).json();
  assert.equal(revision.revision.content_json.blocks[0].children[0].text,'原生 SQLite 离线记录。');

  const other = active.ctx.waitForEvent('page',{ timeout:15000 });
  await page.getByRole('button',{ name:'独立窗口' }).click();
  const artifactWindow = await other;
  await expect(artifactWindow.getByRole('heading',{ name:'离线草稿' })).toBeVisible({ timeout:15000 });

  oldClipboard = await native(page,'read_clipboard').catch(() => undefined);
  if (typeof oldClipboard === 'string') {
    await page.getByRole('button',{ name:'复制正文' }).click();
    await expect(page.getByText('文档正文已复制',{ exact:true })).toBeVisible();
    assert.match(await native(page,'read_clipboard'),/原生 SQLite 离线记录/);
    await native(page,'write_clipboard',{ text:oldClipboard });
    oldClipboard = undefined;
  }
  assert.ok(await native(page,'quick_capture_shortcut'),'Expected a registered capture shortcut');
  await native(page,'set_research_activity',{ active:1 });
  await native(page,'set_research_activity',{ active:0 });
  await native(page,'show_notification',{ title:'AI Knowledge Workspace',message:'Windows 本地测试已完成。' });
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'来源',exact:true }).click();
  await expect(page.getByRole('heading',{ name:'Windows 文件导入' })).toBeVisible();

  const png = await readFile(join(root,'apps','api','tests','fixtures','ocr-atlas.png'));
  const title = '图片 OCR 验收';
  const asset = await (await request('/assets',{
    workspace_id:workspace,name:'atlas-test.png',mime:'image/png',data_base64:png.toString('base64'),
  })).json();
  const source = await (await request('/sources',{
    workspace_id:workspace,title,asset_id:asset.id,rights:'user_owned',
  })).json();
  const ingestion = await (await request('/sources/' + source.id + '/ingest',{})).json();
  await expect.poll(async () => (await (await request('/ingestion-runs/' + ingestion.run_id)).json()).status,{ timeout:25000 }).toBe('COMPLETED');
  // The fixture was imported through the API, so reload the source catalog in this window.
  await page.reload();
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'来源',exact:true }).click();
  await expect(page.getByRole('button',{ name:title,exact:true })).toBeVisible({ timeout:15000 });
  await page.getByRole('button',{ name:title,exact:true }).click();
  await page.getByText('图片 1 · 段落 1',{ exact:true }).click();
  await expect(page.getByText(/ATLAS 51/i)).toBeVisible();
  const milestone = await (await request('/knowledge/nodes',{ workspace_id:workspace,title:'Windows 里程碑',type:'event',event_date:'2024-06' })).json();
  const { default:PDFDocument } = await import('pdfkit');
  const pdf = new PDFDocument();
  const parts = [];
  const pdfBytes = new Promise((resolve,reject) => {
    pdf.on('data',chunk => parts.push(chunk)); pdf.on('end',() => resolve(Buffer.concat(parts))); pdf.on('error',reject);
  });
  pdf.text('Calibration procedure.'); pdf.addPage().text('Read the original measurement here.'); pdf.end();
  const pdfAsset = await (await request('/assets',{ workspace_id:workspace,name:'windows-example.pdf',mime:'application/pdf',
    data_base64:(await pdfBytes).toString('base64'),export_rights:'user_owned' })).json();
  const pdfSource = await (await request('/sources',{ workspace_id:workspace,title:'Windows 实验报告',asset_id:pdfAsset.id,rights:'user_owned' })).json();
  const pdfJob = await (await request('/sources/'+pdfSource.id+'/ingest',{})).json();
  await expect.poll(async () => (await (await request('/ingestion-runs/'+pdfJob.run_id)).json()).status,{ timeout:25000 }).toBe('COMPLETED');
  const p2 = (await (await request('/sources/'+pdfSource.id)).json()).passages.find(item => item.page===2);
  const pdfEvidence = await (await request('/sources/'+pdfSource.id+'/evidence',{ passage_id:p2.id,start_utf16:0,end_utf16:p2.content.length })).json();
  const chartTable = crypto.randomUUID();
  const composite = await (await request('/artifacts',{ workspace_id:workspace,title:'Windows 可组合文档',content:{ schema_version:'1.0',
    relations:{ source_ids:[pdfSource.id],knowledge_node_ids:[] },blocks:[
      { id:crypto.randomUUID(),type:'math_block',attrs:{ latex:'\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}' } },
      { id:crypto.randomUUID(),type:'timeline',attrs:{ view_version:1,node_ids:[milestone.id] } },
      { id:chartTable,type:'table',attrs:{ table_version:1,rows:[['批次','结果'],['A','17'],['B','23']] } },
      { id:crypto.randomUUID(),type:'chart',attrs:{ chart_version:1,title:'Windows 实测趋势',kind:'line',table_id:chartTable,
        series:[{ name:'结果',points:[{ x:1,y:0 }] }] } },
      { id:crypto.randomUUID(),type:'evidence_reference',attrs:{ evidence_id:pdfEvidence.id } },
    ] } })).json();
  assert.ok(composite.id);
  await page.evaluate(id => localStorage.setItem('akw-last-artifact',id),composite.id);
  await page.reload();
  await expect(page.getByRole('heading',{ name:'Windows 可组合文档',exact:true })).toBeVisible({ timeout:15000 });
  await expect(page.locator('.artifact-content .katex math')).toHaveCount(1);
  await expect(page.locator('.artifact-content time')).toHaveText('2024-06');
  assert.ok(await page.evaluate(async () => (await document.fonts.load('16px KaTeX_Main')).some(face => face.status === 'loaded')));
  const chart = page.getByRole('region',{ name:'Windows 实测趋势' });
  await expect(chart.locator('canvas')).toBeVisible();
  await chart.getByText('查看图表数据').click();
  await expect(chart.getByRole('cell',{ name:'23',exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'查看证据',exact:true }).click();
  await page.getByRole('button',{ name:'在检查器阅读来源' }).click();
  await expect(page.locator('canvas[aria-label="PDF 第 2 页"]')).toBeVisible({ timeout:25000 });
  if (process.env.AKW_WINDOWS_SCREENSHOT) await page.screenshot({ path:process.env.AKW_WINDOWS_SCREENSHOT });
  console.log('Windows WebView2 passed: workspace, SQLite offline restart and resync, artifact window, notification IPC, OCR source display, bundled LaTeX fonts, knowledge timeline, a linked data chart, and PDF evidence page rendering.');
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  for (const info of handles) if (info.log()) console.error(info.log());
  process.exitCode = 1;
} finally {
  if (oldClipboard !== undefined && active) await native(active.page,'write_clipboard',{ text:oldClipboard }).catch(() => {});
  for (const info of [...handles].reverse()) await stop(info);
}
