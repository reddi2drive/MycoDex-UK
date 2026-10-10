// Local-first app shell cache. Personal data remains in IndexedDB, not the service worker.
const CACHE='mycodex-shell-v1';
const SHELL=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./data/species.json','./assets/icon-180.png','./assets/icon-192.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}return response;}).catch(()=>caches.match(event.request).then(response=>response||caches.match('./index.html'))));
});