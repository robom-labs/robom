import type { Metadata } from "next";
import { AppPrivacyPage } from "../app-privacy";

export const metadata: Metadata = {
  title: "러닝봄 개인정보처리방침",
  description: "러닝봄의 대회 알림·권한 안내·동기화 정보 기기 저장과 공식 접수 사이트 이동 범위를 설명합니다.",
  alternates: { canonical: "/privacy/runningbom" },
};

export default function RunningBomPrivacy() {
  return <AppPrivacyPage app={{
    name: "러닝봄",
    purpose: "공개 러닝 대회 일정과 접수 정보를 정리하고 사용자가 선택한 로컬 알림을 제공합니다.",
    local: "웹에서는 대회 알림, 권한 안내 확인 여부와 마지막 데이터 동기화 정보를 브라우저 기기에 저장합니다. 네이티브 앱에서는 선택한 대회 알림 예약 정보만 기기의 안전한 앱 저장소와 운영체제 알림 기능에 저장합니다. 회원 계정은 운영하지 않습니다.",
    external: "대회 접수 버튼을 누르면 각 대회의 공식 접수 사이트로 이동합니다. 알림 설정과 관심 대회 정보는 현재 로봄 서버로 전송하지 않으며, 로컬 알림은 사용자가 직접 권한을 허용했을 때만 기기에서 표시됩니다.",
  }} />;
}
