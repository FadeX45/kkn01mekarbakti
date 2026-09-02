// Service worker: cache semua aset saat install.
// Halaman utama (index.html/navigasi) pakai strategi NETWORK-FIRST agar
// setiap kali online selalu dapat versi terbaru; offline baru fallback ke cache.
// Aset statis (manifest, ikon) tetap CACHE-FIRST karena jarang berubah.
var CACHE_NAME = 'buku-kas-umkm-v5';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(
        names.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;
  // Jangan cache permintaan lintas domain (mis. Supabase Auth & REST API)
  // agar fitur cadangan Supabase selalu memakai data/izin terbaru.
  if(new URL(event.request.url).origin !== self.location.origin) return;

  var isHTMLPage = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').indexOf('text/html') !== -1;

  if(isHTMLPage){
    // NETWORK-FIRST: selalu coba ambil index.html terbaru dari internet dulu.
    // Kalau berhasil, perbarui cache. Kalau gagal (offline), baru pakai cache.
    event.respondWith(
      fetch(event.request).then(function(response){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        return response;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // CACHE-FIRST untuk aset statis (manifest, ikon, dll) yang jarang berubah.
  event.respondWith(
    caches.match(event.request).then(function(cached){
      if(cached) return cached;
      return fetch(event.request).then(function(response){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        return response;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});
