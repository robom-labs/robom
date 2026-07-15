import type { Metadata } from "next";
import { AppPrivacyPage } from "../app-privacy";

export const metadata: Metadata = { title: "캘린더봄 개인정보처리방침", alternates: { canonical: "/privacy/calendarbom" } };

export default function CalendarBomPrivacy() {
  return <AppPrivacyPage app={{
    name: "캘린더봄",
    purpose: "사용자가 직접 입력한 일정과 알람을 큰 달력으로 보여주고, 선택한 시각에 로컬 알림을 제공합니다.",
    local: "일정 내용, 사람 이름과 관계(선택 사항), 약 이름과 복용 확인 기록(의학적 건강기록이 아닌 편의용 확인 기록), 알람 시점, 글자 크기 설정은 모두 사용자의 브라우저 기기에만 저장됩니다. 복용 확인 기록은 설정에서 보관 기간(7·30·90일)을 정하거나 전체 삭제할 수 있습니다. 회원 계정은 운영하지 않습니다.",
    external: "일정·사람·복용 기록은 로봄 서버나 분석 도구로 전송하지 않습니다. 보관용 JSON·ICS 파일은 사용자가 직접 내려받아 관리하며, 일정 한 건 공유는 사용자가 미리보기로 확인한 내용만 전달됩니다.",
  }} />;
}
