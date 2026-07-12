// 운영 레지스트리와 동기화된 로봄 패밀리 앱 표시 정보를 제공한다.
export type AppId = "outbom" | "homebom" | "runningbom";

export type FamilyApp = {
  id: AppId;
  name: string;
  englishName: string;
  prefix: string;
  tagline: string;
  description: string;
  status: "live";
  statusLabel: string;
  accessLabel: string;
  version: string;
  webUrl: string;
  hubPath: `/apps/${AppId}`;
  tone: "out" | "home" | "run";
  symbol: string;
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  metrics: readonly { value: string; label: string }[];
  highlights: readonly string[];
};

export const SITE_VERSION = "1.4.0";

// 값의 정본은 ../../ops/registry/apps.yml이며 렌더링 테스트에서 URL과 버전의 일치를 검증한다.
export const familyApps: readonly FamilyApp[] = [
  {
    id: "outbom",
    name: "야외봄",
    englishName: "OutBom",
    prefix: "야외",
    tagline: "바깥바람이 좋은 때",
    description: "날씨와 대기질로 야외활동하기 좋은 시간을 알려주는 앱",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.14.0",
    webUrl: "https://runningcall.vercel.app",
    hubPath: "/apps/outbom",
    tone: "out",
    symbol: "☼",
    eyebrow: "오늘의 바깥 신호",
    heroTitle: "나가기 좋은 시간을 먼저 봅니다.",
    heroBody: "기온·비·바람·대기질을 함께 살펴 걷기, 러닝, 자전거처럼 원하는 활동에 맞는 시간을 고릅니다.",
    metrics: [
      { value: "5가지", label: "야외 활동" },
      { value: "시간별", label: "추천 흐름" },
      { value: "오늘·내일", label: "미리 보기" },
    ],
    highlights: ["활동별 날씨 점수", "좋은 시간대 비교", "준비물과 알림"],
  },
  {
    id: "homebom",
    name: "청약봄",
    englishName: "HomeBom",
    prefix: "청약",
    tagline: "다시 없을 기회의 날",
    description: "청약 공고와 접수 시작·마감을 놓치지 않게 챙기는 앱",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.2.0",
    webUrl: "https://robom-labs.github.io/homebom/",
    hubPath: "/apps/homebom",
    tone: "home",
    symbol: "▥",
    eyebrow: "곧 열리는 기회",
    heroTitle: "접수 시작과 마감을 놓치지 않게.",
    heroBody: "실제 청약 공고를 한곳에서 보고, 관심 공고의 접수 시작과 마감 시점을 내 알림으로 챙깁니다.",
    metrics: [
      { value: "실제", label: "공고 정보" },
      { value: "시작·마감", label: "두 번 확인" },
      { value: "내 알림", label: "관심 공고" },
    ],
    highlights: ["접수 일정 한눈에", "정정·취소 주의 표시", "관심 공고 알림"],
  },
  {
    id: "runningbom",
    name: "러닝봄",
    englishName: "RunningBom",
    prefix: "러닝",
    tagline: "출발선에 서는 날",
    description: "러닝 대회 탐색과 접수 시작 시간을 알려주는 앱",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.7.0",
    webUrl: "https://robom-labs.github.io/runningbom/",
    hubPath: "/apps/runningbom",
    tone: "run",
    symbol: "⚑",
    eyebrow: "다가오는 출발선",
    heroTitle: "대회 접수가 열리기 전에 준비합니다.",
    heroBody: "전국 러닝 대회를 탐색하고 거리와 지역을 비교해, 원하는 대회의 접수 시작 시간을 미리 챙깁니다.",
    metrics: [
      { value: "전국", label: "대회 탐색" },
      { value: "거리·지역", label: "조건 비교" },
      { value: "접수 전", label: "미리 알림" },
    ],
    highlights: ["이번 주 접수", "거리·지역 필터", "접수 시작 알림"],
  },
] as const;

export function getFamilyApp(id: string) {
  return familyApps.find((app) => app.id === id);
}

export function contactHref(kind: "general" | "partnership", context = "로봄 웹사이트") {
  const purpose = kind === "general" ? "일반 문의" : "광고·제휴 문의";
  const subject = `[${context}] ${purpose} · v${SITE_VERSION}`;
  return `mailto:hello.robom@gmail.com?subject=${encodeURIComponent(subject)}`;
}
