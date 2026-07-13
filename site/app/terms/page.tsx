// 로봄 공식 사이트와 앱 연결 정보의 이용 조건을 안내한다.
import type { Metadata } from "next";
import { PageShell } from "../components";

export const metadata: Metadata = { title: "이용약관", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <PageShell current="terms"><article className="legal-page"><p className="eyebrow"><span aria-hidden="true" /> TERMS</p><h1>이용약관</h1><p className="legal-date">시행일 2026년 7월 12일</p><section><h2>1. 목적</h2><p>이 약관은 로봄이 제공하는 공식 사이트와 패밀리 앱 안내 정보의 기본 이용 조건을 설명합니다.</p></section><section><h2>2. 정보의 성격</h2><p>날씨, 청약 공고, 러닝 대회 일정은 이해와 탐색을 돕는 정보입니다. 최종 신청·접수·외출 판단 전에는 각 기관의 공식 정보와 현장 상황을 다시 확인해야 합니다.</p></section><section><h2>3. 서비스 변경</h2><p>데이터 제공처, 운영 환경 또는 안전상 필요에 따라 일부 기능과 연결 주소가 변경될 수 있습니다. 중요한 변경은 가능한 범위에서 사이트나 각 앱에 안내합니다.</p></section><section><h2>4. 금지 행위</h2><p>서비스를 방해하거나 자동화된 방식으로 과도한 요청을 보내는 행위, 타인의 권리를 침해하는 행위를 해서는 안 됩니다.</p></section><section><h2>5. 문의</h2><p>서비스 문의는 <a href="mailto:hello.robom@gmail.com">hello.robom@gmail.com</a>으로 보내주세요.</p></section></article></PageShell>;
}
