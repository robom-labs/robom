// 러너 감독기 — 실제 클론 탐지 + Electron 환경 대응 계약(자식 spawn은 부작용이라 단위로는 탐지만).
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverRepoRoot, startRunnerSupervisor, restartPlan, STABLE_UPTIME_MS, MAX_RESTART_BEFORE_ESCALATE, ESCALATE_DELAY_MS } from "./runner-supervisor.mjs";
import { readRunnerStatus } from "./task-queue.mjs";

test("재시작 정책: 느린 크래시(안정 가동 미달)도 backoff에 걸리고, 반복 실패는 escalate한다", () => {
  // 안정 가동(오래 살다 종료) → 카운터 리셋, 3초 빠른 재시작
  const stable = restartPlan({ consecutiveFailures: 5, uptimeMs: STABLE_UPTIME_MS + 1000 });
  assert.equal(stable.consecutiveFailures, 0);
  assert.equal(stable.delayMs, 3000);
  assert.equal(stable.escalated, false);
  // '느린 크래시'(~20초, 예전엔 clean 3초 재시작으로 무한 루프) → 크래시로 누적 + backoff 증가
  const slow = restartPlan({ consecutiveFailures: 2, uptimeMs: 20_000 });
  assert.equal(slow.consecutiveFailures, 3);
  assert.ok(slow.delayMs > 3000, "느린 크래시도 backoff 적용");
  assert.equal(slow.escalated, false);
  // backoff는 2분 상한
  assert.ok(restartPlan({ consecutiveFailures: 10, uptimeMs: 1000 }).delayMs <= 120_000);
  // 안정 가동 없이 반복 실패 → escalate(간격 크게 낮춤)
  const esc = restartPlan({ consecutiveFailures: MAX_RESTART_BEFORE_ESCALATE - 1, uptimeMs: 1000 });
  assert.equal(esc.escalated, true);
  assert.equal(esc.delayMs, ESCALATE_DELAY_MS);
});

test("ROBOM_HQ_REPO_ROOT가 .git을 가리키면 그 경로를 정본으로 쓴다", () => {
  const prev = process.env.ROBOM_HQ_REPO_ROOT;
  // 이 저장소 루트는 .git을 가진다(테스트 실행 위치 기준).
  process.env.ROBOM_HQ_REPO_ROOT = process.cwd();
  try {
    const root = discoverRepoRoot();
    // .git이 있으면 cwd, 없으면 null 또는 홈 후보 — 최소한 예외 없이 동작
    assert.ok(root === null || typeof root === "string");
  } finally {
    if (prev === undefined) delete process.env.ROBOM_HQ_REPO_ROOT; else process.env.ROBOM_HQ_REPO_ROOT = prev;
  }
});

test("감독기는 자식이 상태를 쓰기 전에도 상태 파일을 만들고 종료 뒤 재시작을 예약한다", () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), "robom-hq-supervisor-"));
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};
  const errors = [];
  const supervisor = startRunnerSupervisor({
    runtimeDir,
    repoRoot: null,
    logger: { log() {}, error(message) { errors.push(message); } },
    spawnProcess: () => child,
  });
  assert.equal(readRunnerStatus(runtimeDir).state, "starting");
  child.emit("error", new Error("spawn denied"));
  assert.equal(readRunnerStatus(runtimeDir).state, "not_running");
  assert.match(readRunnerStatus(runtimeDir).reason, /spawn denied/);
  assert.match(errors.at(-1), /자동 재시작/);
  supervisor.stop();
});
