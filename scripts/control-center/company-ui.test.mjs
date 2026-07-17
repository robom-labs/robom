// ROBOM Company OS의 핵심 경영 화면·모바일 조작·오프라인 계약을 정적으로 검증한다.
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

test("세부 화면은 유지하고 회장 메뉴만 핵심 항목으로 축소한다", () => {
  for (const screen of [
    "chair", "briefing", "approvals", "meetings", "portfolio", "web", "tasks", "roadmap",
    "delivery", "launch", "reviews", "design", "data", "incidents", "feedback", "growth",
    "costs", "security", "backup", "memory", "activity", "connections", "automations", "settings",
  ]) assert.match(app, new RegExp(`${screen}:render`, "i"), screen);

  const menuSource = app.slice(app.indexOf("const MENU"), app.indexOf("const SCREEN_NAMES"));
  const visibleItems = [...menuSource.matchAll(/\["([a-z-]+)","[^"]+","[^"]+"\]/g)].map((match) => match[1]);
  assert.equal(visibleItems.length, 13);
  for (const screen of ["chair", "approvals", "office", "portfolio", "tasks", "launch", "delivery", "data", "incidents", "costs", "meetings", "memory", "settings"]) {
    assert.ok(visibleItems.includes(screen), screen);
  }
  for (const screen of ["growth", "security", "connections", "automations", "activity"]) {
    assert.ok(!visibleItems.includes(screen), screen);
  }
  assert.match(app, /회장 바로가기/);
});

test("모바일 주요 메뉴와 48px 조작 영역 계약을 유지한다", () => {
  assert.match(html, /aria-label="모바일 주요 메뉴"/);
  assert.match(html, /id="moreBtn"/);
  assert.match(css, /\.brand,\.icon-button,\.button,\.nav-search,\.nav-item,\.chip\{min-height:48px\}/);
  assert.match(css, /\.sidebar\.open\{z-index:50\}/);
});

test("업무 지시는 담당 직원과 연결해 저장한다", () => {
  assert.match(html, /id="recordAssigneeWrap" hidden/);
  assert.match(html, /name="assignedTo" id="recordAssignee"/);
  assert.match(app, /function fillAssigneeSelect/);
  assert.match(app, /payload\.assignedTo=String\(fd\.get\("assignedTo"\)\)/);
  assert.match(app, /담당 · \$\{esc\(agentName\(r\.assignedTo\)\)\}/);
});

test("서명·내부 기록·오프라인 셸을 명확히 분리한다", () => {
  assert.match(html, /id="recordDialog"/);
  assert.match(html, /id="signaturePad"/);
  assert.match(html, /이 서명은 로봄 본부 내부 결재 기록/);
  assert.match(sw, /robom-company-os-v2\.1\.0/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});
