// 로봄 패밀리의 실제 스토어 출시 상태와 공식 설치 QR을 안내하는 허브다.
/* eslint-disable @next/next/no-img-element -- 빌드 타임 QR SVG는 고정 크기이며 이미지 런타임을 싣지 않는다. */
import type { Metadata } from "next";
import { AppGlyph, FamilyFooter, SiteHeader, Wordmark } from "./components";
import { contactHref, familyApps } from "./app-data";
import { appsItemList } from "./structured-data";

const liveApps = familyApps.filter((app) => app.status === "live");
const preparingApps = familyApps.filter((app) => app.status === "preparing");
const liveNames = liveApps.map((app) => app.name).join("·");
const preparingNames = preparingApps.map((app) => app.name).join("·");
const homepageDescription = `${liveNames}을 Google Play에서 만나보세요. ${preparingNames}도 2026년 8월 출시 예정입니다.`;

export const metadata: Metadata = {
  title: { absolute: `로봄 | ${liveNames} Google Play 출시` },
  description: homepageDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: "로봄의 첫 앱들이 Google Play에 도착했습니다",
    description: homepageDescription,
    url: "/",
    siteName: "로봄",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "날씨·청약·러닝·자격증의 필요한 순간을 알려주는 로봄 앱 패밀리" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `로봄 | ${liveNames} 정식 출시`,
    description: homepageDescription,
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
            <p className="eyebrow"><span aria-hidden="true" /> NOW LIVE · ROBOM FAMILY</p>
            <h1 id="hero-title">로봄 앱,<br /><em>이제 시작합니다.</em></h1>
            <p className="hero-lead">{liveNames}이 Google Play에 정식 출시되었습니다. 필요한 순간을 먼저 알려주는 로봄 앱을 지금 만나보세요.</p>
          </div>

          <div className="launch-stage" id="apps">
            <section className="launch-section launch-section--live" aria-labelledby="live-apps-title">
              <header className="launch-section-head">
                <p className="section-kicker"><span aria-hidden="true" /> NOW LIVE</p>
                <div><h2 id="live-apps-title">Google Play 정식 출시</h2><p>{liveNames}을 지금 바로 설치할 수 있습니다.</p></div>
              </header>
              <div className="quick-install-grid quick-install-grid--live" aria-label="Google Play 정식 출시 앱">
                {liveApps.map((app) => (
                  <article className={`quick-install-card is-live ${app.tone}`} data-app-id={app.id} key={app.id}>
                    <div className="quick-install-main">
                      <h3 className="quick-app-name"><AppGlyph app={app} /><Wordmark app={app} /></h3>
                      <p className="app-value">{app.mobileValue}</p>
                      <p className="prelaunch-status"><span className="status-pill">{app.statusLabel}</span><span className="launch-window">{app.launchWindow}</span></p>
                      <p className="launch-note">필요한 순간을 놓치지 않도록 핵심 정보를 먼저 보여드립니다.</p>
                    </div>
                    <div className="quick-install-action">
                      <img className="prelaunch-qr" src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={200} height={200} />
                      <a className="install-address install-address--live" href={app.googlePlayUrl} aria-label={`${app.name} Google Play에서 설치`}>
                        <span className="install-address__desktop">Google Play에서 설치</span>
                        <span className="install-address__mobile">{app.accessLabel} 열기 <b aria-hidden="true">→</b></span>
                      </a>
                      <a className="card-stable-link" href={app.installPath}>공식 설치 주소 <span>robom.kr/get/{app.id}</span></a>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="launch-section launch-section--preparing" aria-labelledby="preparing-apps-title">
              <header className="launch-section-head">
                <p className="section-kicker">NEXT</p>
                <div><h2 id="preparing-apps-title">다음 앱도 곧 만나요</h2><p>{preparingNames}은 2026년 8월 출시 예정입니다.</p></div>
              </header>
              <div className="quick-install-grid quick-install-grid--preparing" aria-label="2026년 8월 출시 예정 앱">
                {preparingApps.map((app) => (
                  <article className={`quick-install-card is-preparing ${app.tone}`} data-app-id={app.id} key={app.id}>
                    <div className="quick-install-main">
                      <h3 className="quick-app-name"><AppGlyph app={app} /><Wordmark app={app} /></h3>
                      <p className="app-value">{app.mobileValue}</p>
                      <p className="prelaunch-status"><span className="status-pill">{app.statusLabel}</span><span className="launch-window">{app.launchWindow}</span></p>
                    </div>
                    <div className="quick-install-action">
                      <img className="prelaunch-qr" src={`/install/qr/${app.id}.svg`} alt={`${app.name} 공식 설치 주소 ${app.stableInstallUrl} QR 코드`} width={200} height={200} />
                      <a className="install-address" href={app.installPath} aria-label={`${app.name} 출시 안내 열기`}>
                        <span className="install-address__desktop">출시 안내 보기</span>
                        <span className="install-address__mobile">{app.accessLabel} 열기 <b aria-hidden="true">→</b></span>
                      </a>
                      <span className="card-stable-address">robom.kr/get/{app.id}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <p className="trust-copy">설치 QR은 바뀌지 않는 robom.kr/get 주소를 사용합니다. 출시 예정 앱도 정식 출시 뒤 같은 QR에서 공식 스토어 설치로 연결됩니다.</p>
        </section>

        <section className="support-band" aria-labelledby="support-title"><div><p>문의 · 광고 · 제휴</p><h2 id="support-title">궁금한 내용은 한곳으로 편하게 보내주세요.</h2><span>서비스 문의와 광고·제휴 제안 모두 hello.robom@gmail.com에서 확인합니다.</span></div><a className="button light" href={contactHref()}>이메일 보내기 <span aria-hidden="true">→</span></a></section>
      </main>
      <FamilyFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite", "@id": "https://robom.kr/#website",
        url: "https://robom.kr/", name: "로봄", alternateName: ["ROBOM", "robom.kr"], inLanguage: "ko-KR",
        publisher: { "@id": "https://robom.kr/#organization" },
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appsItemList()) }} />
    </div>
  );
}
