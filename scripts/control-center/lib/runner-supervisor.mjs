// 로봄 HQ 러너 감독기 — 회장이 터미널을 열지 않아도 되도록, HQ 서버가 codex-runner를
// 자식 프로세스로 직접 실행하고 죽으면 다시 살린다(크래시 루프 보호). 러너는 스스로
// runner-status.json에 상태를 쓰며, 감독기는 자식이 내려갔을 때만 '실행기 꺼짐'을 정직하게 기록한다.
// 원칙: spawnSync 금지(비동기 spawn), Codex 미연결이어도 러너는 상주하며 정직하게 not_connected 보고.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { writeRunnerStatus } from "./task-queue.mjs";

const RUNNER_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "codex-runner.mjs");

// 러너 자식 트리 전체를 종료한다. 러너는 codex CLI를 손자로 띄우므로(spawnSync), 러너만 kill하면
// codex 손자가 고아로 남아 회장이 앱을 껐는데도 계속 코드 작업·quota를 쓸 수 있다. 그룹/트리째 종료한다.
function killChildTree(child, signal = "SIGTERM") {
  if (!child) return;
  const pid = child.pid;
  try {
    if (process.platform === "win32") {
      // 동기 종료: 앱 종료(process 'exit') 핸들러에서는 비동기 spawn이 이벤트루프 종료로 실행되지 못해
      // 러너·codex 손자가 고아로 남는다("끄면 꺼질 것" 위반). spawnSync로 트리를 확실히 종료한다.
      if (Number.isInteger(pid)) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else if (Number.isInteger(pid)) {
      process.kill(-pid, signal); // detached로 만든 프로세스 그룹 전체(러너 + codex 손자)
    }
  } catch { /* 이미 종료했거나 그룹 없음 */ }
  try { child.kill?.(signal); } catch { /* fallback */ }
}

// GUI(로그인 항목·Electron)에서 실행되면 PATH가 최소화되어 codex CLI를 못 찾을 수 있다.
// 흔한 설치 경로를 보강한다(없어도 무해).
function augmentedPath() {
  const home = homedir();
  const extra = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin",
    join(home, ".local/bin"), join(home, ".npm-global/bin"), join(home, ".volta/bin")];
  return [process.env.PATH || "", ...extra].filter(Boolean).join(":");
}

// 회장의 실제 git 클론을 자동 탐지한다(있으면 러너가 실제 코드 작업 가능).
export function discoverRepoRoot() {
  if (process.env.ROBOM_HQ_REPO_ROOT && existsSync(join(process.env.ROBOM_HQ_REPO_ROOT, ".git"))) {
    return resolve(process.env.ROBOM_HQ_REPO_ROOT);
  }
  const home = homedir();
  const candidates = [
    join(home, "robom-labs", "robom"),
    join(home, "robom"),
    join(home, "Documents", "robom"),
    join(home, "Developer", "robom"),
    join(home, "Projects", "robom"),
    join(home, "Desktop", "robom"),
  ];
  return candidates.find((dir) => existsSync(join(dir, ".git"))) || null;
}

// 러너를 자식으로 실행하고 감시한다. runtimeDir/snapDir/repoRoot 환경을 자식에 전달한다.
// 재시작 정책(순수 함수 — 단위 테스트 가능). 크래시 판정을 '15초 미만'이 아니라 '안정 가동(STABLE_UPTIME_MS) 미달'로
// 넓혀, ~20초에 반복해서 죽는 '느린 크래시'도 backoff에 걸리게 한다(예전엔 3초 고정 재시작으로 무한 루프). 또한
// 안정 가동 없이 너무 여러 번 연속 실패하면 재시작 간격을 크게 낮추고 회장 확인으로 escalate한다(자원·쿼터 소모 방지).
export const STABLE_UPTIME_MS = 90_000;         // 이 이상 살아 있다가 종료하면 '정상 가동'으로 보고 크래시 카운터 리셋
export const MAX_RESTART_BEFORE_ESCALATE = 15;  // 안정 가동 없이 이만큼 연속 재시작하면 간격을 크게 낮추고 escalate
export const ESCALATE_DELAY_MS = 600_000;       // 10분 — 반복 실패 시 드물게만 재시도(무한 tight 루프 방지)
export function restartPlan({ consecutiveFailures = 0, uptimeMs = 0 } = {}) {
  const next = (Number.isFinite(uptimeMs) && uptimeMs >= STABLE_UPTIME_MS) ? 0 : Math.min(consecutiveFailures + 1, 20);
  if (next >= MAX_RESTART_BEFORE_ESCALATE) return { consecutiveFailures: next, delayMs: ESCALATE_DELAY_MS, escalated: true };
  const delayMs = next ? Math.min(3000 * 2 ** next, 120_000) : 3000;
  return { consecutiveFailures: next, delayMs, escalated: false };
}

export function startRunnerSupervisor({ runtimeDir, snapDir, repoRoot = discoverRepoRoot(), logger = console, spawnProcess = spawn } = {}) {
  let child = null;
  let stopped = false;
  let consecutiveFailures = 0;
  let startedAt = 0;
  let timer = null;

  const childEnv = () => {
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1", // Electron에서 실행되면 순수 Node로 동작
      PATH: augmentedPath(),
    };
    if (runtimeDir) env.ROBOM_HQ_RUNTIME_DIR = runtimeDir;
    if (snapDir) env.ROBOM_HQ_SNAP_DIR = snapDir;
    if (repoRoot) env.ROBOM_HQ_REPO_ROOT = repoRoot;
    return env;
  };

  const markDown = (reason) => {
    try { writeRunnerStatus({ state: "not_running", managed: true, reason }, { runtimeDir }); }
    catch { /* 상태 기록 실패는 무시 */ }
  };

  // 자식 프로세스가 아직 상태를 쓰기 전에도 HQ 화면은 자동 복구 중임을 알 수 있어야 한다.
  const markStarting = () => {
    try { writeRunnerStatus({ state: "starting", managed: true }, { runtimeDir }); }
    catch { /* 상태 기록 실패는 무시 */ }
  };

  function spawnOnce() {
    if (stopped) return;
    startedAt = Date.now();
    markStarting();
    try {
      // detached: 러너를 새 프로세스 그룹의 리더로 띄운다 → 종료 시 그룹째(codex 손자 포함) kill 가능(POSIX).
      child = spawnProcess(process.execPath, [RUNNER_SCRIPT], { env: childEnv(), stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    } catch (error) {
      markDown(`실행 실패: ${error.message}`);
      scheduleRestart(0, `실행 실패: ${error.message}`); // 즉시 실패 → uptime 0(크래시)
      return;
    }
    child.stdout?.on("data", (d) => logger.log?.(String(d).trimEnd()));
    child.stderr?.on("data", (d) => logger.error?.(String(d).trimEnd()));
    let settled = false;
    const handleStop = (reason) => {
      if (settled) return;
      settled = true;
      child = null;
      const uptimeMs = Date.now() - startedAt; // 안정 가동 여부를 uptime으로 판정(느린 크래시도 backoff에 걸리게)
      markDown(reason);
      scheduleRestart(uptimeMs, reason);
    };
    child.once("error", (error) => handleStop(`실행 실패: ${error.message}`));
    child.once("exit", (code, signal) => handleStop(`실행기 종료(code ${code ?? signal ?? "?"})`));
    logger.log?.(`[robom-hq] codex-runner 자동 실행 중${repoRoot ? ` · 작업 저장소 ${repoRoot}` : " · 작업 저장소 미발견(요청은 대기열 보관)"}`);
  }

  function scheduleRestart(uptimeMs, reason) {
    if (stopped) return;
    const plan = restartPlan({ consecutiveFailures, uptimeMs });
    consecutiveFailures = plan.consecutiveFailures;
    if (plan.escalated) {
      // 안정 가동 없이 반복 실패 → 간격을 크게 낮추고 회장 확인으로 escalate(무한 tight 재시작·쿼터 소모 방지).
      markDown(`반복 재시작 실패(${consecutiveFailures}회) — 재시작 간격을 ${ESCALATE_DELAY_MS / 60000}분으로 낮췄습니다. 회장 확인이 필요할 수 있습니다: ${reason}`);
      logger.error?.(`[robom-hq] codex-runner 반복 실패 ${consecutiveFailures}회 — 재시작 간격 ${ESCALATE_DELAY_MS / 60000}분으로 낮춤(회장 확인 권장)`);
    } else {
      logger.error?.(`[robom-hq] codex-runner ${reason || "종료"}; ${plan.delayMs / 1000}초 뒤 자동 재시작`);
    }
    timer = setTimeout(spawnOnce, plan.delayMs);
    timer.unref?.();
  }

  spawnOnce();
  return {
    get repoRoot() { return repoRoot; },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (child) killChildTree(child, "SIGTERM"); // 러너 + codex 손자까지 그룹/트리째 종료
      markDown("감독기 중지");
    },
  };
}
