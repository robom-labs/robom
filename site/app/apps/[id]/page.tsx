// 각 로봄 앱의 안정 주소에서 가치와 실제 웹 진입 경로를 안내한다.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppGlyph, PageShell, Wordmark } from "../../components";
import { contactHref, familyApps, getFamilyApp } from "../../app-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return familyApps.map((app) => ({ id: app.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const app = getFamilyApp((await params).id);
  return app ? { title: app.name, description: app.description } : {};
}

export default async function AppLanding({ params }: { params: Promise<{ id: string }> }) {
  const app = getFamilyApp((await params).id);
  if (!app) notFound();
  const otherApps = familyApps.filter((item) => item.id !== app.id);

  return (
    <PageShell current="apps">
      <section className={`product-page ${app.tone}`}>
        <div className="product-appbar"><AppGlyph app={app} large /><div><Wordmark app={app} /><p>robom · {app.tagline}</p></div><span className="status-pill">{app.statusLabel}</span></div>
        <div className="product-chips">{app.highlights.map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}</div>
        <div className="product-hero"><div className="product-copy"><p className="card-eyebrow">{app.eyebrow}</p><h1>{app.heroTitle}</h1><p>{app.heroBody}</p><div className="product-actions"><a className="button primary" href={app.webUrl}>{app.accessLabel} <span aria-hidden="true">↗</span></a><a className="button secondary" href={contactHref("general", app.name)}>문의하기</a></div></div><div className="product-score" aria-label={`${app.name} 버전`}><small>현재 버전</small><strong>v{app.version}</strong><span>WEB PWA</span></div></div>
        <div className="product-metrics">{app.metrics.map((metric) => <span key={metric.label}><b>{metric.value}</b><small>{metric.label}</small></span>)}</div>

        <section className="feature-section" aria-labelledby="feature-title"><div><p className="eyebrow"><span aria-hidden="true" /> WHAT IT DOES</p><h2 id="feature-title">{app.name}이 챙기는 것</h2></div><div className="feature-list">{app.highlights.map((item, index) => <article key={item}><span>0{index + 1}</span><div><h3>{item}</h3><p>{index === 0 ? app.description : "복잡한 정보는 줄이고 지금 확인하거나 행동할 내용을 먼저 보여줍니다."}</p></div></article>)}</div></section>

        <section className="family-menu" aria-labelledby="family-menu-title"><div><p>로봄 패밀리</p><h2 id="family-menu-title">다른 순간도 함께 챙겨보세요.</h2></div><div>{otherApps.map((item) => <Link href={item.hubPath} key={item.id}><AppGlyph app={item} /><span><Wordmark app={item} /><small>{item.tagline}</small></span><b>보기 →</b></Link>)}</div></section>
      </section>
    </PageShell>
  );
}
