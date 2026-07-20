// 로봄 오피스 실시간 이벤트의 만료·종료 상태 판정을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveRuns, STALE_MINUTES, readEventsWithMeta } from "./events.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("readEventsWithMeta는 손상 라인을 건너뛰되 그 수를 반환한다(스냅샷에서 데이터 유실 정직 표기)", () => {
  const root = mkdtempSync(join(tmpdir(), "robom-events-"));
  mkdirSync(join(root, "ops/control-center/events"), { recursive: true });
  writeFileSync(join(root, "ops/control-center/events/2026-07-17.jsonl"),
    `{"type":"run_completed","runId":"a","createdAt":"2026-07-17T00:00:00Z"}\n{"type":"run_com{깨진 줄\n{"type":"heartbeat","runId":"b","createdAt":"2026-07-17T00:01:00Z"}\n`);
  const { events, dropped } = readEventsWithMeta(root, null);
  assert.equal(dropped, 1, "손상 1줄 집계");
  assert.equal(events.length, 2, "유효 이벤트는 그대로 유지(이후 줄도 살아남음)");
});

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

test("사람 승인 대기·외부 대기는 30분이 지나도 사라지지 않는다(승인 게이트 유지)", () => {
  const createdAt = "2026-07-17T00:00:00.000Z";
  const later = new Date(Date.parse(createdAt) + (STALE_MINUTES + 10) * 60_000).toISOString();
  // 사람 승인 대기: 회장이 30분 넘게 결재 안 해도 승인함에 남아 있어야 한다(needs_check로 강등 금지).
  const [appr] = deriveRuns([
    { runId: "ap", agentId: "builder", type: "approval_requested", createdAt },
  ], later);
  assert.equal(appr.status, "approval_pending", "승인 대기는 시간 경과로 사라지지 않음");
  // 외부 작업 대기(스토어 심사 등, 며칠 소요): 명시 status로 온 경우도 유지.
  const [ext] = deriveRuns([
    { runId: "ex", agentId: "release", type: "task_assigned", status: "external_wait", createdAt },
  ], later);
  assert.equal(ext.status, "external_wait", "외부 대기는 며칠 걸려도 유지");
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
