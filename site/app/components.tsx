// 로봄 패밀리 전 페이지에서 공유하는 브랜드와 내비게이션 UI를 제공한다.
/* eslint-disable @next/next/no-img-element -- 로컬 SVG는 변환 없이 직접 제공해 이미지 런타임을 싣지 않는다. */
import type { ReactNode } from "react";
import Link from "next/link";
import { contactHref, familyApps, SITE_BUILD_SHA, SITE_VERSION, type FamilyApp } from "./app-data";

export function Wordmark({ app }: { app?: FamilyApp }) {
  const prefix = app?.prefix ?? "로";
  const asset = app ? `/brand/bom-${app.id}.svg` : "/brand/bom-robom.svg";

  return (
    <span className={`wordmark ${app?.tone ?? "robom"}`}>
      <span className="sr-only">{app?.name ?? "로봄"}</span>
      <span aria-hidden="true">{prefix}</span>
      <img src={asset} alt="" aria-hidden="true" width={200} height={120} />
    </span>
  );
}

export function AppGlyph({ app, large = false }: { app: FamilyApp; large?: boolean }) {
  return (
    <span className={`app-glyph ${app.tone}${large ? " large" : ""}`} aria-hidden="true">
      <img src={`/icons/${app.id}.svg`} alt="" width={64} height={64} />
    </span>
  );
}

export function RobomIcon() {
  return <img className="robom-icon" src="/icons/robom.svg" alt="" aria-hidden="true" width={64} height={64} />;
}

export function FamilyIcon({ name }: { name: "home" | "family" | "info" | "install" | "search" | "settings" }) {
  return <svg className="family-line-icon" aria-hidden="true" viewBox="0 0 24 24"><use href={`/family/icons.svg#family-icon-${name}`} /></svg>;
}

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="로봄 홈" prefetch={false}>
        <RobomIcon />
        <Wordmark />
        <span>중요한 순간을 먼저 보는 앱 스튜디오</span>
      </Link>
      <nav className="desktop-nav" aria-label="주요 메뉴">
        <Link href="/#apps" prefetch={false}>앱</Link>
        <Link href="/support" prefetch={false} aria-current={current === "support" ? "page" : undefined}>지원</Link>
        <Link href="/privacy" prefetch={false} aria-current={current === "privacy" ? "page" : undefined}>개인정보</Link>
      </nav>
    </header>
  );
}

export function MobileNav({ current = "home" }: { current?: string }) {
  return (
    <nav className="mobile-tabbar" aria-label="하단 메뉴">
      <Link href="/" prefetch={false} aria-current={current === "home" ? "page" : undefined}><FamilyIcon name="home" />홈</Link>
      <Link href="/#apps" prefetch={false} aria-current={current === "apps" ? "page" : undefined}><FamilyIcon name="family" />앱</Link>
      <Link href="/support" prefetch={false} aria-current={current === "support" ? "page" : undefined}><FamilyIcon name="info" />지원</Link>
      <Link href="/#about" prefetch={false} aria-current={current === "about" ? "page" : undefined}><FamilyIcon name="settings" />정보</Link>
    </nav>
  );
}

export function FamilyFooter() {
  return (
    <footer className="family-footer" id="about">
      <div className="footer-brand">
        <Wordmark />
        <p>먼저 보고, 필요한 순간에 분명하게 알립니다.</p>
      </div>
      <div className="footer-links" aria-label="앱과 지원 링크">
        <div><strong>로봄 패밀리</strong>{familyApps.map((app) => <Link href={app.hubPath} prefetch={false} key={app.id}>{app.name}</Link>)}</div>
        <div><strong>지원</strong><a href={contactHref()}>문의 · 광고 · 제휴</a><Link href="/support" prefetch={false}>고객 지원</Link></div>
        <div><strong>정보</strong><Link href="/privacy" prefetch={false}>개인정보처리방침</Link><Link href="/terms" prefetch={false}>이용약관</Link><Link href="/licenses" prefetch={false}>오픈소스 라이선스</Link><a href="https://robom.kr">robom.kr</a></div>
      </div>
      <div className="footer-meta" data-nosnippet data-build-sha={SITE_BUILD_SHA}><span>개발자 로봄</span><span>hello.robom@gmail.com</span><span>웹 v{SITE_VERSION}</span><span>build {SITE_BUILD_SHA.slice(0, 7)}</span><span>© 2026 ROBOM</span></div>
    </footer>
  );
}

export function PageShell({ children, current }: { children: ReactNode; current?: string }) {
  return <><SiteHeader current={current} /><main id="main">{children}</main><FamilyFooter /><MobileNav current={current} /></>;
}
