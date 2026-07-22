#!/usr/bin/env node
// ROBOM Context OS v1.1 — Repository/Product Profile v2 생성기 (doc-04 §V1.1-E, §10).
// registry + REPO-MAP에서 앱별 PRODUCT PROFILE을 기계 생성한다(앱 이름 하드코딩 없음).
// 자동 발견 가능한 값은 registry/REPO-MAP에서, 사람 판단 topic은 큐레이션 맵에서 채운다.
// 사용법: node ops/scripts/family/build-repo-profiles.mjs [--check]
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const check = process.argv.includes("--check");
const outDir = resolve(root, "ops/family/ai/repositories");

const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
const repoMap = await readFile(resolve(root, "ops/family/ai/REPO-MAP.yml"), "utf8");

// REPO-MAP 한 앱 블록에서 섹션 배열을 뽑는다.
function mapSection(id, section) {
  const lines = repoMap.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${id}:`));
  if (start === -1) return [];
  for (let i = start + 1; i < lines.length && !/^[a-z]/.test(lines[i]); i++) {
    const m = lines[i].match(new RegExp(`^\\s+${section}:\\s*\\[(.*)\\]`));
    if (m) return m[1].split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// 사람 판단 context_topics (doc-04 §E). 앱 핵심 관심사 — registry로 자동 발견 불가.
const TOPICS = {
  outbom: ["위치", "날씨", "대기질", "활동 점수", "추천", "준비물", "PWA"],
  homebom: ["공고", "정규화", "주택형", "가격", "Supabase", "캐시", "마감", "PWA"],
  runningbom: ["대회 catalog", "접수 링크", "상태", "정적 build", "link health", "PWA"],
  certbom: ["공식 출처", "시험 catalog", "일정", "LKG", "source monitor", "PWA"],
};
// 사람 판단 불변조건(회귀 시 사용자 피해). 이번 세션까지 확인된 것만 — 미확인은 두지 않는다.
const INVARIANTS = {
  homebom: ["공고 캐시 무효화가 마감/발표 알림 정확성을 깨지 않도록 유지"],
};

function yamlList(arr) { return arr.length ? `[${arr.map((s) => JSON.stringify(s)).join(", ")}]` : "[]"; }

function profileYaml(app) {
  const flavor = /vanilla|static|html/i.test(app.stack || "") || /runningbom/.test(app.id) ? "vanilla" : "react";
  const lines = [
    `# DO NOT EDIT by hand — build-repo-profiles.mjs 생성물 (Context OS v1.1 · doc-04 §E).`,
    `id: ${app.id}`,
    `repo: ${app.repo}`,
    `stack: ${JSON.stringify(app.stack || "")}`,
    `source_roots: ${yamlList(mapSection(app.id, "shell"))}`,
    `modules: ${yamlList(mapSection(app.id, "domain"))}`,
    `pwa_paths: ${yamlList(mapSection(app.id, "pwa"))}`,
    `generated_paths: ["generated/robom-family (또는 src/app 하위)"]`,
    `tests: ${yamlList(mapSection(app.id, "tests"))}`,
    `test_command: ${JSON.stringify(app.test || "")}`,
    `build_command: ${JSON.stringify(app.build || "")}`,
    `deploy_contract: ${JSON.stringify(`${app.deploy_provider || ""} · base ${app.base_path || "/"}`)}`,
    `production_url: ${JSON.stringify(app.web_url || "")}`,
    `health_contract: ${JSON.stringify(app.healthcheck_url || app.data_probe_url || "")}`,
    `family_ui_adapter: ${flavor}`,
    `family_spec_deployed: ${JSON.stringify(app.family_spec_version || "")}`,
    `stable_install_url: ${JSON.stringify(app.stable_install_url || "")}`,
    `context_topics: ${yamlList(TOPICS[app.id] || [])}`,
    `critical_invariants: ${yamlList(INVARIANTS[app.id] || ["설정은 마지막·다른 로봄 앱은 registry 동적", "분석 이벤트에 개인정보·비밀값 금지"])}`,
    `high_risk_paths: ${yamlList([...mapSection(app.id, "domain"), ...mapSection(app.id, "pwa")])}`,
    ``,
  ];
  return lines.join("\n");
}

await mkdir(outDir, { recursive: true });
const expected = new Map(apps.map((a) => [`${a.id}.yml`, profileYaml(a)]));
const existing = new Set((await readdir(outDir).catch(() => [])).filter((f) => f.endsWith(".yml")));

if (check) {
  const problems = [];
  for (const app of apps) {
    if (!existing.has(`${app.id}.yml`)) { problems.push(`${app.id}: PRODUCT PROFILE 없음 (build-repo-profiles.mjs 재실행 필요)`); continue; }
    const cur = await readFile(resolve(outDir, `${app.id}.yml`), "utf8");
    if (cur !== expected.get(`${app.id}.yml`)) problems.push(`${app.id}: PRODUCT PROFILE가 registry/REPO-MAP과 드리프트 (재생성 필요)`);
  }
  // registry에 없는 여분 프로파일(폐기 앱 잔존)도 경고.
  for (const f of existing) if (![...expected.keys()].includes(f) && !["robom.yml", "robom-hq.yml"].includes(f)) problems.push(`${f}: registry에 없는 여분 프로파일`);
  if (problems.length) { console.error("repo-profile 검사 실패:\n" + problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
  console.log(`repo-profile: ${apps.length}개 앱 PRODUCT PROFILE 정합 ✓`);
} else {
  for (const [name, body] of expected) await writeFile(resolve(outDir, name), body);
  console.log(`repo-profile: ${apps.length}개 앱 PRODUCT PROFILE 생성 → ops/family/ai/repositories/`);
}
