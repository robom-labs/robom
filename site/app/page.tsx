// 로봄의 registry 앱을 하나의 제품 문법으로 소개하고 안정 경로로 연결하는 공식 패밀리 허브다.
import type { Metadata } from "next";
import Link from "next/link";
import { AppGlyph, FamilyFooter, MobileNav, SiteHeader, Wordmark } from "./components";
import { contactHref, familyApps } from "./app-data";

export const metadata: Metadata = {
  title: { absolute: "로봄 | 날씨·청약·러닝·달력·자격증·음성 메모" },
  description: "날씨, 청약, 러닝 대회, 자격증 시험을 한곳에서 확인하세요. 야외봄·청약봄·러닝봄·자격증봄으로 바로 연결됩니다.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "로봄 | 날씨·청약·러닝·달력·자격증·음성 메모",
    description: "날씨, 청약, 러닝 대회, 자격증 시험을 한곳에서 확인하세요. 야외봄·청약봄·러닝봄·자격증봄으로 바로 연결됩니다.",
    url: "/",
    siteName: "로봄",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "따뜻한 색의 타이밍 신호로 표현한 로봄 알림 앱 스튜디오" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "로봄 | 날씨·청약·러닝·달력·자격증·음성 메모",
    description: "날씨, 청약, 러닝 대회, 가족 일정, 자격증 시험과 음성 메모를 한곳에서 확인하세요.",
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
            <h1 id="hero-title">로봄 앱으로 오늘 필요한 정보를 고르고,<br /><em>휴대폰에서 바로 확인하세요.</em></h1>
            <p className="hero-lead">날씨·청약·러닝 대회·가족 일정·자격증 시험·음성 메모에서 지금 해야 할 행동을 {familyApps.length}개의 독립 앱이 또렷하게 알려드립니다.</p>
          </div>
          <div className="quick-install-grid" aria-label={`로봄 ${familyApps.length}개 앱 설치 선택`}>
            {familyApps.map((app) => (
              <article className={`quick-install-card ${app.tone}`} key={app.id}>
                <div className="quick-app-name"><AppGlyph app={app} /><Wordmark app={app} /></div>
                <p>{app.mobileValue}</p>
                <div><Link href={app.installPath} prefetch={false}>설치·휴대폰 사용 <span aria-hidden="true">→</span></Link><Link href={`/apps/${app.id}`} prefetch={false}>미리보기</Link></div>
              </article>
            ))}
          </div>
          <p className="trust-copy">등록된 {familyApps.length}개 앱 모두 운영 중이며, 설치 QR은 바뀌지 않는 robom.kr/get 주소를 사용합니다. 앱은 QR로 휴대폰에 설치해 사용하고, 소개 페이지에서 화면을 미리 볼 수 있습니다.</p>
        </section>

        <section className="apps-section" id="apps" aria-labelledby="apps-title">
          <div className="section-heading">
            <div><p className="eyebrow"><span aria-hidden="true" /> {familyApps.length} APPS, ONE FAMILY</p><h2 id="apps-title">마음은 하나로,<br />지키는 순간은 저마다 또렷하게.</h2></div>
            <p>등록된 모든 앱은 같은 마음과 같은 약속으로 만들어졌습니다. 하늘과 기회, 출발선과 가족 일정, 시험 준비와 떠오른 말을 각자의 방식으로 지킵니다.</p>
          </div>
          <div className="app-card-grid">
            {familyApps.map((app) => (
              <article className={`family-card ${app.tone}`} key={app.id}>
                <div className="appbar"><AppGlyph app={app} /><div><Wordmark app={app} /><p>robom · {app.tagline}</p></div><span className="status-pill">{app.statusLabel}</span></div>
                <div className="filter-row" aria-label={`${app.name} 주요 기능`} role="group" tabIndex={0}>{app.highlights.map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}</div>
                <div className="app-hero-card"><span className="card-rule" /><p className="card-eyebrow">{app.eyebrow}</p><h3>{app.heroTitle}</h3><p>{app.heroBody}</p><div className="metric-row">{app.metrics.map((metric) => <span key={metric.label}><b>{metric.value}</b><small>{metric.label}</small></span>)}</div><Link className="card-cta" href={app.installPath} prefetch={false}>{app.name} 설치·휴대폰 사용 <span aria-hidden="true">→</span></Link></div>
                <div className="short-list"><strong>이 앱이 챙기는 것</strong>{app.highlights.slice(0, 2).map((item, index) => <span key={item}>{item}<b>{index === 0 ? "핵심" : "보기"}</b></span>)}</div>
                <Link className="web-access" href={app.hubPath} prefetch={false}>{app.name} 소개 자세히 <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="standard-section" aria-labelledby="standard-title">
          <div><p className="eyebrow"><span aria-hidden="true" /> THE ROBOM STANDARD</p><h2 id="standard-title">익숙한 골격,<br />각 앱다운 디테일.</h2><p>큰 앱바, 쉬운 필터, 핵심 카드, 한 손에 닿는 버튼과 하단 내비를 공통으로 사용합니다. 색과 데이터 표현은 서비스 목적에 맞게 달라집니다.</p></div>
          <ol><li><span>01</span><div><b>한눈에 이해합니다.</b><p>첫 화면에서 오늘 가장 중요한 신호와 다음 행동을 확인합니다.</p></div></li><li><span>02</span><div><b>한 손으로 움직입니다.</b><p>모바일 버튼과 탭은 충분히 크고 기기 안전 영역을 침범하지 않습니다.</p></div></li><li><span>03</span><div><b>앱 사이를 잃지 않습니다.</b><p>안정적인 로봄 허브에서 다른 패밀리 앱과 지원 정보로 이동합니다.</p></div></li></ol>
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
    </div>
  );
}
