// 로봄 Company OS 앱 셸만 오프라인 보관하고 회사 기록 API와 실시간 스냅샷은 캐시하지 않는다.
const CACHE = "robom-company-os-v6.7.0";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./version.json", "./office.html", "./office.js", "./office-map.json", "./manifest.webmanifest", "./icon.svg", "./assets/qrcode.js", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/apple-touch-icon.png", "./assets/fonts/PretendardVariable.woff2", "./assets/fonts/NanumMyeongjo-400.woff2", "./assets/fonts/NanumMyeongjo-700.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("robom-company-os-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.endsWith("/snapshot.json")) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then((response) => response || caches.match("./index.html"))));
});
