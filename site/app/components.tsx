// 로봄 패밀리 전 페이지에서 공유하는 브랜드와 내비게이션 UI를 제공한다.
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { contactHref, familyApps, type FamilyApp } from "./app-data";

export function Wordmark({ app }: { app?: FamilyApp }) {
  const prefix = app?.prefix ?? "로";
  const asset = app ? `/brand/bom-${app.id}.svg` : "/brand/bom-robom.svg";

  return (
    <span className={`wordmark ${app?.tone ?? "robom"}`} aria-label={app?.name ?? "로봄"}>
      <span aria-hidden="true">{prefix}</span>
      <Image src={asset} alt="" aria-hidden="true" width={200} height={120} unoptimized />
    </span>
  );
}

export function AppGlyph({ app, large = false }: { app: FamilyApp; large?: boolean }) {
  return (
    <span className={`app-glyph ${app.tone}${large ? " large" : ""}`} aria-hidden="true">
      {app.symbol}
    </span>
  );
}

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="로봄 홈">
        <Wordmark />
        <span>중요한 순간을 먼저 보는 앱 스튜디오</span>
      </Link>
      <nav className="desktop-nav" aria-label="주요 메뉴">
        <Link href="/#apps">앱</Link>
        <Link href="/support" aria-current={current === "support" ? "page" : undefined}>지원</Link>
        <Link href="/privacy" aria-current={current === "privacy" ? "page" : undefined}>개인정보</Link>
      </nav>
    </header>
  );
}

export function MobileNav({ current = "home" }: { current?: string }) {
  return (
    <nav className="mobile-tabbar" aria-label="하단 메뉴">
      <Link href="/" aria-current={current === "home" ? "page" : undefined}><span aria-hidden="true">⌂</span>홈</Link>
      <Link href="/#apps" aria-current={current === "apps" ? "page" : undefined}><span aria-hidden="true">⌑</span>앱</Link>
      <Link href="/support" aria-current={current === "support" ? "page" : undefined}><span aria-hidden="true">?</span>지원</Link>
      <Link href="/#about" aria-current={current === "about" ? "page" : undefined}><span aria-hidden="true">ⓘ</span>정보</Link>
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
        <div><strong>로봄 패밀리</strong>{familyApps.map((app) => <Link href={app.hubPath} key={app.id}>{app.name}</Link>)}</div>
        <div><strong>지원</strong><a href={contactHref("general")}>문의 · 광고 · 제휴</a><Link href="/support">고객 지원</Link></div>
        <div><strong>정보</strong><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link><Link href="/licenses">오픈소스 라이선스</Link><a href="https://robom.kr">robom.kr</a></div>
      </div>
      <div className="footer-meta"><span>개발자 로봄</span><span>hello.robom@gmail.com</span><span>웹 v1.4.0</span><span>© 2026 ROBOM</span></div>
    </footer>
  );
}

export function PageShell({ children, current }: { children: ReactNode; current?: string }) {
  return <><SiteHeader current={current} /><main id="main">{children}</main><FamilyFooter /><MobileNav current={current} /></>;
}
