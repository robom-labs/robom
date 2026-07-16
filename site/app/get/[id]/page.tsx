// 안정 설치 URL에서 PC QR과 모바일 플랫폼별 설치·PWA·웹 사용 선택을 제공한다.
/* eslint-disable @next/next/no-img-element -- 빌드 타임 QR SVG는 고정 크기이며 이미지 런타임을 싣지 않는다. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppGlyph, PageShell, Wordmark } from "../../components";
import { familyApps, getFamilyApp } from "../../app-data";
import { InstallActions } from "./install-actions";

export const dynamicParams = false;

export function generateStaticParams() {
  return familyApps.map((app) => ({ id: app.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const app = getFamilyApp((await params).id);
  return app ? {
    title: { absolute: `${app.name} 설치 | 로봄` },
    description: `${app.name}을 휴대폰에 설치하거나 웹으로 사용하는 공식 안정 경로입니다.`,
    alternates: { canonical: app.installPath },
    openGraph: { title: `${app.name} 설치 | 로봄`, description: app.description, url: app.installPath, siteName: "로봄", locale: "ko_KR", type: "website" },
  } : {};
}

export default async function InstallLanding({ params }: { params: Promise<{ id: string }> }) {
  const app = getFamilyApp((await params).id);
  if (!app) notFound();
  const otherApps = familyApps.filter((item) => item.id !== app.id);

  return (
    <PageShell current="apps">
      <section className={`install-page ${app.tone}`}>
        <nav className="breadcrumb" aria-label="현재 위치"><Link href="/" prefetch={false}>로봄</Link><span aria-hidden="true">›</span><Link href={app.hubPath} prefetch={false}>{app.name}</Link><span aria-hidden="true">›</span><span aria-current="page">설치</span></nav>
        <div className="install-appbar"><AppGlyph app={app} large /><div><Wordmark app={app} /><p>{app.description}</p></div></div>
        <div className="install-layout">
          <div className="install-copy">
            <p className="eyebrow"><span aria-hidden="true" /> OFFICIAL INSTALL</p>
            <h1>휴대폰에서<br /><em>{app.name}</em>을 바로 쓰세요.</h1>
            <p>PC에서는 QR을 휴대폰 카메라로 찍고, 모바일에서는 기기에 맞는 설치 방법을 선택하세요. 자동으로 다른 곳으로 보내지 않습니다.</p>
            <InstallActions app={app} />
          </div>
          <aside className="qr-card" aria-label={`${app.name} 설치 QR`}>
            <img src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={320} height={320} />
            <strong>휴대폰 카메라로 스캔</strong>
            <a href={app.stableInstallUrl}>{app.stableInstallUrl}</a>
            <small>QR 목적지는 스토어 출시 뒤에도 바뀌지 않습니다.</small>
          </aside>
        </div>
        <section className="install-trust" aria-labelledby="install-trust-title"><h2 id="install-trust-title">설치 전에 확인하세요.</h2><div><article><b>공식 안정 주소</b><p>QR은 항상 robom.kr의 앱별 설치 경로를 가리킵니다.</p></article><article><b>웹 사용 보장</b><p>스토어 출시 전이나 설치가 어려울 때도 웹으로 계속 사용할 수 있습니다.</p></article><article><b>선택권 유지</b><p>강제 리다이렉트 없이 사용자가 목적지를 확인하고 선택합니다.</p></article></div></section>
        <section className="family-menu" aria-labelledby="install-family-title"><div><p>다른 로봄 앱</p><h2 id="install-family-title">다른 순간도 휴대폰에서 챙겨보세요.</h2></div><div>{otherApps.map((item) => <Link href={item.installPath} prefetch={false} key={item.id}><AppGlyph app={item} /><span><Wordmark app={item} /><small>{item.mobileValue}</small></span><b>설치 →</b></Link>)}</div></section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: app.name, applicationCategory: "LifestyleApplication", operatingSystem: "Web, Android, iOS", url: app.stableInstallUrl, softwareVersion: app.version, offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } }) }} />
      </section>
    </PageShell>
  );
}
