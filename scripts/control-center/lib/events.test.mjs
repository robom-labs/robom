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
