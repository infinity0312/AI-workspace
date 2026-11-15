import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { Pool } from 'pg';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { databaseUrl, localDataPath, root } from '../config';

export type Row = Record<string, unknown>;
export interface Sql {
  all<T extends object = Row>(sql: string, args?: unknown[]): Promise<T[]>;
  script(sql: string): Promise<void>;
}
export interface Database extends Sql {
  transaction<T>(operation: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function first<T extends object = Row>(sql: Sql, query: string, args: unknown[] = []) {
  return (await sql.all<T>(query, args))[0];
}

export async function openDatabase(options: { url?: string; path?: string } = { url: databaseUrl, path: localDataPath }): Promise<Database> {
  if (options.url) {
    const pool = new Pool({ connectionString: options.url, connectionTimeoutMillis: 5000, statement_timeout: 15000, max: 10 });
    const wrap = (client: Pick<Pool, 'query'>): Sql => ({
      all: async (query, args) => (await client.query(query, args)).rows,
      script: async (query) => { await client.query(query); },
    });
    return {
      ...wrap(pool),
      async transaction(operation) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await operation(wrap(client));
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (options.path) await mkdir(dirname(options.path), { recursive: true });
  const pg = await PGlite.create({ dataDir: options.path ?? 'memory://', extensions: { vector } });
  const wrap = (client: Pick<PGlite, 'query' | 'exec'>): Sql => ({
    all: async (query, args) => (await client.query(query, args)).rows as never[],
    script: async (query) => { await client.exec(query); },
  });
  return {
    ...wrap(pg),
    transaction: operation => pg.transaction(tx => operation(wrap(tx))),
    close: () => pg.close(),
  };
}

export async function migrate(db: Database, lock = false) {
  const directory = resolve(root!, 'apps/api/migrations');
  const files = (await readdir(directory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
  await db.transaction(async sql => {
    if (lock) await sql.all('SELECT pg_advisory_xact_lock(40110000)');
    await sql.script('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of files) {
      if (await first(sql, 'SELECT name FROM schema_migrations WHERE name=$1', [name])) continue;
      await sql.script(await readFile(resolve(directory, name), 'utf8'));
      await sql.all('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    }
  });
}
