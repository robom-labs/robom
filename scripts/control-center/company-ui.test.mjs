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

test("회장·회사·제품·개발·출시·운영·성장·시스템 화면을 모두 제공한다", () => {
  for (const screen of [
    "chair", "briefing", "approvals", "meetings", "portfolio", "web", "tasks", "roadmap",
    "delivery", "launch", "reviews", "design", "data", "incidents", "feedback", "growth",
    "costs", "security", "backup", "memory", "activity", "connections", "automations", "settings",
  ]) assert.match(app, new RegExp(`\\[\"${screen}\"`), screen);
});

test("모바일 주요 메뉴와 48px 조작 영역 계약을 유지한다", () => {
  assert.match(html, /aria-label="모바일 주요 메뉴"/);
  assert.match(html, /id="moreBtn"/);
  assert.match(css, /\.brand,\.icon-button,\.button,\.nav-search,\.nav-item,\.chip\{min-height:48px\}/);
  assert.match(css, /\.sidebar\.open\{z-index:50\}/);
});

test("서명·내부 기록·오프라인 셸을 명확히 분리한다", () => {
  assert.match(html, /id="recordDialog"/);
  assert.match(html, /id="signaturePad"/);
  assert.match(html, /이 서명은 로봄 본부 내부 결재 기록/);
  assert.match(sw, /robom-company-os-v2\.0\.0/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});
