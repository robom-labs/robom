// 로봄 80명 인력 배치·업무 상태 도출 — v2.4.0 "24시간 살아있는 회사".
// 원칙(거짓 성과 금지): 직원 상태는 실제 근거(계약 판정 결과·큐 작업·executor heartbeat)로만 판정한다.
//   · 24시간 무교대: 회사 가동 중이면 복지·홍보를 뺀 전원이 담당 계약을 상시 점검(실제 엔진이 매 주기 평가하는 실동작).
//   · '수정 중'(REPAIRING/TESTING/DEPLOYING)은 실제 executor 작업이 있을 때만. 없으면 점검/관제(정직).
//   · 막힘 계약은 '자동 수정 대기'(Codex가 고칠 수 있음)와 '사람 확인 필요'(키·보안·데이터소스)를 구분해 표기.
//   · 인원 수 != 실제 executor 수. 복지 7명=생활 연출(엔지니어링 KPI 제외), 홍보 4명=STANDBY.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./sources.mjs";

// 근무(출근) 상태 정본 enum — label은 회장 화면 표기.
export const ATTENDANCE = Object.freeze({
  ON_DUTY: "근무 중", MONITORING: "관제 중", HEALTH_CHECKING: "점검 중", TRIAGING: "수정 대기",
  REPAIRING: "수정 중", TESTING: "테스트 중", VERIFYING: "검증 중", DEPLOYING: "배포 중",
  MEETING: "회의 중", HANDOFF: "인수인계", BREAK: "휴식", OFF_DUTY: "비번", LEAVE: "휴가",
  STANDBY: "대기 조직", BLOCKED: "막힘", NOT_CONNECTED: "실행기 미연결",
});
// KPI 집계용 그룹
const WORKING_STATES = new Set(["REPAIRING", "TESTING", "DEPLOYING"]); // 실제 executor 작업만 '수정 중'류
const ONDUTY_STATES = new Set(["ON_DUTY", "MONITORING", "HEALTH_CHECKING", "TRIAGING", "REPAIRING", "TESTING", "VERIFYING", "DEPLOYING", "MEETING", "HANDOFF"]);
// 화면 연출용 activity 태그(오피스 캐릭터 색/링/이모지 매핑) — 상태를 8종으로 요약
const ACTIVITY = {
  REPAIRING: "repair", TESTING: "test", DEPLOYING: "deploy", VERIFYING: "verify",
  HEALTH_CHECKING: "check", MONITORING: "monitor", TRIAGING: "repairwait", BLOCKED: "block",
  MEETING: "meet", HANDOFF: "handoff", ON_DUTY: "welfare", STANDBY: "standby",
  OFF_DUTY: "off", BREAK: "off", LEAVE: "off", NOT_CONNECTED: "off",
};

let _roster = null;
export function loadRoster(root = REPO_ROOT) {
  if (_roster) return _roster;
  try { _roster = JSON.parse(readFileSync(join(root, "ops/organization/workforce.json"), "utf8")); }
  catch { _roster = { staff: [], divisions: [], careerLadder: [] }; }
  return _roster;
}
export function invalidateRoster() { _roster = null; }

// 현재 교대조(서울) — 24시간 무교대 정책이라 근무 여부엔 쓰지 않고, 화면 '지금 시간대' 표기에만 사용.
export function currentShiftId(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now));
  if (h >= 6 && h < 14) return "DAY";
  if (h >= 14 && h < 22) return "EVENING";
  return "NIGHT";
}
export const SHIFT_LABELS = Object.freeze({ DAY: "아침 관제", EVENING: "저녁 관제", NIGHT: "심야 관제" });
const hash = (s) => { let n = 7; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };

// ── 담당 역량(division → 처리 가능한 계약 category) : 전원에게 일이 돌아가도록 폭넓게 매핑 ──
const DIV_CATEGORIES = {
  product: ["user_surface", "production", "version", "data", "seo"],
  engineering: ["production", "pwa", "self", "version", "network", "storage"],
  quality: ["security", "user_surface", "ci", "release", "production"],
  data: ["data", "seo", "self", "notification"],
  design: ["user_surface", "seo"],
  operations: ["self", "network", "ci", "github", "production", "version"],
  strategy: ["roadmap", "version", "seo"],
  finance: ["security", "release"],
  audit: ["security", "self", "release"],
  future: ["roadmap", "data"],
  customer: ["user_surface", "production"],
  people: ["self"],
  facilities: ["self", "network"], // 시설·IT 담당도 역량 범주를 명시 — 없으면 전-범주 fallback으로 무관한 계약이 배정됨
  exec: ["version", "release", "self", "production"],
};
// 앱 target → 그 앱을 주로 맡는 division(제품/데이터 우선), 없으면 전 division 대상.
const APP_LEAD = { outbom: "outbom-product-lead", homebom: "homebom-product-lead", runningbom: "runningbom-product-lead", certbom: "certbom-product-lead", robom: "site-product-lead", "robom-hq": "hq-product-lead" };
const APP_DATA = { outbom: "weather-data-lead", homebom: "housing-data-lead", runningbom: "race-data-lead", certbom: "certification-data-lead" };

// 사람 확인이 꼭 필요한(자동 수정 불가) 계약 — 비밀키·보안 폐기·데이터 소스 선언·법적/스토어.
function needsHuman(c) {
  if (c.needNewSource) return { kind: "source", note: "데이터 소스 선언 필요 (회장 확인)" };
  const id = String(c.contractId || c.id || "");
  // 'qnet' 단독 토큰은 제거: qnet-https-static(package.json에 certbom 포함 여부만 보는 정보성 감사)까지
  // 비밀키 사고로 오분류돼 회장 확인으로 잘못 올라갔다. 진짜 비밀키 계약은 secret·name-safety·key 토큰으로 잡힌다.
  if (/secret|kakao-key|service-key|key-absent|name-safety/.test(id)) return { kind: "secret", note: "비밀키 폐기·교체 — 사람 확인 필요" };
  if (c.category === "security" && /secret|scan/.test(id)) return { kind: "secret", note: "보안 노출 — 사람 확인 필요" };
  return null;
}
// 계약이 어느 앱(target)에 속하든, 자동 수정 대상 여부.
function isAutoFixable(c) { return !needsHuman(c); }

// ── 단일 계약 소유권 조회(호환용): category별 후보 pool에서 결정론 선택(owner != verifier) ──
const VERIFIERS = ["release-verifier", "inspector", "browser-qa-lead", "mobile-qa-lead", "accessibility-auditor", "red-team-lead", "internal-audit-director"];
function ownerPool(target, category) {
  const lead = APP_LEAD[target] || "hq-product-lead";
  const byCat = {
    production: [lead, "sre-operator", "web-platform-lead"], version: [lead, "release-manager", "integration-engineer"],
    pwa: ["pwa-engineer", "web-platform-lead", lead], data: [APP_DATA[target] || "data-engineer", "data-engineer", lead],
    security: ["security-engineer", "privacy-officer"], seo: ["site-product-lead", "web-platform-lead"],
    ci: ["release-manager", "automation-engineer"], github: ["release-manager", "program-control-lead"],
    user_surface: ["interaction-designer", "visual-qa-designer", lead], self: ["runtime-operator", "automation-engineer", "sre-operator"],
    network: ["sre-operator", "supervisor"], roadmap: ["strategist", "portfolio-pm"], release: ["release-verifier", "release-manager"],
    storage: ["data-engineer", lead], notification: ["notification-quality-lead", "data-engineer"],
  };
  return byCat[category] || [lead, "supervisor"];
}
export function assignOwnership(contract) {
  const pool = ownerPool(contract.target, contract.category);
  const staffIds = new Set(loadRoster().staff.map((s) => s.id));
  const cand = pool.filter((x) => staffIds.has(x));
  const owner = (cand.length ? cand : ["supervisor"])[hash(contract.id) % (cand.length || 1)];
  let verifier = VERIFIERS[hash(contract.id + ":v") % VERIFIERS.length];
  if (verifier === owner) verifier = VERIFIERS[(hash(contract.id + ":v") + 1) % VERIFIERS.length];
  return { owner: staffIds.has(owner) ? owner : "supervisor", verifier: staffIds.has(verifier) ? verifier : "inspector" };
}

// ── 전원 커버리지 부하분산 배정: 모든 계약을 '역량 있는 직원 중 가장 적게 맡은 사람'에게(결정론) ──
// 이렇게 하면 계약이 특정 소수에 몰리지 않고 근무 직원 전원에게 골고루 돌아간다.
function buildAssignment(results, workingStaff) {
  const byId = Object.fromEntries(workingStaff.map((s) => [s.id, s]));
  const load = Object.fromEntries(workingStaff.map((s) => [s.id, 0]));
  const vLoad = Object.fromEntries(workingStaff.map((s) => [s.id, 0]));
  const qaStaff = workingStaff.filter((s) => s.division === "quality" || s.division === "audit" || /verifier|inspector|qa|audit|accessibility|red-team/.test(s.id));
  const eligibleFor = (target, category) => {
    // 1순위: 그 앱 담당 리드/데이터리드, 2순위: category 역량 division 전원.
    const primary = [APP_LEAD[target], APP_DATA[target]].filter((id) => byId[id]);
    const byDiv = workingStaff.filter((s) => (DIV_CATEGORIES[s.division] || []).includes(category));
    const pool = [...new Set([...primary, ...byDiv.map((s) => s.id)])];
    return pool.length ? pool : workingStaff.map((s) => s.id);
  };
  const pickLeast = (ids, loadMap) => {
    let best = ids[0], bestL = Infinity;
    for (const id of ids) { const l = loadMap[id] + (hash(id) % 7) / 100; if (l < bestL) { bestL = l; best = id; } }
    return best;
  };
  const ownership = [];
  // 결정론: 계약 id 정렬 후 순차 배정.
  const sorted = [...results].filter((r) => !r.needNewSource).sort((a, b) => String(a.contractId).localeCompare(String(b.contractId)));
  for (const r of sorted) {
    const c = { ...r, id: r.contractId };
    const ownerIds = eligibleFor(r.target, r.category);
    const owner = pickLeast(ownerIds, load); load[owner] += 1;
    let vIds = (qaStaff.length ? qaStaff : workingStaff).map((s) => s.id).filter((id) => id !== owner);
    if (!vIds.length) vIds = workingStaff.map((s) => s.id).filter((id) => id !== owner);
    const verifier = pickLeast(vIds, vLoad); vLoad[verifier] += 1;
    ownership.push({ ...r, owner, verifier, autoFix: isAutoFixable(c), human: needsHuman(c) });
  }
  // 전원 커버리지 보장(결정론): 계약 0건인 근무자에게 과다 소유자의 계약을 이관 — '전원에게 일'.
  if (ownership.length >= workingStaff.length) {
    const owned = {}; for (const o of ownership) owned[o.owner] = (owned[o.owner] || 0) + 1;
    const zero = workingStaff.filter((s) => !owned[s.id]).sort((a, b) => a.id.localeCompare(b.id));
    for (const s of zero) {
      const cats = DIV_CATEGORIES[s.division] || [];
      let idx = ownership.findIndex((o) => (owned[o.owner] || 0) > 1 && cats.includes(o.category));
      if (idx < 0) idx = ownership.findIndex((o) => (owned[o.owner] || 0) > 1);
      if (idx < 0) break;
      const o = ownership[idx];
      owned[o.owner] -= 1; o.owner = s.id; owned[s.id] = (owned[s.id] || 0) + 1;
      if (o.verifier === s.id) o.verifier = VERIFIERS.find((v) => v !== s.id) || "inspector";
    }
  }
  return ownership;
}

// ── 직원별 업무 상태 도출 (24시간 무교대, 랜덤 금지) ──
export function computeWorkforce({ report = null, tasks = [], authority = { mode: "RUNNING" }, now = new Date(), executorConnected = false } = {}) {
  const roster = loadRoster();
  const shift = currentShiftId(now);
  const results = report?.results || [];
  const mode = authority.mode || "RUNNING";
  const running = mode === "RUNNING";
  const companyDown = mode === "PAUSED" || mode === "EMERGENCY_STOP";
  const monitorOnly = mode === "MONITOR_ONLY" || mode === "SAFE_MODE";
  const draining = mode === "DRAINING";

  // 배정 대상 = 복지·홍보(대기)·회장 제외. 회장은 전 부문을 관장(총괄)하지 실무 계약을 소유하지 않는다.
  const workingStaff = roster.staff.filter((s) => !s.welfare && !s.standby && s.id !== "chairman");
  const ownership = buildAssignment(results, workingStaff);
  const byOwner = {}, byVerifier = {};
  for (const o of ownership) {
    (byOwner[o.owner] = byOwner[o.owner] || []).push(o);
    (byVerifier[o.verifier] = byVerifier[o.verifier] || []).push(o);
  }
  // 실제 executor 작업(코드 수정) — 담당 직원 매핑
  const activeTasks = (tasks || []).filter((t) => !["completed", "done", "cancelled", "archived", "resolved", "dismissed", "superseded"].includes(t.status));
  const taskByStaff = {};
  for (const t of activeTasks) {
    const sid = t.assignedTo || APP_LEAD[t.appId] || (t.appId ? `${t.appId}-product-lead` : null);
    if (sid) (taskByStaff[sid] = taskByStaff[sid] || []).push(t);
  }
  // 시간 회전 버킷(30초) — 담당 계약을 돌아가며 점검하는 '살아있는' 연출(실제 엔진도 매 주기 전수 평가).
  const bucket = Math.floor(now.getTime() / 30_000);

  let autoFixing = 0, needHuman = 0, failingTotal = 0;
  const staff = roster.staff.map((s) => {
    const owned = byOwner[s.id] || [];
    const verifies = byVerifier[s.id] || [];
    const myTasks = taskByStaff[s.id] || [];
    // FAIL뿐 아니라 DEGRADED+warning(info 아님)도 '주의 필요'다 — health 엔진은 이를 incident로 올리는데
    // workforce 헤드라인만 빼면 두 화면이 어긋난다(사건판엔 뜨는데 '실패 N'엔 안 잡힘). 같은 기준으로 맞춘다.
    const failing = owned.filter((r) => r.status === "FAIL" || (r.status === "DEGRADED" && r.severity && r.severity !== "info"));
    const failingHuman = failing.filter((r) => r.human);
    const failingAuto = failing.filter((r) => !r.human);
    let state, work = null, current = null;

    if (s.id === "chairman") { state = "ON_DUTY"; work = companyDown ? "회사 정지 관장 · 재가동 판단" : "회사 총괄 · 전 부문 관장 · 승인 전결"; }
    else if (s.welfare) { state = "ON_DUTY"; work = `${s.floor} 복지시설 운영 · 생활 연출`; }
    else if (s.standby) { state = "STANDBY"; work = "조직 구성 완료 · 외부 게시 없음(대기)"; }
    else if (companyDown) { state = s.authority || s.division === "operations" ? "MONITORING" : "OFF_DUTY"; work = mode === "EMERGENCY_STOP" ? "긴급 정지 · 읽기 전용 관제" : "회사 일시정지 · 대기"; }
    else if (myTasks.length && !monitorOnly) {
      const t = myTasks[0], st = String(t.status || "");
      // '수정 중'(WORKING)은 실행기가 실제로 도는 중일 때만. queued·blocked를 REPAIRING으로 위장하면
      // executorBusy가 executorCapacity(연결 0)를 넘고, '막힌' 업무가 '자동 수정 중'으로 뒤집혀 보인다(거짓 성과·거짓 병렬).
      const processing = executorConnected && /in_progress|implementing|working|investigating|fixing|deploy|verif/.test(st);
      const blockedTask = /block|needs_check|external_wait|held|on_hold|fail|reject/.test(st);
      if (processing) {
        state = /deploy/.test(st) ? "DEPLOYING" : /test|verif/.test(st) ? "TESTING" : "REPAIRING";
        work = `자동 수정 · ${t.title || t.appId || "업무"}`; current = { id: t.id, what: t.title, target: t.appId, status: "REPAIR" };
      } else if (blockedTask) {
        state = "BLOCKED";
        work = `막힘 · ${t.title || t.appId || "업무"} · 회장 확인/재시도 필요`; current = { id: t.id, what: t.title, target: t.appId, status: "BLOCKED" };
      } else {
        // queued·pending·in_review 등: 실행기 대기(순차) — '수정 중'으로 위장하지 않는다.
        state = "TRIAGING";
        work = `${executorConnected ? "자동 수정 대기(Codex 큐 · 순차)" : "자동 수정 대기(실행기 연결 시 시작)"} · ${t.title || t.appId || "업무"}`;
        current = { id: t.id, what: t.title, target: t.appId, status: "QUEUED" };
      }
    }
    else if (failingHuman.length) {
      state = "BLOCKED"; const f = failingHuman[0];
      work = `막힘 · ${f.human.note} · ${f.what || f.contractId}`;
      current = { id: f.contractId, what: f.what, target: f.target, status: f.status || "FAIL", auto: false, note: f.human.note };
    }
    else if (failingAuto.length && !monitorOnly) {
      // 실제 작업(myTasks)이 없으면 REPAIRING으로 위장하지 않는다. 실행기는 1대라 큐에서 순차 처리 →
      // 담당 계약이 실패라도 지금 이 사람이 '고치는 중'인 건 아니고 '자동 수정 대기(큐)'다(거짓 병렬 진행 금지).
      state = "TRIAGING";
      const f = failingAuto[(bucket + hash(s.id)) % failingAuto.length];
      work = `${executorConnected ? "자동 수정 대기(Codex 큐 · 순차)" : "자동 수정 대기(실행기 연결 시 시작)"} · ${f.what || f.contractId}`;
      current = { id: f.contractId, what: f.what, target: f.target, status: f.status || "FAIL", auto: true, note: executorConnected ? "Codex 큐에서 순차 수정 대기" : "Codex 실행기 연결 시 자동 시작" };
    }
    else if (failingAuto.length) { // monitorOnly: 수정 금지, 관제만
      state = "MONITORING"; const f = failingAuto[0]; work = `관제 · 수정 보류(관제 모드) · ${f.what || f.contractId}`;
      current = { id: f.contractId, what: f.what, target: f.target, status: "FAIL", auto: true, note: "관제 모드 — 수정 보류" };
    }
    else if (verifies.some((r) => r.status !== "PASS") && !monitorOnly) {
      state = "VERIFYING"; const v = verifies.find((r) => r.status !== "PASS");
      work = `검증 · ${v?.what || v?.contractId || "재검증"}`; current = { id: v?.contractId, what: v?.what, target: v?.target, status: "VERIFY" };
    }
    else if (owned.length && running) {
      // 24시간 상시 점검: 담당 계약을 시간 버킷으로 회전하며 점검(실제 엔진의 전수 평가와 일치).
      state = "HEALTH_CHECKING";
      const c = owned[(bucket + hash(s.id)) % owned.length];
      work = `점검 · ${c.what || c.target || "담당 계약"}`;
      current = { id: c.contractId, what: c.what, target: c.target, status: c.status || "CHECK" };
    }
    else if (owned.length) { // monitorOnly with owned
      state = "MONITORING"; const c = owned[(bucket + hash(s.id)) % owned.length];
      work = `관제 · ${c.what || c.target || "담당 계약"}`; current = { id: c.contractId, what: c.what, target: c.target, status: "MONITOR" };
    }
    else if (s.division === "operations") { state = "MONITORING"; work = "24시간 운영관제 · 회사 전역 지표 감시"; }
    else if (s.authority) { state = "MONITORING"; work = "경영 관제 · 전결·승인 대기"; }
    else { state = running ? "HEALTH_CHECKING" : "MONITORING"; work = `${s.divisionName || s.division} 영역 순환 점검`; }

    // 계약 단위로 집계한다(직원 수가 아니라). failing = failingAuto ∪ failingHuman 파티션이므로
    // contractsFailing == contractsAutoFixing + contractsNeedHuman 이 항상 성립 — 화면 숫자가 정확히 맞아떨어진다.
    // (과거엔 autoFixing이 직원 수를 세서 실패 계약 일부가 두 레인 어디에도 안 잡히고 사라졌다.)
    failingTotal += failing.length;
    needHuman += failingHuman.length;
    autoFixing += failingAuto.length;

    const activity = ACTIVITY[state] || "monitor";
    return {
      id: s.id, name: s.name, title: s.title, rank: s.rank, division: s.division, divisionName: s.divisionName,
      floor: s.floor, standby: s.standby, welfare: s.welfare, executor: s.executor, authority: s.authority,
      deputy: s.deputy, reportsTo: s.reportsTo, targets: s.targets,
      state, stateLabel: ATTENDANCE[state], activity, currentWork: work, currentContract: current,
      ownedCount: owned.length, verifyCount: verifies.length, failing: failing.length,
      failingAuto: failingAuto.length, failingHuman: failingHuman.length,
      contracts: owned.slice(0, 16).map((r) => ({ id: r.contractId, target: r.target, what: r.what, status: r.status, auto: !r.human, note: r.human?.note || null })),
    };
  });

  // needNewSource 계약은 소유자 배정에서 제외돼(buildAssignment) 어느 직원 레인에도 안 잡힌다.
  // 이는 회장이 데이터 소스를 선언해야만 풀리는 '사람 확인' 안건이므로, 실패·사람확인 총계에 더해
  // '✋ 사람 확인 필요' 레인에서 사라지지 않게 한다(숨은 회장 조치 항목 = 거짓 all-clear 방지).
  const sourceNeeded = results.filter((r) => r.needNewSource).length;
  failingTotal += sourceNeeded;
  needHuman += sourceNeeded;

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
  const byDivision = {};
  for (const s of staff) {
    const d = byDivision[s.division] || (byDivision[s.division] = { division: s.division, divisionName: s.divisionName, total: 0, onDuty: 0, checking: 0, repairing: 0, blocked: 0, ownedContracts: 0 });
    d.total += 1; if (ONDUTY_STATES.has(s.state)) d.onDuty += 1;
    if (s.state === "HEALTH_CHECKING") d.checking += 1;
    if (WORKING_STATES.has(s.state) || s.state === "TRIAGING") d.repairing += 1;
    if (s.state === "BLOCKED") d.blocked += 1; d.ownedContracts += s.ownedCount;
  }
  return {
    companyMode: mode, running, monitorOnly, draining, approvalMode: authority.approvalMode || "CHAIRMAN_DIRECT",
    currentShift: shift, shiftLabel: SHIFT_LABELS[shift], executorConnected,
    staff, summary, byDivision: Object.values(byDivision), ownership,
    executorCapacity: executorConnected ? 1 : 0, executorBusy: summary.working,
    contractsAssigned: ownership.length, contractsFailing: failingTotal,
    contractsAutoFixing: autoFixing, contractsNeedHuman: needHuman,
  };
}

// 조직도 트리 — 회장 root, 감사실 회장 직속, 나머지 수석부회장(리리) 아래.
export function orgTree() {
  const roster = loadRoster();
  const byId = Object.fromEntries(roster.staff.map((s) => [s.id, s]));
  const children = (pid) => roster.staff.filter((s) => s.reportsTo === pid).map((s) => ({
    id: s.id, name: s.name, title: s.title, rank: s.rank, division: s.division, divisionName: s.divisionName,
    standby: s.standby, welfare: s.welfare, authority: s.authority, children: children(s.id),
  }));
  const root = byId.chairman;
  return root ? { id: root.id, name: root.name, title: root.title, rank: root.rank, children: children(root.id) } : null;
}
