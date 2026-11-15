import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataRoot, isLocal } from '../config';

export interface ObjectStore {
  put(key: string, bytes: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}
export function openObjects(base = process.env.AKW_OBJECTS_PATH ?? resolve(dataRoot, 'objects')): ObjectStore {
  const bucket = process.env.AKW_S3_BUCKET;
  if (bucket) {
    const accessKeyId = process.env.AKW_S3_ACCESS_KEY;
    const secretAccessKey = process.env.AKW_S3_SECRET_KEY;
    const client = new S3Client({
      region: process.env.AKW_S3_REGION ?? 'us-east-1',
      endpoint: process.env.AKW_S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.AKW_S3_ENDPOINT),
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      maxAttempts: 3,
    });
    return {
      async put(key, bytes, mime) {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mime }), { abortSignal: AbortSignal.timeout(20_000) });
      },
      async get(key) {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(20_000) });
        if (!response.Body) throw new Error('Object unavailable');
        return Buffer.from(await response.Body.transformToByteArray());
      },
    };
  }
  if (!isLocal) throw new Error('Server profile requires AKW_S3_BUCKET');
  function path(key: string) {
    if (!/^[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(key)) throw new Error('Invalid storage key');
    return resolve(base, key);
  }
  return {
    async put(key, bytes) {
      const file = path(key);
      await mkdir(dirname(file), { recursive: true });
      const staged = file + '.' + randomUUID() + '.tmp';
      await writeFile(staged, bytes, { flag: 'wx' });
      await rename(staged, file);
    },
    get: key => readFile(path(key)),
  };
}
