const CACHE='gold-pronos-v8';
const ASSETS=['./','./index.html','./styles.css?v=10','./app.js?v=18','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/matches.json')){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
  const freshFile=event.request.mode==='navigate'||/\.(html|js|css)$/.test(url.pathname);
  if(freshFile){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request,{cache:'no-store'});if(response.ok)await cache.put(event.request,response.clone());return response;}catch(error){const cached=await cache.match(event.request);if(cached)return cached;throw error;}})());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});