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
  return app ? {
    title: { absolute: app.metadataTitle },
    description: app.metadataDescription,
    alternates: { canonical: app.hubPath },
    openGraph: {
      title: app.metadataTitle,
      description: app.metadataDescription,
      url: app.hubPath,
      siteName: "로봄",
      locale: "ko_KR",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "따뜻한 색의 타이밍 신호로 표현한 로봄 알림 앱 스튜디오" }],
    },
    twitter: { card: "summary_large_image", title: app.metadataTitle, description: app.metadataDescription, images: ["/og.png"] },
  } : {};
}

export default async function AppLanding({ params }: { params: Promise<{ id: string }> }) {
  const app = getFamilyApp((await params).id);
  if (!app) notFound();
  const otherApps = familyApps.filter((item) => item.id !== app.id);

  return (
    <PageShell current="apps">
      <section className={`product-page ${app.tone}`}>
        <nav className="breadcrumb" aria-label="현재 위치">
          <Link href="/" prefetch={false}>로봄</Link><span aria-hidden="true">›</span><span aria-current="page">{app.name}</span>
        </nav>
        <div className="product-appbar"><AppGlyph app={app} large /><div><Wordmark app={app} /><p>robom · {app.tagline}</p></div><span className="status-pill">{app.statusLabel}</span></div>
        <div className="product-chips" aria-label={`${app.name} 주요 기능`} role="group" tabIndex={0}>{app.highlights.map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}</div>
        <div className="product-hero"><div className="product-copy"><p className="card-eyebrow">{app.eyebrow}</p><h1>{app.heroTitle}</h1><p>{app.heroBody}</p><div className="product-actions"><Link className="button primary" href={app.installPath} prefetch={false}>{app.accessLabel} <span aria-hidden="true">→</span></Link><a className="button secondary" href={app.webUrl} target="_blank" rel="noopener noreferrer">웹으로 먼저 체험 <span aria-hidden="true">↗</span></a></div><a className="product-contact" href={contactHref(app.name)}>문의·의견 보내기</a></div><div className="product-score" aria-label={`${app.name} 버전`}><small>현재 버전</small><strong>v{app.version}</strong><span>{app.mobileStatus.toUpperCase()}</span></div></div>
        <div className="product-metrics">{app.metrics.map((metric) => <span key={metric.label}><b>{metric.value}</b><small>{metric.label}</small></span>)}</div>

        <section className="feature-section" aria-labelledby="feature-title"><div><p className="eyebrow"><span aria-hidden="true" /> WHAT IT DOES</p><h2 id="feature-title">{app.name}이 챙기는 것</h2></div><div className="feature-list">{app.highlights.map((item, index) => <article key={item}><span>0{index + 1}</span><div><h3>{item}</h3><p>{index === 0 ? app.description : "복잡한 정보는 줄이고 지금 확인하거나 행동할 내용을 먼저 보여줍니다."}</p></div></article>)}</div></section>

        <section className="family-menu" aria-labelledby="family-menu-title"><div><p>로봄 패밀리</p><h2 id="family-menu-title">다른 순간도 함께 챙겨보세요.</h2></div><div>{otherApps.map((item) => <Link href={item.hubPath} prefetch={false} key={item.id}><AppGlyph app={item} /><span><Wordmark app={item} /><small>{item.tagline}</small></span><b>보기 →</b></Link>)}</div></section>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "로봄", item: "https://robom.kr/" },
                { "@type": "ListItem", position: 2, name: app.name, item: `https://robom.kr${app.hubPath}` },
              ],
            }),
          }}
        />
      </section>
    </PageShell>
  );
}
