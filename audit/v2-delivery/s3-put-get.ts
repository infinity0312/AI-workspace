import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join,resolve } from 'node:path';
import { openObjects } from '../../apps/api/src/platform/objects';

async function main() {
  const dir=resolve('.data/v2-s3');
  const S3rver=createRequire(join(dir,'package.json'))('s3rver');
  const data=await mkdtemp(join(dir,'bucket-'));
  const port=await new Promise<number>((resolve,reject)=>{
    const socket=createServer();
    socket.once('error',reject);
    socket.listen(0,'127.0.0.1',()=>{
      const address=socket.address();
      if (!address || typeof address==='string') return reject(new Error('No test port'));
      socket.close(error=>error ? reject(error) : resolve(address.port));
    });
  });
  const bucket='akw-v2-test';
  const server=new S3rver({ address:'127.0.0.1',port,directory:data,silent:true,configureBuckets:[{ name:bucket }] });
  await server.run();
  try {
    process.env.AKW_S3_ENDPOINT='http://127.0.0.1:'+port;
    process.env.AKW_S3_BUCKET=bucket;
    process.env.AKW_S3_ACCESS_KEY='S3RVER';
    process.env.AKW_S3_SECRET_KEY='S3RVER';
    process.env.AKW_S3_REGION='us-east-1';
    process.env.AWS_REQUEST_CHECKSUM_CALCULATION='WHEN_REQUIRED';
    process.env.AWS_RESPONSE_CHECKSUM_VALIDATION='WHEN_REQUIRED';
    const store=openObjects();
    const fixture=Buffer.from('Isolated workspace S3 round trip.');
    const hash=createHash('sha256').update(fixture).digest('hex');
    const first=randomUUID()+'/'+hash, second=randomUUID()+'/'+hash;
    await store.put(first,fixture,'text/plain');
    assert.deepEqual(await store.get(first),fixture);
    await assert.rejects(store.get(second));
    await store.put(second,await store.get(first),'text/plain');
    assert.deepEqual(await store.get(second),fixture);
    console.log(JSON.stringify({ endpoint:'local S3rver',put_get_hash_match:true,missing_key_rejected:true,copy_roundtrip:true }));
  } finally { await server.close(); }
}
void main().catch(error=>{console.error(error instanceof Error ? error.message : 'S3 fixture failed');process.exitCode=1;});
