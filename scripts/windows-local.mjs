import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

if (process.platform !== 'win32') throw new Error('This launcher requires Windows');
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port = Number(process.env.AKW_DESKTOP_API_PORT ?? '4100');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local API port');
const target = join(root,'apps','windows','src-tauri','target');
const candidates = ['debug','release'].map(profile => join(target,profile,'akw-desktop.exe'))
  .filter(existsSync).sort((a,b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
const desktop = process.env.AKW_WINDOWS_EXE ?? candidates[0];
if (!desktop || !existsSync(desktop)) throw new Error('Build the Windows desktop first');
const apiFile = join(root,'apps','api','dist','apps','api','src','main.js');
async function health() {
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/v1/health',{ signal:AbortSignal.timeout(750) });
    if (!response.ok) return false;
    const result = await response.json();
    return result.status === 'ok' && result.api_version === 'v1';
  } catch { return false; }
}
let ownedApi;
let app;
function cleanup() {
  if (app && app.exitCode === null) app.kill();
  if (ownedApi && ownedApi.exitCode === null) ownedApi.kill();
}
process.once('SIGINT',cleanup);
process.once('SIGTERM',cleanup);
try {
  if (!await health()) {
    if (!existsSync(apiFile)) throw new Error('Build the API with npm run build -w @akw/api');
    ownedApi = spawn(process.execPath,[apiFile],{
      cwd:root,stdio:'inherit',windowsHide:true,env:{ ...process.env,AKW_PORT:String(port) },
    });
    let ready = false;
    for (let i=0;i<30 && ownedApi.exitCode === null;i++) {
      if (await health()) { ready = true; break; }
      await delay(400);
    }
    if (!ready) throw new Error('Could not start the local API');
  }
  const desktopEnv = { ...process.env,AKW_DESKTOP_API_PORT:String(port) };
  for (const key of ['DEEPSEEK_API_KEY','AKW_RUNTIME_RECOVERY_KEY','BRAVE_SEARCH_API_KEY','AKW_EMBEDDINGS_API_KEY','DATABASE_URL','AKW_TOKEN_SECRET','AKW_S3_ACCESS_KEY','AKW_S3_SECRET_KEY']) {
    delete desktopEnv[key];
  }
  app = spawn(desktop,[],{ cwd:root,env:desktopEnv,stdio:'inherit' });
  process.exitCode = await new Promise((resolve,reject) => {
    app.once('error',reject);
    app.once('exit',code => resolve(code ?? 0));
  });
} finally {
  cleanup();
}
