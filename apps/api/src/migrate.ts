import { databaseUrl } from './config';
import { migrate, openDatabase } from './platform/database';

async function main() {
  const database = await openDatabase();
  try {
    await migrate(database, Boolean(databaseUrl));
    console.info('Schema migrations applied.');
  } finally {
    await database.close();
  }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exitCode = 1; });
