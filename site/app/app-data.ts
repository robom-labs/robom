// 운영 레지스트리와 동기화된 로봄 패밀리 앱 표시 정보를 제공한다.
export type AppId = "outbom" | "homebom" | "runningbom" | "calendarbom" | "certbom";

export type FamilyApp = {
  id: AppId;
  name: string;
  englishName: string;
  prefix: string;
  tagline: string;
  description: string;
  metadataTitle: string;
  metadataDescription: string;
  mobileValue: string;
  mobileAction: string;
  status: "live";
  statusLabel: string;
  accessLabel: string;
  version: string;
  webUrl: string;
  hubPath: `/apps/${AppId}`;
  tone: "out" | "home" | "run" | "cal" | "cert";
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  metrics: readonly { value: string; label: string }[];
  highlights: readonly string[];
};

export const SITE_VERSION = "2.0.0";

// 값의 정본은 ../../ops/registry/apps.yml이며 렌더링 테스트에서 URL과 버전의 일치를 검증한다.
export const familyApps: readonly FamilyApp[] = [
  {
    id: "outbom",
    name: "야외봄",
    englishName: "OutBom",
    prefix: "야외",
    tagline: "바람이 당신을 부르는 때",
    description: "날씨와 대기질로 야외활동하기 좋은 시간을 알려주는 앱",
    metadataTitle: "야외봄 | 오늘 나가기 좋은 시간과 날씨",
    metadataDescription: "걷기·러닝·등산·자전거에 좋은 시간과 비·바람·대기질, 준비물을 오늘과 내일 예보로 확인하세요.",
    mobileValue: "오늘 나가기 좋은 시간",
    mobileAction: "지금 확인",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.24.0",
    webUrl: "https://robom-labs.github.io/outbom/",
    hubPath: "/apps/outbom",
    tone: "out",
    eyebrow: "오늘, 나가도 좋을 하늘",
    heroTitle: "나가기 좋은 시간을 먼저 봅니다.",
    heroBody: "기온과 비, 바람과 공기를 대신 살펴, 걷기에도 러닝에도 자전거에도 꼭 알맞은 그 한 시간을 찾아 건넵니다.",
    metrics: [
      { value: "5가지", label: "야외 활동" },
      { value: "시간별", label: "추천 흐름" },
      { value: "오늘·내일", label: "미리 보기" },
    ],
    highlights: ["활동별 안전 점수", "2시간 추천 흐름", "실제 예보 준비물"],
  },
  {
    id: "homebom",
    name: "청약봄",
    englishName: "HomeBom",
    prefix: "청약",
    tagline: "다시 오지 않을 그 하루",
    description: "일반공급과 무순위 청약의 접수·발표·계약 일정을 한눈에 챙기는 앱",
    metadataTitle: "청약봄 | 특별공급·1순위·무순위 청약 일정",
    metadataDescription: "특별공급·1순위·2순위·무순위·재공급의 접수와 발표·계약 일정을 달력과 알림으로 확인하세요.",
    mobileValue: "이번 달 접수 일정",
    mobileAction: "일정 보기",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.13.0",
    webUrl: "https://robom-labs.github.io/homebom/",
    hubPath: "/apps/homebom",
    tone: "home",
    eyebrow: "곧, 문이 열립니다",
    heroTitle: "접수 시작과 마감을 놓치지 않게.",
    heroBody: "흩어진 공고를 한자리에 모아 두고, 마음에 둔 그 하나의 시작과 마감을 당신의 알림으로 대신 지킵니다.",
    metrics: [
      { value: "일반·무순위", label: "공식 공고" },
      { value: "월간", label: "전체 일정" },
      { value: "발표·계약", label: "후속 일정" },
    ],
    highlights: ["일반·무순위 일정", "발표·계약 캘린더", "관심 공고 알림"],
  },
  {
    id: "runningbom",
    name: "러닝봄",
    englishName: "RunningBom",
    prefix: "러닝",
    tagline: "다시 출발선에 서는 날",
    description: "러닝 대회 탐색과 접수 시작 시간을 알려주는 앱",
    metadataTitle: "러닝봄 | 마라톤 대회 접수 일정과 알림",
    metadataDescription: "전국 마라톤·러닝 대회를 지역과 거리로 찾고, 공식 접수 일정과 시작 알림을 확인하세요.",
    mobileValue: "곧 열리는 대회 접수",
    mobileAction: "대회 찾기",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.16.0",
    webUrl: "https://robom-labs.github.io/runningbom/",
    hubPath: "/apps/runningbom",
    tone: "run",
    eyebrow: "저 앞, 다가오는 출발선",
    heroTitle: "대회 접수가 열리기 전에 준비합니다.",
    heroBody: "전국의 대회를 펼쳐 두고 거리와 지역을 나란히 견주어, 당신이 달릴 그날의 접수가 열리는 순간을 미리 일러둡니다.",
    metrics: [
      { value: "전국", label: "대회 탐색" },
      { value: "검색·필터", label: "조건 비교" },
      { value: "접수 전", label: "미리 알림" },
    ],
    highlights: ["월간 접수 캘린더", "거리·지역·검색", "접수 시작 알림"],
  },
  {
    id: "calendarbom",
    name: "캘린더봄",
    englishName: "CalendarBom",
    prefix: "캘린더",
    tagline: "날짜를 누르고, 잊지 않게",
    description: "큰 달력에서 날짜를 누르고 버튼만으로 일정과 알람을 저장하는 우리 가족 달력 앱",
    metadataTitle: "캘린더봄 | 큰 달력과 쉬운 알람",
    metadataDescription: "큰 월간 달력에서 날짜를 누르고, 키보드 없이 버튼만으로 병원·약·가족 일정을 알람으로 챙기세요.",
    mobileValue: "우리 가족 일정 알람",
    mobileAction: "달력 열기",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.3.0",
    // robom-labs/calendarbom 저장소 생성 전까지 본사 Pages 아래 임시 경로로 운영한다.
    webUrl: "https://robom-labs.github.io/robom/calendarbom/",
    hubPath: "/apps/calendarbom",
    tone: "cal",
    eyebrow: "잊기 전에, 우리 집 달력",
    heroTitle: "날짜를 누르면, 알람까지 끝.",
    heroBody: "글씨가 큰 달력을 펼쳐 두고, 병원과 약속과 가족의 날을 버튼 몇 번으로 담아 그 시간이 오기 전에 대신 일러드립니다.",
    metrics: [
      { value: "결정 2개", label: "일반 일정 저장" },
      { value: "3단계", label: "큰 글자" },
      { value: "기기 안", label: "개인 보관" },
    ],
    highlights: ["큰 월간 달력", "키보드 없는 저장", "일정 알람"],
  },
  {
    id: "certbom",
    name: "자격증봄",
    englishName: "CertBom",
    prefix: "자격증",
    tagline: "시험 준비가 제때 닿도록",
    description: "97개 시험에서 현재 접수와 공식 일정을 찾고 내게 맞는 자격증을 추천받는 앱",
    metadataTitle: "자격증봄 | 자격증 시험 일정·준비물·추천",
    metadataDescription: "공식 출처 8곳의 자격증 시험 97개와 2026 일정을 확인하고, 현재 접수 중인 시험과 내게 맞는 추천을 받아보세요.",
    mobileValue: "현재 접수와 97개 시험",
    mobileAction: "시험 찾기",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.5.0",
    webUrl: "https://certbom.vercel.app/",
    hubPath: "/apps/certbom",
    tone: "cert",
    eyebrow: "접수부터 시험일까지, 놓치지 않게",
    heroTitle: "무엇을 준비할지 먼저 보여드립니다.",
    heroBody: "공식 출처 8곳의 시험 97개를 한곳에 모아, 지금 접수할 시험과 다음 일정을 먼저 안내합니다.",
    metrics: [
      { value: "97개", label: "시험 탐색" },
      { value: "70개", label: "일정 확인" },
      { value: "8곳", label: "공식 출처" },
    ],
    highlights: ["현재 접수 우선", "별칭·분야 검색", "공식 일정과 준비물"],
  },
] as const;

export function getFamilyApp(id: string) {
  return familyApps.find((app) => app.id === id);
}

export function contactHref(context = "로봄 웹사이트") {
  const subject = `[${context}] 문의·광고·제휴 · v${SITE_VERSION}`;
  return `mailto:hello.robom@gmail.com?subject=${encodeURIComponent(subject)}`;
}
