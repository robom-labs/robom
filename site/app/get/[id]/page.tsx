// 출시 준비 단계의 설치 안내 페이지: 앱 이름·준비 중 안내·QR·공식 주소만 보여준다.
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
  return app ? {
    title: { absolute: `${app.name} 설치 | 로봄` },
    description: `${app.name}은 출시를 준비하고 있습니다. 스토어 출시 후 이 QR에서 설치할 수 있습니다.`,
    alternates: { canonical: app.installPath },
    openGraph: { title: `${app.name} 설치 | 로봄`, description: `${app.name}은 출시를 준비하고 있습니다.`, url: app.installPath, siteName: "로봄", locale: "ko_KR", type: "website" },
  } : {};
}

export default async function InstallLanding({ params }: { params: Promise<{ id: string }> }) {
  const app = getFamilyApp((await params).id);
  if (!app) notFound();

  return (
    <PageShell current="apps">
      <section className={`install-page ${app.tone}`}>
        <div className="install-appbar"><AppGlyph app={app} large /><div><Wordmark app={app} /><p>{app.description}</p></div></div>
        <div className="install-layout">
          <div className="install-copy">
            <p className="prelaunch-status"><span className="status-pill">준비 중</span><span className="launch-window">2026년 8월 초 출시 예정</span></p>
            <h1><em>{app.name}</em></h1>
            <p>스토어 출시 후 이 QR에서 설치할 수 있습니다.</p>
            <Link className="button primary" href="/" prefetch={false}>로봄 홈으로 <span aria-hidden="true">→</span></Link>
          </div>
          <aside className="qr-card" aria-label={`${app.name} 설치 QR`}>
            <img src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={320} height={320} />
            <strong>휴대폰 카메라로 스캔</strong>
            <p className="install-address">robom.kr/get/{app.id}</p>
          </aside>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(installLandingStructuredData(app)) }} />
      </section>
    </PageShell>
  );
}
