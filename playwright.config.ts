import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    launchOptions: process.platform === 'win32' && existsSync(edge) ? { executablePath: edge } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: (process.env.AKW_E2E_SKIP_BUILD==='1' ? '' : 'npm run build && ') + 'npm exec concurrently -- -k "npm run start -w @akw/api" "npm exec -w @akw/web -- next start --hostname 127.0.0.1 --port 3001"',
    url: 'http://127.0.0.1:3001/api/v1/health',
    env: {
      PORT: '3001', AKW_PORT: '4101', AKW_API_ORIGIN: 'http://127.0.0.1:4101',
      AKW_RENDERER_LAB:'1', AKW_PGLITE_PATH: resolve('.data', 'e2e-' + Date.now()), NEXT_TELEMETRY_DISABLED: '1', AKW_WEB_DIST: '.next-e2e',
    },
    timeout: 150000,
  },
});
