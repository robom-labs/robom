// 업무 대기열의 패킷 생성·잠금·복구·긴급 제어 계약을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AUTONOMY_LEVELS, buildTaskPacket, cancelPendingTask, claimNextTask, completeTask,
  enqueueTask, failTask, heartbeatTask, listQueue, queueSummary, readControl,
  recoverStaleLeases, writeControl, writeRunnerStatus,
} from "./task-queue.mjs";

const record = (over = {}) => ({
  id: `tasks_test_${Math.random().toString(36).slice(2, 8)}`,
  title: "러닝봄 카드 접수 버튼 대비 개선",
  appId: "runningbom",
  problem: "접수 버튼 글자가 흐려서 안 보인다",
  desiredOutcome: "흰 글자 고정, 대비 AA",
  priority: "high",
  autonomy: "implement_and_review",
  ...over,
});
const snapshot = { apps: [{ id: "runningbom", repo: "robom-labs/runningbom", url: "https://run.robom.kr/", git: { sha: "abc1234" } }] };

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "robom-queue-"));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("작업 패킷은 v1.2 §10.2 필수 필드를 채운다", () => {
  const packet = buildTaskPacket(record(), { snapshot });
  assert.equal(packet.target_repo, "robom-labs/runningbom");
  assert.equal(packet.base_sha, "abc1234");
  assert.equal(packet.production_url, "https://run.robom.kr/");
  assert.equal(packet.autonomy, "implement_and_review");
  assert.ok(packet.must_preserve);
  assert.ok(packet.rollback_plan);
  assert.ok(Array.isArray(packet.forbidden) && packet.forbidden.length >= 3);
});

test("autonomy가 없거나 잘못되면 안전한 기본값으로 강등한다", () => {
  assert.equal(buildTaskPacket(record({ autonomy: undefined })).autonomy, "implement_and_review");
  assert.equal(buildTaskPacket(record({ autonomy: "everything" })).autonomy, "implement_and_review");
  assert.deepEqual(AUTONOMY_LEVELS.slice(0, 2), ["research_only", "implement_and_review"]);
});

test("등록→잠금→완료 흐름과 중복 등록 금지", () => withDir((dir) => {
  const r = record();
  enqueueTask(r, { runtimeDir: dir, snapshot });
  assert.throws(() => enqueueTask(r, { runtimeDir: dir }), /이미 대기열/);
  assert.equal(listQueue(dir).pending.length, 1);

  const claimed = claimNextTask(dir, { runner: "test-runner" });
  assert.equal(claimed.task_id, r.id);
  assert.equal(claimed.lease.runner, "test-runner");
  assert.equal(listQueue(dir).pending.length, 0);
  assert.equal(listQueue(dir).running.length, 1);
  // 한 저장소 동시 쓰기 금지: 실행 중이면 새 작업을 잡지 않는다
  enqueueTask(record(), { runtimeDir: dir });
  assert.equal(claimNextTask(dir), null);

  assert.ok(heartbeatTask(r.id, { runtimeDir: dir }));
  const done = completeTask(r.id, { commitSha: "def5678" }, { runtimeDir: dir });
  assert.equal(done.result.status, "completed");
  assert.equal(listQueue(dir).running.length, 0);
  assert.equal(listQueue(dir).done.length, 1);
}));

test("실패 처리와 대기 작업 취소", () => withDir((dir) => {
  const r = record();
  enqueueTask(r, { runtimeDir: dir });
  claimNextTask(dir);
  const failed = failTask(r.id, { reason: "테스트 실패" }, { runtimeDir: dir });
  assert.equal(failed.result.status, "failed");
  const r2 = record();
  enqueueTask(r2, { runtimeDir: dir });
  assert.ok(cancelPendingTask(r2.id, { runtimeDir: dir }));
  assert.equal(cancelPendingTask(r2.id, { runtimeDir: dir }), false);
}));

test("stale lease는 pending으로 복구된다", () => withDir((dir) => {
  const r = record();
  enqueueTask(r, { runtimeDir: dir });
  const past = () => new Date("2026-01-01T00:00:00Z");
  claimNextTask(dir, { now: past });
  const recovered = recoverStaleLeases(dir, { leaseTtlMs: 1000 });
  assert.deepEqual(recovered, [r.id]);
  const queue = listQueue(dir);
  assert.equal(queue.running.length, 0);
  assert.equal(queue.pending.length, 1);
  assert.ok(queue.pending[0].recoveredFromStaleLease);
}));

test("잠금 없는 running 패킷은 갓 쓰였으면(claim 진행 중 창) 회수 안 함, 오래되면 회수 — 교차 프로세스 이중 실행 방지", () => withDir((dir) => {
  const runningDir = join(dir, "queue", "running");
  mkdirSync(runningDir, { recursive: true });
  writeFileSync(join(runningDir, "T1.json"), JSON.stringify({ task_id: "T1", title: "x" })); // lease 없음
  // 방금 쓰인 파일(mtime 신선) → claim이 lease를 쓰기 직전일 수 있으므로 회수하지 않는다.
  assert.deepEqual(recoverStaleLeases(dir, { leaseTtlMs: 60_000 }), []);
  // now를 충분히 미래로 주면 파일 mtime이 TTL을 넘긴 것으로 판정 → 진짜 정체로 보고 회수.
  assert.deepEqual(recoverStaleLeases(dir, { now: () => Date.now() + 3_600_000, leaseTtlMs: 60_000 }), ["T1"]);
}));

test("손상된 running 패킷은 조용히 사라지지 않는다 — 단일 실행 잠금 유지 + stale되면 failed로 격리", () => withDir((dir) => {
  const runningDir = join(dir, "queue", "running");
  mkdirSync(runningDir, { recursive: true });
  // JSON.parse가 실패하는 손상 패킷(예: 크래시로 잘린 쓰기)
  writeFileSync(join(runningDir, "corrupt-task.json"), '{"task_id":"corrupt-task","lease":{ 잘린-json');
  // (a) 손상돼도 '실행 중인 무언가'로 세어 새 claim을 막는다 — listState(파싱 성공만) 기준이면 이 잠금이 안 보여
  //     같은 저장소에 두 번째 작업이 동시에 잡히던 결함.
  enqueueTask(record(), { runtimeDir: dir });
  assert.equal(claimNextTask(dir), null, "손상된 running 파일이 있어도 단일 실행 잠금을 지킨다");
  // (b) 신선한 손상 파일은 아직 회수하지 않는다(claim 진행 중 창일 수 있음 — 정상 패킷과 동일 원칙).
  assert.deepEqual(recoverStaleLeases(dir, { leaseTtlMs: 60_000 }), []);
  // (c) 오래되면 조용히 사라지지 않고 failed로 격리 + 원본은 .corrupt로 증거 보존.
  const recovered = recoverStaleLeases(dir, { now: () => Date.now() + 3_600_000, leaseTtlMs: 60_000 });
  assert.deepEqual(recovered, ["corrupt-task"]);
  const queue = listQueue(dir);
  assert.equal(queue.running.length, 0);
  assert.equal(queue.failed.length, 1);
  assert.equal(queue.failed[0].corrupted, true);
  assert.match(queue.failed[0].result.reason, /손상/);
  // 이제 잠금이 풀렸으니 대기 중이던 작업을 잡을 수 있다.
  assert.ok(claimNextTask(dir));
}));

test("queueSummary는 손상된(파싱 안 되는) 패킷 수를 조용히 숨기지 않고 corrupted로 드러낸다", () => withDir((dir) => {
  const doneDir = join(dir, "queue", "done");
  mkdirSync(doneDir, { recursive: true });
  writeFileSync(join(doneDir, "broken.json"), "{ 손상됨");
  enqueueTask(record(), { runtimeDir: dir });
  const summary = queueSummary(dir);
  assert.equal(summary.pending, 1);
  assert.equal(summary.corrupted, 1, "done 폴더의 손상 파일 1개가 집계에 드러남");
}));

test("손상된 control.json은 fail-open이 아니라 안전측(일시정지)으로 읽는다", () => withDir((dir) => {
  writeFileSync(join(dir, "control.json"), "{ paused: 손상된-json");
  const c = readControl(dir);
  assert.equal(c.paused, true);
  assert.equal(c.intakeClosed, true);
  assert.equal(c.corrupt, true);
}));

test("긴급 일시정지·러너 상태·요약", () => withDir((dir) => {
  assert.equal(readControl(dir).paused, false);
  writeControl({ paused: true }, { runtimeDir: dir });
  assert.equal(readControl(dir).paused, true);
  writeRunnerStatus({ state: "idle", codex: "not_connected" }, { runtimeDir: dir });
  enqueueTask(record(), { runtimeDir: dir });
  const summary = queueSummary(dir);
  assert.equal(summary.pending, 1);
  assert.equal(summary.control.paused, true);
  assert.equal(summary.runner.state, "idle");
  assert.ok(summary.nextTask.title);
}));
