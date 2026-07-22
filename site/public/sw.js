// 출시 준비 단계: 로봄 허브는 더 이상 PWA로 동작하지 않는다.
// 이 서비스워커는 자기 자신을 해제하고 허브 전용 캐시(robom-site-v*)만 비운 뒤 사라진다(self-destroying).
const CACHE_PREFIX = "robom-site-v";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll();
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
