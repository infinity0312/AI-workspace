const SHELL = 'akw-shell-v1';
const home = new URL('/',self.location.origin).href;
const staticPrefix = '/_next/static/';

function isStatic(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(staticPrefix);
}

async function rememberAssets(cache,paths) {
  const urls = [...new Set(paths)].slice(0,120).map(path => new URL(path,self.location.origin)).filter(isStatic);
  await Promise.allSettled(urls.map(async url => {
    if (await cache.match(url.href)) return;
    const response = await fetch(url.href);
    if (response.ok) await cache.put(url.href,response);
  }));
}

async function rememberHome(cache,response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return;
  const html = await response.clone().text();
  const paths = [...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)].map(match => match[1].replaceAll('&amp;','&'));
  await rememberAssets(cache,paths);
  await cache.put(home,response);
}

self.addEventListener('install',event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await rememberHome(cache,await fetch(home,{ cache:'reload' }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('akw-shell-') && name !== SHELL) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message',event => {
  if (event.data?.type === 'warm-shell' && Array.isArray(event.data.paths)) {
    event.waitUntil(caches.open(SHELL).then(cache => rememberAssets(cache,event.data.paths.filter(path => typeof path === 'string'))));
  }
});

self.addEventListener('fetch',event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isStatic(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const found = await cache.match(request);
      if (found) return found;
      const response = await fetch(request);
      if (response.ok) await cache.put(request,response.clone());
      return response;
    })());
  } else if (request.mode === 'navigate' && url.origin === self.location.origin && url.pathname === '/') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const response = await fetch(request);
        if (!response.ok && response.status >= 500) return await cache.match(home) ?? response;
        if (response.ok) await rememberHome(cache,response.clone());
        return response;
      } catch {
        return await cache.match(home) ?? new Response('离线内容尚未准备完成。',{ status:503,headers:{ 'Content-Type':'text/plain; charset=utf-8' } });
      }
    })());
  }
});
