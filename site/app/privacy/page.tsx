// 로봄 공식 사이트의 최소 개인정보 처리 원칙을 설명한다.
import type { Metadata } from "next";
import { PageShell } from "../components";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "robom.kr과 로봄 패밀리 앱 안내 사이트의 개인정보 처리, 이메일 문의 보관과 외부 서비스 이동 기준을 설명합니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <PageShell current="privacy"><article className="legal-page"><p className="eyebrow"><span aria-hidden="true" /> PRIVACY</p><h1>개인정보처리방침</h1><p className="legal-date">시행일 2026년 7월 17일</p><section><h2>1. 이 사이트가 하는 일</h2><p>robom.kr은 로봄 패밀리 앱을 소개하고 각 서비스의 공식 웹 주소와 문의 채널을 안내합니다. 이 사이트 자체에는 회원가입, 결제, 위치 수집 또는 광고 추적 기능이 없습니다.</p></section><section><h2>2. 문의 이메일</h2><p>사용자가 이메일로 문의하면 답변에 필요한 이메일 주소와 사용자가 직접 적은 내용을 처리합니다. 문의 해결과 분쟁 대응에 필요한 기간 동안 보관한 뒤 관련 법령에 따른 의무가 없으면 삭제합니다.</p></section><section><h2>3. 외부 서비스</h2><p>각 앱의 웹 이용 버튼을 누르면 별도 운영되는 야외봄·청약봄·러닝봄·자격증봄 서비스로 이동합니다. 각 앱의 데이터와 브라우저 저장 정보는 해당 앱에서 안내하는 기준을 따릅니다.</p></section><section><h2>4. 문의</h2><p>개인정보 관련 문의는 <a href="mailto:hello.robom@gmail.com">hello.robom@gmail.com</a>으로 보내주세요.</p></section></article></PageShell>;
}
