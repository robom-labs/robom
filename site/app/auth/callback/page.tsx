// 외부 인증이 아직 연결되지 않은 상태에서 민감 값을 노출하지 않고 guest 사용으로 복귀시킨다.
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../../components";
import { AuthQueryScrubber } from "./auth-query-scrubber";

export const metadata: Metadata = {
  title: { absolute: "로봄 계정 연결" },
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <PageShell current="about">
      <AuthQueryScrubber />
      <section className="legal-page auth-callback-page">
        <p className="eyebrow"><span aria-hidden="true" /> GUEST FIRST</p>
        <h1>계정 없이도<br />계속 사용할 수 있어요.</h1>
        <p className="info-lead">공통 계정 공급자가 아직 연결되지 않았거나 연결 요청이 끝나지 않았습니다. 이 화면은 인증 코드·토큰·이메일을 표시하거나 저장하지 않습니다.</p>
        <div className="policy-actions">
          <Link className="button primary" href="/" prefetch={false}>로봄 앱 선택으로 돌아가기</Link>
          <Link className="button secondary" href="/support" prefetch={false}>계정 연결 도움 받기</Link>
        </div>
      </section>
    </PageShell>
  );
}
