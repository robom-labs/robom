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

// 3. 하단 내비 geometry 계약
const nav = await readFile(C("bottom-nav.yml"), "utf8");
const touch = parseInt(scalar(nav, "min_touch_target") || "0", 10);
touch >= 48 ? ok("nav:touch>=48") : bad("nav:touch>=48", `min_touch_target ${touch} < 48`);
scalar(nav, "safe_area_bottom") === "true" ? ok("nav:safe-area") : bad("nav:safe-area", "safe_area_bottom != true");
scalar(nav, "text_symbol_icons_forbidden") === "true" ? ok("nav:no-text-icons") : bad("nav:no-text-icons", "text_symbol_icons_forbidden != true");
scalar(nav, "content_padding_required") === "true" ? ok("nav:content-padding") : bad("nav:content-padding", "content_padding_required != true");
const maxTabs = parseInt(scalar(nav, "max_tabs") || "0", 10);
maxTabs >= 3 && maxTabs <= 5 ? ok("nav:max-tabs-3-5") : bad("nav:max-tabs-3-5", `max_tabs ${maxTabs} 범위 밖`);

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
