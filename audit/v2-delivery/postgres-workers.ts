import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emptyDocument,runInput,type Mutation } from '../../packages/contracts/src';
import { openDatabase,type Database } from '../../apps/api/src/platform/database';
import { services } from '../../apps/api/src/services';

async function main() {
  const dependency=resolve('.data/v2-postgres');
  const requireAudit=createRequire(join(dependency,'package.json'));
  const { default:EmbeddedPostgres }=await import(pathToFileURL(requireAudit.resolve('embedded-postgres')).href);
  const dir=await mkdtemp(join(dependency,'cluster-'));
  const port=await new Promise<number>((resolve,reject)=>{
    const server=createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const address=server.address();
      if (!address || typeof address==='string') return reject(new Error('No test port'));
      server.close(error=>error ? reject(error) : resolve(address.port));
    });
  });
  const password=randomUUID();
  const postgres=new EmbeddedPostgres({ databaseDir:dir,port,user:'qa',password,persistent:true,
    postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{} });
  const pools:Database[]=[];
  try {
    await postgres.initialise();
    await postgres.start();
    const url='postgresql://qa:'+password+'@127.0.0.1:'+port+'/postgres';
    const a=await openDatabase({ url });pools.push(a);
    const b=await openDatabase({ url });pools.push(b);
    // These real migrations contain every table used by the simple research queue.
    // The vector extension and evidence schema are outside this infrastructure fixture.
    for (const file of ['001_core.sql','003_jobs.sql','012_runtime_sessions.sql','013_runtime_journal.sql']) {
      const sql=await readFile(resolve('apps/api/migrations',file),'utf8');
      await a.script(sql.replace(/^CREATE EXTENSION IF NOT EXISTS vector;\r?\n/, ''));
    }
    const library=await readFile(resolve('apps/api/migrations/004_library.sql'),'utf8');
    const audience=library.match(/ALTER TABLE domain_outbox ADD COLUMN audience_user_id text;/)?.[0];
    assert.ok(audience);
    await a.script(audience);
    const objects={ async get():Promise<Buffer>{ throw new Error('Unexpected object read'); },async put(){ throw new Error('Unexpected object write'); } };
    const one=services(a,objects),two=services(b,objects);
    const actor={ tenant:'queue-fixture',user:'local-owner' };
    const ws=await one.workspaces.create(actor,{ name:'Queue concurrency fixture' });
    const signal=new AbortController().signal;
    const count=48;
    const job=()=>runInput.parse({ workspace_id:ws.id,goal:'Synthetic queue verification',mode:'simple' });
    for(let i=0;i<count;i++) await one.jobs.research(actor,job(),'job-'+i);
    const same=await one.jobs.research(actor,job(),'job-0');
    const duplicate=await two.jobs.research(actor,job(),'job-0');
    assert.deepEqual(same,duplicate);
    const started=performance.now();
    await Promise.all([one.jobs,two.jobs].map(async jobs=>{
      while(await jobs.next(signal)) { /* Drain this connection independently. */ }
    }));
    const elapsed=Math.round(performance.now()-started);
    const rows=await a.all<{ id:string;attempts:number;status:string }>('SELECT id,attempts,status FROM jobs');
    assert.equal(rows.length,count);
    assert.ok(rows.every(item=>item.attempts===1 && item.status==='PARTIAL'));
    const stale=await one.jobs.research(actor,job(),'expired');
    await a.all("UPDATE jobs SET status='RUNNING',attempts=1,lease_id=$2,lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [stale.run_id,randomUUID()]);
    assert.equal(await two.jobs.next(signal),true);
    const [reclaimed]=await a.all<{ attempts:number;lease_id:string|null;status:string }>('SELECT attempts,lease_id,status FROM jobs WHERE id=$1',[stale.run_id]);
    assert.equal(reclaimed?.attempts,2);
    assert.equal(reclaimed?.lease_id,null);
    assert.equal(reclaimed?.status,'PARTIAL');
    const target=await one.artifacts.create(actor,{ workspace_id:ws.id,title:'Concurrent sync',kind:'note' });
    const before=await one.sync.changes(actor,ws.id,'0',200);
    const deviceId=randomUUID();
    const initial:Mutation={ mutation_id:randomUUID(),workspace_id:ws.id,entity_id:target.id,entity_type:'artifact',
      device_id:deviceId,client_sequence:3,base_version:1,operation:'patch',schema_version:'1.0',created_at:new Date().toISOString(),payload:{ base_revision_id:target.revision.id,
        operations:[{ type:'replace_document',content:{ ...emptyDocument(),blocks:[{ id:randomUUID(),type:'paragraph',
          children:[{ type:'text',text:'Concurrent edit fixture' }] }] } }] } };
    const results=await Promise.all([one.sync.submit(actor,initial),two.sync.submit(actor,initial)]);
    assert.deepEqual(JSON.parse(JSON.stringify(results[0])),JSON.parse(JSON.stringify(results[1])));
    await assert.rejects(two.sync.submit(actor,{ ...initial,mutation_id:randomUUID(),client_sequence:2 }),
      (error:unknown)=>typeof error==='object' && error!==null && 'code' in error && error.code==='CONFLICT_DEVICE_SEQUENCE');
    const changes=await two.sync.changes(actor,ws.id,before.next_cursor,10);
    assert.equal(changes.changes.filter(item=>item.server_sequence && item.event_type==='ArtifactRevisionCommitted').length,1);
    const [version]=await a.all<{ server_version:string }>('SHOW server_version');
    console.log(JSON.stringify({ server:version?.server_version,pools:2,queued:count,elapsed_ms:elapsed,duplicate_idempotent:true,expired_lease_reclaimed:true,concurrent_sync_idempotent:true,pgvector:false }));
  } finally {
    await Promise.all(pools.map(pool=>pool.close()));
    await postgres.stop().catch(()=>{});
  }
}
void main().catch(error=>{ console.error(error instanceof Error ? error.message : 'Postgres fixture failed');process.exitCode=1; });
