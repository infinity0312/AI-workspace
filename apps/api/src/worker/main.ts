import { databaseUrl } from '../config';
import { openServices } from '../services';
import { runWorker } from './loop';

async function main() {
  if (!databaseUrl) throw new Error('Standalone worker requires DATABASE_URL. Local mode runs its worker with the API.');
  const app = await openServices();
  const stop = new AbortController();
  process.once('SIGINT',() => stop.abort());
  process.once('SIGTERM',() => stop.abort());
  try { await runWorker(app.jobs,app.schedules,stop.signal); }
  finally { await app.db.close(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Worker startup failed'); process.exitCode = 1; });
