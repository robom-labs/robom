// 오프라인 예시 스냅샷 생성기 — ops/registry/apps.yml(정본)에서 example.json을 만든다.
// 목적: 네트워크·로컬 클론 없이 앱을 처음 켰을 때도 "6개 앱 + 본사"가 정확히 보이게 한다.
// 원칙: 연출 금지 — 확인 불가능한 값은 unknown/빈 값으로 정직하게 둔다. runs·approvals·events는 비운다.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, readApps, readDepartments, readAgents, readText, controlCenterFields } from "./lib/sources.mjs";

// 부서 정의와 동일한 사실 기반 한 줄 소개(제품 목적) — 수치·성과 주장 없음.
const ROLE = {
  robom: "로봄 지주회사 허브 — 계열사 소개·설치 진입",
  outbom: "날씨·대기질 기반 야외활동 추천",
  homebom: "청약 공고 탐색·접수 시작/마감 알림",
  runningbom: "러닝 대회 탐색·접수 알림",
  calendarbom: "계열사 일정 통합 캘린더",
  certbom: "자격증 시험 탐색·접수/시험 일정",
  notebom: "빠른 메모·기록 정리",
};

function exampleApp(app) {
  const fields = controlCenterFields(app);
  return {
    id: app.id,
    name: app.name,
    accent: app.accent || null,
    repo: app.repo || null,
    url: fields.url,
    version: app.version || null,
    registered: app.registered !== false,
    stack: app.stack || null,
    deployTarget: fields.deployTarget,
    role: ROLE[app.id] || null,
    tracked: false,
    nextActions: [],
    blocked: null,
    git: { available: false },
    github: "not_connected",
    openPrs: [],
    ci: [],
    health: "unknown",
    production: null,
    todayDeploys: 0,
    todayFails: 0,
    note: null,
  };
}

function main() {
  const sitePackage = JSON.parse(readText(join(REPO_ROOT, "site/package.json")) || "{}");
  const registryApps = readApps(REPO_ROOT).filter((a) => a.registered !== false);
  const apps = [
    exampleApp({ id: "robom", name: "로봄 본사", repo: "robom-labs/robom", version: sitePackage.version || null, web_url: "https://robom.kr/", deploy_provider: "openai-sites", registered: true }),
    ...registryApps.map(exampleApp),
  ];
  const family = apps.filter((a) => a.id !== "robom");
  const snapshot = {
    product: "ROBOM COMPANY OS · 로봄 본부",
    phase: "company-os-v2-example",
    generatedAt: null, // 예시 스냅샷 — 실제 생성 시각을 연출하지 않는다.
    example: true,
    company: {
      trafficLight: "yellow",
      apps: { total: apps.length, live: apps.length, ok: 0, warn: apps.length, down: 0, planned: 0 },
      employees: { registered: readAgents(REPO_ROOT).length, working: 0 },
      tasks: { investigating: 0, implementing: 0, verifying: 0, approvalPending: 0, blocked: 0, needsCheck: 0 },
      todayDeploys: 0,
      todayFailures: 0,
    },
    apps,
    departments: readDepartments(REPO_ROOT),
    agents: readAgents(REPO_ROOT),
    runs: [],
    approvals: [],
    events: [],
    connections: {
      github: "not_connected(예시 스냅샷 — 본부 실행 시 실제 상태로 대체)",
      localGit: [],
      events: "no_events(아직 작업 이벤트 없음)",
      codex: "runner(단일 실행기 — 모든 자동 수정은 코덱스)",
    },
    operations: { humanTasks: [], security: [] },
  };
  const out = join(REPO_ROOT, "ops/control-center/snapshots/example.json");
  writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`[robom-hq] example snapshot: 본사 1 + 계열사 ${family.length}개 (${family.map((a) => a.name).join("·")})`);
}

main();
