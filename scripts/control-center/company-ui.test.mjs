// ROBOM HQ v1.4 임원 관제탑 UI 계약 — 해시 라우터·라벨 사이드바·⌘K 팔레트·결재 문서(도장)·
// 6앱 매트릭스·표적 폴링(스크롤 보존)·이미지 첨부·모바일 탭.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, readApps } from "./lib/sources.mjs";

const appDir = join(REPO_ROOT, "ops/control-center/app");
const html = readFileSync(join(appDir, "index.html"), "utf8");
const app = readFileSync(join(appDir, "app.js"), "utf8");
const css = readFileSync(join(appDir, "styles.css"), "utf8");
const sw = readFileSync(join(appDir, "sw.js"), "utf8");
const server = readFileSync(join(REPO_ROOT, "scripts/control-center/serve.mjs"), "utf8");

test("주 메뉴는 5화면(오늘·앱·업무·자동화·기록)이고 해시 라우터로 딥링크된다", () => {
  const navSource = app.slice(app.indexOf("const NAV"), app.indexOf("const REC_SECTIONS"));
  const ids = [...navSource.matchAll(/id:\s*"([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["today", "apps", "tasks", "automation", "records"]);
  // Codex 기술 명칭 화면은 '자동화'로 개편, 삭제된 연출 화면 부활 금지
  assert.ok(!/id:\s*"codex"/.test(navSource), "codex 메뉴 없음");
  for (const removed of ["briefing", "broadcast", "renderGrowth", "signaturePad", "ARCHIVE_TAB"]) {
    assert.ok(!app.includes(removed), removed);
  }
  assert.match(app, /function parseHash/);
  assert.match(app, /addEventListener\("hashchange"/);
  assert.match(app, /#\/apps\//); // 앱 상세 딥링크
  assert.match(app, /#\/records\//); // 기록 섹션 딥링크
});

test("셸: 커맨드바 + 아이콘·라벨이 항상 보이는 사이드바 + 금색 버전 칩", () => {
  assert.match(html, /class="cmdbar"/);
  assert.match(html, /class="sidenav"/);
  assert.match(html, /class="ver-chip" id="appVersion"/);
  assert.match(html, /class="skip-link"/);
  assert.match(app, /nav-item[^"]*" href="\$\{n\.hash\}/); // 시맨틱 링크 내비
  assert.match(app, /<span>\$\{esc\(n\.name\)\}<\/span>/); // 라벨 항상 표시
  assert.match(css, /\.nav-item span\{/);
  assert.match(css, /--gold/);
});

test("상단에 Codex 상태·앱 신호·전사 건강 요약이 있다", () => {
  assert.match(html, /id="codexPill"/);
  assert.match(html, /id="cxState"/);
  assert.match(html, /id="appSignals"/);
  assert.match(html, /id="cbHealth"/);
  assert.match(app, /function codexState/);
  assert.match(app, /function healthSummary/);
  assert.match(app, /function updateChrome/);
  assert.match(css, /\.codex-pill/);
  assert.match(css, /@keyframes ping/);
});

test("⌘K 명령 팔레트로 화면·앱·명령에 접근한다", () => {
  assert.match(html, /id="paletteDialog"/);
  assert.match(html, /id="paletteInput"/);
  assert.match(app, /function openPalette/);
  assert.match(app, /function paletteItems/);
  assert.match(app, /e\.key\.toLowerCase\(\)==="k"/);
  assert.match(css, /\.palette-item/);
});

test("결재는 정식 문서(decree) + 도장(seal)으로 표현한다", () => {
  assert.match(app, /function decreeCard/);
  assert.match(app, /decree-head/);
  assert.match(app, /decree-sign/);
  assert.match(app, /class="seal"/);
  assert.match(app, /sign-slot/);
  assert.match(app, /approve-proposal/);
  assert.match(css, /\.decree\{/);
  assert.match(css, /@keyframes stamp/);
  assert.match(server, /approve-proposal/);
  assert.match(server, /runDailyReviewIfDue/);
  assert.match(server, /generateProposals/);
});

test("오늘은 다열 미션 컨트롤: KPI(클릭 가능)·확인할 일·포트폴리오 매트릭스·최근 활동", () => {
  assert.match(app, /kpi-row/);
  assert.match(app, /attn-list/);
  assert.match(app, /function matrixTable/);
  assert.match(app, /class="timeline"/);
  assert.match(css, /\.grid\.main-side/);
  assert.match(css, /\.matrix\b/);
  // KPI 4장은 각각 관련 화면으로 이동하는 링크(클릭 가능)
  assert.match(app, /"#\/tasks"\)\}/); assert.match(app, /"#\/records\/approvals"\)\}/);
  assert.match(app, /class="kpi \$\{tone\} clickable"/);
  assert.match(css, /\.kpi\.clickable/);
});

test("전체 화면 밀도 축소(약 2/3) — 데스크톱만, 모바일은 원본 크기", () => {
  assert.match(css, /--ui-zoom:\.72/);
  assert.match(css, /\.hq\{zoom:var\(--ui-zoom\)/);
  assert.match(css, /width:calc\(100vw \/ var\(--ui-zoom\)\)/);
  assert.match(css, /@media \(max-width:820px\)\{\s*:root\{--ui-zoom:1\}/);
});

test("폴링은 표적 갱신: 상태 서명 비교 + 스크롤 보존 + 입력 중 재렌더 금지", () => {
  assert.match(app, /function stateSignature/);
  assert.match(app, /function safeToRerender/);
  assert.match(app, /keepScroll/);
  assert.match(app, /RENDER_SIG/);
});

test("업무 요청은 6단계 흐름 + 이미지 첨부(붙여넣기·드래그)를 지원한다", () => {
  for (const marker of ["어느 앱인가요", "무엇이 불편한가요", "어떻게 되면 만족하나요", "꼭 유지해야 하는 것은", "어디까지 자동으로"]) {
    assert.match(html, new RegExp(marker), marker);
  }
  assert.match(html, /name="autonomy"/);
  assert.match(html, /id="taskDrop"/);
  assert.match(html, /붙여넣기/);
  assert.match(app, /function addImages/);
  assert.match(app, /function stripAndResize/); // canvas 재인코딩으로 EXIF 제거
  assert.match(app, /addEventListener\("paste"/);
  assert.match(app, /\/api\/attachments/);
});

test("사용자용 상태는 단순 상태로 변환하고 색+글자로 함께 표시한다", () => {
  assert.match(app, /const SIMPLE_STATUS/);
  for (const label of ["대기", "작업 중", "검토 중", "승인 필요", "완료", "막힘", "실패", "취소"]) {
    assert.ok(app.includes(`"${label}"`), label);
  }
  assert.match(app, /statusPill/);
});

test("본사(robom)와 계열사 앱을 분리하고 예시 스냅샷도 registry 기준 6앱이다", () => {
  assert.match(app, /a\.id!=="robom"/);
  assert.match(app, /본사 시스템/);
  const example = JSON.parse(readFileSync(join(REPO_ROOT, "ops/control-center/snapshots/example.json"), "utf8"));
  const registryIds = readApps(REPO_ROOT).filter((a) => a.registered !== false).map((a) => a.id);
  const exampleFamily = example.apps.filter((a) => a.id !== "robom").map((a) => a.id);
  assert.deepEqual(exampleFamily, registryIds, "example.json 계열사 = registry 정본");
  assert.ok(example.apps.some((a) => a.id === "robom"), "본사 포함");
  assert.ok(example.apps.some((a) => a.id === "notebom"), "노트봄 포함");
});

test("Codex 미연결을 정직하게 표시하고 긴급 제어를 제공한다", () => {
  assert.match(app, /미연결|Codex 미연결/);
  assert.match(app, /not_connected/);
  assert.match(app, /pause-all/);
  assert.match(app, /\/api\/control/);
});

test("모바일 하단 탭 5개와 44px+ 조작 계약을 유지한다", () => {
  assert.match(html, /aria-label="모바일 주요 메뉴"/);
  assert.match(html, /id="tabbar"/);
  assert.match(app, /#tabbar"\)\.innerHTML=NAV\.map/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /\.tabbar\{[^}]*grid-template-columns:repeat\(5,1fr\)/);
});

test("기록 화면은 그룹형 서브내비(업무 흐름·운영 기록·시스템)를 쓴다", () => {
  assert.match(app, /const REC_SECTIONS/);
  for (const group of ["업무 흐름", "운영 기록", "시스템"]) assert.ok(app.includes(group), group);
  assert.match(app, /rec-nav/);
  assert.match(css, /\.records-wrap\{/);
  assert.match(css, /\.rec-link\.active/);
});

test("순수 수동인 회의·결정은 제거하고 아이디어 메모장으로 대체한다", () => {
  const rec = app.slice(app.indexOf("const REC_SECTIONS"), app.indexOf("const REC_IDS"));
  assert.ok(!/"회의"|"결정"|"meetings"|"decisions"/.test(rec), "회의·결정 탭 제거");
  assert.match(rec, /"ideas", "아이디어"/);
  assert.match(app, /function ideasBody/);
  assert.match(app, /function saveMemo/);
  assert.match(app, /\/api\/records\/notes/); // notes 컬렉션에 저장
  assert.match(css, /\.memo-compose/);
});

test("오피스는 부가기능(사이드바 하단)으로만 두고 제거하지 않는다", () => {
  assert.match(app, /nav-foot" href="\.\/office\.html"/);
  const navSource = app.slice(app.indexOf("const NAV"), app.indexOf("const REC_SECTIONS"));
  assert.ok(!/office/.test(navSource), "오피스는 주 메뉴가 아니다");
});

test("Pretendard(본문)와 Nanum Myeongjo(결재 명조체)를 함께 번들한다", () => {
  assert.match(css, /Pretendard Variable/);
  assert.match(css, /PretendardVariable\.woff2/);
  assert.match(css, /Nanum Myeongjo/);
  assert.match(css, /NanumMyeongjo-700\.woff2/);
  assert.ok(statSync(join(appDir, "assets/fonts/PretendardVariable.woff2")).size > 500_000, "Pretendard 실파일");
  assert.ok(statSync(join(appDir, "assets/fonts/NanumMyeongjo-700.woff2")).size > 200_000, "명조 실파일");
  const license = readFileSync(join(appDir, "assets/fonts/LICENSE.txt"), "utf8");
  assert.match(license, /SIL OPEN FONT LICENSE|OFL/i);
  const nmLicense = readFileSync(join(appDir, "assets/fonts/NanumMyeongjo-LICENSE.txt"), "utf8");
  assert.match(nmLicense, /SIL OPEN FONT LICENSE|OFL/i);
  assert.match(sw, /NanumMyeongjo-700\.woff2/); // 오프라인 셸 포함
});

test("밝은 상아 테마 + 금색 결재판(명조체 제목·낙관 도장)로 렌더한다", () => {
  assert.match(html, /content="light"/); // color-scheme: light
  assert.match(html, /theme-color" content="#f5f0e6"/); // 밝은 배경
  assert.match(css, /--serif:"Nanum Myeongjo"/);
  assert.match(css, /--gold:#8f6d22/); // 결재 금색
  assert.match(css, /\.decree-body h2\{font-family:var\(--serif\)/); // 결재 제목 명조체
  assert.match(css, /--seal:#b23a2e/); // 낙관 도장 붉은색
  assert.match(css, /@keyframes stamp/);
});

test("오프라인 셸 캐시 v5.x + API는 캐시하지 않는다", () => {
  assert.match(sw, /robom-company-os-v5\.\d/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("완전 자동: HQ가 codex-runner를 관리하고 하루 2회(6시·18시) 점검한다", () => {
  const supervisor = readFileSync(join(REPO_ROOT, "scripts/control-center/lib/runner-supervisor.mjs"), "utf8");
  assert.match(supervisor, /startRunnerSupervisor/);
  assert.match(supervisor, /discoverRepoRoot/);
  assert.match(supervisor, /ELECTRON_RUN_AS_NODE/); // Electron에서도 순수 Node로 러너 실행
  // 서버가 관리 러너를 붙이고, 점검은 슬롯(am/pm) 기반
  assert.match(server, /ROBOM_HQ_MANAGE_RUNNER/);
  assert.match(server, /startRunnerSupervisor/);
  assert.match(server, /function currentReviewSlot|currentReviewSlot\(/);
  assert.match(server, /REVIEW_HOURS/); // 하루 N회 예약 점검(설정 가능)
  assert.match(server, /ROBOM_HQ_REVIEW_HOURS/);
  assert.match(server, /reviewHours/); // hq-status로 점검 시각 노출
  // 데스크톱이 관리 러너 켜고 로그인 자동시작 기본 ON
  const main = readFileSync(join(REPO_ROOT, "desktop/main.cjs"), "utf8");
  assert.match(main, /ROBOM_HQ_MANAGE_RUNNER = "1"/);
  assert.match(main, /setLoginItemSettings\(\{ openAtLogin: true/);
  // UI가 자동 관리·점검 횟수를 정직하게 표시(점검 시각은 hq-status의 reviewHours로 동적 표기)
  assert.match(app, /자동으로 다시 켜는 중|자동 실행 중|자동 관리/);
  assert.match(app, /function reviewLabel/);
  assert.match(app, /reviewHours/);
});

test("상단에 설치 버전을 항상 표시하고 실제 앱 버전과 맞춘다", () => {
  assert.match(html, /id="appVersion"/);
  assert.match(app, /function loadVersion/);
  assert.match(app, /version\.json/);
  const ver = JSON.parse(readFileSync(join(appDir, "version.json"), "utf8")).version;
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "desktop/package.json"), "utf8")).version;
  assert.equal(ver, pkg, "version.json = desktop/package.json");
  assert.match(app, new RegExp(`HQ_VERSION="${ver.replace(/\./g, "\\.")}"`), "app.js fallback 버전 일치");
  // 데스크톱 빌드가 version.json을 실제 앱 버전으로 주입
  const prep = readFileSync(join(REPO_ROOT, "desktop/scripts/prepare-payload.mjs"), "utf8");
  assert.match(prep, /version\.json/);
  assert.match(prep, /pkg\.version/);
});

test("데스크톱 셸은 외부 링크를 https+허용 호스트로 제한한다", () => {
  const main = readFileSync(join(REPO_ROOT, "desktop/main.cjs"), "utf8");
  assert.match(main, /EXTERNAL_HOST_ALLOWLIST/);
  assert.match(main, /isAllowedExternalUrl/);
  assert.match(main, /will-navigate/);
});

test("서버는 화면 먼저·스냅샷/자동점검은 백그라운드", () => {
  const listenIndex = server.indexOf("await new Promise((resolveListen");
  const refreshIndex = server.indexOf("buildSnapshotInBackground();");
  assert.ok(listenIndex >= 0 && refreshIndex > listenIndex);
  assert.match(server, /WATCHDOG_MINUTES/);
});

test("서버 API·원격 토큰·첨부 검증 계약", () => {
  assert.match(server, /\/api\/tasks/);
  assert.match(server, /\/api\/hq-status/);
  assert.match(server, /\/api\/control/);
  assert.match(server, /\/api\/attachments/);
  assert.match(server, /IMAGE_SIGNATURES/); // 매직바이트로 이미지만 허용
  assert.match(server, /ATTACHMENT_ID/);
  assert.match(server, /ROBOM_HQ_REMOTE_TOKEN/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /LOCAL_ONLY/);
});
