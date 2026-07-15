// 자격증봄의 기기 저장 정보와 공식 외부 링크 사용 범위를 안내한다.
import type { Metadata } from "next";
import { AppPrivacyPage } from "../app-privacy";

export const metadata: Metadata = { title: "자격증봄 개인정보처리방침", alternates: { canonical: "/privacy/certbom" } };

export default function CertBomPrivacy() {
  return <AppPrivacyPage app={{
    name: "자격증봄",
    purpose: "공개된 자격증 시험 일정과 준비물을 정리하고, 사용자가 답한 질문에 따라 탐색 우선순위를 추천합니다.",
    local: "관심 시험, 준비물 확인, 추천 답변과 글자 크기 설정은 사용자의 브라우저 기기에 저장됩니다. 현재 회원 계정이나 서버 사용자 프로필은 운영하지 않습니다.",
    external: "공식 일정과 세부 기준을 확인하는 버튼을 누르면 Q-Net, 국사편찬위원회, 대한상공회의소 등 각 시행기관 사이트로 이동합니다. 관심 시험과 추천 답변은 현재 로봄 서버로 전송하지 않습니다.",
  }} />;
}
