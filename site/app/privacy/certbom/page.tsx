// 자격증봄의 기기 저장 정보와 공식 외부 링크 사용 범위를 안내한다.
import type { Metadata } from "next";
import { AppPrivacyPage } from "../app-privacy";

export const metadata: Metadata = {
  title: "자격증봄 개인정보처리방침",
  description: "자격증봄의 관심 시험·준비물·추천 답변 기기 저장과 공식 시행기관 사이트 이동 범위를 설명합니다.",
  alternates: { canonical: "/privacy/certbom" },
};

export default function CertBomPrivacy() {
  return <AppPrivacyPage app={{
    name: "자격증봄",
    purpose: "공개된 자격증 시험 일정과 준비물을 정리하고, 사용자가 답한 질문에 따라 탐색 우선순위를 추천합니다.",
    local: "웹에서는 관심 시험, 준비물 확인, 추천 답변과 글자 크기 설정을 브라우저 기기에 저장합니다. 네이티브 앱에서는 관심 시험 목록과 사용자가 직접 예약한 로컬 알림만 기기의 안전한 앱 저장소와 운영체제 알림 기능에 저장합니다. 현재 회원 계정이나 서버 사용자 프로필은 운영하지 않습니다.",
    external: "공식 일정과 세부 기준을 확인하는 버튼을 누르면 Q-Net, 국사편찬위원회, 대한상공회의소 등 각 시행기관 사이트로 이동합니다. 자격증봄은 정부 또는 시행기관을 대표하지 않는 독립 정보 도구이며, 관심 시험과 추천 답변은 현재 로봄 서버로 전송하지 않습니다.",
  }} />;
}
