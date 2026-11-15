import { databaseUrl, isLocal, port } from './config';
import { createApp } from './http/app';
import { openServices } from './services';
import { runWorker } from './worker/loop';

async function main() {
  const services = await openServices();
  const app = await createApp(services);
  const host = isLocal ? '127.0.0.1' : process.env.AKW_BIND_HOST ?? '127.0.0.1';
  const stop = new AbortController();
  const inProcessWorker = !databaseUrl || process.env.AKW_INLINE_WORKER === 'true';
  const worker = inProcessWorker ? runWorker(services.jobs,services.schedules,stop.signal) : Promise.resolve();
  const shutdown = async () => {
    if (stop.signal.aborted) return;
    stop.abort();
    await app.close();
    await worker;
    await services.db.close();
  };
  process.once('SIGINT',() => { void shutdown(); });
  process.once('SIGTERM',() => { void shutdown(); });
  try {
    await app.listen(port,host);
    console.info('API listening at http://' + host + ':' + port);
  } catch (error) {
    await shutdown();
    throw error;
  }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'API startup failed'); process.exitCode = 1; });
