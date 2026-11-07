const CACHE='gold-pronos-v47';
const APP_ASSETS=['./','./index.html','./styles.css?v=33','./app.js?v=45','./i18n.js?v=7','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(APP_ASSETS.map(async url=>{try{const r=await fetch(url,{cache:'no-store'});if(r.ok)await cache.put(url,r);}catch(_){}}));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('gold-pronos-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/matches.json')){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const fresh=await fetch(request,{cache:'no-store'});if(fresh.ok)await cache.put('./matches.json',fresh.clone());return fresh;}catch(_){return (await cache.match('./matches.json'))||Response.error();}})());return;
  }
  if(request.mode==='navigate'){
    event.respondWith((async()=>{try{const fresh=await fetch(request);if(fresh.ok){const cache=await caches.open(CACHE);await cache.put('./index.html',fresh.clone());}return fresh;}catch(_){return (await caches.open(CACHE)).match('./index.html')||Response.error();}})());return;
  }
  if(/\.(js|css|svg|webmanifest)$/.test(url.pathname)){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(request);const update=fetch(request,{cache:'no-store'}).then(response=>{if(response.ok)cache.put(request,response.clone());return response;}).catch(()=>null);if(cached){event.waitUntil(update);return cached;}return (await update)||Response.error();})());return;
  }
});