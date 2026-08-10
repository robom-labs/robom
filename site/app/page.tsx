// 로봄 패밀리의 실제 스토어 출시 상태와 공식 설치 QR을 안내하는 허브다.
/* eslint-disable @next/next/no-img-element -- 빌드 타임 QR SVG는 고정 크기이며 이미지 런타임을 싣지 않는다. */
import type { Metadata } from "next";
import { AppGlyph, FamilyFooter, MobileNav, SiteHeader, Wordmark } from "./components";
import { contactHref, familyApps } from "./app-data";
import { appsItemList } from "./structured-data";

const liveApps = familyApps.filter((app) => app.status === "live");
const preparingApps = familyApps.filter((app) => app.status === "preparing");
const installStatusDescription = `${liveApps.map((app) => app.name).join("·")}은 Google Play에서 지금 설치할 수 있습니다. ${preparingApps.map((app) => app.name).join("·")}은 출시를 준비하고 있습니다.`;

export const metadata: Metadata = {
  title: { absolute: "로봄 | 날씨·청약·러닝·자격증 앱" },
  description: installStatusDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: "로봄 | 날씨·청약·러닝·자격증 앱",
    description: installStatusDescription,
    url: "/",
    siteName: "로봄",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "따뜻한 색의 타이밍 신호로 표현한 로봄 알림 앱 스튜디오" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "로봄 | 날씨·청약·러닝·자격증 앱",
    description: installStatusDescription,
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
            <h1 id="hero-title">로봄 {familyApps.length}개 앱을<br /><em>만나보세요.</em></h1>
            <p className="hero-lead">{liveApps.map((app) => app.name).join("·")}은 Google Play에서 지금 설치할 수 있습니다. {preparingApps.map((app) => app.name).join("·")}은 출시를 준비하고 있으며, 컴퓨터에서는 QR로, 휴대폰에서는 카드 버튼으로 공식 설치 안내를 열 수 있습니다.</p>
          </div>
          <div className="quick-install-grid" id="apps" aria-label={`로봄 ${familyApps.length}개 앱 설치 및 출시 안내`}>
            {familyApps.map((app) => (
              <article className={`quick-install-card ${app.tone}`} key={app.id}>
                <div className="quick-app-name"><AppGlyph app={app} /><Wordmark app={app} /></div>
                <p>{app.mobileValue}</p>
                <p className="prelaunch-status"><span className="status-pill">{app.statusLabel}</span><span className="launch-window">{app.launchWindow}</span></p>
                <img className="prelaunch-qr" src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={200} height={200} />
                <a className="install-address" href={app.installPath} aria-label={`${app.name} 설치 안내 열기`}>
                  <span className="install-address__desktop">robom.kr/get/{app.id}</span>
                  <span className="install-address__mobile">{app.accessLabel} 열기 <b aria-hidden="true">→</b></span>
                </a>
              </article>
            ))}
          </div>
          <p className="trust-copy">설치 QR은 바뀌지 않는 robom.kr/get 주소를 사용합니다. 출시된 앱은 같은 QR에서 공식 스토어 설치로 연결됩니다.</p>
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
