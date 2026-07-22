// 출시 준비 단계에서는 허브를 PWA로 설치하지 않는다.
// 이전에 등록된 로봄 허브 서비스워커와 허브 전용 캐시만 1회 정리한다(앱 origin 캐시는 건드리지 않는다).
"use client";

import { useEffect } from "react";

export function PwaCleanup() {
  useEffect(() => {
    // 이 origin(robom.kr 허브)에 등록된 서비스워커만 해제한다. 앱 기술 origin은 별도 origin이라 영향받지 않는다.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations?.()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => undefined);
    }
    // 허브 전용 캐시(robom-site-v*)만 삭제한다. 다른 캐시는 그대로 둔다.
    if ("caches" in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("robom-site-v")).map((key) => caches.delete(key))))
        .catch(() => undefined);
    }
  }, []);

  return null;
}
