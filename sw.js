// 서비스워커: 앱 파일을 폰에 저장해 오프라인에서도 열리게 함.
// 파일을 수정하면 VERSION 숫자를 올려야 폰에 새 버전이 반영됩니다.
const VERSION = 'v5';
const CACHE = `fromis-app-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/db.js',
  './js/data.js',
  './js/settings.js',
  './js/ledger.js',
  './js/ledger-data.js',
  './js/ledger-settings.js',
  './js/photos.js',
  './js/decor-settings.js',
  './js/ledger-rec.js',
  './js/ledger-manage.js',
  './js/ledger-fandom.js',
  './js/backup.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 캐시에 있으면 바로 보여주고, 뒤에서 네트워크로 최신 파일을 받아 캐시를 갱신 (stale-while-revalidate)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('오프라인 상태예요', { status: 503 });
  })());
});
