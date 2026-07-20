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
  claimNextTask, completeTask, failTask, heartbeatTask, readControl, releaseTask,
  recoverStaleLeases, writeRunnerStatus, DEFAULT_LEASE_TTL_MS,
} from "./lib/task-queue.mjs";
import { REPO_ROOT } from "./lib/sources.mjs";

const RUNTIME = DEFAULT_COMPANY_RUNTIME_DIR;
const POLL_MS = 30_000;
// 작업 제한시간은 lease TTL보다 항상 짧게 강제한다(마진 5분). 그렇지 않으면 실행 중인 작업의 lease가
// 만료돼 다른 claimant가 같은 작업을 이중 실행할 수 있다(spawnSync가 이벤트루프를 막아 heartbeat가 못 뛰므로 특히 위험).
const TASK_TIMEOUT_MS = Math.min(
  Number(process.env.ROBOM_HQ_TASK_TIMEOUT_MINUTES || 40) * 60_000,
  DEFAULT_LEASE_TTL_MS - 5 * 60_000,
);

export function detectCodexCli() {
  try {
    const probe = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 10_000 });
    if (probe.status === 0) return { connected: true, version: String(probe.stdout || "").trim() };
    return { connected: false, reason: `codex CLI 종료 코드 ${probe.status}` };
  } catch {
    return { connected: false, reason: "codex CLI가 설치되어 있지 않습니다." };
  }
}

// codex exec 실패 원인을 결정론적으로 분류한다. 용량/토큰 소진·요청 한도(rate limit)와 로그인 만료를
// 일반 코드 실패와 구분해, 화면에 "용량 소진"·"로그인 필요"로 정직하게 띄운다.
export function classifyCodexFailure(stderr = "", stdout = "") {
  // 분류는 stderr(CLI가 내는 구조화된 에러)를 본다. 모델의 자유 서술(stdout)에 'auth/login/401/billing'이
  // 들어 있어도 그건 작업 내용일 뿐 실패 원인이 아니므로, stdout에서는 산문에 안 나오는 아주 구체적인
  // 토큰(insufficient_quota·resource_exhausted)만 인정한다. 과거 bare 'auth/login/401/429' 매칭이 실패를
  // 오분류해 회장에게 엉뚱한 조치(로그인/용량)를 안내하던 문제를 막는다.
  const e = String(stderr).toLowerCase();
  const stdoutSignals = (String(stdout).toLowerCase().match(/insufficient[_ ]quota|resource_exhausted/g) || []).join(" ");
  const quotaHay = `${e}\n${stdoutSignals}`;
  if (/usage limit|insufficient[_ ]quota|quota exceeded|out of (credits|tokens)|429 too many|rate[ _-]?limit|resource_exhausted|사용량 초과|한도 초과/.test(quotaHay)) {
    return { kind: "quota", detail: "Codex 사용량(토큰)이 소진됐거나 요청 한도에 걸렸습니다. 한도가 회복되면 자동으로 다시 시도합니다." };
  }
  if (/not logged in|no api key|unauthorized|http 401|authentication (failed|required)|로그인이 필요|세션이 만료/.test(e)) {
    return { kind: "auth", detail: "Codex 로그인이 필요합니다(맥에서 codex login)." };
  }
  return { kind: "error", detail: String(stderr || "실패").slice(-300) };
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
  // claim과 실행 사이에 회장이 일시정지를 눌렀을 수 있다 → 다시 확인해 코드 변경 전에 작업을 대기열로 되돌린다.
  if (readControl(RUNTIME).paused) {
    log(taskId, "잠금 직후 일시정지 감지 — 작업을 대기로 되돌립니다.");
    releaseTask(taskId, { runtimeDir: RUNTIME });
    await markRecord(taskId, "queued");
    writeRunnerStatus({ state: "paused", codex: codex.connected ? "connected" : "not_connected" }, { runtimeDir: RUNTIME });
    return { skipped: "paused-after-claim" };
  }
  if (!codex.connected) {
    // 미연결은 일시적(맥에서 codex login 하면 해소)이다. failed로 종결하지 말고 대기열로 되돌려 연결되면 재개한다.
    log(taskId, `Codex 미연결: ${codex.reason} — 작업을 대기열로 되돌립니다(연결되면 재개).`);
    releaseTask(taskId, { runtimeDir: RUNTIME });
    await markRecord(taskId, "queued");
    writeRunnerStatus({ state: "blocked", codex: "not_connected", codexDetail: codex.reason, lastTask: taskId }, { runtimeDir: RUNTIME });
    return { retryLater: taskId, cause: "not_connected" };
  }
  const workdir = resolveWorkdir(packet);
  if (!workdir) {
    // 로컬 복제본 부재도 일시적(클론되면 해소). 대기열로 되돌려 재개한다.
    log(taskId, `대상 저장소 로컬 복제본 없음: ${packet.target_repo} — 대기열로 되돌립니다.`);
    releaseTask(taskId, { runtimeDir: RUNTIME });
    await markRecord(taskId, "queued");
    writeRunnerStatus({ state: "blocked", codex: "connected", codexDetail: `저장소 로컬 복제본 없음: ${packet.target_repo}`, lastTask: taskId }, { runtimeDir: RUNTIME });
    return { retryLater: taskId, cause: "no_workdir" };
  }
  await markRecord(taskId, "in_progress");
  writeRunnerStatus({ state: "running", taskId, app: packet.target_app, codex: "connected" }, { runtimeDir: RUNTIME });
  const heartbeat = setInterval(() => heartbeatTask(taskId, { runtimeDir: RUNTIME }), 60_000);
  try {
    // 회장이 고른 모델·추론 강도(control.json)를 codex exec에 전달한다. 없으면 codex CLI 기본값.
    const model = String(control.codexModel || "").trim();
    const effort = String(control.codexEffort || "").trim();
    const args = ["exec"];
    if (model) args.push("--model", model);
    if (["low", "medium", "high"].includes(effort)) args.push("-c", `model_reasoning_effort="${effort}"`);
    args.push("--cd", workdir, buildCodexPrompt(packet));
    log(taskId, `codex exec 시작 (cwd=${workdir}, model=${model || "기본"}, effort=${effort || "기본"}, timeout=${TASK_TIMEOUT_MS / 60000}분)`);
    const result = spawnSync("codex", args, {
      encoding: "utf8", timeout: TASK_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024,
    });
    log(taskId, `codex 종료 코드 ${result.status}\n--- stdout(끝 4000자) ---\n${String(result.stdout || "").slice(-4000)}\n--- stderr(끝 2000자) ---\n${String(result.stderr || "").slice(-2000)}`);
    if (result.status === 0) {
      completeTask(taskId, { exitCode: 0, logTail: String(result.stdout || "").slice(-1500) }, { runtimeDir: RUNTIME });
      await markRecord(taskId, "in_review"); // 완료 표시는 사람이/검증이 확인한 뒤
      writeRunnerStatus({ state: "idle", codex: "connected", lastTask: taskId, lastResult: "completed" }, { runtimeDir: RUNTIME });
      return { completed: taskId };
    }
    // 실패 원인 분류: 용량/토큰 소진·로그인 만료는 코드 실패와 구분해 정직하게 표시한다.
    const cause = classifyCodexFailure(result.stderr, result.stdout);
    // 일시적 원인(용량 소진·로그인 만료)은 failed(종료)로 버리지 않는다 — "한도 회복되면 자동 재시도"가 실제로
    // 이행되도록 대기열(pending)로 되돌린다(러너는 30초 폴링으로 재시도). 실제 코드 실패만 failed로 종결한다.
    if (cause.kind === "quota" || cause.kind === "auth") {
      releaseTask(taskId, { runtimeDir: RUNTIME });
      await markRecord(taskId, "queued");
      writeRunnerStatus({ state: "idle", codex: cause.kind === "quota" ? "quota_exhausted" : "not_connected", codexDetail: cause.detail, lastTask: taskId, lastResult: cause.kind }, { runtimeDir: RUNTIME });
      return { retryLater: taskId, cause: cause.kind };
    }
    failTask(taskId, { exitCode: result.status, reason: `${cause.kind}: ${cause.detail}`.slice(-500) }, { runtimeDir: RUNTIME });
    await markRecord(taskId, "blocked");
    writeRunnerStatus({ state: "idle", codex: "connected", lastTask: taskId, lastResult: "failed", codexDetail: cause.detail }, { runtimeDir: RUNTIME });
    return { failed: taskId, cause: cause.kind };
  } finally {
    clearInterval(heartbeat);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const codex = detectCodexCli();
  console.log(`[codex-runner] Codex CLI: ${codex.connected ? `연결됨 (${codex.version})` : `미연결 — ${codex.reason}`}`);
  console.log(`[codex-runner] 대기열 위치: ${RUNTIME}`);
  console.log(`[codex-runner]   (ROBOM HQ.app에서 넣은 요청을 보려면, 앱과 같은 데이터 폴더를 가리키게`);
  console.log(`[codex-runner]    ROBOM_HQ_RUNTIME_DIR 환경변수로 지정하고 실행하세요 — docs/hq/CODEX-RUNNER.md 참고)`);
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
