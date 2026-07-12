// 일반 문의와 광고·제휴 문의를 명확히 구분해 안내하는 고객 지원 페이지다.
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components";
import { contactHref, familyApps, SITE_VERSION } from "../app-data";

export const metadata: Metadata = { title: "고객 지원" };

export default function SupportPage() {
  return (
    <PageShell current="support">
      <section className="info-page"><p className="eyebrow"><span aria-hidden="true" /> SUPPORT</p><h1>무엇을 도와드릴까요?</h1><p className="info-lead">문의 목적을 선택하면 앱명과 웹 버전이 포함된 이메일 제목이 자동으로 만들어집니다. 개인정보나 인증번호는 이메일에 적지 마세요.</p><div className="contact-grid"><a href={contactHref("general")}><span aria-hidden="true">?</span><div><strong>일반 문의</strong><p>앱 사용, 데이터, 알림, 오류와 계정 관련 문의</p><small>hello.robom@gmail.com →</small></div></a><a href={contactHref("partnership")}><span aria-hidden="true">↗</span><div><strong>광고·제휴 문의</strong><p>브랜드 제휴, 콘텐츠 협업과 광고 운영 관련 문의</p><small>hello.robom@gmail.com →</small></div></a></div><section className="support-list"><h2>앱별 정보</h2>{familyApps.map((app) => <Link href={app.hubPath} key={app.id}><span><b>{app.name}</b><small>{app.description}</small></span><em>v{app.version}</em></Link>)}</section><div className="notice-box"><strong>광고 운영 상태</strong><p>현재 로봄 사이트에는 광고 SDK나 활성 광고가 없습니다. 화면의 광고 자리는 향후 정책·동의·광고 식별자가 준비된 뒤에만 활성화합니다.</p></div><p className="version-note">로봄 웹 v{SITE_VERSION} · 개발자 로봄</p></section>
    </PageShell>
  );
}
