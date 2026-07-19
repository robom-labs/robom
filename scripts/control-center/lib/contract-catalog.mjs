// 로봄 health contract 카탈로그 정본 — v2.0.0 프롬프트 PART 07~12의 계약을 machine-readable로 전부 정의한다.
// 원칙: 계약은 코드와 분리된 데이터(이 카탈로그에서 ops/health-contracts/*.json 생성), 판정은 evaluator allowlist만,
//   실측 불가 항목은 숨기지 않고 need_new_source로 정직 표기(§18), 주관 문장 threshold 금지.
// 실행기는 오로지 Codex 단일이다(회장 지시) — 계약 수리는 incident→task→Codex 경계로만 넘어간다.

export const CONTRACT_SCHEMA_VERSION = "2.2.0";

// 계약 최소 수(프롬프트 명시) — 게이트 테스트가 검증한다.
export const MIN_CONTRACTS = Object.freeze({
  outbom: 18, homebom: 22, runningbom: 20, calendarbom: 22, certbom: 24, notebom: 26,
  robom: 20, "robom-hq": 20,
});

const DEF = Object.freeze({
  schemaVersion: CONTRACT_SCHEMA_VERSION,
  runTier: "standard",
  required: false,
  enabled: true,
  timeoutMs: 20_000,
  consecutiveFailures: 2,
  recoverySuccesses: 2,
  requiredCapabilities: ["network"],
  sourceUnavailableStatus: "UNAVAILABLE",
  needNewSource: false,
});

function C(id, target, category, evaluator, config, extra = {}) {
  return { ...DEF, id, target, category, evaluator, config, ...extra };
}

const HOSTS = Object.freeze({ pages: "robom-labs.github.io", site: "robom.kr", vercel: "certbom.vercel.app" });
const SECRET_PATTERNS = ["-----BEGIN PRIVATE KEY", "service_role", "SUPABASE_SERVICE", "AKIA", "sk-proj-", "sk-ant-", "ghp_", "KakaoAK "];
const PROVIDER_ERROR_MARKERS = ["Application Error", "DEPLOYMENT_NOT_FOUND", "This page could not be found", "There isn't a GitHub Pages site here"];
const ANALYTICS_MARKERS = ["googletagmanager.com", "google-analytics.com", "adsbygoogle", "doubleclick.net"];

// ── 회사 전역 선행 계약(§9.0): 개별 앱 판정 전에 로컬 실행 환경을 먼저 확인 ──
function companyContracts() {
  const t = "company";
  return [
    C("c:company:network-online", t, "network", "company_precondition", { check: "network" },
      { runTier: "cheap", required: true, severityIfFail: "warning", failureClass: "transport",
        what: "로컬 네트워크로 외부 응답을 하나라도 받는지", userImpact: "인터넷 연결이 끊기면 모든 운영 점검이 불가능합니다.",
        recommendedAction: "네트워크 연결을 확인하세요. 연결 복구 시 자동으로 재점검합니다." }),
    C("c:company:dns", t, "network", "dns_resolution", { hosts: [HOSTS.site, HOSTS.pages, HOSTS.vercel] },
      { runTier: "cheap", required: true, severityIfFail: "warning", failureClass: "transport",
        what: "자사 도메인 DNS 해석", userImpact: "DNS가 막히면 모든 앱 접속이 실패합니다.", recommendedAction: "네트워크·DNS 설정을 확인합니다." }),
    C("c:company:github-api", t, "network", "company_precondition", { check: "github" },
      { runTier: "cheap", severityIfFail: "info", failureClass: "quota",
        what: "GitHub REST 접근·rate limit 상태", userImpact: "제한 시 CI·PR 점검이 캐시로 대체됩니다.", recommendedAction: "시간이 지나면 자동 회복됩니다." }),
    C("c:company:clock-skew", t, "self", "company_precondition", { check: "clock", maxSkewMinutes: 5 },
      { runTier: "cheap", severityIfFail: "warning", failureClass: "freshness",
        what: "로컬 시각과 HTTPS Date 헤더 차이 5분 이내", userImpact: "시계가 어긋나면 신선도·마감 판정이 틀립니다.", recommendedAction: "맥의 날짜/시간 자동 설정을 확인합니다." }),
    C("c:company:captive-portal", t, "network", "company_precondition", { check: "captive" },
      { runTier: "cheap", severityIfFail: "warning", failureClass: "transport",
        what: "captive portal이 응답을 가로채는지(JSON이 HTML로 바뀜)", userImpact: "호텔·카페 와이파이 로그인 화면이 점검을 오염시킬 수 있습니다.", recommendedAction: "와이파이 로그인 후 재점검합니다." }),
    ...[HOSTS.pages, HOSTS.site, HOSTS.vercel].map((host) =>
      C(`c:company:host-${host}`, t, "network", "company_precondition", { check: "host", host },
        { runTier: "cheap", severityIfFail: "warning", failureClass: "availability",
          what: `${host} 공동 호스트 접근 가능`, userImpact: `${host}에 올라간 앱들이 함께 영향을 받습니다.`,
          recommendedAction: "호스트 장애면 개별 앱 조치 없이 회복을 기다립니다.", correlationKey: `host:${host}` })),
  ];
}

// ── 공통 계약(§9): registry의 모든 앱에 적용 ──
function commonAppContracts(app) {
  const id = app.id; const name = app.name || id;
  const host = new URL(app.web_url).hostname;
  const out = [];
  const add = (...args) => out.push(...args);
  add(
    C(`c:${id}:production-home`, id, "production", "http_html", {
      url: app.healthcheck_url, minBytes: 500, negativeMarkers: PROVIDER_ERROR_MARKERS,
    }, { runTier: "cheap", required: true, severityIfFail: "critical", failureClass: "availability", consecutiveFailures: 1,
      what: `${name} 운영 첫 화면이 실제로 열리는지(200·HTML·빈 화면 아님·오류 페이지 아님)`,
      userImpact: `${name}을(를) 열어도 화면이 뜨지 않을 수 있습니다.`,
      recommendedAction: "운영 배포 상태를 확인하고 마지막 정상 배포로 복구합니다." }),
    C(`c:${id}:critical-assets`, id, "production", "surface_assets", { url: app.healthcheck_url, baseUrl: app.web_url },
      { severityIfFail: "critical", failureClass: "availability",
        what: `${name} 핵심 CSS·JS 자산이 모두 200으로 응답`, userImpact: "핵심 파일이 깨지면 화면이 하얗게 나오거나 기능이 죽습니다.",
        recommendedAction: "배포 산출물·경로를 확인하고 재배포합니다." }),
    C(`c:${id}:response-time`, id, "production", "http_timing", { url: app.healthcheck_url, warnMs: 8000 },
      { severityIfFail: "warning", failureClass: "availability", what: `${name} 첫 응답 시간`, userImpact: "응답이 느리면 사용자가 이탈합니다.", recommendedAction: "호스팅·자산 크기를 점검합니다." }),
    C(`c:${id}:tls`, id, "production", "tls_certificate", { host },
      { runTier: "cheap", severityIfFail: "error", failureClass: "transport",
        what: `${name} TLS 인증서 잔여일(21일 경고·10일 위험)`, userImpact: "인증서가 만료되면 접속 자체가 차단됩니다.", recommendedAction: "인증서 자동 갱신 상태를 확인합니다." }),
    C(`c:${id}:dns`, id, "production", "dns_resolution", { hosts: [host] },
      { runTier: "cheap", severityIfFail: "error", failureClass: "transport", what: `${name} 도메인 DNS 해석`, userImpact: "DNS 실패 시 접속 불가입니다.", recommendedAction: "도메인 설정을 확인합니다." }),
    C(`c:${id}:manifest`, id, "pwa", "manifest_contract", { baseUrl: app.web_url },
      { severityIfFail: "error", failureClass: "schema",
        what: `${name} PWA manifest JSON·필수 필드(name·start_url·icons)`, userImpact: "manifest가 깨지면 홈 화면 설치가 실패합니다.", recommendedAction: "manifest.webmanifest를 수정해 재배포합니다." }),
    C(`c:${id}:manifest-icons`, id, "pwa", "manifest_contract", { baseUrl: app.web_url, iconCheck: true },
      { severityIfFail: "error", failureClass: "availability", what: `${name} manifest 아이콘 자산 200`, userImpact: "아이콘이 깨지면 설치 아이콘이 표시되지 않습니다.", recommendedAction: "아이콘 파일 경로를 수정합니다." }),
    C(`c:${id}:service-worker`, id, "pwa", "service_worker_contract", { baseUrl: app.web_url, syntax: true, mustContainAny: ["cache", "workbox"] },
      { severityIfFail: "error", failureClass: "availability", what: `${name} service worker 200·문법·캐시 동작 존재`, userImpact: "SW가 깨지면 오프라인·업데이트가 실패합니다.", recommendedAction: "sw.js를 수정해 재배포합니다." }),
    C(`c:${id}:sw-cache-isolation`, id, "pwa", "service_worker_contract", {
      baseUrl: app.web_url, mustContainAny: [id],
      mustNotContainAny: ["outbom", "homebom", "runningbom", "calendarbom", "certbom", "notebom"].filter((x) => x !== id).map((x) => `${x}-`),
    }, { severityIfFail: "warning", failureClass: "storage",
      what: `${name} SW 캐시 접두사가 자기 앱 소유이고 다른 앱 캐시를 건드리지 않음`, userImpact: "다른 앱 캐시를 지우면 가족 앱들이 함께 고장납니다.", recommendedAction: "캐시 이름 접두사를 앱 전용으로 유지합니다." }),
    C(`c:${id}:offline-shell`, id, "pwa", "service_worker_contract", { baseUrl: app.web_url, mustContainAny: ["index.html", "./"] },
      { severityIfFail: "warning", failureClass: "availability", what: `${name} 오프라인 셸 프리캐시 선언`, userImpact: "오프라인에서 앱이 아예 열리지 않을 수 있습니다.", recommendedAction: "SW 프리캐시 목록에 앱 셸을 포함합니다." }),
    C(`c:${id}:version-registry-main`, id, "version", "version_parity", { rawUrl: app.version_source, expected: app.version },
      { severityIfFail: "error", failureClass: "parity",
        what: `registry ${app.version} == 앱 main package.json`, userImpact: "버전 장부가 어긋나면 배포 판단이 틀립니다.", recommendedAction: "registry 또는 앱 버전을 정합화합니다." }),
    C(`c:${id}:version-production`, id, "version", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: [app.version] },
      { severityIfFail: "error", failureClass: "parity", what: `운영 자산에 버전 ${app.version} marker 존재`,
        userImpact: "운영에 오래된 버전이 남아 있으면 사용자에게 구버전이 보입니다.", recommendedAction: "배포 전파를 확인하고 재배포합니다." }),
    C(`c:${id}:deployed-sha`, id, "version", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: [String(app.last_deployed_sha || "").slice(0, 7)].filter(Boolean) },
      { severityIfFail: "warning", failureClass: "parity", what: "운영 자산에 registry deployed SHA marker 존재",
        userImpact: "장부의 배포 기록과 실제 운영이 다를 수 있습니다.", recommendedAction: "registry last_deployed_sha를 실제 배포와 맞춥니다." }),
    C(`c:${id}:registry-freshness`, id, "version", "data_freshness", { value: app.last_verified_at, maxHours: Number(app.freshness_slo_hours ?? 48) },
      { severityIfFail: "warning", failureClass: "freshness", what: "registry last_verified_at 나이", userImpact: "장부 확인이 오래되면 상태 신뢰가 떨어집니다.", recommendedAction: "운영 검증 후 registry를 갱신합니다." }),
    C(`c:${id}:ci-latest`, id, "ci", "github_actions", { repo: app.repo },
      { severityIfFail: "error", failureClass: "automation", what: `${name} 최신 main CI 결과`, userImpact: "CI 실패 상태에서는 다음 배포가 위험합니다.", recommendedAction: "실패 로그를 확인해 수정 후 재실행합니다." }),
    C(`c:${id}:open-pr-age`, id, "github", "github_prs", { repo: app.repo, warnDays: 14, errorDays: 30 },
      { severityIfFail: "warning", failureClass: "automation", what: `${name} 열린 PR 정체(14일 경고·30일 오류)`, userImpact: "오래 열린 변경은 작업 흐름 정체 신호입니다.", recommendedAction: "리뷰 후 병합하거나 닫아 정리합니다." }),
    C(`c:${id}:privacy-url`, id, "security", "http_status", { url: app.privacy_url, expectStatus: [200] },
      { severityIfFail: "error", failureClass: "security", what: "개인정보처리방침 URL 200", userImpact: "스토어 심사·신뢰에 필수인 문서가 끊기면 안 됩니다.", recommendedAction: "robom.kr 개인정보 페이지를 복구합니다." }),
    C(`c:${id}:install-url`, id, "production", "http_status", { url: app.stable_install_url, expectStatus: [200], finalHostSuffixes: [HOSTS.site] },
      { severityIfFail: "error", failureClass: "availability", what: "고정 설치 URL(robom.kr/get)이 200이고 외부로 강제 이동하지 않음",
        userImpact: "설치 안내 링크가 죽으면 신규 사용자를 잃습니다.", recommendedAction: "사이트 설치 페이지를 복구합니다." }),
    C(`c:${id}:secret-scan`, id, "security", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, forbiddenMarkers: SECRET_PATTERNS },
      { severityIfFail: "critical", failureClass: "security", consecutiveFailures: 1,
        what: "공개 번들에 secret 패턴 0건", userImpact: "secret이 노출되면 즉시 폐기·교체가 필요합니다.", recommendedAction: "번들에서 secret을 제거하고 키를 교체합니다." }),
    C(`c:${id}:mixed-content`, id, "security", "http_html", { url: app.healthcheck_url, negativeMarkers: ['src="http://', "src='http://"] },
      { severityIfFail: "warning", failureClass: "security", what: "HTTPS 페이지에 http:// 활성 콘텐츠 없음", userImpact: "혼합 콘텐츠는 브라우저가 차단해 기능이 깨집니다.", recommendedAction: "자산 URL을 https로 바꿉니다." }),
    C(`c:${id}:unsafe-scheme`, id, "security", "http_html", { url: app.healthcheck_url, negativeMarkers: ['href="javascript:', "href='javascript:"] },
      { severityIfFail: "warning", failureClass: "security", what: "위험 scheme 링크 없음", userImpact: "javascript: 링크는 보안 위험입니다.", recommendedAction: "해당 링크를 제거합니다." }),
    C(`c:${id}:analytics-off`, id, "security", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, forbiddenMarkers: ANALYTICS_MARKERS },
      { severityIfFail: "warning", failureClass: "security", what: "광고·추적 스크립트 기본 OFF 계약", userImpact: "회장 승인 없는 광고·추적은 회사 원칙 위반입니다.", recommendedAction: "동의 없는 추적 코드를 제거합니다." }),
    C(`c:${id}:page-title`, id, "user_surface", "http_html", { url: app.healthcheck_url, markers: ["<title"] },
      { severityIfFail: "warning", failureClass: "user_flow", what: "페이지 title 존재", userImpact: "탭·검색에서 앱 이름이 비어 보입니다.", recommendedAction: "title을 채웁니다." }),
    C(`c:${id}:browser-smoke`, id, "user_surface", "browser_smoke", {
      url: app.web_url, viewports: [{ width: 360, height: 800 }, { width: 390, height: 844 }],
      maxConsoleErrors: 0, checkOverflow: true,
    }, { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
      what: `${name} 360·390 모바일 화면 smoke(콘솔 오류 0·가로 넘침 0)`, userImpact: "휴대폰에서 화면이 깨지거나 스크립트 오류가 날 수 있습니다.",
      recommendedAction: "콘솔 오류·넘치는 요소를 수정합니다." }),
  );
  if (app.data_probe_url) {
    add(C(`c:${id}:data-probe-heartbeat`, id, "data", "http_json_contract", {
      url: app.data_probe_url, headerAssertions: [
        { path: "x-verified-at", op: "exists", label: "검증 시각 헤더" },
        { path: "x-verified-at", op: "age_lte_seconds", value: Number(app.data_probe_max_age_hours ?? 6) * 3600, label: "검증 시각 신선도" },
      ],
    }, { required: true, severityIfFail: "error", failureClass: "freshness",
      what: `${name} 데이터 갱신 파이프라인 heartbeat(x-verified-at ≤ ${app.data_probe_max_age_hours ?? 6}시간)`,
      userImpact: "갱신이 멈추면 사용자가 오래된 정보로 잘못된 판단을 할 수 있습니다.", recommendedAction: "수집 워크플로 실행 이력을 확인해 복구합니다." }));
  }
  return out;
}

// ── 야외봄 전용(§12) ──
function outbomContracts(app) {
  const id = "outbom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  return [
    s("forecast-source-declared", "data", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["open-meteo", "api/forecast", "forecast"] },
      { severityIfFail: "warning", failureClass: "schema", what: "배포 번들에 날씨 데이터 소스 참조가 존재", userImpact: "날씨 소스 연결이 사라지면 예보가 뜨지 않습니다.", recommendedAction: "forecast 소스 연결을 확인합니다." }),
    s("activity-profiles", "data", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["러닝"], markersAll: ["러닝", "산책", "등산", "자전거"] },
      { severityIfFail: "warning", failureClass: "user_flow", what: "활동 프로필(러닝·산책·등산·자전거 등)이 번들에 존재", userImpact: "활동별 점수 기능이 빠지면 앱의 핵심 가치가 사라집니다.", recommendedAction: "활동 프로필 구성을 복구합니다." }),
    s("legacy-key-preserved", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["running-alarm"] },
      { severityIfFail: "warning", failureClass: "storage", what: "기존 사용자 저장 키(running-alarm:*) 참조 보존", userImpact: "키가 사라지면 기존 사용자 설정을 잃습니다.", recommendedAction: "저장 키 마이그레이션 없이 키를 바꾸지 않습니다." }),
    s("kakao-key-absent", "security", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, forbiddenMarkers: ["KakaoAK "] },
      { severityIfFail: "critical", failureClass: "security", consecutiveFailures: 1, what: "Kakao REST 키가 공개 번들에 없음", userImpact: "키 노출 시 도용·과금 위험이 있습니다.", recommendedAction: "키를 서버 측으로 옮기고 노출 키는 폐기합니다." }),
    s("forecast-probe", "data", "need_new_source", {},
      { severityIfFail: "warning", failureClass: "freshness", needNewSource: true,
        sourceNeeded: "OutBom 공개 forecast API base 또는 안전한 health endpoint를 registry에 선언",
        whyNeeded: "registry에 probe URL이 없어 실제 forecast JSON 계약(오늘·내일 배열, generatedAt, 결측 처리)을 운영에서 확인할 수 없음",
        privacyRisk: "좌표·검색어를 기록하면 안 됨 — 서울 기준 고정 synthetic 좌표만 사용",
        freeImplementationOption: "registry apps.yml에 data_probe_url(서울 고정 좌표 forecast) 1줄 선언",
        fallbackStatus: "UNAVAILABLE",
        what: "서울 고정 좌표 forecast 응답의 심층 데이터 계약(오늘·내일 nonempty, 시간 정렬, 필수 기상값 finite, 결측 위장 금지, generatedAt 나이)",
        userImpact: "예보 데이터 이상을 운영에서 조기 감지하지 못합니다.", recommendedAction: "registry에 probe URL을 선언하면 즉시 자동 점검됩니다." }),
    s("scoring-goldens", "data", "repo_text_contract", { repo: app.repo, pathCandidates: ["lib/weather.ts", "lib/scoring.ts"], mustContainAny: ["score"] },
      { severityIfFail: "info", failureClass: "integrity", what: "scoring 로직 정본이 main에 존재(읽기 전용 감사)", userImpact: "점수 로직이 사라지면 활동 추천이 무의미해집니다.", recommendedAction: "scoring 모듈·golden 테스트를 유지합니다." }),
    s("api-error-isolation", "user_surface", "browser_smoke", { url: app.web_url, viewports: [{ width: 390, height: 844 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 40 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
        what: "외부 API가 느리거나 실패해도 앱 셸이 빈 화면이 되지 않음(본문 텍스트 존재)", userImpact: "API 장애 시 앱 전체가 하얗게 보이면 안 됩니다.", recommendedAction: "LKG fallback과 오류 안내를 유지합니다." }),
  ];
}

// ── 청약봄 전용(§13) ──
function homebomContracts(app) {
  const id = "homebom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  const probe = app.data_probe_url;
  const itemPaths = ["", "data", "notices"];
  return [
    s("notices-http", "data", "http_json_contract", { url: probe, contentTypeIncludes: "json" },
      { required: true, severityIfFail: "critical", failureClass: "availability", consecutiveFailures: 1,
        what: "공고 데이터 probe 200·JSON content-type", userImpact: "공고 데이터가 끊기면 앱이 빈 목록을 보여줍니다.", recommendedAction: "Supabase 함수·수집 파이프라인을 확인합니다." }),
    s("notices-nonempty", "data", "http_json_contract", { url: probe, itemsPathCandidates: itemPaths, assertions: [
      { path: "", op: "length_gte", value: 1, label: "공고 0건(빈 200을 정상으로 위장 금지)" }] },
      { severityIfFail: "error", failureClass: "schema", what: "공고 배열 nonempty(0건이면 수집 실패 의심)", userImpact: "실공고가 전부 사라진 것처럼 보입니다.", recommendedAction: "수집 파이프라인·LKG 보존을 확인합니다." }),
    s("notices-required-fields", "data", "http_json_contract", { url: probe, itemsPathCandidates: itemPaths, assertions: [
      { path: "", op: "nonempty_string", quantifier: "every", itemPath: "id", label: "id" },
      { path: "", op: "nonempty_string", quantifier: "every", itemPath: "houseName", label: "houseName" },
      { path: "", op: "nonempty_string", quantifier: "every", itemPath: "region", label: "region" }] },
      { severityIfFail: "error", failureClass: "schema", what: "각 공고 필수 필드(id·houseName·region)", userImpact: "필드 누락 공고는 화면·알림 계산을 깨뜨립니다.", recommendedAction: "수집 스키마 검증을 강화합니다." }),
    s("notices-ids-unique", "data", "http_json_contract", { url: probe, itemsPathCandidates: itemPaths, assertions: [
      { path: "", op: "unique", value: "id", label: "stable id 중복" }] },
      { severityIfFail: "error", failureClass: "integrity", what: "stable id 중복 0", userImpact: "중복 id는 알림 중복·상세 오연결을 만듭니다.", recommendedAction: "id 생성 규칙을 수정합니다." }),
    s("notices-dates", "data", "http_json_contract", { url: probe, itemsPathCandidates: itemPaths, assertions: [
      { path: "", op: "date_valid", quantifier: "every", itemPath: "receiptStart", optional: true, label: "receiptStart parse" },
      { path: "", op: "date_valid", quantifier: "every", itemPath: "receiptEnd", optional: true, label: "receiptEnd parse" }] },
      { severityIfFail: "error", failureClass: "schema", what: "접수 시작·마감 시각 parse 가능", userImpact: "날짜가 깨지면 마감 알림이 틀립니다.", recommendedAction: "날짜 정규화를 수정합니다." }),
    s("notices-urls", "data", "http_json_contract", { url: probe, itemsPathCandidates: itemPaths, assertions: [
      { path: "", op: "not_contains", quantifier: "every", itemPath: "applyHomeUrl", value: "&amp;", optional: true, label: "HTML entity 잔존" }] },
      { severityIfFail: "warning", failureClass: "schema", what: "공식 신청 URL에 &amp; 엔티티가 남지 않음", userImpact: "깨진 링크는 신청 페이지 연결을 막습니다.", recommendedAction: "URL 디코딩을 수정합니다." }),
    s("verified-header-fresh", "data", "http_json_contract", { url: probe, headerAssertions: [
      { path: "x-verified-at", op: "exists", label: "x-verified-at" },
      { path: "x-verified-at", op: "age_lte_seconds", value: Number(app.data_probe_max_age_hours ?? 6) * 3600, label: "검증 나이" }] },
      { required: true, severityIfFail: "error", failureClass: "freshness", what: `x-verified-at ≤ ${app.data_probe_max_age_hours ?? 6}시간`, userImpact: "수집이 멈추면 새 공고를 놓칩니다.", recommendedAction: "수집 워크플로를 복구합니다." }),
    s("verified-not-future", "data", "http_json_contract", { url: probe, headerAssertions: [
      { path: "x-verified-at", op: "not_future_beyond_seconds", value: 600, label: "미래 시각 skew" }] },
      { severityIfFail: "warning", failureClass: "freshness", what: "x-verified-at 미래 시각이 허용 skew(10분) 이내", userImpact: "시계 오류는 신선도 판정을 왜곡합니다.", recommendedAction: "수집기 시계·기록 시점을 확인합니다." }),
    s("stale-flag-honest", "data", "http_json_contract", { url: probe, staleHeaderDegraded: "x-data-stale" },
      { severityIfFail: "warning", failureClass: "freshness", what: "x-data-stale=1이면 확인 필요로 강등(LKG 표시 정직)", userImpact: "오래된 데이터를 최신처럼 보이게 하면 안 됩니다.", recommendedAction: "업스트림 수집을 복구합니다." }),
    s("cors-expose-headers", "data", "http_json_contract", { url: probe, headerAssertions: [
      { path: "access-control-expose-headers", op: "contains", value: "x-verified-at", label: "CORS expose" }] },
      { severityIfFail: "warning", failureClass: "schema", what: "CORS expose에 x-verified-at 포함(앱이 신선도를 읽을 수 있음)", userImpact: "앱이 데이터 나이를 사용자에게 보여주지 못합니다.", recommendedAction: "함수 응답 헤더를 수정합니다." }),
    s("verified-monotonic", "data", "http_json_contract", { url: probe, monotonicHeader: "x-verified-at", stateKey: "homebom-verified" },
      { severityIfFail: "warning", failureClass: "integrity", what: "x-verified-at가 성공 수집 후 단조 증가(뒤로 가지 않음)", userImpact: "검증 시각이 뒤로 가면 파이프라인 오류입니다.", recommendedAction: "수집기 기록 로직을 확인합니다." }),
    s("refresh-auth-static", "security", "repo_text_contract", { repo: app.repo, pathCandidates: ["supabase/functions/notices/index.ts"], mustContainAny: ["x-sync-token"] },
      { severityIfFail: "warning", failureClass: "security", what: "refresh(동기화) 경로가 토큰 인증을 요구(읽기 전용 코드 감사)", userImpact: "무인증 refresh는 과금·오염 위험입니다.", recommendedAction: "x-sync-token 검증을 유지합니다." }),
    s("pipeline-workflow", "data", "github_actions", { repo: app.repo, maxAgeHours: 24 },
      { severityIfFail: "warning", failureClass: "automation", what: "데이터 파이프라인 workflow 최근 성공", userImpact: "워크플로가 죽으면 수집이 멈춥니다.", recommendedAction: "Actions 실행 이력을 확인합니다." }),
    s("collection-stats", "data", "need_new_source", {},
      { severityIfFail: "info", failureClass: "observability", needNewSource: true,
        sourceNeeded: "fetched·valid·published·preserved 수를 노출하는 read-only /health 응답 또는 헤더",
        whyNeeded: "현재 public endpoint가 수집 통계를 노출하지 않아 0건 삭제 보호·conflict 수를 외부에서 검증할 수 없음",
        privacyRisk: "민감 원문 없이 숫자·verifiedAt·snapshot fingerprint만",
        freeImplementationOption: "Supabase 함수에 통계 헤더(x-collection-stats) 추가",
        fallbackStatus: "UNAVAILABLE",
        what: "수집 통계(fetched≥published, 불가능 통계 금지, 0건 삭제 보호) 심층 검증", userImpact: "수집 이상을 통계로 조기 감지하지 못합니다.", recommendedAction: "read-only 통계 신호를 추가하면 자동 점검됩니다." }),
    s("filters-smoke", "user_surface", "browser_smoke", { url: app.web_url, viewports: [{ width: 390, height: 844 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 40 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
        what: "청약봄 목록 화면 smoke(렌더·콘솔 오류 0·넘침 0)", userImpact: "필터·목록이 깨지면 공고 확인이 불가능합니다.", recommendedAction: "콘솔 오류를 수정합니다." }),
  ];
}

// ── 러닝봄 전용(§14) ──
function runningbomContracts(app) {
  const id = "runningbom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  // 실제 배포 경로가 바뀌어도 고정 후보 순서로 첫 200을 채택(결정론) — 전부 실패면 FAIL(추측 PASS 금지)
  const racesCandidates = ["races.json", "data/races.json", "assets/races.json"].map((p) => new URL(p, app.web_url).href);
  const races = racesCandidates[0];
  return [
    s("races-json", "data", "http_json_contract", { url: races, urlCandidates: racesCandidates, contentTypeIncludes: "json" },
      { required: true, severityIfFail: "critical", failureClass: "availability", consecutiveFailures: 1,
        what: "races.json 200·JSON parse", userImpact: "대회 데이터가 없으면 앱이 빈 목록입니다.", recommendedAction: "데이터 파일 배포를 확인합니다." }),
    s("races-data-version", "data", "http_json_contract", { url: races, urlCandidates: racesCandidates, assertions: [
      { path: "dataVersion", op: "eq", value: app.data_version, label: "registry data_version parity" }] },
      { severityIfFail: "error", failureClass: "parity", what: `races.json dataVersion == registry(${app.data_version})`, userImpact: "데이터 장부가 어긋나면 갱신 판단이 틀립니다.", recommendedAction: "registry data_version을 갱신합니다." }),
    s("races-deep", "data", "app_data_validator", { url: races, urlCandidates: racesCandidates, validator: "runningbom_races" },
      { severityIfFail: "error", failureClass: "schema",
        what: "대회 데이터 심층 계약(필수 필드·중복 0·날짜 parse·접수 순서·상태-날짜 모순·미래 접수 존재·종료 비율)",
        userImpact: "데이터가 모순이면 접수 알림·D-day가 틀립니다.", recommendedAction: "데이터 검증 스크립트로 원본을 수정합니다." }),
    s("races-freshness", "data", "data_freshness", { value: app.last_data_sync_at, maxHours: Number(app.freshness_slo_hours ?? 168) },
      { severityIfFail: "warning", failureClass: "freshness", what: `대회 데이터 나이 ≤ ${app.freshness_slo_hours ?? 168}시간`, userImpact: "갱신이 늦으면 새 대회를 놓칩니다.", recommendedAction: "대회 데이터를 수집·갱신합니다." }),
    s("asset-version-parity", "version", "asset_version_parity", { url: app.healthcheck_url, baseUrl: app.web_url },
      { severityIfFail: "warning", failureClass: "parity", what: "HTML의 캐시버스트 버전과 SW 캐시 버전 정합", userImpact: "어긋나면 업데이트가 반영되지 않습니다.", recommendedAction: "ASSET_VERSION을 함께 올립니다." }),
    s("official-link-sample", "data", "app_data_validator", { url: races, urlCandidates: racesCandidates, validator: "runningbom_link_sample" },
      { severityIfFail: "info", failureClass: "availability", timeoutMs: 30_000,
        what: "공식 접수 링크 회전 표본 점검(하루 1개 결정론 선택·403은 정책으로 구분)", userImpact: "죽은 공식 링크는 접수 기회를 잃게 합니다.", recommendedAction: "해당 대회의 공식 URL을 갱신합니다." }),
    s("no-fake-alarm-static", "notification", "repo_text_contract", { repo: app.repo, pathCandidates: ["app.js", "src/app.js", "scripts/validate-static.mjs"], mustContainAny: ["confirmed", "exact"] },
      { severityIfFail: "info", failureClass: "notification", what: "정각 미확정 대회에 임의 시각 알림을 만들지 않는 로직 존재(읽기 전용 감사)", userImpact: "틀린 시각 알림은 신뢰를 깨뜨립니다.", recommendedAction: "exact time 확인 로직을 유지합니다." }),
    s("filters-smoke", "user_surface", "browser_smoke", { url: app.web_url, viewports: [{ width: 320, height: 700 }, { width: 390, height: 844 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 40 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
        what: "320·390 폭에서 필터·카드·하단 탭 넘침 0·콘솔 오류 0", userImpact: "작은 화면에서 조작이 불가능해집니다.", recommendedAction: "레이아웃을 수정합니다." }),
  ];
}

// ── 캘린더봄 전용(§15) ──
function calendarbomContracts(app) {
  const id = "calendarbom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  return [
    s("storage-keys-preserved", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAll: ["calendarbom:events:v1", "calendarbom:data:v2"] },
      { required: true, severityIfFail: "critical", failureClass: "storage", consecutiveFailures: 1,
        what: "기존 저장 키 문자열(calendarbom:events:v1·data:v2)이 번들에 보존", userImpact: "키가 바뀌면 기존 사용자 일정이 사라져 보입니다.", recommendedAction: "마이그레이션 없이 키를 바꾸지 않습니다." }),
    s("js-syntax", "production", "service_worker_contract", { baseUrl: app.web_url, scriptPath: "app.js", syntax: true },
      { severityIfFail: "critical", failureClass: "availability", what: "핵심 app.js 문법 오류 0(vm compile)", userImpact: "문법 오류면 앱 전체가 죽습니다.", recommendedAction: "배포 전 문법 검사를 통과시킵니다." }),
    s("schema-v3-marker", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["schemaVersion"] },
      { severityIfFail: "warning", failureClass: "schema", what: "저장 스키마 버전 관리 코드 존재", userImpact: "스키마 버전 없이는 안전한 마이그레이션이 불가능합니다.", recommendedAction: "schemaVersion 관리를 유지합니다." }),
    s("boot-clean", "user_surface", "browser_smoke", { url: app.web_url, viewports: [{ width: 390, height: 844 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 20 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
        what: "부팅 smoke(콘솔 오류 0·넘침 0·본문 렌더)", userImpact: "부팅 실패는 모든 기능 상실입니다.", recommendedAction: "부팅 오류를 수정합니다." }),
    s("corrupt-v2-recovery", "storage", "browser_smoke", {
      url: app.web_url, viewports: [{ width: 390, height: 844 }], bodyMinTextLength: 20,
      seedStorage: { "calendarbom:data:v2": "{corrupt-not-json" },
      storageAssertions: [
        { key: "calendarbom:data:v2", op: "not_eq_empty_overwrite", label: "손상 원문을 빈 값으로 덮지 않음" }],
    }, { runTier: "deep", severityIfFail: "error", failureClass: "storage", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
      what: "손상된 저장 데이터 fixture에서 앱이 부팅하고 원문을 빈 값으로 덮어쓰지 않음",
      userImpact: "손상 시 덮어쓰면 사용자 일정이 영구 소실됩니다.", recommendedAction: "recovery 보존 로직을 유지합니다." }),
    s("multi-tab-safety-static", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["storage"] },
      { severityIfFail: "info", failureClass: "storage", what: "multi-tab storage event 처리 코드 존재", userImpact: "두 탭 동시 사용 시 데이터가 덮일 수 있습니다.", recommendedAction: "storage event 처리를 유지합니다." }),
    s("backup-roundtrip-static", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["backup", "내보내기"] },
      { severityIfFail: "warning", failureClass: "storage", what: "JSON 백업 내보내기 기능 존재", userImpact: "백업이 없으면 기기 교체 때 일정을 잃습니다.", recommendedAction: "백업 기능을 유지합니다." }),
    s("ics-static", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["BEGIN:VCALENDAR", "ics", "ICS"] },
      { severityIfFail: "info", failureClass: "storage", what: "ICS 내보내기·가져오기 코드 존재", userImpact: "캘린더 앱 연동이 끊깁니다.", recommendedAction: "ICS 지원을 유지합니다." }),
    s("user-storage-health", "storage", "need_new_source", {},
      { severityIfFail: "info", failureClass: "observability", needNewSource: true,
        sourceNeeded: "사용자 동의 후 로컬에서 출력하는 비식별 진단 JSON(손상 여부·마지막 백업 나이·저장공간 버킷·예약 알림 수)",
        whyNeeded: "HQ는 다른 origin의 localStorage를 직접 읽을 수 없음(§18.1 opt-in handshake 필요)",
        privacyRisk: "일정 제목·내용은 절대 포함 금지 — 숫자·버킷만",
        freeImplementationOption: "캘린더봄 설정에 '진단 데이터 보내기(내 맥의 HQ로)' 옵트인 버튼",
        fallbackStatus: "UNAVAILABLE",
        what: "실사용자 저장 데이터 건강(손상·백업 나이·잔여 공간·알림 수)", userImpact: "사용자 기기 문제를 원격에서 알 수 없습니다.", recommendedAction: "옵트인 진단 브리지를 구현하면 자동 점검됩니다." }),
  ];
}

// ── 자격증봄 전용(§16) ──
function certbomContracts(app) {
  const id = "certbom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  const registryCandidates = [
    "apps/web/public/data/source-registry.json", "apps/web/src/data/source-registry.json",
    "ops/source-registry.json", "ops/sources/source-registry.json", "packages/data/source-registry.json",
  ];
  return [
    s("source-registry", "data", "repo_json_contract", { repo: app.repo, pathCandidates: registryCandidates, validator: "certbom_sources" },
      { severityIfFail: "error", failureClass: "integrity",
        what: "공식 출처 registry 심층 계약(schemaVersion·dataVersion·sourceId 중복 0·owner·officialUrl HTTPS·parserVersion·lastVerifiedAt·staleAfterHours)",
        userImpact: "출처 장부가 깨지면 수집 전체의 신뢰가 무너집니다.", recommendedAction: "source registry를 스키마에 맞게 수정합니다." }),
    s("source-workflow", "data", "github_actions", { repo: app.repo, workflowFile: "source-operations.yml", maxAgeHours: 36 },
      { required: true, severityIfFail: "error", failureClass: "automation",
        what: "공식 출처 수집 workflow 최근 36시간 내 성공", userImpact: "수집이 멈추면 시험 일정이 오래됩니다.", recommendedAction: "workflow 실패 로그를 확인해 복구합니다." }),
    s("qnet-https-static", "security", "repo_text_contract", { repo: app.repo, pathCandidates: ["apps/web/package.json", "package.json"], mustContainAny: ["certbom"] },
      { severityIfFail: "info", failureClass: "security", what: "저장소 정본 접근 가능(읽기 전용 감사 기반선)", userImpact: "정본 감사가 막히면 코드 변경 무효화 판정이 불가합니다.", recommendedAction: "main 접근성을 유지합니다." }),
    s("secret-name-safety", "security", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, forbiddenMarkers: ["QNET_SERVICE_KEY", "serviceKey="] },
      { severityIfFail: "critical", failureClass: "security", consecutiveFailures: 1, what: "Q-Net service key가 번들·URL에 없음", userImpact: "키 노출 시 폐기·재발급이 필요합니다.", recommendedAction: "키를 서버 전용으로 유지합니다." }),
    s("marketing-count-parity", "user_surface", "app_data_validator", { url: app.healthcheck_url, validator: "certbom_marketing_parity" },
      { severityIfFail: "info", failureClass: "parity", what: "화면의 '공식 출처 N곳' 등 마케팅 숫자와 실제 데이터 수 parity", userImpact: "숫자가 다르면 과장 표시가 됩니다.", recommendedAction: "화면 숫자를 데이터에서 생성합니다." }),
    s("rolling-no-fake-schedule", "data", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["상시"] },
      { severityIfFail: "info", failureClass: "integrity", what: "상시(rolling) 시험 처리 코드 존재 — 가짜 일정 생성 금지 계약", userImpact: "상시 시험에 허위 날짜가 붙으면 안 됩니다.", recommendedAction: "상시 시험 예외 처리를 유지합니다." }),
    s("stale-banner", "user_surface", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["기준", "확인"] },
      { severityIfFail: "info", failureClass: "freshness", what: "LKG(마지막 정상 데이터) 사용 시 기준 시각 안내 존재", userImpact: "오래된 데이터를 최신처럼 보이면 안 됩니다.", recommendedAction: "기준 시각 배너를 유지합니다." }),
    s("interest-roundtrip-smoke", "user_surface", "browser_smoke", { url: app.web_url, viewports: [{ width: 390, height: 844 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 40 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
        what: "자격증봄 화면 smoke(렌더·콘솔 오류 0·넘침 0)", userImpact: "화면이 깨지면 시험 일정을 볼 수 없습니다.", recommendedAction: "콘솔 오류를 수정합니다." }),
    s("source-hash-change", "data", "need_new_source", {},
      { severityIfFail: "info", failureClass: "observability", needNewSource: true,
        sourceNeeded: "각 공식 source HTML·PDF의 content hash 저장(수집 workflow 산출물)",
        whyNeeded: "hash가 없으면 공식 출처 문서 변경을 결정론적으로 감지할 수 없음",
        privacyRisk: "공개 문서 hash만 — 개인정보 없음",
        freeImplementationOption: "수집 workflow가 source별 sha256을 registry에 기록",
        fallbackStatus: "UNAVAILABLE",
        what: "공식 출처 문서 변경 감지(hash 기반)", userImpact: "출처 개편을 늦게 발견하면 일정이 틀린 채 방치됩니다.", recommendedAction: "workflow에 hash 기록을 추가하면 자동 점검됩니다." }),
  ];
}

// ── 노트봄 전용(§17): 다른 팀 개발 가능성 — main 읽기 전용, 절대 수정 금지 ──
function notebomContracts(app) {
  const id = "notebom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  return [
    s("no-external-model-cdn", "security", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, forbiddenMarkers: ["huggingface.co", "cdn.jsdelivr.net", "unpkg.com"] },
      { required: true, severityIfFail: "error", failureClass: "security",
        what: "전사 모델을 외부 CDN에서 받지 않음(same-origin 계약)", userImpact: "외부 CDN 의존은 프라이버시·가용성 위험입니다.", recommendedAction: "모델 자산을 same-origin으로 유지합니다." }),
    s("model-not-precached", "pwa", "service_worker_contract", { baseUrl: app.web_url, mustNotContainAny: [".onnx"] },
      { severityIfFail: "warning", failureClass: "availability", what: "대형 모델이 SW 초기 프리캐시에 없음", userImpact: "초기 설치가 수백 MB가 되면 안 됩니다.", recommendedAction: "모델은 지연 다운로드로 유지합니다." }),
    s("recording-capabilities", "production", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAll: ["MediaRecorder", "indexedDB"] },
      { severityIfFail: "error", failureClass: "schema", what: "녹음·저장 핵심 capability 코드(MediaRecorder·IndexedDB)가 번들에 존재", userImpact: "핵심 코드가 빠지면 녹음 자체가 불가합니다.", recommendedAction: "빌드 구성을 확인합니다." }),
    s("checksum-integrity-code", "storage", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["SHA-256", "sha-256", "digest"] },
      { severityIfFail: "warning", failureClass: "integrity", what: "chunk checksum(SHA-256) 검증 코드 존재", userImpact: "checksum 없이는 손상 녹음을 정상으로 재생할 위험이 있습니다.", recommendedAction: "무결성 검증을 유지합니다." }),
    s("no-upload-endpoint", "security", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, forbiddenMarkers: ["/upload-audio", "audio/upload"] },
      { severityIfFail: "error", failureClass: "security", what: "원음 업로드 endpoint 없음(로컬 전용 계약)", userImpact: "원음이 서버로 가면 프라이버시 약속 위반입니다.", recommendedAction: "로컬 전용 구조를 유지합니다." }),
    s("privacy-link-page", "security", "http_html", { url: app.healthcheck_url, markers: ["privacy"] },
      { severityIfFail: "info", failureClass: "security", what: "개인정보 링크가 첫 화면에 연결", userImpact: "프라이버시 안내 접근성이 떨어집니다.", recommendedAction: "푸터에 개인정보 링크를 유지합니다." }),
    s("worker-wasm-refs", "production", "surface_marker", { url: app.healthcheck_url, baseUrl: app.web_url, markersAny: ["Worker", "worker"] },
      { severityIfFail: "info", failureClass: "availability", what: "전사 Web Worker 구조 존재", userImpact: "메인 스레드 전사는 UI를 얼립니다.", recommendedAction: "Worker 분리를 유지합니다." }),
    s("boot-smoke", "user_surface", "browser_smoke", { url: app.web_url, viewports: [{ width: 360, height: 800 }, { width: 390, height: 844 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 20 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 45_000,
        what: "노트봄 360·390 smoke(렌더·콘솔 오류 0·넘침 0)", userImpact: "부팅이 깨지면 녹음 접근이 불가합니다.", recommendedAction: "부팅 오류를 수정합니다." }),
    s("user-recording-health", "storage", "need_new_source", {},
      { severityIfFail: "info", failureClass: "observability", needNewSource: true,
        sourceNeeded: "노트봄이 사용자 동의 후 로컬로 출력하는 비식별 진단 JSON(interrupted 수·checksum 실패 수·저장공간 버킷·마지막 백업 나이)",
        whyNeeded: "HQ는 다른 origin의 IndexedDB·마이크 상태를 직접 읽을 수 없음(§18.1)",
        privacyRisk: "원음·전사문·노트 제목은 절대 포함 금지 — 숫자만",
        freeImplementationOption: "설정에 '진단 데이터 보내기' 옵트인(localhost HQ로 숫자만 전달)",
        fallbackStatus: "UNAVAILABLE",
        what: "실사용자 녹음 데이터 건강(중단 복구·checksum 실패·백업 나이)", userImpact: "사용자 기기의 녹음 손상을 원격에서 알 수 없습니다.", recommendedAction: "옵트인 진단 브리지를 구현하면 자동 점검됩니다." }),
    s("native-session-planned", "production", "need_new_source", {},
      { severityIfFail: "info", failureClass: "observability", needNewSource: true,
        sourceNeeded: "native(Capacitor) 녹음 세션 journal·권한 상태 정본",
        whyNeeded: "native 기반이 main에 준비되기 전에는 Production 지원으로 표시하지 않음(§17.2 planned)",
        privacyRisk: "세션 id·상태만 — 원음 금지",
        freeImplementationOption: "native 구현 시 session journal 스키마를 계약에 연결",
        fallbackStatus: "UNAVAILABLE",
        what: "native 녹음 세션 계약(백그라운드 녹음·process 재생성 복구)", userImpact: "native 출시 전 과잉 표시를 막습니다.", recommendedAction: "native 준비 시 계약을 활성화합니다." }),
  ];
}

// ── robom.kr 사이트(§11) — target "robom" ──
function siteContracts({ registryApps, siteVersion }) {
  const id = "robom"; const s = (cid, ...rest) => C(`c:${id}:${cid}`, id, ...rest);
  const base = "https://robom.kr/";
  const appIds = registryApps.map((a) => a.id);
  return [
    s("home", "production", "http_html", { url: base, minBytes: 1000, negativeMarkers: PROVIDER_ERROR_MARKERS },
      { runTier: "cheap", required: true, severityIfFail: "critical", failureClass: "availability", consecutiveFailures: 1,
        what: "robom.kr 첫 화면 200·HTML·오류 페이지 아님", userImpact: "본사 사이트가 죽으면 모든 앱 안내가 끊깁니다.", recommendedAction: "사이트 배포를 복구합니다." }),
    s("tls", "production", "tls_certificate", { host: "robom.kr" },
      { runTier: "cheap", severityIfFail: "error", failureClass: "transport", what: "robom.kr TLS 잔여일", userImpact: "만료 시 접속 차단.", recommendedAction: "인증서 갱신을 확인합니다." }),
    s("dns", "production", "dns_resolution", { hosts: ["robom.kr"] },
      { runTier: "cheap", severityIfFail: "error", failureClass: "transport", what: "robom.kr DNS", userImpact: "해석 실패 시 접속 불가.", recommendedAction: "가비아 DNS 설정을 확인합니다." }),
    s("robots", "seo", "http_html", { url: `${base}robots.txt`, contentTypeIncludes: "text/plain", markers: ["Sitemap"] },
      { severityIfFail: "warning", failureClass: "schema", what: "robots.txt 200·text/plain·Sitemap 선언", userImpact: "검색엔진 안내가 깨집니다.", recommendedAction: "robots.txt를 수정합니다." }),
    s("sitemap", "seo", "sitemap_contract", { url: `${base}sitemap.xml`, requiredPathPrefixes: appIds.flatMap((a) => [`/apps/${a}`, `/get/${a}`]), maxUrls: 200 },
      { severityIfFail: "warning", failureClass: "schema",
        what: "sitemap.xml 유효·중복 0·query/fragment 0·앱별 필수 경로 포함·URL 전수 200", userImpact: "sitemap 오류는 검색 노출을 깨뜨립니다.", recommendedAction: "sitemap 생성기를 수정합니다." }),
    s("app-pages", "seo", "route_matrix", { urls: appIds.map((a) => `${base}apps/${a}`), uniqueTitles: true },
      { severityIfFail: "error", failureClass: "availability", what: "registry 앱마다 /apps/<id> 200·title 고유", userImpact: "앱 소개 페이지가 죽으면 유입이 끊깁니다.", recommendedAction: "라우트 생성기를 수정합니다." }),
    s("get-pages", "seo", "route_matrix", { urls: appIds.map((a) => `${base}get/${a}`) },
      { severityIfFail: "error", failureClass: "availability", what: "registry 앱마다 /get/<id> 200", userImpact: "설치 페이지가 죽으면 설치가 불가합니다.", recommendedAction: "설치 라우트를 복구합니다." }),
    s("privacy-pages", "seo", "route_matrix", { urls: appIds.map((a) => `${base}privacy/${a}`) },
      { severityIfFail: "error", failureClass: "availability", what: "registry 앱마다 /privacy/<id> 200", userImpact: "개인정보 문서는 스토어 필수입니다.", recommendedAction: "개인정보 라우트를 복구합니다." }),
    s("policy-pages", "seo", "route_matrix", { urls: ["support", "privacy", "terms"].map((p) => `${base}${p}`) },
      { severityIfFail: "warning", failureClass: "availability", what: "support·privacy·terms 200", userImpact: "문의·약관 접근이 끊깁니다.", recommendedAction: "정책 페이지를 복구합니다." }),
    s("home-app-links", "user_surface", "http_html", { url: base, markers: registryApps.map((a) => a.name) },
      { severityIfFail: "error", failureClass: "parity", what: `홈에 ${registryApps.length}개 앱 이름 전부 노출(client JS 없이)`, userImpact: "앱이 빠지면 신규 사용자가 발견하지 못합니다.", recommendedAction: "홈 앱 목록을 registry에서 생성합니다." }),
    s("seo-meta", "seo", "seo_html_contract", { url: base, requireTitle: true, requireDescription: true, requireCanonical: true, requireH1: true, requireJsonLdTypes: ["Organization", "WebSite"] },
      { severityIfFail: "warning", failureClass: "schema", what: "홈 title·description·canonical·H1 각 1·JSON-LD(Organization·WebSite)", userImpact: "검색 표시 품질이 떨어집니다.", recommendedAction: "메타·구조화 데이터를 수정합니다." }),
    s("app-page-jsonld", "seo", "seo_html_contract", { url: `${base}apps/${appIds[0]}`, requireJsonLdTypes: ["BreadcrumbList"] },
      { severityIfFail: "info", failureClass: "schema", what: "앱 페이지 BreadcrumbList JSON-LD(표본)", userImpact: "검색 경로 표시가 빠집니다.", recommendedAction: "구조화 데이터를 추가합니다." }),
    s("get-page-jsonld", "seo", "seo_html_contract", { url: `${base}get/${appIds[0]}`, requireJsonLdTypes: ["SoftwareApplication"] },
      { severityIfFail: "info", failureClass: "schema", what: "설치 페이지 SoftwareApplication JSON-LD(표본)", userImpact: "설치 페이지 검색 표시가 약해집니다.", recommendedAction: "구조화 데이터를 추가합니다." }),
    s("ua-parity", "seo", "ua_parity", { url: base, markers: registryApps.map((a) => a.name), botUserAgent: "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)" },
      { severityIfFail: "warning", failureClass: "availability", what: "일반 UA와 네이버 Yeti UA의 핵심 marker 동일·bot 차단(403/429) 없음", userImpact: "Yeti만 차단되면 네이버 색인이 빠집니다.", recommendedAction: "bot 차단 규칙을 제거합니다." }),
    s("naver-verification", "seo", "http_html", { url: base, markers: ["naver-site-verification"] },
      { severityIfFail: "warning", failureClass: "schema", what: "네이버 소유 확인 meta 존재(자동 교체 금지)", userImpact: "확인 meta가 빠지면 서치어드바이저 소유권이 풀립니다.", recommendedAction: "정본 token을 유지합니다." }),
    s("internal-links", "user_surface", "internal_links", { url: base, maxLinks: 40 },
      { severityIfFail: "warning", failureClass: "availability", what: "홈 내부 링크 404 0(전수·최대 40)", userImpact: "죽은 링크는 신뢰를 깨뜨립니다.", recommendedAction: "링크 대상을 수정합니다." }),
    s("critical-assets", "production", "surface_assets", { url: base, baseUrl: base },
      { severityIfFail: "error", failureClass: "availability", what: "핵심 CSS·JS 200", userImpact: "자산이 깨지면 화면이 무너집니다.", recommendedAction: "배포 산출물을 확인합니다." }),
    s("version-parity", "version", "local_file_contract", { path: "site/package.json", jsonPath: "version", expected: siteVersion },
      { severityIfFail: "info", failureClass: "parity", requiredCapabilities: ["filesystem"], what: "사이트 패키지 버전 정본 일치", userImpact: "장부 어긋남은 배포 판단을 흐립니다.", recommendedAction: "버전을 정합화합니다." }),
    s("sw-cache", "pwa", "service_worker_contract", { baseUrl: base, mustContainAny: ["cache"] },
      { severityIfFail: "info", failureClass: "availability", what: "사이트 SW 캐시 동작 존재(있는 경우)", userImpact: "오래된 SEO HTML 고정을 막아야 합니다.", recommendedAction: "SW 캐시 버전을 관리합니다.", sourceUnavailableStatus: "SKIPPED" }),
    s("secret-scan", "security", "surface_marker", { url: base, baseUrl: base, forbiddenMarkers: SECRET_PATTERNS },
      { severityIfFail: "critical", failureClass: "security", consecutiveFailures: 1, what: "사이트 번들 secret 0", userImpact: "노출 시 즉시 교체 필요.", recommendedAction: "secret을 제거·교체합니다." }),
    s("analytics-off", "security", "http_html", { url: base, negativeMarkers: ANALYTICS_MARKERS },
      { severityIfFail: "warning", failureClass: "security", what: "광고·추적 기본 OFF", userImpact: "동의 없는 추적은 원칙 위반입니다.", recommendedAction: "추적 코드를 제거합니다." }),
    s("mobile-smoke", "user_surface", "browser_smoke", { url: base, viewports: [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }], maxConsoleErrors: 0, checkOverflow: true, bodyMinTextLength: 60 },
      { runTier: "deep", severityIfFail: "warning", failureClass: "user_flow", requiredCapabilities: ["network", "browser"], timeoutMs: 60_000,
        what: "360·390·412 폭 넘침 0·콘솔 오류 0·첫 화면 앱 선택 영역 렌더", userImpact: "모바일 첫인상이 깨집니다.", recommendedAction: "레이아웃을 수정합니다." }),
  ];
}

// ── ROBOM HQ 자체(§10) — target "robom-hq". local runtime 신호 ──
function hqContracts({ registryApps }) {
  const id = "robom-hq"; const s = (cid, check, extra) => C(`c:${id}:${cid}`, id, extra.category || "self", "hq_runtime", { check, appCount: registryApps.length }, { requiredCapabilities: ["filesystem"], ...extra });
  return [
    s("snapshot-exists", "snapshot-exists", { runTier: "cheap", required: true, severityIfFail: "error", failureClass: "observability", what: "실제 스냅샷(latest.json) 존재 — 예시 폴백을 운영 증거로 오인 금지", userImpact: "예시 데이터로는 회사를 판단할 수 없습니다.", recommendedAction: "스냅샷 생성 프로세스를 확인합니다." }),
    s("snapshot-age", "snapshot-age", { runTier: "cheap", severityIfFail: "warning", failureClass: "freshness", what: "스냅샷 나이 ≤ 감시기 주기×3+5분", userImpact: "상태 갱신 지연은 판단 지연입니다.", recommendedAction: "감시기 프로세스를 확인합니다." }),
    s("snapshot-app-count", "snapshot-app-count", { required: true, severityIfFail: "error", failureClass: "parity", what: `스냅샷 앱 수 == registry(${registryApps.length}) + 본사`, userImpact: "앱이 누락되면 그 앱은 무점검 상태가 됩니다.", recommendedAction: "수집 실패 앱을 확인합니다(전체 삭제 금지 구조)." }),
    s("queue-integrity", "queue-integrity", { runTier: "cheap", severityIfFail: "error", failureClass: "automation", what: "작업 대기열 디렉터리·JSON parse·중복 task id 0", userImpact: "대기열이 깨지면 자동 실행이 멈춥니다.", recommendedAction: "대기열 파일을 점검합니다." }),
    s("stale-lease", "stale-lease", { runTier: "cheap", severityIfFail: "warning", failureClass: "automation", what: "죽은 실행 lease 자동 회수 동작", userImpact: "고아 lease는 작업을 영원히 막습니다.", recommendedAction: "lease 회수 로그를 확인합니다." }),
    s("control-flags", "control-flags", { runTier: "cheap", severityIfFail: "info", failureClass: "automation", what: "긴급 제어(paused·intakeClosed) 플래그 parse", userImpact: "제어 상태를 읽지 못하면 오작동합니다.", recommendedAction: "control.json을 확인합니다." }),
    s("authority-valid", "authority-valid", { runTier: "cheap", required: true, severityIfFail: "error", failureClass: "automation", what: "회사 가동·결재 모드 정본 parse 유효", userImpact: "권한 정본이 깨지면 전결·자동화가 멈춥니다.", recommendedAction: "company-authority.json을 복구합니다." }),
    s("review-marker", "review-marker", { severityIfFail: "warning", failureClass: "automation", what: "자동 점검 최근 실행 marker(하트비트)", userImpact: "점검 루프가 멈추면 문제를 놓칩니다.", recommendedAction: "HQ를 재시작하면 자동 복구됩니다." }),
    s("settings-parity", "settings-parity", { severityIfFail: "info", failureClass: "observability", what: "설정 파일과 런타임 표시값 parity", userImpact: "설정 UI가 실제와 다르면 회장 판단이 틀립니다.", recommendedAction: "설정 저장 로직을 확인합니다." }),
    s("runner-status", "runner-status", { runTier: "cheap", severityIfFail: "warning", failureClass: "automation", what: "코덱스 실행기 상태 신선도(관리 모드에서 실행 중)", userImpact: "실행기가 죽으면 승인 작업이 진행되지 않습니다.", recommendedAction: "HQ가 자동 재시작합니다. 반복되면 로그 확인." }),
    s("codex-cli", "codex-cli", { severityIfFail: "warning", failureClass: "automation", requiredCapabilities: ["filesystem"], what: "Codex CLI 설치·로그인 흔적(실행기는 오로지 Codex)", userImpact: "Codex 미연결이면 자동 수정이 불가합니다(점검은 계속 동작).", recommendedAction: "터미널에서 codex login 1회 실행." }),
    s("disk-free", "disk-free", { runTier: "cheap", severityIfFail: "warning", failureClass: "availability", what: "디스크 여유(2GB 경고·500MB 위험)", userImpact: "디스크가 차면 증거 저장·스냅샷이 실패합니다.", recommendedAction: "공간을 확보합니다." }),
    s("backup-age", "backup-age", { severityIfFail: "warning", failureClass: "storage", what: "회사 기록 백업 나이 ≤ 7일", userImpact: "백업이 오래되면 사고 시 기록을 잃습니다.", recommendedAction: "기록 화면에서 백업을 실행합니다." }),
    s("health-history-size", "health-history-size", { severityIfFail: "info", failureClass: "observability", what: "health 증거 저장 용량 상한(200MB) 관리", userImpact: "무한 증가는 디스크를 채웁니다.", recommendedAction: "오래된 history를 정리합니다." }),
    s("version-triad", "version-triad", { required: true, severityIfFail: "error", failureClass: "parity", what: "desktop·payload·앱 버전 삼중 일치", userImpact: "버전 불일치는 업데이트 혼란을 만듭니다.", recommendedAction: "세 곳의 버전을 함께 올립니다." }),
    s("org-canon", "org-canon", { severityIfFail: "warning", failureClass: "schema", what: "조직 정본(organization.json) parse·12본부·임원 구성", userImpact: "조직 정본이 깨지면 회사 화면이 비어 보입니다.", recommendedAction: "organization.json을 복구합니다." }),
    s("runtime-permissions", "runtime-permissions", { severityIfFail: "warning", failureClass: "security", what: "runtime 디렉터리 권한(700) — 기록·첨부 보호", userImpact: "권한이 느슨하면 로컬 기록이 노출될 수 있습니다.", recommendedAction: "권한을 700으로 되돌립니다." }),
    s("clock-seoul", "clock-seoul", { runTier: "cheap", severityIfFail: "info", failureClass: "freshness", what: "Asia/Seoul 시간 계산 정상(교대조 판정 기반)", userImpact: "시간 계산이 깨지면 교대·점검 시각이 틀립니다.", recommendedAction: "OS 시간대 데이터를 확인합니다." }),
    s("engine-self", "engine-self", { runTier: "cheap", required: true, severityIfFail: "warning", failureClass: "observability", what: "monitor-the-monitor: 계약 카탈로그 로드·기대 계약 수 == 실행 수·직전 run 완결", userImpact: "감시기 자신이 죽으면 아무도 모르게 됩니다.", recommendedAction: "HQ 재시작 후 반복되면 로그를 확인합니다." }),
    s("redaction-selftest", "redaction-selftest", { runTier: "cheap", severityIfFail: "error", failureClass: "security", what: "증거 저장 전 secret·원문 redaction 자가 검사", userImpact: "증거에 비밀이 섞이면 안 됩니다.", recommendedAction: "redaction 규칙을 수정합니다." }),
    s("remote-optin", "remote-optin", { runTier: "cheap", severityIfFail: "warning", failureClass: "security", what: "원격 접속은 opt-in·토큰 12자 이상·기본 localhost 전용", userImpact: "기본 공개는 보안 사고입니다.", recommendedAction: "토큰 설정을 확인합니다." }),
    C(`c:${id}:release-artifacts`, id, "release", "github_release", { repo: "robom-labs/robom", tagPrefix: "hq-v", minAssets: 4 },
      { severityIfFail: "warning", failureClass: "integrity", what: "최신 HQ 릴리스에 mac(arm64·x64)·win 산출물 존재·크기 0 금지", userImpact: "산출물이 깨지면 설치·업데이트가 막힙니다.", recommendedAction: "릴리스 워크플로를 재실행합니다." }),
    C(`c:${id}:hq-ci`, id, "ci", "github_actions", { repo: "robom-labs/robom" },
      { severityIfFail: "error", failureClass: "automation", what: "본사 저장소 최신 main CI", userImpact: "CI 실패는 다음 배포 위험입니다.", recommendedAction: "실패 원인을 수정합니다." }),
    s("login-item-status", "login-item-status", { severityIfFail: "info", failureClass: "observability", needNewSource: true,
      sourceNeeded: "macOS 로그인 항목 실제 등록 상태를 renderer에 노출하는 desktop API",
      whyNeeded: "Electron 설정값만으로는 사용자가 시스템 설정에서 껐는지 알 수 없음",
      privacyRisk: "boolean 상태만 — 개인정보 없음",
      freeImplementationOption: "desktop main이 app.getLoginItemSettings()를 스냅샷에 포함",
      fallbackStatus: "UNAVAILABLE",
      what: "맥 부팅 자동 시작 실제 등록 상태", userImpact: "자동 시작이 꺼진 걸 모르면 24/7 운영이 끊깁니다.", recommendedAction: "desktop API 노출 시 자동 점검됩니다." }),
  ];
}

// ── 카탈로그 빌드 ──
export function buildContractCatalog({ registryApps = [], siteVersion = "" } = {}) {
  const contracts = [
    ...companyContracts(),
    ...registryApps.flatMap((app) => commonAppContracts(app)),
  ];
  const byId = Object.fromEntries(registryApps.map((a) => [a.id, a]));
  if (byId.outbom) contracts.push(...outbomContracts(byId.outbom));
  if (byId.homebom) contracts.push(...homebomContracts(byId.homebom));
  if (byId.runningbom) contracts.push(...runningbomContracts(byId.runningbom));
  if (byId.calendarbom) contracts.push(...calendarbomContracts(byId.calendarbom));
  if (byId.certbom) contracts.push(...certbomContracts(byId.certbom));
  if (byId.notebom) contracts.push(...notebomContracts(byId.notebom));
  contracts.push(...siteContracts({ registryApps, siteVersion }));
  contracts.push(...hqContracts({ registryApps }));

  const ids = new Set();
  for (const c of contracts) {
    if (ids.has(c.id)) throw new Error(`duplicate contract id: ${c.id}`);
    ids.add(c.id);
    if (c.needNewSource && !(c.sourceNeeded && c.whyNeeded && c.privacyRisk && c.freeImplementationOption && c.fallbackStatus)) {
      throw new Error(`need_new_source 계약에 §18 필수 메타데이터가 없음: ${c.id}`);
    }
  }
  return contracts;
}

// 타깃별 집계(진단률 산출용)
export function catalogCoverage(contracts) {
  const byTarget = {};
  for (const c of contracts) {
    const t = byTarget[c.target] || (byTarget[c.target] = { total: 0, executable: 0, needNewSource: 0, browserGated: 0 });
    t.total += 1;
    if (c.needNewSource) t.needNewSource += 1;
    else if ((c.requiredCapabilities || []).includes("browser")) { t.browserGated += 1; t.executable += 1; }
    else t.executable += 1;
  }
  const total = contracts.length;
  const needNewSource = contracts.filter((c) => c.needNewSource).length;
  return { total, defined: total, definedRate: 1, executable: total - needNewSource, needNewSource, byTarget };
}
