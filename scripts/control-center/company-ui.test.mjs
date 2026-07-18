// ROBOM HQ 다크 관제탑 UI 계약 — 5화면·상단 Codex 상태바·라인 아이콘·이미지 첨부·자동 제안·모바일.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/sources.mjs";

const appDir = join(REPO_ROOT, "ops/control-center/app");
const html = readFileSync(join(appDir, "index.html"), "utf8");
const app = readFileSync(join(appDir, "app.js"), "utf8");
const css = readFileSync(join(appDir, "styles.css"), "utf8");
const sw = readFileSync(join(appDir, "sw.js"), "utf8");
const server = readFileSync(join(REPO_ROOT, "scripts/control-center/serve.mjs"), "utf8");

test("5화면(오늘·앱·업무·Codex·기록)만 주 메뉴로 둔다", () => {
  for (const screen of ["today", "apps", "tasks", "codex", "archive"]) {
    assert.match(app, new RegExp(`${screen}:render`, "i"), screen);
  }
  const navSource = app.slice(app.indexOf("const NAV"), app.indexOf("const SIMPLE_STATUS"));
  const ids = [...navSource.matchAll(/id:\s*"([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["today", "apps", "tasks", "codex", "archive"]);
  // 삭제된 연출 화면이 부활하지 않는다
  for (const removed of ["briefing", "broadcast", "staff", "organization", "renderGrowth", "signaturePad"]) {
    assert.ok(!app.includes(removed), removed);
  }
});

test("이모지 대신 커스텀 라인 아이콘(SVG)만 쓴다", () => {
  assert.match(app, /const ICON\s*=/);
  assert.match(app, /const SVG\s*=/);
  // 메뉴·화면 마크업에 이모지 잔재가 없어야 한다
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
  const navBlock = app.slice(app.indexOf("const NAV"), app.indexOf("function fetchJson"));
  assert.ok(!emoji.test(navBlock), "NAV/아이콘 영역에 이모지 없음");
  assert.match(html, /class="rail"/);
  assert.match(html, /class="statusbar"/);
});

test("상단에 Codex LIVE 상태바와 6앱 신호등이 있다", () => {
  assert.match(html, /id="codexPill"/);
  assert.match(html, /id="cxState"/);
  assert.match(html, /id="appSignals"/);
  assert.match(app, /function codexState/);
  assert.match(app, /function updateStatusbar/);
  assert.match(css, /\.codex-pill/);
  assert.match(css, /\.app-signals/);
  assert.match(css, /@keyframes ping/);
});

test("다크 테마 토큰과 네온 포인트를 쓴다", () => {
  assert.match(css, /--bg:#080b12/);
  assert.match(css, /--green:#35e39b/);
  assert.match(css, /color-scheme:\s*dark/i.test(css) ? /color-scheme/ : /--bg:#080b12/);
  assert.match(html, /name="theme-color" content="#080b12"/);
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

test("사용자용 상태는 단순 상태로 변환한다", () => {
  assert.match(app, /const SIMPLE_STATUS/);
  for (const label of ["대기", "작업 중", "검토 중", "승인 필요", "완료", "막힘", "실패", "취소"]) {
    assert.ok(app.includes(`"${label}"`), label);
  }
});

test("본사(robom)와 계열사 앱을 분리한다", () => {
  assert.match(app, /function familyApps\(\)\{return \(SNAP\.apps\|\|\[\]\)\.filter\(a=>a\.id!=="robom"\)/);
  assert.match(app, /본사 시스템/);
});

test("자동 점검 개선 제안을 결재로 올리고 승인하면 업무로 전환한다", () => {
  assert.match(app, /function autoCard/);
  assert.match(app, /approve-proposal/);
  assert.match(app, /시스템(이 올린 개선| 제안)/);
  assert.match(server, /approve-proposal/);
  assert.match(server, /runDailyReviewIfDue/);
  assert.match(server, /generateProposals/);
});

test("Codex 미연결을 정직하게 표시하고 긴급 제어를 제공한다", () => {
  assert.match(app, /미연결|Codex 미연결/);
  assert.match(app, /not_connected/);
  assert.match(app, /pause-all/);
  assert.match(app, /\/api\/control/);
});

test("모바일 하단 탭 5개와 46px+ 조작 계약을 유지한다", () => {
  assert.match(html, /aria-label="모바일 주요 메뉴"/);
  assert.match(html, /id="tabbar"/);
  assert.match(app, /#tabbar"\)\.innerHTML=NAV\.map/);
  assert.match(css, /\.button,\.seg button,\.attn-item\{min-height:46px\}/);
  assert.match(css, /\.tabbar\{[^}]*grid-template-columns:repeat\(5,1fr\)/);
});

test("오피스는 부가기능(레일 하단)으로만 두고 제거하지 않는다", () => {
  assert.match(app, /rail-foot" href="\.\/office\.html"/);
  const navSource = app.slice(app.indexOf("const NAV"), app.indexOf("const SIMPLE_STATUS"));
  assert.ok(!/office/.test(navSource), "오피스는 주 메뉴가 아니다");
});

test("오프라인 셸과 API 비캐시 계약을 유지한다", () => {
  assert.match(sw, /robom-company-os-v3\.2\.0/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("상단에 설치 버전을 항상 표시하고 실제 앱 버전과 맞춘다", () => {
  assert.match(html, /id="appVersion"/);
  assert.match(html, /id="brandVer"/);
  assert.match(app, /function loadVersion/);
  assert.match(app, /version\.json/);
  // 데스크톱 빌드가 version.json을 실제 앱 버전으로 주입
  const prep = readFileSync(join(REPO_ROOT, "desktop/scripts/prepare-payload.mjs"), "utf8");
  assert.match(prep, /version\.json/);
  assert.match(prep, /pkg\.version/);
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
