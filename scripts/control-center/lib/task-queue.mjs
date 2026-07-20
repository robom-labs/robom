// 로봄 HQ 업무 대기열 — 회장 요청을 기계 판독 가능한 작업 패킷으로 만들고,
// Codex 실행기가 안전하게(잠금·일시정지·하트비트) 소비하도록 파일 기반 queue를 관리한다.
// 저장 위치는 runtime(비커밋) 아래이며, 한 저장소에는 한 번에 하나의 쓰기 작업만 허용한다.
import { randomUUID } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
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
const MAX_RECOVER = 3; // 자동 회수 상한 — 이보다 자주 회수되는 독성 작업은 failed로 보내 회장 확인(무한 재시도 방지)

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
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
function priorityRank(packet) {
  const rank = PRIORITY_RANK[packet?.priority];
  return rank === undefined ? PRIORITY_RANK.normal : rank;
}
function listState(runtimeDir, state) {
  const dir = stateDir(runtimeDir, state);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort()
    .map((name) => readPacket(join(dir, name))).filter(Boolean)
    // 긴급 요청이 먼저: priority → created_at → task_id 순서로 안정 정렬
    .sort((a, b) => priorityRank(a) - priorityRank(b)
      || String(a.created_at || "").localeCompare(String(b.created_at || ""))
      || String(a.task_id || "").localeCompare(String(b.task_id || "")));
}
export function listQueue(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  return Object.fromEntries(QUEUE_STATES.map((state) => [state, listState(runtimeDir, state)]));
}

// ── 잠금(lease): 한 번에 한 작업만 실행, 만료되면 자동 복구 ──
function leaseInfo(packet) { return packet?.lease || null; }
function isLeaseStale(packet, nowMs, ttlMs, fileMtimeMs = NaN) {
  const lease = leaseInfo(packet);
  if (!lease?.heartbeatAt) {
    // 잠금이 아직 없는 패킷 = claim이 진행 중인 마이크로초 창일 수 있다(pending→running rename 직후, lease 기록 전).
    // 이걸 무조건 stale로 보면 다른 프로세스(서버의 recoverStaleLeases)가 방금 잡힌 작업을 pending으로 되돌려
    // 러너가 다시 만든 running 사본과 동시에 존재 → 같은 작업 이중 실행. 파일 수정 시각으로 생존을 판단해 창을 닫는다.
    if (Number.isFinite(fileMtimeMs)) return nowMs - fileMtimeMs > ttlMs;
    return true;
  }
  return nowMs - Date.parse(lease.heartbeatAt) > ttlMs;
}

export function recoverStaleLeases(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, { now = () => Date.now(), leaseTtlMs = DEFAULT_LEASE_TTL_MS } = {}) {
  ensureDirs(runtimeDir);
  const recovered = [];
  // listState(파싱 성공만)가 아니라 원본 파일 목록을 순회한다 — 손상된(JSON.parse 실패) running 패킷은
  // 예전엔 listState의 filter(Boolean)에서 통째로 빠져 이 함수가 존재를 몰랐다: 영원히 회수되지 않는
  // 유령 잠금으로 남아 단일 실행 보장(§3 저장소당 동시 쓰기 1개)이 조용히 깨졌다(claimNextTask 참고).
  const runningDir = stateDir(runtimeDir, "running");
  const files = existsSync(runningDir) ? readdirSync(runningDir).filter((n) => n.endsWith(".json")) : [];
  for (const name of files) {
    const runningPath = join(runningDir, name);
    const taskId = name.slice(0, -5);
    const packet = readPacket(runningPath); // null이면 손상 — 아래서 조용히 넘어가지 않고 격리한다
    let mtimeMs = NaN;
    try { mtimeMs = statSync(runningPath).mtimeMs; } catch { continue; } // 파일이 이미 사라졌으면 건너뜀
    if (!isLeaseStale(packet, now(), leaseTtlMs, mtimeMs)) continue;
    if (!packet) {
      // 손상된 패킷은 내용을 복구할 수 없어 pending으로 되돌릴 수 없다. 조용히 사라지게 두는 대신
      // failed로 격리해 회장이 보게 하고(§ 정직 — 절대 침묵 실패 금지), 원본은 .corrupt로 증거 보존한다.
      const quarantined = { schemaVersion: 1, task_id: taskId, corrupted: true, title: `[손상된 작업 패킷] ${taskId}`,
        result: { status: "failed", reason: "패킷 파일이 손상되어 읽을 수 없습니다 — 회장 확인 필요", finishedAt: new Date(now()).toISOString() } };
      try { renameSync(runningPath, `${runningPath}.corrupt`); } catch { /* 이미 사라졌으면 무시 */ }
      writeFileSync(packetFile(runtimeDir, "failed", taskId), `${JSON.stringify(quarantined, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      recovered.push(taskId);
      continue;
    }
    const { lease, ...rest } = packet;
    rest.recoverCount = (Number(packet.recoverCount) || 0) + 1;
    // 독성 작업 방지: 여러 번 회수해도 끝나지 않으면 무한 재시도 대신 failed로 보내 회장 확인으로 넘긴다.
    const dest = rest.recoverCount > MAX_RECOVER ? "failed" : "pending";
    if (dest === "failed") rest.result = { status: "failed", reason: `자동 회수 ${rest.recoverCount}회 초과 — 회장 확인 필요`, finishedAt: new Date(now()).toISOString() };
    else rest.recoveredFromStaleLease = true;
    // 원자적 이동: running 파일을 갱신한 뒤 rename으로 옮긴다(두 디렉터리에 동시 존재하는 창을 없앤다).
    writeFileSync(runningPath, `${JSON.stringify(rest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(runningPath, packetFile(runtimeDir, dest, rest.task_id));
    recovered.push(rest.task_id);
  }
  return recovered;
}

export function claimNextTask(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, { runner = "codex-runner", now = () => new Date() } = {}) {
  ensureDirs(runtimeDir);
  // listState(파싱 성공만)로 세면 손상된 running 패킷이 '실행 중 없음'으로 보여, 진짜 잠금이 있는데도
  // 새 작업을 또 잡아 같은 저장소에 두 작업이 동시에 쓰는 사고가 난다. 파싱 여부와 무관하게 파일 존재로 판단한다.
  const runningDir = stateDir(runtimeDir, "running");
  const runningFiles = existsSync(runningDir) ? readdirSync(runningDir).filter((n) => n.endsWith(".json")) : [];
  if (runningFiles.length > 0) return null; // 저장소 동시 쓰기 방지: 실행 중이면 새 작업 안 잡음
  const [next] = listState(runtimeDir, "pending");
  if (!next) return null;
  // 원자적 claim: pending→running을 rename으로 먼저 확보한다. 두 러너가 같은 패킷을 노려도 rename은
  // 하나만 성공하고 진 쪽은 ENOENT로 실패 → return null. write-then-rm의 경쟁(같은 작업 이중 실행)을 없앤다.
  const src = packetFile(runtimeDir, "pending", next.task_id);
  const dst = packetFile(runtimeDir, "running", next.task_id);
  try { renameSync(src, dst); } catch { return null; }
  const claimed = {
    ...next,
    lease: { runner, leaseId: randomUUID(), claimedAt: new Date(now()).toISOString(), heartbeatAt: new Date(now()).toISOString() },
  };
  writeFileSync(dst, `${JSON.stringify(claimed, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); // 잠금 정보 기록(이미 원자적으로 running 확보됨)
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
  // 원자적 이동: 결과를 running 파일에 먼저 쓴 뒤 rename으로 done/failed로 옮긴다.
  // (과거 write-then-rm은 크래시 시 패킷이 running·done 두 곳에 동시에 남아, 이미 끝난 작업이 재실행되던 창을 만들었다.)
  writeFileSync(file, `${JSON.stringify(done, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(file, packetFile(runtimeDir, toState, taskId));
  return done;
}
export const completeTask = (taskId, result = {}, options = {}) => finishTask(taskId, "done", { status: "completed", ...result }, options);
export const failTask = (taskId, result = {}, options = {}) => finishTask(taskId, "failed", { status: "failed", ...result }, options);

// 잡은 작업을 코드 변경 없이 대기열로 되돌린다(예: claim 직후 일시정지 감지). 원자적 rename으로 옮긴다.
export function releaseTask(taskId, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR } = {}) {
  const file = packetFile(runtimeDir, "running", taskId);
  const packet = readPacket(file);
  if (!packet) return false;
  const { lease, ...rest } = packet;
  writeFileSync(file, `${JSON.stringify(rest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(file, packetFile(runtimeDir, "pending", taskId));
  return true;
}

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
  const file = controlFile(runtimeDir);
  const value = readPacket(file);
  // fail-safe: 파일은 있는데 파싱이 실패하면(손상) 일시정지가 몰래 풀리는 fail-open 대신 정지로 본다.
  // (파일이 아예 없으면 정상적으로 미정지 — 존재+손상만 안전측으로 처리.)
  if (value === null && existsSync(file)) {
    return { paused: true, intakeClosed: true, updatedAt: null, corrupt: true };
  }
  return { paused: Boolean(value?.paused), intakeClosed: Boolean(value?.intakeClosed), updatedAt: value?.updatedAt || null };
}
export function writeControl(changes, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = () => new Date() } = {}) {
  ensureDirs(runtimeDir);
  const next = { ...readControl(runtimeDir), ...changes, updatedAt: new Date(now()).toISOString() };
  // 원자적 쓰기: 쓰는 도중 크래시로 파일이 잘려 일시정지(paused)·접수중지가 몰래 false로 되돌아가는 fail-open을 막는다.
  const file = controlFile(runtimeDir);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, file);
  return next;
}
export function readRunnerStatus(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  return readPacket(runnerFile(runtimeDir)) || { state: "not_running", at: null };
}
export function writeRunnerStatus(status, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = () => new Date() } = {}) {
  ensureDirs(runtimeDir);
  const next = { ...status, at: new Date(now()).toISOString() };
  // 원자적 쓰기: 러너 상태 파일은 감독(Electron 메인)과 러너 자식이 동시에 쓴다. in-place로 쓰면
  // 조회가 반쯤 기록된 파일을 읽어 실제로 '실행 중'인 러너를 '꺼짐'으로 잘못 표시하는 거짓 성과가 생긴다.
  const file = runnerFile(runtimeDir);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, file);
  return next;
}

function rawFileCount(runtimeDir, state) {
  const dir = stateDir(runtimeDir, state);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((n) => n.endsWith(".json")).length;
}
export function queueSummary(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  const queue = listQueue(runtimeDir);
  // 손상돼 파싱 안 되는 패킷은 pending/running/... 개수에서 조용히 빠지지 않고 별도로 드러난다(§ 정직).
  const corrupted = QUEUE_STATES.reduce((sum, s) => sum + Math.max(0, rawFileCount(runtimeDir, s) - queue[s].length), 0);
  return {
    pending: queue.pending.length,
    running: queue.running.length,
    done: queue.done.length,
    failed: queue.failed.length,
    corrupted,
    runningTask: queue.running[0] ? { taskId: queue.running[0].task_id, title: queue.running[0].title, app: queue.running[0].target_app, lease: queue.running[0].lease } : null,
    nextTask: queue.pending[0] ? { taskId: queue.pending[0].task_id, title: queue.pending[0].title, app: queue.pending[0].target_app } : null,
    control: readControl(runtimeDir),
    runner: readRunnerStatus(runtimeDir),
  };
}
