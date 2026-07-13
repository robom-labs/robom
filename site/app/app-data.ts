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
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  metrics: readonly { value: string; label: string }[];
  highlights: readonly string[];
};

export const SITE_VERSION = "1.7.4";

// 값의 정본은 ../../ops/registry/apps.yml이며 렌더링 테스트에서 URL과 버전의 일치를 검증한다.
export const familyApps: readonly FamilyApp[] = [
  {
    id: "outbom",
    name: "야외봄",
    englishName: "OutBom",
    prefix: "야외",
    tagline: "바람이 당신을 부르는 때",
    description: "날씨와 대기질로 야외활동하기 좋은 시간을 알려주는 앱",
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.20.0",
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
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.7.0",
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
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "웹으로 이용",
    version: "0.13.0",
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
] as const;

export function getFamilyApp(id: string) {
  return familyApps.find((app) => app.id === id);
}

export function contactHref(context = "로봄 웹사이트") {
  const subject = `[${context}] 문의·광고·제휴 · v${SITE_VERSION}`;
  return `mailto:hello.robom@gmail.com?subject=${encodeURIComponent(subject)}`;
}
