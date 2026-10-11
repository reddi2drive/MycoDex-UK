// MycoDex offline shell. Never cache user discoveries or authentication tokens.
const CACHE='mycodex-shell-v7';
const SHELL=['./','./index.html','./styles.css?v=5','./cloud-config.js?v=3','./cloud.js?v=5','./app.js?v=7','./manifest.webmanifest','./data/species.json','./data/habitats-seasons.json','./assets/icon-180.png','./assets/icon-192.png'];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok){
        const clone=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(console.warn);
      }
      return response;
    }).catch(async()=>{
      const cached=await caches.match(event.request);
      if(cached)return cached;
      // An HTML document is only a valid offline fallback for navigation,
      // never for a .js or .css request (which would break the app).
      if(event.request.mode==='navigate')return caches.match('./index.html');
      return Response.error();
    })
  );
});