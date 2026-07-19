// 로봄 설치 허브의 서비스워커를 현재 배포 base path 안에서 안전하게 등록한다.
"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const baseUrl = manifest?.href ? new URL(".", manifest.href) : new URL("/", window.location.href);
    const swUrl = new URL("sw.js", baseUrl);
    navigator.serviceWorker.register(swUrl, { scope: baseUrl.pathname }).catch(() => {
      // 설치 기능 실패가 앱 선택과 미리보기를 막지 않도록 조용히 폴백한다.
    });
  }, []);

  return null;
}
