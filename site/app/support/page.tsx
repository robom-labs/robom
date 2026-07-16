// 서비스 문의와 광고·제휴를 하나의 연락 창구로 안내하는 고객 지원 페이지다.
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components";
import { contactHref, familyApps, SITE_VERSION } from "../app-data";

export const metadata: Metadata = { title: "고객 지원", alternates: { canonical: "/support" } };

export default function SupportPage() {
  return (
    <PageShell current="support">
      <section className="info-page"><p className="eyebrow"><span aria-hidden="true" /> SUPPORT</p><h1>무엇을 도와드릴까요?</h1><p className="info-lead">서비스 사용, 데이터, 알림, 광고와 제휴 제안을 한 이메일에서 함께 확인합니다. 개인정보나 인증번호는 이메일에 적지 마세요.</p><div className="contact-grid contact-grid--single"><a href={contactHref()}><span aria-hidden="true">✦</span><div><strong>문의 · 광고 · 제휴</strong><p>앱 사용과 오류부터 브랜드 제휴, 콘텐츠 협업, 광고 운영 제안까지 편하게 남겨주세요.</p><small>hello.robom@gmail.com →</small></div></a></div><section className="support-list"><h2>앱별 정보</h2>{familyApps.map((app) => <Link href={app.hubPath} prefetch={false} key={app.id}><span><b>{app.name}</b><small>{app.description}</small></span><em>v{app.version}</em></Link>)}</section><div className="notice-box"><strong>광고 운영 상태</strong><p>현재 로봄 사이트에는 활성 광고가 없습니다. 광고는 정책·동의·광고 식별 기준을 준비한 뒤에만 연결합니다.</p></div><p className="version-note">로봄 웹 v{SITE_VERSION} · 개발자 로봄</p></section>
    </PageShell>
  );
}
