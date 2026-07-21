#!/usr/bin/env node
// ROBOM Family UI OS — 패밀리 UI 계약 정합 검증 (Context&Family OS doc-03 §14·§28).
// 중앙 contract·matrix·exceptions의 자기정합과 registry 앱 커버리지를 검증한다.
// 앱 소스는 각 앱 저장소가 소유하므로 여기서는 중앙 정본만 검증한다(동시작업 안전).
// 사용법: node ops/scripts/family/check-family-ui.mjs [--json]  · 위반 시 종료코드 1.
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const C = (p) => resolve(root, "ops/family/contracts", p);
const has = (n) => process.argv.includes(`--${n}`);

if (has("help")) {
  console.log(`ROBOM 패밀리 UI 계약 검증
사용법: node ops/scripts/family/check-family-ui.mjs [--json]
종료코드: 0 통과 · 1 위반`);
  process.exit(0);
}

async function exists(abs) { try { await stat(abs); return true; } catch { return false; } }
function scalar(text, key) {
  // 최상위 또는 중첩(들여쓰기) 키 모두 매칭한다.
  const m = text.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
  return m ? m[1].trim() : null;
}
function list(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `${key}:`);
  if (start === -1) return [];
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const m = l.match(/^\s+-\s+(.+?)\s*$/);
    if (m) out.push(m[1].trim());
    else if (l.trim() && !l.startsWith(" ")) break;
  }
  return out;
}

const problems = [];
const checks = [];
const ok = (name) => checks.push({ name, pass: true });
const bad = (name, msg) => { checks.push({ name, pass: false, msg }); problems.push(`${name}: ${msg}`); };

const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
const appIds = apps.map((a) => a.id);

// 1. 앱별 design token 커버리지
for (const id of appIds) {
  (await exists(resolve(root, `ops/family/design/apps/${id}.json`)))
    ? ok(`design-token:${id}`)
    : bad(`design-token:${id}`, `ops/family/design/apps/${id}.json 없음(새 앱 profile 누락)`);
}

// 2. 설정 섹션 순서 계약
const settings = await readFile(C("settings.yml"), "utf8");
const sections = list(settings, "sections");
if (sections[0] === "app-about") ok("settings:app-about-first"); else bad("settings:app-about-first", `첫 섹션이 app-about 아님(${sections[0]})`);
if (sections[sections.length - 1] === "app-meta") ok("settings:app-meta-last"); else bad("settings:app-meta-last", "마지막 섹션이 app-meta 아님");
sections.includes("family-apps") ? ok("settings:family-apps-present") : bad("settings:family-apps-present", "family-apps 섹션 없음");
if (sections.indexOf("family-apps") < sections.indexOf("app-meta")) ok("settings:family-before-meta"); else bad("settings:family-before-meta", "family-apps가 app-meta보다 뒤");
if (sections.indexOf("notifications-and-permissions") < sections.indexOf("accessibility-and-font-size")) ok("settings:notifications-before-a11y"); else bad("settings:notifications-before-a11y", "알림이 접근성보다 뒤");
// v1.1: 다른 로봄 앱(family-apps)이 마지막 직전(제공자·버전 app-meta 바로 앞)
sections.indexOf("family-apps") === sections.length - 2 ? ok("settings:family-second-to-last") : bad("settings:family-second-to-last", `family-apps가 마지막 직전이 아님(idx ${sections.indexOf("family-apps")}/${sections.length})`);
sections.indexOf("support-and-feedback") < sections.indexOf("family-apps") ? ok("settings:support-before-family") : bad("settings:support-before-family", "문의가 다른 로봄 앱보다 뒤");
sections.indexOf("privacy-terms-and-official-notice") < sections.indexOf("family-apps") ? ok("settings:privacy-before-family") : bad("settings:privacy-before-family", "정책이 다른 로봄 앱보다 뒤");

// 3. 하단 내비 geometry + v1.1 의미 계약
const nav = await readFile(C("bottom-nav.yml"), "utf8");
const touch = parseInt(scalar(nav, "min_touch_target") || "0", 10);
touch >= 48 ? ok("nav:touch>=48") : bad("nav:touch>=48", `min_touch_target ${touch} < 48`);
scalar(nav, "safe_area_bottom") === "true" ? ok("nav:safe-area") : bad("nav:safe-area", "safe_area_bottom != true");
scalar(nav, "text_symbol_icons_forbidden") === "true" ? ok("nav:no-text-icons") : bad("nav:no-text-icons", "text_symbol_icons_forbidden != true");
scalar(nav, "content_padding_required") === "true" ? ok("nav:content-padding") : bad("nav:content-padding", "content_padding_required != true");
const maxTabs = parseInt(scalar(nav, "max_tabs") || "0", 10);
maxTabs >= 3 && maxTabs <= 5 ? ok("nav:max-tabs-3-5") : bad("nav:max-tabs-3-5", `max_tabs ${maxTabs} 범위 밖`);
// v1.1 의미 필드 — 순서·상태·접근성 계약이 파일에 명시됐는지
scalar(nav, "settings_position") === "last" ? ok("nav:settings-last") : bad("nav:settings-last", "settings_position != last");
(scalar(nav, "notifications_position") || "").includes("before-settings") ? ok("nav:alerts-before-settings") : bad("nav:alerts-before-settings", "notifications_position 계약 없음");
scalar(nav, "visible_labels_required") === "true" ? ok("nav:labels-required") : bad("nav:labels-required", "visible_labels_required != true");
scalar(nav, "active_state_not_color_only") === "true" ? ok("nav:active-not-color-only") : bad("nav:active-not-color-only", "active_state_not_color_only != true");
scalar(nav, "screen_reader_name_required") === "true" ? ok("nav:screen-reader") : bad("nav:screen-reader", "screen_reader_name_required != true");
scalar(nav, "keyboard_semantics_required") === "true" ? ok("nav:keyboard") : bad("nav:keyboard", "keyboard_semantics_required != true");
scalar(nav, "badge_requires_real_state") === "true" ? ok("nav:badge-real") : bad("nav:badge-real", "badge_requires_real_state != true");
(scalar(nav, "icon_format") || "").includes("vector") ? ok("nav:icon-vector") : bad("nav:icon-vector", "icon_format가 vector 계약 아님");

// 4. 앱바 계약
const appbar = await readFile(C("appbar.yml"), "utf8");
scalar(appbar, "safe_area_top") === "true" ? ok("appbar:safe-area-top") : bad("appbar:safe-area-top", "safe_area_top != true");
scalar(appbar, "supports_320px") === "true" ? ok("appbar:320px") : bad("appbar:320px", "supports_320px != true");
scalar(appbar, "supports_200_percent_zoom") === "true" ? ok("appbar:200%") : bad("appbar:200%", "supports_200_percent_zoom != true");
(parseInt(scalar(appbar, "min_height") || "0", 10) >= 64) ? ok("appbar:min-height>=64") : bad("appbar:min-height>=64", "min_height < 64");

// 5. 설치 경로 계약
const install = await readFile(C("install.yml"), "utf8");
(scalar(install, "stable_route") || "").includes("robom.kr/get/") ? ok("install:stable-route") : bad("install:stable-route", "stable_route가 robom.kr/get/ 아님");
scalar(install, "fake_store_url") === "false" ? ok("install:no-fake-store") : bad("install:no-fake-store", "fake_store_url != false");
scalar(install, "forced_redirect") === "false" ? ok("install:no-forced-redirect") : bad("install:no-forced-redirect", "forced_redirect != false");

// 6. 공통/개별 matrix — MUST_SHARE 근거 contract 존재
const matrix = JSON.parse(await readFile(C("COMMON-UNIQUE-MATRIX.json"), "utf8"));
for (const item of matrix.MUST_SHARE) {
  if (!item.contract) { bad(`matrix:${item.id}`, "MUST_SHARE에 contract 근거 없음"); continue; }
  (await exists(C(item.contract))) ? ok(`matrix:${item.id}->${item.contract}`) : bad(`matrix:${item.id}`, `근거 contract ${item.contract} 없음`);
}

// 7. 예외 문서화 정합
const exc = JSON.parse(await readFile(C("EXCEPTIONS.json"), "utf8"));
for (const e of exc.exceptions) {
  const label = e.id || e.app;
  if (!appIds.includes(e.app)) { bad(`exception:${label}`, `app ${e.app}가 registry에 없음`); continue; }
  if (!e.reason || !e.owner || !e.verification) { bad(`exception:${label}`, "reason·owner·verification 누락"); continue; }
  e.withinContract === true ? ok(`exception:${label}`) : bad(`exception:${label}`, "withinContract != true");
}

const passed = checks.filter((c) => c.pass).length;
if (has("json")) {
  console.log(JSON.stringify({ apps: appIds, passed, total: checks.length, problems, checks }, null, 2));
} else {
  console.log(`ROBOM 패밀리 UI 계약 검증 · 앱 ${appIds.length}개 (registry 동적)`);
  console.log(`통과 ${passed}/${checks.length}`);
  if (problems.length) { console.log("\n위반:"); for (const p of problems) console.log(`  ✗ ${p}`); }
  else console.log("모든 패밀리 UI 계약 정합 ✓");
}
process.exit(problems.length ? 1 : 0);
