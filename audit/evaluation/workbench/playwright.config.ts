import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
const dir=resolve(process.cwd(),process.env.AKW_QA_OUTPUT_DIR ?? '.data/harness-final');
const port=process.env.AKW_QA_WEB_PORT ?? '3088';
const api=process.env.AKW_QA_API_PORT ?? '4188';
export default defineConfig({
  testDir:resolve(process.cwd(),'audit','evaluation','workbench'),testMatch:'acceptance.spec.ts',outputDir:resolve(dir,'playwright'),timeout:145_000,workers:1,
  use:{ baseURL:'http://127.0.0.1:'+port,launchOptions:{ executablePath:process.env.AKW_QA_BROWSER ?? (process.platform==='win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined) } },
  webServer:{ cwd:process.cwd(),command:process.env.AKW_QA_SKIP_BUILD==='1' ? 'npm run start' : 'npm run build && npm run start',url:'http://127.0.0.1:'+port+'/api/v1/health',
    env:{ PORT:port,AKW_PORT:api,AKW_API_ORIGIN:'http://127.0.0.1:'+api,AKW_PROFILE:'local',DATABASE_URL:'',AKW_S3_BUCKET:'',AKW_HARNESS_V2_ENABLED:'true',AKW_HARNESS_V2_LOCAL_ALL:'true',
      AKW_PGLITE_PATH:resolve(dir,'db-'+Date.now()),AKW_OBJECTS_PATH:resolve(dir,'objects'),NEXT_TELEMETRY_DISABLED:'1',AKW_WEB_DIST:'.next-harness-final-'+port },
    timeout:150_000 },
});