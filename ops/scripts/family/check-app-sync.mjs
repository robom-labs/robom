#!/usr/bin/env node
// ROBOM Family UI OS — 앱↔중앙 패밀리 UI 동기화 검증 (Context&Family OS doc-03 §14·§29).
// 각 앱 저장소가 소비하는 generated/robom-family 디자인 표면이 "지금 중앙 정본을 다시
// 생성했을 때"와 바이트 일치하는지 확인한다. check-family-ui.mjs가 중앙 계약의 자기정합을
// 본다면, 이 검사는 중앙↔앱 표류(design token·워드마크·아이콘·설정 계약·분석 이벤트)를 본다.
//
// - 실제 생성기(sync-app.mjs)를 그대로 호출해 임시 폴더에 재생성 → 단일 정본, 로직 중복 없음.
// - app-meta.json은 registry version·last-verified·타 앱 메타를 담아 앱 배포 이후에도
//   합법적으로 앞서 나가므로 "디자인 표류"에서 제외한다(배포 지연은 표류가 아니다).
// - 앱 저장소가 로컬에 없으면(예: 중앙 CI) 해당 앱은 'absent'로 건너뛰고 실패로 치지 않는다.
//
// 사용법: node ops/scripts/family/check-app-sync.mjs [--apps-root <dir>] [--json]
//   apps-root 기본값: 환경변수 ROBOM_APPS_ROOT 또는 /workspace
// 종료코드: 0 = 존재하는 앱 모두 동기화 · 1 = 디자인 표류 발견.
import { readFile, stat, mkdir, rm, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const val = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? null : argv[i + 1]; };

if (has("help")) {
  console.log(`ROBOM 앱↔중앙 패밀리 UI 동기화 검증
사용법: node ops/scripts/family/check-app-sync.mjs [--apps-root <dir>] [--json]
  --apps-root  앱 저장소 상위 폴더(기본: $ROBOM_APPS_ROOT 또는 /workspace)
종료코드: 0 통과(존재 앱 모두 동기화) · 1 디자인 표류`);
  process.exit(0);
}

const appsRoot = val("apps-root") || process.env.ROBOM_APPS_ROOT || "/workspace";
const syncScript = resolve(root, "ops/scripts/family/sync-app.mjs");
// app-meta.json은 배포-지연 메타이므로 디자인 표류 판정에서 제외한다.
const META = "app-meta.json";

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

// 앱 저장소 안에서 robom-family/family.lock.json 위치를 찾는다(앱마다 src/ 또는 app/).
async function findLock(appDir) {
  const stack = [appDir];
  const skip = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage"]);
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) stack.push(full); }
      else if (e.name === "family.lock.json") return full;
    }
  }
  return null;
}

const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
const results = [];
const problems = [];

for (const app of apps) {
  const appDir = resolve(appsRoot, app.id);
  if (!(await exists(appDir))) { results.push({ app: app.id, status: "absent" }); continue; }
  const lockPath = await findLock(appDir);
  if (!lockPath) { results.push({ app: app.id, status: "no-family-lock" }); continue; }
  const committed = JSON.parse(await readFile(lockPath, "utf8"));
  const flavor = "analytics-events.js" in (committed.files || {}) ? "vanilla" : "react";
  const sourceCommit = committed.sourceCommit;
  if (!/^[0-9a-f]{40}$/.test(sourceCommit || "")) { results.push({ app: app.id, status: "bad-lock-sha" }); problems.push(`${app.id}: family.lock sourceCommit이 40자리 SHA 아님`); continue; }

  const tmp = resolve(tmpdir(), `robom-app-sync-${process.pid}-${app.id}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  try {
    execFileSync("node", [syncScript, "--app", app.id, "--target", tmp, "--lock", resolve(tmp, "family.lock.json"), "--flavor", flavor, "--source-commit", sourceCommit], { cwd: root, stdio: "pipe" });
  } catch (e) {
    results.push({ app: app.id, status: "generate-error" });
    problems.push(`${app.id}: 재생성 실패 — ${(e.stderr || e.message || "").toString().trim().split("\n").pop()}`);
    await rm(tmp, { recursive: true, force: true });
    continue;
  }
  const fresh = JSON.parse(await readFile(resolve(tmp, "family.lock.json"), "utf8")).files;
  await rm(tmp, { recursive: true, force: true });

  // 디자인 표면(=app-meta 제외) 파일 해시 대조.
  const designKeys = Object.keys(committed.files || {}).filter((k) => k !== META);
  const drift = designKeys.filter((k) => committed.files[k] !== fresh[k]);
  // 중앙에 새로 생긴 디자인 파일이 앱 lock엔 없는 경우(계약 확장 미반영)도 표류로 본다.
  const missing = Object.keys(fresh).filter((k) => k !== META && !(k in (committed.files || {})));
  const metaStale = committed.files?.[META] !== fresh[META];

  if (drift.length || missing.length) {
    results.push({ app: app.id, status: "drift", flavor, drift, missing, metaStale });
    problems.push(`${app.id}: 디자인 표류 ${[...drift, ...missing.map((m) => `+${m}`)].join(", ")}`);
  } else {
    results.push({ app: app.id, status: "synced", flavor, metaStale });
  }
}

const present = results.filter((r) => !["absent"].includes(r.status));
const synced = results.filter((r) => r.status === "synced");
if (has("json")) {
  console.log(JSON.stringify({ appsRoot, total: apps.length, checked: present.length, synced: synced.length, problems, results }, null, 2));
} else {
  console.log(`ROBOM 앱↔중앙 패밀리 UI 동기화 · apps-root=${appsRoot}`);
  for (const r of results) {
    const mark = r.status === "synced" ? "✓" : r.status === "absent" ? "·" : "✗";
    const extra = r.status === "synced" ? (r.metaStale ? " (디자인 동기화 · 메타는 배포 이후 앞섬)" : " (완전 동기화)")
      : r.status === "drift" ? ` → ${[...(r.drift || []), ...((r.missing || []).map((m) => `+${m}`))].join(", ")}`
      : ` (${r.status})`;
    console.log(`  ${mark} ${r.app}${extra}`);
  }
  console.log(`\n검사 ${present.length}개 중 디자인 동기화 ${synced.length}개 · 표류 ${problems.length}개`);
  if (!problems.length) console.log("존재하는 모든 앱이 중앙 패밀리 UI 정본과 일치 ✓");
}
process.exit(problems.length ? 1 : 0);
