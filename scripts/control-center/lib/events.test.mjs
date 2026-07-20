// 로봄 오피스 실시간 이벤트의 만료·종료 상태 판정을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveRuns, STALE_MINUTES } from "./events.mjs";

test("마지막 heartbeat가 30분을 넘으면 상태 확인 필요로 전환한다", () => {
  const createdAt = "2026-07-17T00:00:00.000Z";
  const [run] = deriveRuns([
    { runId: "stale-run", agentId: "builder", type: "heartbeat", createdAt },
  ], new Date(Date.parse(createdAt) + (STALE_MINUTES + 1) * 60_000).toISOString());
  assert.equal(run.status, "needs_check");
});

test("완료 이벤트는 시간이 지나도 상태 확인 필요로 바뀌지 않는다", () => {
  const createdAt = "2026-07-17T00:00:00.000Z";
  const [run] = deriveRuns([
    { runId: "done-run", agentId: "builder", type: "run_completed", createdAt },
  ], new Date(Date.parse(createdAt) + (STALE_MINUTES + 1) * 60_000).toISOString());
  assert.equal(run.status, "completed");
});

test("createdAt이 깨진 뒤늦은 이벤트가 완료된 작업을 '작업 중'으로 오염시키지 못한다(거짓 성과 방지)", () => {
  // 완료 후 createdAt 없는 heartbeat가 붙어도, 문자열 정렬로 last를 차지해 '작업 중'으로 되돌리면 안 된다.
  const t0 = "2026-07-17T00:00:00.000Z";
  const [run] = deriveRuns([
    { runId: "r", agentId: "builder", type: "run_completed", createdAt: t0 },
    { runId: "r", agentId: "builder", type: "heartbeat" }, // createdAt 없음(깨진 이벤트)
  ], new Date(Date.parse(t0) + 60_000).toISOString());
  assert.equal(run.status, "completed"); // 완료가 유지됨(깨진 이벤트가 last를 차지하지 못함)
});

test("활동 시각이 없는 비종료 작업은 정상이 아니라 '상태 확인 필요'로 낮춘다", () => {
  const [run] = deriveRuns([
    { runId: "r2", agentId: "builder", type: "heartbeat" }, // createdAt 없음
  ], "2026-07-17T00:00:00.000Z");
  assert.equal(run.status, "needs_check");
});

test("롤백 완료는 '배정됨'이 아니라 '되돌림(롤백)'으로 표시한다(회귀 은폐 금지)", () => {
  const t0 = "2026-07-17T00:00:00.000Z";
  const [run] = deriveRuns([
    { runId: "rb", agentId: "release", type: "task_assigned", createdAt: t0 },
    { runId: "rb", agentId: "release", type: "rollback_completed", createdAt: "2026-07-17T00:05:00.000Z" },
  ], "2026-07-17T00:06:00.000Z");
  assert.equal(run.status, "rolled_back");
});

test("알 수 없는 last.status 문자열은 라벨 없는 상태로 렌더되지 않고 이벤트 타입으로 추론한다", () => {
  const t0 = "2026-07-17T00:00:00.000Z";
  const [run] = deriveRuns([
    { runId: "u", agentId: "a", type: "test_started", status: "made_up_status", createdAt: t0 },
  ], "2026-07-17T00:01:00.000Z");
  assert.equal(run.status, "verifying"); // made_up_status는 STATUS_LABEL에 없으므로 무시하고 타입 추론
});
