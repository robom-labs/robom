// 캘린더봄 정적 자산의 출시 전 필수 조건을 검증한다(버전·캐시버스트·패밀리 UI·접근성 골격).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "app");
const app = readFileSync(join(site, "app.js"), "utf8");
const styles = readFileSync(join(site, "styles.css"), "utf8");
const html = readFileSync(join(site, "index.html"), "utf8");
const sw = readFileSync(join(site, "sw.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(site, "manifest.webmanifest"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const errors = [];

// ── PWA 기본 ──────────────────────────────────────────────────────
if (manifest.start_url !== "./" || manifest.scope !== "./") {
  errors.push("manifest 의 start_url/scope 는 하위 경로 배포(GitHub Pages)를 위해 './' 여야 합니다.");
}
if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) {
  errors.push("PWA manifest 의 icons 가 부족합니다(any/512/maskable 필요).");
}
for (const file of ["icon-v2.svg", "icon-192-v2.png", "icon-512-v2.png", "maskable-512-v2.png", "apple-touch-icon-v2.png", "bom-calendarbom.svg"]) {
  if (!existsSync(join(site, file))) errors.push(`아이콘·브랜드 자산 누락: ${file}`);
}

// ── 버전·캐시버스트 일관성 ────────────────────────────────────────
const appVersion = app.match(/const APP_VERSION = "([^"]+)"/)?.[1];
const assetVersion = html.match(/app\.js\?v=([\w.-]+)/)?.[1];
if (appVersion !== pkg.version) errors.push(`앱 버전 불일치: package=${pkg.version}, app.js=${appVersion}`);
if (
  !assetVersion ||
  !html.includes(`styles.css?v=${assetVersion}`) ||
  !html.includes(`calendar-core.js?v=${assetVersion}`) ||
  !html.includes(`ics-core.js?v=${assetVersion}`) ||
  !html.includes(`bom-calendarbom.svg?v=${assetVersion}`)
) {
  errors.push("index.html 의 캐시버스트(?v=)가 자산마다 다릅니다.");
}

const cacheVersion = sw.match(/const CACHE_NAME = "calendarbom-v([^"]+)"/)?.[1];
if (cacheVersion !== pkg.version) {
  errors.push(`sw.js CACHE_NAME 불일치: package=${pkg.version}, sw.js=calendarbom-v${cacheVersion}`);
}
const swBustVersions = [...sw.matchAll(/\?v=([\w.-]+)/g)].map((match) => match[1]);
if (swBustVersions.length === 0 || swBustVersions.some((version) => version !== assetVersion)) {
  errors.push(`sw.js APP_SHELL 캐시버스트 불일치: html=${assetVersion}, sw.js=[${[...new Set(swBustVersions)].join(", ")}]`);
}
for (const core of ["calendar-core.js", "ics-core.js", "schedule-core.js", "app.js", "styles.css"]) {
  if (!sw.includes(`./${core}?v=${assetVersion}`)) errors.push(`sw.js APP_SHELL 에 ${core} 가 없습니다 (오프라인에서 앱이 깨집니다).`);
}
if (!app.includes("calendarbom-v${APP_VERSION}")) {
  errors.push("설정 화면의 PWA 캐시 버전 표기가 APP_VERSION 과 연동되지 않았습니다.");
}
if (!html.includes('id="buildShaText"') || !app.includes('const BUILD_SHA = "__BUILD_SHA__"')) {
  errors.push("설정 화면의 운영 빌드 식별자가 없습니다.");
}

// ── 서비스워커 안전 규칙 ──────────────────────────────────────────
if (!sw.includes('request.mode === "navigate"')) {
  errors.push("sw.js의 HTML 셸 폴백이 탐색 요청으로 제한되지 않았습니다.");
}
if (!sw.includes("event.waitUntil") || !sw.includes("response.clone()")) {
  errors.push("sw.js 캐시 저장이 waitUntil+clone 패턴을 따르지 않습니다.");
}

// ── 로봄 패밀리 정본 UI ───────────────────────────────────────────
if (
  !html.includes('<strong class="brand-prefix">캘린더</strong>') ||
  !html.includes('class="brand-bom"') ||
  !html.includes("bom-calendarbom.svg")
) {
  errors.push("캘린더봄 브랜드 워드마크(캘린더+봄 SVG)가 헤더에 없습니다.");
}
if (!html.includes("robom · 날짜를 누르고, 잊지 않게")) errors.push("패밀리 헤더 한 줄 문구가 없습니다.");
if (!/mobile-tab[\s\S]*설정<\/strong>\s*<\/button>\s*<\/nav>/.test(html)) {
  errors.push("하단 내비의 마지막 탭이 설정이 아닙니다(패밀리 규칙).");
}
if (!styles.includes("letter-spacing: -0.04em") || !styles.includes("height: 1.18em") || !styles.includes("font-weight: 900")) {
  errors.push("패밀리 워드마크 타이포 규격(-0.04em·1.18em·900)이 없습니다.");
}
if (!styles.includes("min-height: 64px") || !styles.includes("border-radius: 18px")) {
  errors.push("하단 내비 탭 64px·라운드 18px 규격이 없습니다.");
}
if (!html.includes('name="theme-color" content="#2b2144"') || manifest.theme_color !== "#2b2144") {
  errors.push("HTML과 manifest의 theme-color가 다릅니다.");
}
if (!styles.includes("prefers-color-scheme: dark") || !styles.includes("color-scheme: light")) {
  errors.push("다크 모드에서도 밝은 화면을 유지하는 패밀리 규칙이 없습니다.");
}
if (!styles.includes("prefers-reduced-motion: reduce")) errors.push("동작 줄이기 설정 대응이 없습니다.");

// ── 고령 친화 필수 조건 ───────────────────────────────────────────
if (!html.includes('id="fontScaleGrid"') || !styles.includes('html[data-font="xl"]')) {
  errors.push("글자 크기 설정(보통/크게/아주 크게)이 없습니다.");
}
if (!app.includes('"calendarbom:events:v1"')) { // v1 키는 마이그레이션 원본으로 계속 언급되어야 한다
  errors.push("v1 저장 키 참조(마이그레이션 원본)가 사라졌습니다.");
}
if (!app.includes("저장했어요") || !app.includes("koreanDateTime")) errors.push("저장 후 자연어 확인 문장이 사용되지 않습니다.");
if (!app.includes("CalendarBomScheduleCore")) errors.push("v2 일정 모델(schedule-core)이 앱에 연결되지 않았습니다.");
if (!app.includes('"calendarbom:data:v2"') || !app.includes("migrateV1")) errors.push("v2 저장 키와 v1 마이그레이션이 없습니다.");
if (!app.includes("calendarbom:recovery")) errors.push("손상 데이터 복구 키가 없습니다 (A-03).");
if (!app.includes("function commit(")) errors.push("트랜잭션 저장(commit)이 없습니다 (A-02).");
if (app.includes("alarm-core")) errors.push("제거된 alarm-core 참조가 남아 있습니다.");
if (!app.includes("되돌리기")) errors.push("저장·삭제 후 되돌리기가 없습니다.");
if (!html.includes("aria-live") || !html.includes("aria-modal")) errors.push("스크린리더 실시간 안내(aria-live)·모달 표시가 없습니다.");
if (!html.includes("알람 동작 안내") || !html.includes("홈 화면에 추가")) {
  errors.push("웹 알람의 한계를 정직하게 알리는 안내 카드가 없습니다.");
}
if (html.includes("<input") && !/<input[^>]*type="(text|file)"/.test(html.replace(/\n/g, " "))) {
  errors.push("입력 요소 형식이 예상과 다릅니다.");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`정적 검증 통과: v${pkg.version} · 자산 캐시버스트 ${assetVersion} · sw calendarbom-v${cacheVersion}`);
