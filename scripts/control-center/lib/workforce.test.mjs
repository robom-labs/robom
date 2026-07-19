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
