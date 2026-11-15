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
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3001/api/v1/health',
    env: {
      PORT: '3001', AKW_PORT: '4101', AKW_API_ORIGIN: 'http://127.0.0.1:4101',
      AKW_PGLITE_PATH: resolve('.data', 'e2e-' + Date.now()), NEXT_TELEMETRY_DISABLED: '1', AKW_WEB_DIST: '.next-e2e',
    },
    timeout: 150000,
  },
});
