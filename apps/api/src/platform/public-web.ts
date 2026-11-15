import { lookup } from 'node:dns/promises';
import { request as httpRequest, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { AppError, invalid } from './errors';

const maxBytes = 8 * 1024 * 1024;
const accepted = ['application/pdf', 'text/html', 'text/plain', 'text/markdown', 'application/xhtml+xml'];

export function canonicalUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw invalid('Invalid source URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || url.href.length > 2048) {
    throw invalid('Use a public HTTP or HTTPS URL on the standard port');
  }
  url.hash = '';
  return url;
}
function providerFailure(message: string) {
  return new AppError(502, 'PROVIDER_FETCH_FAILED', message);
}

export async function fetchPublic(input: string, signal = AbortSignal.timeout(20_000)) {
  let url = canonicalUrl(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await lookup(hostname, { all: true });
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(entry => ipaddr.process(entry.address).range() !== 'unicast')) throw invalid('Source must resolve to a public address');
    const pinned = addresses[0]!;
    const response = await new Promise<{ redirect?: string; mime?: string; bytes?: Buffer }>((resolve, reject) => {
      const options: RequestOptions & { autoSelectFamily: boolean } = {
        method: 'GET', agent: false, signal, autoSelectFamily: false,
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
        headers: { Accept: accepted.join(', '), 'User-Agent': 'AI-Knowledge-Workspace/0.1' },
      };
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, options, incoming => {
        incoming.on('error', reject);
        const status = incoming.statusCode ?? 0;
        if ([301,302,303,307,308].includes(status) && incoming.headers.location) {
          resolve({ redirect: incoming.headers.location });
          incoming.destroy();
          return;
        }
        const mime = (incoming.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
        if (status !== 200 || !accepted.includes(mime) || Number(incoming.headers['content-length']) > maxBytes) {
          reject(providerFailure('Source returned an unsupported response'));
          incoming.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) incoming.destroy(providerFailure('Source exceeds download limit'));
          else chunks.push(chunk);
        });
        incoming.on('end', () => resolve({ mime, bytes: Buffer.concat(chunks) }));
      });
      request.on('error', reject);
      request.end();
    });
    if (response.redirect) {
      const next = canonicalUrl(new URL(response.redirect, url).href);
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw invalid('HTTPS downgrade refused');
      url = next;
      continue;
    }
    if (response.bytes && response.mime) return { bytes: response.bytes, mime: response.mime, finalUrl: url.href };
  }
  throw providerFailure('Too many source redirects');
}
