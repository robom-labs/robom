// 로봄 80명 인력 배치·업무 상태 도출 — v2.3.0 프롬프트 PART 02·03·05·06 반영.
// 원칙(거짓 성과 금지): 직원 상태는 실제 근거(계약 판정 결과·큐 작업·회의·교대·executor heartbeat)로만 판정한다.
//   랜덤 출근·랜덤 업무 상태 금지. 인원 수 != 실제 executor 수. 복지 직원은 생활 연출(엔지니어링 KPI 제외).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./sources.mjs";

// 근무(출근) 상태 정본 enum (1G.5) — 16종. label은 회장 화면 표기.
export const ATTENDANCE = Object.freeze({
  ON_DUTY: "근무 중", MONITORING: "관제 중", HEALTH_CHECKING: "점검 중", TRIAGING: "사건 분류",
  REPAIRING: "수정 중", TESTING: "테스트 중", VERIFYING: "검증 중", DEPLOYING: "배포 중",
  MEETING: "회의 중", HANDOFF: "인수인계", BREAK: "휴식", OFF_DUTY: "비번", LEAVE: "휴가",
  STANDBY: "대기 조직", BLOCKED: "막힘", NOT_CONNECTED: "실행기 미연결",
});
// KPI 집계용 그룹(1I.10 오피스 상단·1H-B.1 오늘 KPI)
const WORKING_STATES = new Set(["REPAIRING", "TESTING", "DEPLOYING"]); // 실제 executor 작업만 '수정 중'류
const ONDUTY_STATES = new Set(["ON_DUTY", "MONITORING", "HEALTH_CHECKING", "TRIAGING", "REPAIRING", "TESTING", "VERIFYING", "DEPLOYING", "MEETING", "HANDOFF"]);

let _roster = null;
export function loadRoster(root = REPO_ROOT) {
  if (_roster) return _roster;
  try { _roster = JSON.parse(readFileSync(join(root, "ops/organization/workforce.json"), "utf8")); }
  catch { _roster = { staff: [], divisions: [], careerLadder: [] }; }
  return _roster;
}
export function invalidateRoster() { _roster = null; }

// 현재 교대조(서울) — 06-14 DAY / 14-22 EVENING / 22-06 NIGHT
export function currentShiftId(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now));
  if (h >= 6 && h < 14) return "DAY";
  if (h >= 14 && h < 22) return "EVENING";
  return "NIGHT";
}
const hash = (s) => { let n = 7; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };

// ── 계약 소유권 배정(1A.4): 각 계약 → primary_owner + independent_verifier(owner != verifier) ──
// category별 담당 역할 후보 → 대상(target)의 관련 직원 중 결정론 선택.
const APP_LEAD = { outbom: "outbom-product-lead", homebom: "homebom-product-lead", runningbom: "runningbom-product-lead", calendarbom: "calendarbom-product-lead", certbom: "certbom-product-lead", notebom: "notebom-product-lead", robom: "site-product-lead", "robom-hq": "hq-product-lead" };
const APP_DATA = { outbom: "weather-data-lead", homebom: "housing-data-lead", runningbom: "race-data-lead", calendarbom: "notification-quality-lead", certbom: "certification-data-lead", notebom: "notebom-product-lead" };
function ownerPool(target, category) {
  const lead = APP_LEAD[target] || "hq-product-lead";
  const byCat = {
    production: [lead, "sre-operator", "web-platform-lead"],
    version: [lead, "release-manager", "integration-engineer"],
    pwa: ["pwa-engineer", "web-platform-lead", lead],
    data: [APP_DATA[target] || "data-engineer", "data-engineer", lead],
    security: ["security-engineer", "privacy-officer"],
    seo: ["site-product-lead", "web-platform-lead"],
    ci: ["release-manager", "automation-engineer"],
    github: ["release-manager", "program-control-lead"],
    user_surface: ["interaction-designer", "visual-qa-designer", lead],
    self: ["runtime-operator", "automation-engineer", "sre-operator"],
    network: ["sre-operator", "supervisor"],
    roadmap: ["strategist", "portfolio-pm"],
    release: ["release-verifier", "release-manager"],
  };
  const pool = byCat[category] || [lead, "supervisor"];
  return pool;
}
const VERIFIERS = ["release-verifier", "inspector", "browser-qa-lead", "mobile-qa-lead", "accessibility-auditor", "red-team-lead", "internal-audit-director"];
export function assignOwnership(contract) {
  const pool = ownerPool(contract.target, contract.category);
  const owner = pool[hash(contract.id) % pool.length];
  let verifier = VERIFIERS[hash(contract.id + ":v") % VERIFIERS.length];
  if (verifier === owner) verifier = VERIFIERS[(hash(contract.id + ":v") + 1) % VERIFIERS.length];
  const staffIds = new Set(loadRoster().staff.map((s) => s.id));
  return { owner: staffIds.has(owner) ? owner : "supervisor", verifier: staffIds.has(verifier) ? verifier : "inspector" };
}

// ── 직원별 업무 상태 도출(21B 우선순위, 랜덤 금지) ──
// results: contract-engine report.results (각 {contractId,target,category,status,severity,...})
// tasks: company-state tasks (executor 작업), authority: {mode, approvalMode}
export function computeWorkforce({ report = null, tasks = [], authority = { mode: "RUNNING" }, now = new Date() } = {}) {
  const roster = loadRoster();
  const shift = currentShiftId(now);
  const results = report?.results || [];
  // 계약 → owner/verifier 배정 + owner별 결과 그룹
  const byOwner = {}, byVerifier = {};
  const ownership = [];
  for (const r of results) {
    if (r.needNewSource) continue;
    const { owner, verifier } = assignOwnership({ id: r.contractId, target: r.target, category: r.category });
    ownership.push({ ...r, owner, verifier });
    (byOwner[owner] = byOwner[owner] || []).push(r);
    (byVerifier[verifier] = byVerifier[verifier] || []).push(r);
  }
  // executor 작업(실제 코드 수정) — 담당 직원 매핑(assignedTo 또는 appId의 product-lead)
  const activeTasks = (tasks || []).filter((t) => !["completed", "done", "cancelled", "archived", "resolved", "dismissed", "superseded"].includes(t.status));
  const taskByStaff = {};
  for (const t of activeTasks) {
    const sid = t.assignedTo || APP_LEAD[t.appId] || (t.appId ? `${t.appId}-product-lead` : null);
    if (sid) (taskByStaff[sid] = taskByStaff[sid] || []).push(t);
  }
  const mode = authority.mode || "RUNNING";
  const companyDown = mode === "PAUSED" || mode === "EMERGENCY_STOP";
  const monitorOnly = mode === "MONITOR_ONLY" || mode === "SAFE_MODE";

  const staff = roster.staff.map((s) => {
    const owned = byOwner[s.id] || [];
    const verifies = byVerifier[s.id] || [];
    const myTasks = taskByStaff[s.id] || [];
    const failing = owned.filter((r) => r.status === "FAIL");
    const degraded = owned.filter((r) => r.status === "DEGRADED");
    let state, work = null;
    const onShift = s.shift === shift || s.division === "operations" || s.authority; // 운영·임원은 상시 커버리지

    if (s.welfare) { state = "ON_DUTY"; work = `${s.floor} 복지시설 운영 · 생활 연출`; }
    else if (s.standby) { state = "STANDBY"; work = "조직 구성 완료 · 외부 업무 대기"; }
    else if (companyDown) { state = onShift && s.authority ? "MONITORING" : "OFF_DUTY"; work = mode === "EMERGENCY_STOP" ? "긴급 정지 · 읽기 전용" : "회사 일시정지"; }
    else if (myTasks.length && !monitorOnly) {
      const t = myTasks[0], st = String(t.status || "");
      state = /deploy/.test(st) ? "DEPLOYING" : /test|verif/.test(st) ? "TESTING" : "REPAIRING";
      work = `수정 작업 · ${t.title || t.appId || "업무"}`;
    }
    else if (failing.length) {
      state = s.division === "operations" && (s.id === "incident-commander" || s.id === "supervisor") ? "TRIAGING" : "BLOCKED";
      const f = failing[0];
      work = `${state === "TRIAGING" ? "사건 분류" : "막힘"} · ${f.what || f.contractId}`;
    }
    else if (verifies.some((r) => r.status === "DEGRADED" || r.status === "FAIL")) {
      state = "VERIFYING"; const v = verifies.find((r) => r.status !== "PASS"); work = `검증 · ${v?.what || v?.contractId || "재검증"}`;
    }
    else if (!onShift) { state = "OFF_DUTY"; work = `${s.shift} 교대 · 비번`; }
    else if (owned.length) {
      // 담당 계약이 최근 점검됨 → 점검 중, 아니면 관제 대기
      const recentlyChecked = report && (now.getTime() - Date.parse(report.runAt || 0)) < 20 * 60_000;
      state = monitorOnly ? "MONITORING" : recentlyChecked ? "HEALTH_CHECKING" : "MONITORING";
      const sample = owned.find((r) => r.status !== "PASS") || owned[0];
      work = `${ATTENDANCE[state]} · ${sample?.what || sample?.target || "담당 계약"}`;
    }
    else { state = "MONITORING"; work = "관제 대기 · 담당 영역 순환"; }

    return {
      id: s.id, name: s.name, title: s.title, rank: s.rank, division: s.division, divisionName: s.divisionName,
      floor: s.floor, shift: s.shift, standby: s.standby, welfare: s.welfare, executor: s.executor, authority: s.authority,
      deputy: s.deputy, reportsTo: s.reportsTo, targets: s.targets,
      state, stateLabel: ATTENDANCE[state], currentWork: work,
      ownedCount: owned.length, verifyCount: verifies.length,
      failing: failing.length, degraded: degraded.length,
      contracts: owned.slice(0, 12).map((r) => ({ id: r.contractId, target: r.target, what: r.what, status: r.status, actual: r.actual })),
    };
  });

  // 집계
  const count = (pred) => staff.filter(pred).length;
  const summary = {
    total: staff.length,
    onDuty: count((s) => ONDUTY_STATES.has(s.state)),
    working: count((s) => WORKING_STATES.has(s.state)),
    monitoring: count((s) => s.state === "MONITORING"),
    checking: count((s) => s.state === "HEALTH_CHECKING"),
    triaging: count((s) => s.state === "TRIAGING"),
    repairing: count((s) => s.state === "REPAIRING"),
    verifying: count((s) => s.state === "VERIFYING"),
    deploying: count((s) => s.state === "DEPLOYING"),
    meeting: count((s) => s.state === "MEETING"),
    handoff: count((s) => s.state === "HANDOFF"),
    break: count((s) => s.state === "BREAK"),
    offDuty: count((s) => s.state === "OFF_DUTY"),
    standby: count((s) => s.state === "STANDBY"),
    blocked: count((s) => s.state === "BLOCKED"),
    welfare: count((s) => s.welfare),
  };
  // 본부별 집계
  const byDivision = {};
  for (const s of staff) {
    const d = byDivision[s.division] || (byDivision[s.division] = { division: s.division, divisionName: s.divisionName, total: 0, onDuty: 0, checking: 0, blocked: 0, ownedContracts: 0 });
    d.total += 1; if (ONDUTY_STATES.has(s.state)) d.onDuty += 1; if (s.state === "HEALTH_CHECKING") d.checking += 1; if (s.state === "BLOCKED") d.blocked += 1; d.ownedContracts += s.ownedCount;
  }
  return {
    companyMode: mode, approvalMode: authority.approvalMode || "CHAIRMAN_DIRECT", currentShift: shift,
    staff, summary, byDivision: Object.values(byDivision), ownership,
    executorCapacity: 0, executorBusy: WORKING_STATES.size && summary.working, // executor 미연결 시 0 (정직)
    contractsAssigned: ownership.length,
  };
}

// 조직도 트리(1G.1) — 회장 root, 감사실 회장 직속, 나머지 수석부회장 아래
export function orgTree() {
  const roster = loadRoster();
  const byId = Object.fromEntries(roster.staff.map((s) => [s.id, s]));
  const children = (pid) => roster.staff.filter((s) => s.reportsTo === pid).map((s) => ({ id: s.id, name: s.name, title: s.title, division: s.division, standby: s.standby, welfare: s.welfare, children: children(s.id) }));
  const root = byId.chairman;
  return root ? { id: root.id, name: root.name, title: root.title, children: children(root.id) } : null;
}
