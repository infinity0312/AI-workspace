import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = [process.cwd(), resolve(process.cwd(), '../..'), resolve(__dirname, '../../../..')]
  .find(candidate => existsSync(resolve(candidate, 'apps/api/migrations')));
if (!root) throw new Error('Start from the repository or API workspace');
config({ path: resolve(root, '.env'), quiet: true });
export const isLocal = (process.env.AKW_PROFILE ?? 'local') === 'local';
export const port = Number(process.env.AKW_PORT ?? '4100');
export const databaseUrl = process.env.DATABASE_URL;
export const dataRoot = resolve(root, '.data');
export const localDataPath = process.env.AKW_PGLITE_PATH ?? resolve(dataRoot, 'postgres');
export const tokenSecret = process.env.AKW_TOKEN_SECRET;
if (!isLocal && (!databaseUrl || !tokenSecret || Buffer.byteLength(tokenSecret) < 32)) {
  throw new Error('Server profile requires DATABASE_URL and a token signing secret of at least 32 bytes');
}
