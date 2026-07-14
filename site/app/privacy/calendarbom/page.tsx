import type { Metadata } from "next";
import { AppPrivacyPage } from "../app-privacy";

export const metadata: Metadata = { title: "캘린더봄 개인정보처리방침", alternates: { canonical: "/privacy/calendarbom" } };

export default function CalendarBomPrivacy() {
  return <AppPrivacyPage app={{
    name: "캘린더봄",
    purpose: "사용자가 직접 입력한 일정과 알람을 큰 달력으로 보여주고, 선택한 시각에 로컬 알림을 제공합니다.",
    local: "일정 내용, 알람 시점, 글자 크기 설정은 모두 사용자의 브라우저 기기에만 저장됩니다. 회원 계정은 운영하지 않습니다.",
    external: "일정 데이터는 로봄 서버로 전송하지 않습니다. 보관용 JSON·ICS 파일은 사용자가 직접 내려받아 관리합니다.",
  }} />;
}
