// 로봄 패밀리 공통 이용약관. 스토어 등록용 공개 정본.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="policy-page">
      <Link className="policy-back" href="/">← 로봄 홈</Link>
      <h1>이용약관</h1>
      <p className="policy-updated">시행일: 2026년 7월 12일 · 제공: 로봄</p>

      <section>
        <h2>1. 서비스</h2>
        <p>
          로봄은 야외봄(야외활동 추천)·청약봄(청약 접수 알림)·러닝봄(대회 접수 알림)
          앱과 robom.kr 웹사이트를 무료로 제공합니다.
        </p>
      </section>
      <section>
        <h2>2. 정보의 성격</h2>
        <p>
          앱이 보여주는 날씨·공고·대회 정보는 공공·외부 출처를 정리한 참고 정보입니다.
          실제 접수·신청 전에는 반드시 원문(공식 공고·대회 페이지)을 확인해 주세요.
          정보의 지연·오류로 인한 불이익에 대해 로봄은 책임지지 않습니다.
        </p>
      </section>
      <section>
        <h2>3. 알림</h2>
        <p>
          알림은 기기·브라우저 환경에 따라 지연되거나 전달되지 않을 수 있습니다. 중요한
          일정은 알림에만 의존하지 말고 직접 확인해 주세요.
        </p>
      </section>
      <section>
        <h2>4. 서비스 변경</h2>
        <p>서비스 내용은 사전 고지 후 변경·중단될 수 있습니다.</p>
      </section>
      <section>
        <h2>5. 문의</h2>
        <p>
          약관 관련 문의: <a href="mailto:hello.robom@gmail.com">hello.robom@gmail.com</a>
        </p>
      </section>
    </main>
  );
}
