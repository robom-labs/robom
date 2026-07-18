// 업무 대기열의 패킷 생성·잠금·복구·긴급 제어 계약을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
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
