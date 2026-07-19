// 기기별 스토어·PWA·웹 사용 경로를 강제 이동 없이 알맞은 순서로 보여준다.
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { familyAnalytics } from "../../family-analytics";

type InstallApp = {
  id: string;
  name: string;
  webUrl: string;
  pwaInstallUrl: string;
  googlePlayUrl: string;
  googlePlayStatus: string;
  appStoreUrl: string;
  appStoreStatus: string;
};

function getPlatform() {
  if (/android/i.test(navigator.userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "desktop";
}

function subscribePlatform() {
  return () => undefined;
}

export function InstallActions({ app }: { app: InstallApp }) {
  const platform = useSyncExternalStore(subscribePlatform, getPlatform, () => "desktop");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    familyAnalytics.track({ event_name: "app_install_landing_viewed", app_id: app.id, surface: "install-landing" });
  }, [app.id]);

  const playLive = app.googlePlayStatus === "live" && Boolean(app.googlePlayUrl);
  const appStoreLive = app.appStoreStatus === "live" && Boolean(app.appStoreUrl);
  const primaryStore = platform === "android" ? (playLive ? "play" : null) : platform === "ios" ? (appStoreLive ? "app-store" : null) : null;

  return (
    <div className="install-actions" aria-live="polite">
      <p className="platform-note">
        {platform === "android" ? "Android 기기에 맞는 설치 방법입니다." : platform === "ios" ? "iPhone·iPad에 맞는 설치 방법입니다." : "휴대폰으로 QR을 찍거나 아래 방법을 선택하세요."}
      </p>

      {primaryStore === "play" && <a className="store-action primary" href={app.googlePlayUrl} target="_blank" rel="noopener noreferrer" onClick={() => familyAnalytics.track({ event_name: "store_badge_clicked", app_id: app.id, surface: "install-landing", properties: { store: "google-play" } })}>Google Play에서 설치</a>}
      {primaryStore === "app-store" && <a className="store-action primary" href={app.appStoreUrl} target="_blank" rel="noopener noreferrer" onClick={() => familyAnalytics.track({ event_name: "store_badge_clicked", app_id: app.id, surface: "install-landing", properties: { store: "app-store" } })}>App Store에서 설치</a>}

      {!primaryStore && <a className="store-action primary" href={app.pwaInstallUrl} target="_blank" rel="noopener noreferrer" onClick={() => familyAnalytics.track({ event_name: "pwa_install_cta_clicked", app_id: app.id, surface: "install-landing" })}>{platform === "ios" ? `Safari에서 ${app.name} 열기` : `${app.name} 열고 설치`}</a>}
      {!playLive && !appStoreLive && <p className="store-status">Google Play·App Store 앱은 출시 준비 중입니다. 지금은 검증된 PWA(홈 화면 앱)로 설치해 앱처럼 사용해요.</p>}

      {!primaryStore && <button className="install-guide-toggle" type="button" aria-expanded={showGuide || platform === "ios"} onClick={() => setShowGuide((value) => !value)}>홈 화면 설치 방법</button>}
      {(showGuide || (platform === "ios" && !appStoreLive)) && (
        <ol className="manual-install-guide">
          {platform === "ios" ? <><li>위 버튼으로 {app.name}을 Safari에서 여세요.</li><li>Safari 아래쪽 공유 버튼에서 ‘홈 화면에 추가’를 선택하세요.</li><li>오른쪽 위 ‘추가’를 누르면 설치가 끝나요.</li></> : <><li>위 버튼으로 {app.name} 앱을 먼저 여세요.</li><li>앱 안의 설치 버튼 또는 브라우저 메뉴를 여세요.</li><li>‘앱 설치’나 ‘홈 화면에 추가’를 누르세요.</li></>}
        </ol>
      )}

      <div className="install-secondary-actions">
        {playLive && primaryStore !== "play" && <a href={app.googlePlayUrl} target="_blank" rel="noopener noreferrer">Google Play</a>}
        {appStoreLive && primaryStore !== "app-store" && <a href={app.appStoreUrl} target="_blank" rel="noopener noreferrer">App Store</a>}
        <a href={`/apps/${app.id}#app-preview`} onClick={() => familyAnalytics.track({ event_name: "preview_clicked", app_id: app.id, surface: "install-landing" })}>화면 미리보기</a>
      </div>
    </div>
  );
}
