// 앱별 출시 상태에 따라 스토어 설치 또는 출시 준비 안내를 제공한다.
/* eslint-disable @next/next/no-img-element -- 빌드 타임 QR SVG는 고정 크기이며 이미지 런타임을 싣지 않는다. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppGlyph, PageShell, Wordmark } from "../../components";
import { familyApps, getFamilyApp } from "../../app-data";
import { installLandingStructuredData } from "../../structured-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return familyApps.map((app) => ({ id: app.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const app = getFamilyApp((await params).id);
  const isGooglePlayLive = app?.status === "live" && Boolean(app.googlePlayUrl);
  return app ? {
    title: { absolute: isGooglePlayLive ? `${app.name} Google Play 설치 | 로봄` : `${app.name} 출시 안내 | 로봄` },
    description: isGooglePlayLive
      ? `${app.name} 정식 출시. Google Play 설치 버튼과 바뀌지 않는 공식 QR 주소를 제공합니다.`
      : `${app.name}은 2026년 8월 출시 예정입니다. 출시 뒤에도 같은 공식 주소와 QR에서 설치할 수 있습니다.`,
    alternates: { canonical: app.installPath },
    openGraph: {
      title: isGooglePlayLive ? `${app.name} Google Play 정식 출시 | 로봄` : `${app.name} 2026년 8월 출시 예정 | 로봄`,
      description: isGooglePlayLive ? `${app.name}을 Google Play에서 지금 설치하세요.` : `${app.name}은 2026년 8월 출시 예정입니다.`,
      url: app.installPath, siteName: "로봄", locale: "ko_KR", type: "website",
    },
  } : {};
}

export default async function InstallLanding({ params }: { params: Promise<{ id: string }> }) {
  const app = getFamilyApp((await params).id);
  if (!app) notFound();
  const isGooglePlayLive = app.status === "live" && Boolean(app.googlePlayUrl);

  return (
    <PageShell current="apps">
      <section className={`install-page ${app.tone}`}>
        <div className="install-appbar"><AppGlyph app={app} large /><div><Wordmark app={app} /><p>{app.description}</p></div></div>
        <div className={`install-layout ${isGooglePlayLive ? "is-live" : "is-preparing"}`}>
          <div className="install-copy">
            <p className="prelaunch-status"><span className="status-pill">{app.statusLabel}</span><span className="launch-window">{app.launchWindow}</span></p>
            <h1><em>{app.name}</em></h1>
            <p>{isGooglePlayLive ? "Google Play에 정식 출시되었습니다. Android 휴대전화와 태블릿에서 지금 설치할 수 있습니다." : "2026년 8월 출시 예정입니다. 출시 뒤에도 이 주소와 QR에서 공식 설치 안내를 만날 수 있습니다."}</p>
            {isGooglePlayLive ? (
              <div className="install-actions">
                <a className="store-action" href={app.googlePlayUrl}>Google Play에서 설치</a>
                <p className="store-status">공식 Google Play 설치 페이지로 이동합니다.</p>
              </div>
            ) : (
              <Link className="button primary" href="/" prefetch={false}>로봄 홈으로 <span aria-hidden="true">→</span></Link>
            )}
          </div>
          <aside className="qr-card" aria-label={`${app.name} 설치 QR`}>
            <img src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={320} height={320} />
            <strong>{isGooglePlayLive ? "휴대폰 카메라로 스캔해 설치" : "출시 뒤에도 같은 QR을 사용합니다"}</strong>
            <p className="install-address">robom.kr/get/{app.id}</p>
          </aside>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(installLandingStructuredData(app)) }} />
      </section>
    </PageShell>
  );
}
