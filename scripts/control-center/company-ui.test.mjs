// ROBOM HQ v1.2 정보구조(오늘·앱·업무·Codex·기록설정)와 모바일·정직성 계약을 정적으로 검증한다.
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

test("회장 메뉴는 5개(오늘·앱·업무·Codex·기록설정)로 단순화한다", () => {
  for (const screen of ["today", "apps", "tasks", "codex", "archive"]) {
    assert.match(app, new RegExp(`${screen}:render`, "i"), screen);
  }
  const menuSource = app.slice(app.indexOf("const MENU"), app.indexOf("const SCREEN_NAMES"));
  const visibleItems = [...menuSource.matchAll(/\["([a-z-]+)","[^"]+","[^"]+"\]/g)].map((match) => match[1]);
  assert.equal(visibleItems.length, 5);
  assert.deepEqual(visibleItems, ["today", "apps", "tasks", "codex", "archive"]);
  // 삭제된 연출 화면이 부활하지 않는다 (§6)
  for (const removed of ["briefing", "broadcast", "staff", "organization", "growth", "costs", "reports"]) {
    assert.ok(!visibleItems.includes(removed), removed);
  }
  assert.ok(!/signaturePad/.test(app), "서명 캔버스 연출은 제거됐다");
  assert.ok(!/signatureDialog/.test(html), "서명 다이얼로그는 제거됐다");
});

test("오늘 화면은 확인할 일→Codex→앱 전체→새 수정 요청 순서를 지킨다", () => {
  const today = app.slice(app.indexOf("function renderToday"), app.indexOf("function renderApps"));
  const order = ["내가 확인할 일", "Codex 현재 상태", "개 앱", "새 수정 요청", "일시정지"];
  let cursor = -1;
  for (const marker of order) {
    const index = today.indexOf(marker);
    assert.ok(index > cursor, `${marker} 순서`);
    cursor = index;
  }
});

test("본사 시스템과 계열사 앱을 분리한다", () => {
  assert.match(app, /function familyApps\(\)\{return \(SNAP\.apps\|\|\[\]\)\.filter\(a=>a\.id!=="robom"\)/);
  assert.match(app, /본사 시스템/);
});

test("업무 접수는 6단계 질문 흐름과 자율 범위를 받는다", () => {
  for (const marker of ["어느 앱인가요", "무엇이 불편한가요", "어떻게 되면 만족하나요", "꼭 유지해야 하는 것은", "어디까지 자동으로"]) {
    assert.match(html, new RegExp(marker), marker);
  }
  assert.match(html, /name="autonomy"/);
  assert.match(app, /\/api\/tasks/);
  assert.match(app, /research_only/);
});

test("사용자용 상태는 단순 상태로 변환해 표시한다", () => {
  assert.match(app, /const SIMPLE_STATUS/);
  for (const label of ["대기", "작업 중", "검토 중", "승인 필요", "완료", "막힘", "실패", "취소"]) {
    assert.ok(app.includes(`"${label}"`), label);
  }
});

test("Codex 화면은 미연결을 정직하게 표시하고 긴급 제어를 제공한다", () => {
  assert.match(app, /Codex 미연결/);
  assert.match(app, /not_connected/);
  assert.match(app, /모든 자동작업 일시정지/);
  assert.match(app, /pause-all/);
  assert.match(app, /\/api\/control/);
});

test("모바일 주요 메뉴 5개와 48px 조작 계약을 유지한다", () => {
  assert.match(html, /aria-label="모바일 주요 메뉴"/);
  assert.match(html, /id="moreBtn"/);
  const tabs = [...html.matchAll(/class="tab[ "]/g)];
  assert.equal(tabs.length, 5);
  assert.match(css, /\.brand,\.icon-button,\.button,\.nav-search,\.nav-item,\.chip\{min-height:48px\}/);
  assert.match(css, /\.sidebar\.open\{z-index:50\}/);
});

test("오피스는 부가기능으로 분리하되 제거하지 않는다", () => {
  assert.match(app, /로봄 오피스 보기/);
  assert.match(app, /office\.html/);
  const menuSource = app.slice(app.indexOf("const MENU"), app.indexOf("const SCREEN_NAMES"));
  assert.ok(!/office/.test(menuSource), "오피스는 주 메뉴가 아니다");
});

test("오프라인 셸과 API 비캐시 계약을 유지한다", () => {
  assert.match(sw, /robom-company-os-v3\.0\.0/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("서버는 화면을 먼저 열고 스냅샷·감시기는 백그라운드에서 돈다", () => {
  const listenIndex = server.indexOf("await new Promise((resolveListen");
  const refreshIndex = server.indexOf("buildSnapshotInBackground();");
  assert.ok(listenIndex >= 0);
  assert.ok(refreshIndex > listenIndex);
  assert.match(server, /기존 화면을 먼저 열고 스냅샷은 백그라운드에서 갱신합니다/);
  assert.match(server, /WATCHDOG_MINUTES/);
});

test("서버는 업무 접수·HQ 상태·긴급 제어 API와 원격 토큰 인증을 제공한다", () => {
  assert.match(server, /\/api\/tasks/);
  assert.match(server, /\/api\/hq-status/);
  assert.match(server, /\/api\/control/);
  assert.match(server, /ROBOM_HQ_REMOTE_TOKEN/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /LOCAL_ONLY/);
});
