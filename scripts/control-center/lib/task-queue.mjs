// 로봄 HQ 업무 대기열 — 회장 요청을 기계 판독 가능한 작업 패킷으로 만들고,
// Codex 실행기가 안전하게(잠금·일시정지·하트비트) 소비하도록 파일 기반 queue를 관리한다.
// 저장 위치는 runtime(비커밋) 아래이며, 한 저장소에는 한 번에 하나의 쓰기 작업만 허용한다.
import { randomUUID } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_COMPANY_RUNTIME_DIR } from "./company-store.mjs";

export const AUTONOMY_LEVELS = Object.freeze([
  "research_only",            // 조사만
  "implement_and_review",     // 구현 후 검토 대기
  "implement_test_wait_for_deploy", // 구현·테스트 후 배포는 대기
  "guarded_auto_deploy",      // 보호장치 갖춘 자동 배포까지
]);
export const DEFAULT_LEASE_TTL_MS = 45 * 60 * 1000; // 45분: 넘기면 stale lease로 복구

const QUEUE_STATES = Object.freeze(["pending", "running", "done", "failed"]);

export class TaskQueueError extends Error {
  constructor(message, code = "INVALID_TASK") { super(message); this.name = "TaskQueueError"; this.code = code; }
}

function queueRoot(runtimeDir) { return join(resolve(runtimeDir), "queue"); }
function stateDir(runtimeDir, state) {
  if (!QUEUE_STATES.includes(state)) throw new TaskQueueError(`잘못된 queue 상태: ${state}`, "INVALID_STATE");
  return join(queueRoot(runtimeDir), state);
}
function ensureDirs(runtimeDir) {
  for (const state of QUEUE_STATES) mkdirSync(stateDir(runtimeDir, state), { recursive: true, mode: 0o700 });
  mkdirSync(join(resolve(runtimeDir), "runs"), { recursive: true, mode: 0o700 });
}
const packetFile = (runtimeDir, state, taskId) => join(stateDir(runtimeDir, state), `${taskId}.json`);

// ── 작업 패킷 (v1.2 §10.2) ──
export function buildTaskPacket(record, { snapshot = null, now = () => new Date() } = {}) {
  if (!record || typeof record !== "object" || !record.id || !record.title) {
    throw new TaskQueueError("record에는 id와 title이 필요합니다.");
  }
  const autonomy = record.autonomy && AUTONOMY_LEVELS.includes(record.autonomy)
    ? record.autonomy : "implement_and_review";
  const app = (snapshot?.apps || []).find((item) => item.id === record.appId) || null;
  return {
    schemaVersion: 1,
    task_id: record.id,
    created_at: new Date(now()).toISOString(),
    target_app: record.appId || null,
    target_repo: record.targetRepo || app?.repo || (record.appId ? `robom-labs/${record.appId}` : "robom-labs/robom"),
    base_sha: app?.git?.sha || app?.production?.deployedSha || null,
    title: record.title,
    problem: record.problem || record.body || "",
    desired_outcome: record.desiredOutcome || "",
    must_preserve: record.mustPreserve || "기존 사용자 데이터·저장 키·배포 경로",
    acceptance_criteria: record.acceptanceCriteria || [],
    priority: record.priority || "normal",
    autonomy,
    production_url: app?.url || null,
    required_tests: app?.id === "robom" || !app ? ["node --test scripts/control-center"] : ["앱 저장소의 기본 테스트"],
    forbidden: ["production secret 접근", "유료 API 추가", "백업 없는 대량 삭제", "테스트 실패 상태 배포"],
    rollback_plan: "작업 전 기준 SHA로 revert하고 재배포한다.",
  };
}

// ── 등록·조회 ──
export function enqueueTask(record, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, snapshot = null, now } = {}) {
  ensureDirs(runtimeDir);
  const packet = buildTaskPacket(record, { snapshot, now });
  const file = packetFile(runtimeDir, "pending", packet.task_id);
  if (existsSync(file)) throw new TaskQueueError("이미 대기열에 있는 작업입니다.", "DUPLICATE_TASK");
  writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return packet;
}

function readPacket(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}
function listState(runtimeDir, state) {
  const dir = stateDir(runtimeDir, state);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort()
    .map((name) => readPacket(join(dir, name))).filter(Boolean);
}
export function listQueue(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  return Object.fromEntries(QUEUE_STATES.map((state) => [state, listState(runtimeDir, state)]));
}

// ── 잠금(lease): 한 번에 한 작업만 실행, 만료되면 자동 복구 ──
function leaseInfo(packet) { return packet?.lease || null; }
function isLeaseStale(packet, nowMs, ttlMs) {
  const lease = leaseInfo(packet);
  if (!lease?.heartbeatAt) return true;
  return nowMs - Date.parse(lease.heartbeatAt) > ttlMs;
}

export function recoverStaleLeases(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, { now = () => Date.now(), leaseTtlMs = DEFAULT_LEASE_TTL_MS } = {}) {
  ensureDirs(runtimeDir);
  const recovered = [];
  for (const packet of listState(runtimeDir, "running")) {
    if (isLeaseStale(packet, now(), leaseTtlMs)) {
      const { lease, ...rest } = packet;
      rest.recoveredFromStaleLease = true;
      writeFileSync(packetFile(runtimeDir, "pending", rest.task_id), `${JSON.stringify(rest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      rmSync(packetFile(runtimeDir, "running", packet.task_id), { force: true });
      recovered.push(rest.task_id);
    }
  }
  return recovered;
}

export function claimNextTask(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, { runner = "codex-runner", now = () => new Date() } = {}) {
  ensureDirs(runtimeDir);
  if (listState(runtimeDir, "running").length > 0) return null; // 저장소 동시 쓰기 방지: 실행 중이면 새 작업 안 잡음
  const [next] = listState(runtimeDir, "pending");
  if (!next) return null;
  const claimed = {
    ...next,
    lease: { runner, leaseId: randomUUID(), claimedAt: new Date(now()).toISOString(), heartbeatAt: new Date(now()).toISOString() },
  };
  writeFileSync(packetFile(runtimeDir, "running", next.task_id), `${JSON.stringify(claimed, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  rmSync(packetFile(runtimeDir, "pending", next.task_id), { force: true });
  return claimed;
}

export function heartbeatTask(taskId, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = () => new Date() } = {}) {
  const file = packetFile(runtimeDir, "running", taskId);
  const packet = readPacket(file);
  if (!packet) return false;
  packet.lease = { ...(packet.lease || {}), heartbeatAt: new Date(now()).toISOString() };
  writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return true;
}

function finishTask(taskId, toState, result, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = () => new Date() } = {}) {
  const file = packetFile(runtimeDir, "running", taskId);
  const packet = readPacket(file);
  if (!packet) throw new TaskQueueError("실행 중 작업을 찾을 수 없습니다.", "NOT_RUNNING");
  const done = { ...packet, result: { ...result, finishedAt: new Date(now()).toISOString() } };
  writeFileSync(packetFile(runtimeDir, toState, taskId), `${JSON.stringify(done, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  rmSync(file, { force: true });
  return done;
}
export const completeTask = (taskId, result = {}, options = {}) => finishTask(taskId, "done", { status: "completed", ...result }, options);
export const failTask = (taskId, result = {}, options = {}) => finishTask(taskId, "failed", { status: "failed", ...result }, options);

export function cancelPendingTask(taskId, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR } = {}) {
  const file = packetFile(runtimeDir, "pending", taskId);
  if (!existsSync(file)) return false;
  rmSync(file, { force: true });
  return true;
}

// ── 긴급 제어(전체 일시정지)·러너 상태 ──
const controlFile = (runtimeDir) => join(resolve(runtimeDir), "control.json");
const runnerFile = (runtimeDir) => join(resolve(runtimeDir), "runner-status.json");

export function readControl(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  const value = readPacket(controlFile(runtimeDir));
  return { paused: Boolean(value?.paused), intakeClosed: Boolean(value?.intakeClosed), updatedAt: value?.updatedAt || null };
}
export function writeControl(changes, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = () => new Date() } = {}) {
  ensureDirs(runtimeDir);
  const next = { ...readControl(runtimeDir), ...changes, updatedAt: new Date(now()).toISOString() };
  writeFileSync(controlFile(runtimeDir), `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return next;
}
export function readRunnerStatus(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  return readPacket(runnerFile(runtimeDir)) || { state: "not_running", at: null };
}
export function writeRunnerStatus(status, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = () => new Date() } = {}) {
  ensureDirs(runtimeDir);
  const next = { ...status, at: new Date(now()).toISOString() };
  writeFileSync(runnerFile(runtimeDir), `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return next;
}

export function queueSummary(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  const queue = listQueue(runtimeDir);
  return {
    pending: queue.pending.length,
    running: queue.running.length,
    done: queue.done.length,
    failed: queue.failed.length,
    runningTask: queue.running[0] ? { taskId: queue.running[0].task_id, title: queue.running[0].title, app: queue.running[0].target_app, lease: queue.running[0].lease } : null,
    nextTask: queue.pending[0] ? { taskId: queue.pending[0].task_id, title: queue.pending[0].title, app: queue.pending[0].target_app } : null,
    control: readControl(runtimeDir),
    runner: readRunnerStatus(runtimeDir),
  };
}
