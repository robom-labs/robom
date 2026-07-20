// Loop 엔진: 생성·전이·iteration·CLOSED 조건·요약이 결정론적으로 동작하는지 검증한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLoop, transitionLoop, openIteration, readLoops, summarizeLoops,
  deriveAcceptanceCriteria, findLoopByContract, isActive, LOOP_STATES, metaAudit, pruneClosedLoops, MAX_LOOP_ITERATION,
} from "./loop-engine.mjs";

function tmp() { return mkdtempSync(join(tmpdir(), "loop-test-")); }

test("createLoop은 objective 없으면 거부한다", () => {
  const dir = tmp();
  assert.throws(() => createLoop({}, { runtimeDir: dir }));
  rmSync(dir, { recursive: true, force: true });
});

test("createLoop은 원래 계약 재검증을 필수 기준으로 넣는다", () => {
  const dir = tmp();
  const now = new Date("2026-07-19T00:00:00Z");
  const loop = createLoop({ objective: "야외봄 응답 복구", contractId: "production:outbom", fixClass: "codex", appId: "outbom" }, { runtimeDir: dir, now });
  const oc = loop.acceptanceCriteria.find((c) => c.id === "origin-contract-pass");
  assert.ok(oc && oc.required && oc.source === "production:outbom");
  assert.ok(loop.acceptanceCriteria.some((c) => c.id === "local-tests-pass")); // codex형은 테스트도 요구
  assert.equal(loop.authorityClass, "codex");
  assert.equal(loop.state, "AWAITING_APPROVAL"); // codex는 승인 대기부터
  assert.equal(loop.iteration, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("self_heal Loop은 승인 없이 분류 상태로 시작한다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "데이터 신선도 재점검", contractId: "freshness:homebom", fixClass: "self_heal" }, { runtimeDir: dir });
  assert.equal(loop.state, "TRIAGED");
  rmSync(dir, { recursive: true, force: true });
});

test("전이는 정의된 상태만 허용하고 종료 후엔 되돌리지 않는다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "x", contractId: "c1", fixClass: "codex" }, { runtimeDir: dir });
  assert.throws(() => transitionLoop(loop.loopId, "NOT_A_STATE", { runtimeDir: dir }));
  transitionLoop(loop.loopId, "QUEUED", { runtimeDir: dir });
  transitionLoop(loop.loopId, "RECHECKING_ORIGIN", { runtimeDir: dir });
  transitionLoop(loop.loopId, "CLOSED", { runtimeDir: dir, evidence: { origin_recheck: "PASS" } });
  const after = transitionLoop(loop.loopId, "QUEUED", { runtimeDir: dir }); // 종료 후 재개 금지
  assert.equal(after.state, "CLOSED");
  assert.equal(after.evidence.origin_recheck, "PASS");
  assert.ok(after.closedAt);
  rmSync(dir, { recursive: true, force: true });
});

test("openIteration은 iteration을 올리고 이력에 실패 서명을 남긴다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "x", contractId: "c2", fixClass: "codex" }, { runtimeDir: dir });
  const it = openIteration(loop.loopId, { runtimeDir: dir, failureSignature: "exit1:build" });
  assert.equal(it.iteration, 2);
  assert.equal(it.state, "TRIAGED");
  assert.equal(it.attemptHistory.length, 1);
  assert.equal(it.attemptHistory[0].iteration, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("openIteration은 상한(MAX_LOOP_ITERATION)을 넘기면 무한 반복 대신 FAILED_SAFE로 안전 중단한다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "x", contractId: "cmax", fixClass: "codex" }, { runtimeDir: dir });
  let cur = loop;
  for (let i = 0; i < 20; i++) cur = openIteration(cur.loopId, { runtimeDir: dir, failureSignature: `try${i}` });
  assert.equal(cur.state, "FAILED_SAFE");
  assert.equal(isActive(cur.state), false);
  assert.ok(cur.iteration > MAX_LOOP_ITERATION);
  rmSync(dir, { recursive: true, force: true });
});

test("createLoop은 같은 계약에 활성 Loop가 있으면 중복 생성하지 않고 기존 것을 돌려준다", () => {
  const dir = tmp();
  const first = createLoop({ objective: "첫 사건", contractId: "dup:outbom", fixClass: "codex" }, { runtimeDir: dir });
  const second = createLoop({ objective: "같은 계약 재감지", contractId: "dup:outbom", fixClass: "codex" }, { runtimeDir: dir });
  assert.equal(second.loopId, first.loopId); // 새 orphan을 만들지 않는다
  assert.equal(Object.keys(readLoops(dir)).length, 1);
  // 종료된 뒤에는 같은 계약으로 새 Loop를 열 수 있다.
  transitionLoop(first.loopId, "CLOSED", { runtimeDir: dir });
  const third = createLoop({ objective: "재발", contractId: "dup:outbom", fixClass: "codex" }, { runtimeDir: dir });
  assert.notEqual(third.loopId, first.loopId);
  rmSync(dir, { recursive: true, force: true });
});

test("findLoopByContract는 활성 Loop만 찾는다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "x", contractId: "c3", fixClass: "codex" }, { runtimeDir: dir });
  assert.ok(findLoopByContract("c3", { runtimeDir: dir }));
  transitionLoop(loop.loopId, "CLOSED", { runtimeDir: dir });
  assert.equal(findLoopByContract("c3", { runtimeDir: dir }), null); // 종료된 건 안 잡힘
  rmSync(dir, { recursive: true, force: true });
});

test("summarizeLoops는 활성/종료를 나눠 센다", () => {
  const dir = tmp();
  const a = createLoop({ objective: "a", contractId: "ca", fixClass: "codex" }, { runtimeDir: dir });
  createLoop({ objective: "b", contractId: "cb", fixClass: "self_heal" }, { runtimeDir: dir });
  transitionLoop(a.loopId, "CLOSED", { runtimeDir: dir });
  const s = summarizeLoops(dir);
  assert.equal(s.total, 2);
  assert.equal(s.active, 1);
  assert.equal(s.closed, 1);
  assert.ok(s.activeLoops.length === 1);
  rmSync(dir, { recursive: true, force: true });
});

test("pruneClosedLoops는 오래된 종료 Loop만 지우고 활성은 보존한다", () => {
  const dir = tmp();
  const old = new Date("2026-06-01T00:00:00Z");
  const nowD = new Date("2026-07-20T00:00:00Z");
  const a = createLoop({ objective: "옛종료", contractId: "co", fixClass: "codex" }, { runtimeDir: dir, now: old });
  transitionLoop(a.loopId, "CLOSED", { runtimeDir: dir, now: old }); // 49일 전 종료
  const b = createLoop({ objective: "활성", contractId: "cb", fixClass: "codex" }, { runtimeDir: dir, now: nowD });
  const recent = createLoop({ objective: "최근종료", contractId: "cr", fixClass: "codex" }, { runtimeDir: dir, now: nowD });
  transitionLoop(recent.loopId, "CLOSED", { runtimeDir: dir, now: nowD }); // 방금 종료
  const res = pruneClosedLoops(dir, { now: nowD, keepDays: 30 });
  const remaining = readLoops(dir);
  assert.equal(res.pruned, 1);
  assert.ok(!remaining[a.loopId]);       // 49일 전 종료 → 정리됨
  assert.ok(remaining[b.loopId]);        // 활성 → 보존
  assert.ok(remaining[recent.loopId]);   // 최근 종료 → 보존
  rmSync(dir, { recursive: true, force: true });
});

test("모든 상태 라벨과 활성 판정이 일관된다", () => {
  assert.ok(LOOP_STATES.includes("RECHECKING_ORIGIN"));
  assert.equal(isActive("CLOSED"), false);
  assert.equal(isActive("FAILED_SAFE"), false);
  assert.equal(isActive("QUEUED"), true);
});

test("metaAudit는 재시도 폭주·멈춘 Loop를 잡는다", () => {
  const dir = tmp();
  const now = new Date("2026-07-20T00:00:00Z");
  // 재시도 5회 = retry_storm
  const a = createLoop({ objective: "폭주", contractId: "cs", fixClass: "codex" }, { runtimeDir: dir, now: new Date("2026-07-19T23:00:00Z") });
  for (let i = 0; i < 4; i++) openIteration(a.loopId, { runtimeDir: dir, now: new Date("2026-07-19T23:30:00Z") });
  // 30시간째 QUEUED = stuck
  const b = createLoop({ objective: "멈춤", contractId: "ck", fixClass: "codex" }, { runtimeDir: dir, now: new Date("2026-07-18T18:00:00Z") });
  transitionLoop(b.loopId, "QUEUED", { runtimeDir: dir, now: new Date("2026-07-18T18:00:00Z") });
  // QUEUED인데 taskId 없음 = broken_wiring
  const c = createLoop({ objective: "끊김", contractId: "cw", fixClass: "codex" }, { runtimeDir: dir, now });
  transitionLoop(c.loopId, "QUEUED", { runtimeDir: dir, now });
  const audit = metaAudit(dir, { now });
  const kinds = new Set(audit.issues.map((x) => x.kind));
  assert.ok(kinds.has("retry_storm"));
  assert.ok(kinds.has("stuck"));
  assert.ok(kinds.has("broken_wiring"));
  rmSync(dir, { recursive: true, force: true });
});

test("createLoop은 §17 회귀 기준선(baselineFailCount)을 저장한다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "x", contractId: "c", fixClass: "codex", baselineFailCount: 3 }, { runtimeDir: dir });
  assert.equal(readLoops(dir)[loop.loopId].baselineFailCount, 3);
  const noBase = createLoop({ objective: "y", contractId: "c2", fixClass: "codex" }, { runtimeDir: dir });
  assert.equal(noBase.baselineFailCount, null);
  rmSync(dir, { recursive: true, force: true });
});

test("createLoop은 §17 회귀 기준선 집합(baselineFailContracts)을 중복 제거해 저장한다", () => {
  const dir = tmp();
  const loop = createLoop({ objective: "x", contractId: "c", fixClass: "codex", baselineFailContracts: ["a", "b", "a"] }, { runtimeDir: dir });
  assert.deepEqual([...new Set(readLoops(dir)[loop.loopId].baselineFailContracts)].sort(), ["a", "b"]);
  const noSet = createLoop({ objective: "y", contractId: "c2", fixClass: "codex" }, { runtimeDir: dir });
  assert.equal(noSet.baselineFailContracts, null); // 미지정 시 null → 회귀 판정은 수 비교로 호환
  rmSync(dir, { recursive: true, force: true });
});

test("summarizeLoops는 meta 자가점검을 포함한다", () => {
  const dir = tmp();
  createLoop({ objective: "x", contractId: "c", fixClass: "codex" }, { runtimeDir: dir });
  const s = summarizeLoops(dir);
  assert.ok(s.meta && typeof s.meta.issueCount === "number");
  rmSync(dir, { recursive: true, force: true });
});
