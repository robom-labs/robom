// 로봄 HQ Codex 실행기 — 대기열의 작업 패킷을 Codex 구독 CLI로 실제 실행한다.
// 원칙(v1.2 §10): OpenAI API 키 금지, 구독 CLI(`codex`)만 사용. UI를 눈으로 클릭하지 않고
// 구조화된 queue를 읽는다. 한 저장소에 한 번에 하나의 쓰기 작업. 연결이 없으면 정직하게 not_connected.
// 사용:
//   node scripts/control-center/codex-runner.mjs --once     # 대기 작업 1개만 처리
//   node scripts/control-center/codex-runner.mjs            # 상주(30초 폴링, Ctrl+C 종료)
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_COMPANY_RUNTIME_DIR, createCompanyStore } from "./lib/company-store.mjs";
import {
  claimNextTask, completeTask, failTask, heartbeatTask, readControl,
  recoverStaleLeases, writeRunnerStatus,
} from "./lib/task-queue.mjs";
import { REPO_ROOT } from "./lib/sources.mjs";

const RUNTIME = DEFAULT_COMPANY_RUNTIME_DIR;
const POLL_MS = 30_000;
const TASK_TIMEOUT_MS = Number(process.env.ROBOM_HQ_TASK_TIMEOUT_MINUTES || 40) * 60_000;

export function detectCodexCli() {
  try {
    const probe = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 10_000 });
    if (probe.status === 0) return { connected: true, version: String(probe.stdout || "").trim() };
    return { connected: false, reason: `codex CLI 종료 코드 ${probe.status}` };
  } catch {
    return { connected: false, reason: "codex CLI가 설치되어 있지 않습니다." };
  }
}

// 작업 대상 저장소의 로컬 경로: robom은 이 저장소, 앱은 형제 폴더(../<repo이름>)를 찾는다.
export function resolveWorkdir(packet, repoRoot = REPO_ROOT) {
  const repo = String(packet.target_repo || "robom-labs/robom");
  const name = repo.split("/").pop();
  if (name === "robom") return repoRoot;
  const sibling = resolve(repoRoot, "..", name);
  return existsSync(join(sibling, ".git")) ? sibling : null;
}

export function buildCodexPrompt(packet) {
  return [
    `# 로봄 HQ 작업 패킷 ${packet.task_id}`,
    `대상 앱: ${packet.target_app || "회사 전체"} · 저장소: ${packet.target_repo} · 기준 SHA: ${packet.base_sha || "최신 main"}`,
    `## 요청`, packet.title,
    `## 문제`, packet.problem || "(기록 없음)",
    `## 원하는 결과`, packet.desired_outcome || "(기록 없음)",
    `## 반드시 유지`, packet.must_preserve,
    `## 완료 기준`, ...(packet.acceptance_criteria?.length ? packet.acceptance_criteria.map((x) => `- ${x}`) : ["- 구현·관련 테스트 통과·실제 화면 확인"]),
    `## 자율 범위`, packet.autonomy,
    `## 금지`, ...packet.forbidden.map((x) => `- ${x}`),
    `## 실패 시`, packet.rollback_plan,
    ``, `작업을 완료하면 변경 파일·테스트 결과·커밋 SHA를 요약하라. 실행하지 못한 검증은 실행했다고 말하지 마라.`,
  ].join("\n");
}

function log(taskId, text) {
  const dir = join(RUNTIME, "runs");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  appendFileSync(join(dir, `${taskId}.log`), `[${new Date().toISOString()}] ${text}\n`, { encoding: "utf8", mode: 0o600 });
}

async function markRecord(taskId, status) {
  try { await createCompanyStore().updateStatus("tasks", taskId, { status }); }
  catch (error) { log(taskId, `기록 상태 갱신 실패: ${error.message}`); }
}

export async function runOne({ codex = detectCodexCli() } = {}) {
  recoverStaleLeases(RUNTIME);
  const control = readControl(RUNTIME);
  if (control.paused) {
    writeRunnerStatus({ state: "paused", codex: codex.connected ? "connected" : "not_connected" }, { runtimeDir: RUNTIME });
    return { skipped: "paused" };
  }
  const packet = claimNextTask(RUNTIME, { runner: "codex-runner" });
  if (!packet) {
    writeRunnerStatus({ state: "idle", codex: codex.connected ? "connected" : "not_connected", codexDetail: codex.version || codex.reason }, { runtimeDir: RUNTIME });
    return { skipped: "empty" };
  }
  const taskId = packet.task_id;
  log(taskId, `작업 잠금: ${packet.title}`);
  if (!codex.connected) {
    log(taskId, `Codex 미연결: ${codex.reason} — 작업을 실패가 아닌 '막힘'으로 되돌립니다.`);
    failTask(taskId, { status: "blocked", reason: `NOT_CONNECTED: ${codex.reason}` }, { runtimeDir: RUNTIME });
    await markRecord(taskId, "blocked");
    writeRunnerStatus({ state: "blocked", codex: "not_connected", lastTask: taskId }, { runtimeDir: RUNTIME });
    return { blocked: taskId };
  }
  const workdir = resolveWorkdir(packet);
  if (!workdir) {
    log(taskId, `대상 저장소 로컬 복제본 없음: ${packet.target_repo}`);
    failTask(taskId, { status: "blocked", reason: `저장소 로컬 복제본이 없습니다: ${packet.target_repo}` }, { runtimeDir: RUNTIME });
    await markRecord(taskId, "blocked");
    return { blocked: taskId };
  }
  await markRecord(taskId, "in_progress");
  writeRunnerStatus({ state: "running", taskId, app: packet.target_app, codex: "connected" }, { runtimeDir: RUNTIME });
  const heartbeat = setInterval(() => heartbeatTask(taskId, { runtimeDir: RUNTIME }), 60_000);
  try {
    log(taskId, `codex exec 시작 (cwd=${workdir}, timeout=${TASK_TIMEOUT_MS / 60000}분)`);
    const result = spawnSync("codex", ["exec", "--cd", workdir, buildCodexPrompt(packet)], {
      encoding: "utf8", timeout: TASK_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024,
    });
    log(taskId, `codex 종료 코드 ${result.status}\n--- stdout(끝 4000자) ---\n${String(result.stdout || "").slice(-4000)}\n--- stderr(끝 2000자) ---\n${String(result.stderr || "").slice(-2000)}`);
    if (result.status === 0) {
      completeTask(taskId, { exitCode: 0, logTail: String(result.stdout || "").slice(-1500) }, { runtimeDir: RUNTIME });
      await markRecord(taskId, "in_review"); // 완료 표시는 사람이/검증이 확인한 뒤
      writeRunnerStatus({ state: "idle", codex: "connected", lastTask: taskId, lastResult: "completed" }, { runtimeDir: RUNTIME });
      return { completed: taskId };
    }
    failTask(taskId, { exitCode: result.status, reason: String(result.stderr || "실패").slice(-500) }, { runtimeDir: RUNTIME });
    await markRecord(taskId, "blocked");
    writeRunnerStatus({ state: "idle", codex: "connected", lastTask: taskId, lastResult: "failed" }, { runtimeDir: RUNTIME });
    return { failed: taskId };
  } finally {
    clearInterval(heartbeat);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const codex = detectCodexCli();
  console.log(`[codex-runner] Codex CLI: ${codex.connected ? `연결됨 (${codex.version})` : `미연결 — ${codex.reason}`}`);
  writeRunnerStatus({ state: "starting", codex: codex.connected ? "connected" : "not_connected", codexDetail: codex.version || codex.reason }, { runtimeDir: RUNTIME });
  if (once) { console.log("[codex-runner]", JSON.stringify(await runOne({ codex }))); return; }
  console.log(`[codex-runner] 상주 모드 · ${POLL_MS / 1000}초 폴링 (Ctrl+C 종료)`);
  // eslint 없음: 단순 상주 루프
  for (;;) {
    try { await runOne({ codex: detectCodexCli() }); }
    catch (error) { console.error("[codex-runner] 오류", error); }
    await new Promise((resolveWait) => setTimeout(resolveWait, POLL_MS));
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => { console.error("[codex-runner] 시작 실패", error); process.exitCode = 1; });
