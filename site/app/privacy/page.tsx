// 로봄 패밀리(야외봄·청약봄·러닝봄) 공통 개인정보처리방침. 스토어 등록용 공개 정본.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className="policy-page">
      <Link className="policy-back" href="/">← 로봄 홈</Link>
      <h1>개인정보처리방침</h1>
      <p className="policy-updated">시행일: 2026년 7월 12일 · 제공: 로봄</p>

      <section>
        <h2>1. 수집하는 정보</h2>
        <p>
          로봄의 앱(야외봄·청약봄·러닝봄)은 회원가입이나 계정이 없으며, 이름·연락처 같은
          개인 식별 정보를 수집하지 않습니다. 알림 설정과 관심 항목은 사용자의 기기
          안(브라우저·앱 저장소)에만 저장됩니다.
        </p>
      </section>
      <section>
        <h2>2. 위치 정보 (야외봄)</h2>
        <p>
          야외봄은 날씨·대기질 조회를 위해 사용자가 허용한 경우에만 현재 위치 또는 입력한
          지역명을 사용합니다. 위치는 예보 조회 목적으로만 쓰이며 로봄 서버에 저장하지
          않습니다.
        </p>
      </section>
      <section>
        <h2>3. 알림</h2>
        <p>
          알림은 기기(브라우저) 알림 권한을 통해 제공되며, 언제든 기기 설정에서 끌 수
          있습니다. 알림 예약 정보는 기기 안에만 저장됩니다.
        </p>
      </section>
      <section>
        <h2>4. 광고</h2>
        <p>
          일부 화면에 광고가 표시될 수 있습니다. 광고 제공사(예: Google AdMob·AdSense)는
          자체 정책에 따라 광고 식별자를 사용할 수 있으며, 자세한 내용은 해당 제공사의
          개인정보 정책을 따릅니다.
        </p>
      </section>
      <section>
        <h2>5. 계정·데이터 삭제</h2>
        <p>
          계정이 없으므로 삭제할 서버 데이터가 없습니다. 기기 안 데이터는 앱 삭제 또는
          브라우저 데이터 삭제로 즉시 제거됩니다.
        </p>
      </section>
      <section>
        <h2>6. 문의</h2>
        <p>
          개인정보 관련 문의: <a href="mailto:hello.robom@gmail.com">hello.robom@gmail.com</a>
        </p>
      </section>
    </main>
  );
}
