// 로봄의 세 앱을 하나의 제품 문법으로 소개하고 안정 경로로 연결하는 공식 패밀리 허브다.
import type { Metadata } from "next";
import Link from "next/link";
import { AppGlyph, FamilyFooter, MobileNav, SiteHeader, Wordmark } from "./components";
import { familyApps } from "./app-data";

export const metadata: Metadata = {
  title: "중요한 순간을 먼저 봅니다",
};

export default function Home() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main">
        <section className="family-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span aria-hidden="true" /> ROBOM FAMILY</p>
            <h1 id="hero-title">놓치고 싶지 않은 순간을<br /><em>먼저 봅니다.</em></h1>
            <p className="hero-lead">날이 개는 아침, 문이 열리는 순간, 출발선이 그려지는 날. 로봄은 쏟아지는 정보 대신, 지금 당신이 내디딜 한 걸음만 조용히 건네드립니다.</p>
            <div className="hero-actions">
              <a className="button primary" href="#apps">세 앱 만나기 <span aria-hidden="true">↓</span></a>
              <Link className="button secondary" href="/support">도움받기</Link>
            </div>
            <p className="mobile-jump-label">지금 필요한 앱을 바로 여세요.</p>
            <nav className="mobile-app-jump" aria-label="앱 바로 열기">
              {familyApps.map((app) => (
                <a className={`app-jump ${app.tone}`} href={app.webUrl} target="_blank" rel="noopener noreferrer" key={app.id} aria-label={`${app.name} 웹 앱 새 창으로 열기`}>
                  <AppGlyph app={app} />
                  <span className="app-jump-text"><b>{app.name}</b><small>{app.tagline}</small></span>
                  <span className="app-jump-go" aria-hidden="true">바로 열기 ↗</span>
                </a>
              ))}
            </nav>
            <ul className="trust-list" aria-label="로봄의 제품 원칙">
              <li>먼저 살펴두고</li><li>당신 몫만 남겨</li><li>때가 오면 알려요</li>
            </ul>
          </div>

          <div className="family-preview" aria-label="로봄 패밀리 앱 미리보기">
            <div className="preview-head"><Wordmark /><span className="live-badge"><i aria-hidden="true" /> 세 앱 운영 중</span></div>
            <div className="preview-chips" aria-hidden="true"><span>날씨</span><span>청약</span><span>러닝</span></div>
            <div className="preview-hero">
              <span className="preview-rule" />
              <p>오늘, 놓치면 아쉬운 신호</p>
              <h2>그 순간이 닿기 전에,<br />미리 준비해 둘 수 있도록.</h2>
              <div className="preview-metrics"><span><b>3개</b>생활 앱</span><span><b>한곳</b>공식 허브</span><span><b>제때</b>행동 알림</span></div>
              <a href="#apps">앱 고르기</a>
            </div>
            <div className="preview-list">{familyApps.map((app) => <span key={app.id}><i className={app.tone} aria-hidden="true" />{app.name}<b>{app.statusLabel}</b></span>)}</div>
          </div>
        </section>

        <section className="apps-section" id="apps" aria-labelledby="apps-title">
          <div className="section-heading">
            <div><p className="eyebrow"><span aria-hidden="true" /> THREE APPS, ONE FAMILY</p><h2 id="apps-title">마음은 하나로,<br />지키는 순간은 저마다 또렷하게.</h2></div>
            <p>세 앱은 같은 마음과 같은 약속으로 만들어졌습니다. 다만 바라보는 곳이 다를 뿐 — 하나는 하늘을, 하나는 기회를, 하나는 출발선을 지킵니다.</p>
          </div>
          <div className="app-card-grid">
            {familyApps.map((app) => (
              <article className={`family-card ${app.tone}`} key={app.id}>
                <div className="appbar"><AppGlyph app={app} /><div><Wordmark app={app} /><p>robom · {app.tagline}</p></div><span className="status-pill">{app.statusLabel}</span></div>
                <div className="filter-row" aria-label={`${app.name} 주요 기능`}>{app.highlights.map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}</div>
                <div className="app-hero-card"><span className="card-rule" /><p className="card-eyebrow">{app.eyebrow}</p><h3>{app.heroTitle}</h3><p>{app.heroBody}</p><div className="metric-row">{app.metrics.map((metric) => <span key={metric.label}><b>{metric.value}</b><small>{metric.label}</small></span>)}</div><a className="card-cta" href={app.webUrl} target="_blank" rel="noopener noreferrer">{app.name} 웹으로 열기 <span aria-hidden="true">↗</span></a></div>
                <div className="short-list"><strong>이 앱이 챙기는 것</strong>{app.highlights.slice(0, 2).map((item, index) => <span key={item}>{item}<b>{index === 0 ? "핵심" : "보기"}</b></span>)}</div>
                <div className="ad-placeholder" aria-label="광고 영역 비활성"><span>광고</span><p>추천 정보 영역 · 현재 비활성</p><b>OFF</b></div>
                <Link className="web-access" href={app.hubPath}>{app.name} 소개 자세히 <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="standard-section" aria-labelledby="standard-title">
          <div><p className="eyebrow"><span aria-hidden="true" /> THE ROBOM STANDARD</p><h2 id="standard-title">익숙한 골격,<br />각 앱다운 디테일.</h2><p>큰 앱바, 쉬운 필터, 핵심 카드, 한 손에 닿는 버튼과 하단 내비를 공통으로 사용합니다. 색과 데이터 표현은 서비스 목적에 맞게 달라집니다.</p></div>
          <ol><li><span>01</span><div><b>한눈에 이해합니다.</b><p>첫 화면에서 오늘 가장 중요한 신호와 다음 행동을 확인합니다.</p></div></li><li><span>02</span><div><b>한 손으로 움직입니다.</b><p>모바일 버튼과 탭은 충분히 크고 기기 안전 영역을 침범하지 않습니다.</p></div></li><li><span>03</span><div><b>앱 사이를 잃지 않습니다.</b><p>안정적인 로봄 허브에서 다른 패밀리 앱과 지원 정보로 이동합니다.</p></div></li></ol>
        </section>

        <section className="support-band" aria-labelledby="support-title"><div><p>문의 · 광고 · 제휴</p><h2 id="support-title">궁금한 내용은 한곳으로 편하게 보내주세요.</h2><span>서비스 문의와 광고·제휴 제안 모두 hello.robom@gmail.com에서 확인합니다.</span></div><a className="button light" href="mailto:hello.robom@gmail.com?subject=%5B%EB%A1%9C%EB%B4%84%5D%20%EB%AC%B8%EC%9D%98%C2%B7%EA%B4%91%EA%B3%A0%2F%EC%A0%9C%ED%9C%B4">이메일 보내기 <span aria-hidden="true">→</span></a></section>
      </main>
      <FamilyFooter />
      <MobileNav />
    </div>
  );
}
