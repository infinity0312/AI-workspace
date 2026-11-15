import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { isLocal, tokenSecret } from '../config';
import { AppError } from './errors';

export interface Actor { tenant: string; user: string }
const localActor: Actor = { tenant: 'local-tenant', user: 'local-user' };
export const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().filter(key => object[key] !== undefined)
      .map(key => JSON.stringify(key) + ':' + stableJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
const claims = z.object({
  sub: z.string().regex(/^[\w.:-]{1,128}$/),
  tid: z.string().regex(/^[\w.:-]{1,128}$/),
  iss: z.string(),
  aud: z.literal('akw-api'),
  exp: z.number().int(),
  nbf: z.number().int().optional(),
});
export function authenticate(req: Request): Actor {
  const auth = req.get('Authorization');
  const unauthorized = new AppError(401, 'AUTH_REQUIRED', 'Valid bearer token required');
  if (!auth && isLocal && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return localActor;
  if (!tokenSecret || !auth?.startsWith('Bearer ') || auth.length > 4096) throw unauthorized;
  const [head, payload, signature, extra] = auth.slice(7).split('.');
  if (!head || !payload || !signature || extra !== undefined) throw unauthorized;
  try {
    const header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') throw unauthorized;
    const expected = createHmac('sha256', tokenSecret).update(head + '.' + payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw unauthorized;
    const parsed = claims.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    const now = Date.now() / 1000;
    if (parsed.iss !== (process.env.AKW_TOKEN_ISSUER ?? 'akw') || parsed.exp <= now || (parsed.nbf ?? 0) > now) throw unauthorized;
    return { user: parsed.sub, tenant: parsed.tid };
  } catch {
    throw unauthorized;
  }
}
