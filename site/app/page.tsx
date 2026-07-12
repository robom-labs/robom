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
      <main>
        <section className="family-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span aria-hidden="true" /> ROBOM FAMILY</p>
            <h1 id="hero-title">놓치고 싶지 않은 순간을<br /><em>먼저 봅니다.</em></h1>
            <p className="hero-lead">날씨가 좋아질 때, 기회가 열릴 때, 대회 접수가 시작될 때. 로봄은 더 많은 정보보다 지금 할 수 있는 다음 행동을 선명하게 알려드립니다.</p>
            <div className="hero-actions">
              <a className="button primary" href="#apps">세 앱 만나기 <span aria-hidden="true">↓</span></a>
              <Link className="button secondary" href="/support">도움받기</Link>
            </div>
            <ul className="trust-list" aria-label="로봄의 제품 원칙">
              <li>먼저 살펴보고</li><li>필요한 것만 골라</li><li>움직일 때 알려요</li>
            </ul>
          </div>

          <div className="family-preview" aria-label="로봄 패밀리 앱 미리보기">
            <div className="preview-head"><Wordmark /><span className="live-badge"><i aria-hidden="true" /> 세 앱 운영 중</span></div>
            <div className="preview-chips" aria-hidden="true"><span>날씨</span><span>청약</span><span>러닝</span></div>
            <div className="preview-hero">
              <span className="preview-rule" />
              <p>오늘의 중요한 신호</p>
              <h2>좋은 순간이 오기 전에<br />준비할 수 있도록.</h2>
              <div className="preview-metrics"><span><b>3개</b>생활 앱</span><span><b>한곳</b>공식 허브</span><span><b>제때</b>행동 알림</span></div>
              <a href="#apps">앱 고르기</a>
            </div>
            <div className="preview-list">{familyApps.map((app) => <span key={app.id}><i className={app.tone} aria-hidden="true" />{app.name}<b>{app.statusLabel}</b></span>)}</div>
          </div>
        </section>

        <section className="apps-section" id="apps" aria-labelledby="apps-title">
          <div className="section-heading">
            <div><p className="eyebrow"><span aria-hidden="true" /> THREE APPS, ONE FAMILY</p><h2 id="apps-title">큰 느낌은 하나로,<br />필요한 순간은 각자 정확하게.</h2></div>
            <p>세 앱은 같은 사용법과 신뢰 기준을 공유하고, 날씨·청약·러닝이라는 각자의 데이터에 집중합니다.</p>
          </div>
          <div className="app-card-grid">
            {familyApps.map((app) => (
              <article className={`family-card ${app.tone}`} key={app.id}>
                <div className="appbar"><AppGlyph app={app} /><div><Wordmark app={app} /><p>robom · {app.tagline}</p></div><span className="status-pill">{app.statusLabel}</span></div>
                <div className="filter-row" aria-label={`${app.name} 주요 기능`}>{app.highlights.map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}</div>
                <div className="app-hero-card"><span className="card-rule" /><p className="card-eyebrow">{app.eyebrow}</p><h3>{app.heroTitle}</h3><p>{app.heroBody}</p><div className="metric-row">{app.metrics.map((metric) => <span key={metric.label}><b>{metric.value}</b><small>{metric.label}</small></span>)}</div><Link className="card-cta" href={app.hubPath}>자세히 보기 <span aria-hidden="true">→</span></Link></div>
                <div className="short-list"><strong>이 앱이 챙기는 것</strong>{app.highlights.slice(0, 2).map((item, index) => <span key={item}>{item}<b>{index === 0 ? "핵심" : "보기"}</b></span>)}</div>
                <div className="ad-placeholder" aria-label="광고 영역 비활성"><span>광고</span><p>추천 정보 영역 · 현재 비활성</p><b>OFF</b></div>
                <a className="web-access" href={app.webUrl}>{app.accessLabel} <span aria-hidden="true">↗</span></a>
              </article>
            ))}
          </div>
        </section>

        <section className="standard-section" aria-labelledby="standard-title">
          <div><p className="eyebrow"><span aria-hidden="true" /> THE ROBOM STANDARD</p><h2 id="standard-title">익숙한 골격,<br />각 앱다운 디테일.</h2><p>큰 앱바, 쉬운 필터, 핵심 카드, 한 손에 닿는 버튼과 하단 내비를 공통으로 사용합니다. 색과 데이터 표현은 서비스 목적에 맞게 달라집니다.</p></div>
          <ol><li><span>01</span><div><b>한눈에 이해합니다.</b><p>첫 화면에서 오늘 가장 중요한 신호와 다음 행동을 확인합니다.</p></div></li><li><span>02</span><div><b>한 손으로 움직입니다.</b><p>모바일 버튼과 탭은 충분히 크고 기기 안전 영역을 침범하지 않습니다.</p></div></li><li><span>03</span><div><b>앱 사이를 잃지 않습니다.</b><p>안정적인 로봄 허브에서 다른 패밀리 앱과 지원 정보로 이동합니다.</p></div></li></ol>
        </section>

        <section className="support-band" aria-labelledby="support-title"><div><p>지원과 제휴</p><h2 id="support-title">궁금한 점은 로봄에 바로 알려주세요.</h2><span>일반 문의와 광고·제휴 문의를 구분해 더 빠르게 확인합니다.</span></div><Link className="button light" href="/support">지원 페이지 열기 <span aria-hidden="true">→</span></Link></section>
      </main>
      <FamilyFooter />
      <MobileNav />
    </div>
  );
}
