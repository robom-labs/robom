import test from "node:test";
import assert from "node:assert/strict";
import { loadRoster, computeWorkforce, assignOwnership, orgTree, currentShiftId, ATTENDANCE } from "./workforce.mjs";
import { buildContractCatalog } from "./contract-catalog.mjs";
import { readApps, REPO_ROOT } from "./sources.mjs";

const roster = loadRoster(REPO_ROOT);

test("80명 정본 roster — id 고유·보고선/대직 유효·순환 0", () => {
  assert.equal(roster.staff.length, 80);
  const ids = new Set(roster.staff.map((s) => s.id));
  assert.equal(ids.size, 80, "id 중복 0");
  for (const s of roster.staff) {
    assert.ok(s.name && s.title && s.division, `${s.id} 필드`);
    if (s.reportsTo) assert.ok(ids.has(s.reportsTo), `${s.id} 보고선`);
    if (s.deputy) assert.ok(ids.has(s.deputy), `${s.id} 대직`);
  }
  // 계층 순환 0
  const by = Object.fromEntries(roster.staff.map((s) => [s.id, s.reportsTo]));
  for (const s of roster.staff) {
    let cur = s.reportsTo, g = 0, seen = false;
    while (cur && g++ < 20) { if (cur === s.id) { seen = true; break; } cur = by[cur]; }
    assert.ok(!seen, `${s.id} 순환`);
  }
});

test("복지 7명=생활 연출(executor 아님) · 홍보 4명 STANDBY", () => {
  const welfare = roster.staff.filter((s) => s.welfare);
  assert.ok(welfare.length >= 7);
  assert.ok(welfare.every((s) => !s.executor), "복지는 executor 아님");
  const growth = roster.staff.filter((s) => s.division === "growth");
  assert.ok(growth.length >= 4);
  assert.ok(growth.every((s) => s.standby), "홍보 전원 STANDBY");
});

test("계약 소유권 배정 — owner 지정 + 구현자≠검증자", () => {
  const registryApps = readApps(REPO_ROOT).filter((a) => a.registered);
  const contracts = buildContractCatalog({ registryApps, siteVersion: "0.0.0" }).filter((c) => !c.needNewSource);
  const ids = new Set(roster.staff.map((s) => s.id));
  for (const c of contracts.slice(0, 120)) {
    const { owner, verifier } = assignOwnership({ id: c.id, target: c.target, category: c.category });
    assert.ok(ids.has(owner), `${c.id} owner ${owner}`);
    assert.ok(ids.has(verifier), `${c.id} verifier`);
    assert.notEqual(owner, verifier, `${c.id} 구현=검증 금지`);
  }
});

test("직원 상태는 계약 판정 근거로 도출 — FAIL 소유자는 막힘, 랜덤 아님", () => {
  const report = { runAt: new Date().toISOString(), results: [
    { contractId: "c:homebom:notices-http", target: "homebom", category: "data", status: "FAIL", what: "공고 probe", needNewSource: false },
    { contractId: "c:outbom:production-home", target: "outbom", category: "production", status: "PASS", what: "운영", needNewSource: false },
  ] };
  const out = computeWorkforce({ report, tasks: [], authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z") }); // 서울 13시=DAY
  assert.equal(out.staff.length, 80);
  assert.equal(out.companyMode, "RUNNING");
  // 결정론: 같은 입력 → 같은 출력
  const out2 = computeWorkforce({ report, tasks: [], authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z") });
  assert.deepEqual(out.staff.map((s) => s.state), out2.staff.map((s) => s.state), "결정론적");
  // 청약봄 데이터 FAIL 소유자 중 한 명은 막힘/사건분류
  const blockedOrTriage = out.staff.filter((s) => ["BLOCKED", "TRIAGING"].includes(s.state));
  assert.ok(blockedOrTriage.length >= 1, "FAIL 소유자 막힘");
  // 모든 상태는 ATTENDANCE enum 안
  for (const s of out.staff) assert.ok(ATTENDANCE[s.state], `${s.id} 상태 ${s.state}`);
});

test("PAUSED·EMERGENCY_STOP에서는 대부분 근무 아님(수정 0)", () => {
  const report = { runAt: new Date().toISOString(), results: [] };
  const out = computeWorkforce({ report, tasks: [], authority: { mode: "EMERGENCY_STOP" }, now: new Date() });
  assert.equal(out.summary.repairing, 0);
  assert.equal(out.summary.deploying, 0);
});

test("복지 직원은 executor 없이도 생활 연출 ON_DUTY", () => {
  const out = computeWorkforce({ report: { results: [] }, tasks: [], authority: { mode: "RUNNING" }, now: new Date() });
  const pool = out.staff.find((s) => s.id === "pool-manager");
  assert.ok(pool);
  assert.equal(pool.welfare, true);
  assert.equal(pool.state, "ON_DUTY");
});

test("조직도 트리 — 회장 root, 감사·수석부회장 직속", () => {
  const t = orgTree();
  assert.equal(t.id, "chairman");
  const direct = t.children.map((c) => c.id);
  assert.ok(direct.includes("executive-vice-chair"));
  assert.ok(direct.includes("internal-audit-director"), "감사 회장 직속");
});

test("교대조 계산 — 서울 시각 기준", () => {
  assert.equal(currentShiftId(new Date("2026-07-19T01:00:00Z")), "DAY"); // 서울 10시
  assert.equal(currentShiftId(new Date("2026-07-19T09:00:00Z")), "EVENING"); // 서울 18시
  assert.equal(currentShiftId(new Date("2026-07-19T16:00:00Z")), "NIGHT"); // 서울 01시
});

test("24시간 무교대·전원 배정 — 가동 중 근무자(복지·홍보·회장 제외) OFF_DUTY 0 + 전원 담당 계약", () => {
  const registryApps = readApps(REPO_ROOT).filter((a) => a.registered);
  const contracts = buildContractCatalog({ registryApps, siteVersion: "0.0.0" }).filter((c) => !c.needNewSource);
  const results = contracts.map((c) => ({ contractId: c.id, target: c.target, category: c.category, status: "PASS", what: c.what }));
  const out = computeWorkforce({ report: { runAt: new Date().toISOString(), results }, tasks: [], authority: { mode: "RUNNING" }, now: new Date("2026-07-19T16:00:00Z") }); // 서울 01시(심야)라도 근무
  const working = out.staff.filter((s) => !s.welfare && !s.standby && s.id !== "chairman");
  assert.ok(working.length >= 60, "근무 대상 다수");
  assert.equal(working.filter((s) => s.state === "OFF_DUTY").length, 0, "무교대 — 비번 0");
  assert.equal(working.filter((s) => s.ownedCount === 0).length, 0, "전원 담당 계약 보유");
  // 회장은 총괄(실무 계약 미소유)
  const chair = out.staff.find((s) => s.id === "chairman");
  assert.equal(chair.ownedCount, 0);
  assert.match(chair.currentWork, /총괄/);
});

test("2인자 = 리리(수석부회장) · 회장 직속", () => {
  const vc = roster.staff.find((s) => s.id === "executive-vice-chair");
  assert.equal(vc.name, "리리");
  assert.equal(vc.reportsTo, "chairman");
  const t = orgTree();
  assert.ok(t.children.some((c) => c.id === "executive-vice-chair" && c.name === "리리"));
});

test("막힘 계약 자동수정/사람확인 구분 — 비밀키는 사람 확인, 나머지는 자동", () => {
  const report = { runAt: new Date().toISOString(), results: [
    { contractId: "c:outbom:secret-scan", target: "outbom", category: "security", status: "FAIL", what: "secret", needNewSource: false },
    { contractId: "c:outbom:production-home", target: "outbom", category: "production", status: "FAIL", what: "운영 첫 화면", needNewSource: false },
  ] };
  const out = computeWorkforce({ report, tasks: [], authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z"), executorConnected: false });
  assert.ok(out.contractsNeedHuman >= 1, "비밀키는 사람 확인 필요");
  assert.ok(out.contractsAutoFixing >= 1, "운영 장애는 자동 수정 대기");
});

test("실행기가 연결돼도 실제 작업(task)이 없으면 '수정 중'으로 위장하지 않는다(거짓 병렬 진행 금지)", () => {
  const report = { runAt: new Date().toISOString(), results: [
    { contractId: "c:outbom:production-home", target: "outbom", category: "production", status: "FAIL", what: "운영 첫 화면", needNewSource: false },
    { contractId: "c:homebom:ci-latest", target: "homebom", category: "data", status: "FAIL", what: "CI", needNewSource: false },
  ] };
  // executorConnected=true 이지만 tasks=[] (실행기 유휴). 실행기는 1대뿐이라 병렬 '수정 중'은 거짓이다.
  const out = computeWorkforce({ report, tasks: [], authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z"), executorConnected: true });
  assert.equal(out.summary.repairing, 0, "실제 작업이 없으면 REPAIRING 0");
  assert.ok(out.contractsAutoFixing >= 2, "실패 계약은 자동 수정 '대기'로는 잡힌다");
});

test("queued·blocked 업무는 '자동 수정 중'으로 위장하지 않는다 — executorBusy가 capacity를 넘지 않음", () => {
  const report = { runAt: new Date().toISOString(), results: [] };
  const tasks = [
    { id: "t1", appId: "outbom", status: "queued", title: "대기 업무" },
    { id: "t2", appId: "homebom", status: "blocked", title: "막힌 업무" },
    { id: "t3", appId: "certbom", status: "in_progress", title: "실제 진행" },
  ];
  // 실행기 미연결: 아무도 실제로 '수정 중'이 아니다 → busy 0, capacity 0(자기모순 없음).
  const off = computeWorkforce({ report, tasks, authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z"), executorConnected: false });
  assert.equal(off.executorCapacity, 0);
  assert.equal(off.executorBusy, 0, "미연결이면 REPAIRING 0");
  assert.ok(off.staff.some((s) => s.state === "BLOCKED"), "blocked 업무 담당자는 BLOCKED(자동 수정 아님)");
  // 실행기 연결: in_progress 업무만 REPAIRING → busy ≤ capacity.
  const on = computeWorkforce({ report, tasks, authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z"), executorConnected: true });
  assert.ok(on.executorBusy <= on.executorCapacity, `busy(${on.executorBusy}) ≤ capacity(${on.executorCapacity})`);
  assert.ok(on.staff.some((s) => s.state === "TRIAGING"), "queued 업무는 TRIAGING(대기)");
});

test("needNewSource 계약은 어느 레인에도 사라지지 않고 '사람 확인 필요'로 집계된다", () => {
  const report = { runAt: new Date().toISOString(), results: [
    { contractId: "c:certbom:new-source", target: "certbom", category: "data", status: "FAIL", what: "새 데이터 소스 필요", needNewSource: true },
  ] };
  const out = computeWorkforce({ report, tasks: [], authority: { mode: "RUNNING" }, now: new Date("2026-07-19T04:00:00Z"), executorConnected: true });
  assert.ok(out.contractsNeedHuman >= 1, "소스 선언 필요는 회장 확인 항목으로 집계");
  assert.ok(out.contractsFailing >= 1, "실패 총계에도 포함 — '전 계약 정상' 위장 금지");
});
