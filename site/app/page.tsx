// 스토어 출시 전, 로봄 4개 앱을 QR로만 안내하는 출시 준비 허브다.
/* eslint-disable @next/next/no-img-element -- 빌드 타임 QR SVG는 고정 크기이며 이미지 런타임을 싣지 않는다. */
import type { Metadata } from "next";
import { AppGlyph, FamilyFooter, MobileNav, SiteHeader, Wordmark } from "./components";
import { contactHref, familyApps } from "./app-data";
import { appsItemList } from "./structured-data";

export const metadata: Metadata = {
  title: { absolute: "로봄 | 4개 앱 출시 예정" },
  description: "야외봄·청약봄·러닝봄·자격증봄 4개 앱이 곧 출시됩니다. 8월 초 출시를 앞두고 있으며, 각 앱의 QR로 설치를 안내합니다.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "로봄 | 4개 앱 출시 예정",
    description: "야외봄·청약봄·러닝봄·자격증봄 4개 앱이 곧 출시됩니다. 8월 초 출시를 앞두고 있으며, 각 앱의 QR로 설치를 안내합니다.",
    url: "/",
    siteName: "로봄",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "따뜻한 색의 타이밍 신호로 표현한 로봄 알림 앱 스튜디오" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "로봄 | 4개 앱 출시 예정",
    description: "야외봄·청약봄·러닝봄·자격증봄 4개 앱이 곧 출시됩니다. 8월 초 출시를 앞두고 있습니다.",
    images: ["/og.png"],
  },
};

export default function Home() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main">
        <section className="family-hero family-hero--install" aria-labelledby="hero-title">
          <div className="hero-intro">
            <p className="eyebrow"><span aria-hidden="true" /> ROBOM FAMILY</p>
            <h1 id="hero-title">로봄 {familyApps.length}개 앱이<br /><em>곧 출시됩니다.</em></h1>
            <p className="hero-lead">야외봄·청약봄·러닝봄·자격증봄 {familyApps.length}개 앱을 준비하고 있습니다. 8월 초 출시를 앞두고 있으며, 출시 후 아래 QR에서 바로 설치할 수 있습니다.</p>
          </div>
          <div className="quick-install-grid" aria-label={`로봄 ${familyApps.length}개 앱 출시 준비`}>
            {familyApps.map((app) => (
              <article className={`quick-install-card ${app.tone}`} key={app.id}>
                <div className="quick-app-name"><AppGlyph app={app} /><Wordmark app={app} /></div>
                <p>{app.mobileValue}</p>
                <p className="prelaunch-status"><span className="status-pill">준비 중</span><span className="launch-window">2026년 8월 초 출시 예정</span></p>
                <img className="prelaunch-qr" src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={200} height={200} />
                <p className="install-address">robom.kr/get/{app.id}</p>
              </article>
            ))}
          </div>
          <p className="trust-copy">설치 QR은 바뀌지 않는 robom.kr/get 주소를 사용합니다. 스토어 출시 후 같은 QR에서 앱을 설치할 수 있습니다.</p>
        </section>

        <section className="support-band" aria-labelledby="support-title"><div><p>문의 · 광고 · 제휴</p><h2 id="support-title">궁금한 내용은 한곳으로 편하게 보내주세요.</h2><span>서비스 문의와 광고·제휴 제안 모두 hello.robom@gmail.com에서 확인합니다.</span></div><a className="button light" href={contactHref()}>이메일 보내기 <span aria-hidden="true">→</span></a></section>
      </main>
      <FamilyFooter />
      <MobileNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": "https://robom.kr/#website",
            url: "https://robom.kr/",
            name: "로봄",
            alternateName: ["ROBOM", "robom.kr"],
            inLanguage: "ko-KR",
            publisher: { "@id": "https://robom.kr/#organization" },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appsItemList()) }}
      />
    </div>
  );
}
