// 로봄 HQ 러너 감독기 — 회장이 터미널을 열지 않아도 되도록, HQ 서버가 codex-runner를
// 자식 프로세스로 직접 실행하고 죽으면 다시 살린다(크래시 루프 보호). 러너는 스스로
// runner-status.json에 상태를 쓰며, 감독기는 자식이 내려갔을 때만 '실행기 꺼짐'을 정직하게 기록한다.
// 원칙: spawnSync 금지(비동기 spawn), Codex 미연결이어도 러너는 상주하며 정직하게 not_connected 보고.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { writeRunnerStatus } from "./task-queue.mjs";

const RUNNER_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "codex-runner.mjs");

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
export function startRunnerSupervisor({ runtimeDir, snapDir, repoRoot = discoverRepoRoot(), logger = console } = {}) {
  let child = null;
  let stopped = false;
  let fastFailures = 0;
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

  function spawnOnce() {
    if (stopped) return;
    startedAt = Date.now();
    try {
      child = spawn(process.execPath, [RUNNER_SCRIPT], { env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      markDown(`실행 실패: ${error.message}`);
      scheduleRestart(true);
      return;
    }
    child.stdout?.on("data", (d) => logger.log?.(String(d).trimEnd()));
    child.stderr?.on("data", (d) => logger.error?.(String(d).trimEnd()));
    child.on("exit", (code, signal) => {
      child = null;
      markDown(`실행기 종료(code ${code ?? signal ?? "?"})`);
      scheduleRestart(Date.now() - startedAt < 15_000); // 15초 내 종료면 크래시로 간주
    });
    logger.log?.(`[robom-hq] codex-runner 자동 실행 중${repoRoot ? ` · 작업 저장소 ${repoRoot}` : " · 작업 저장소 미발견(요청은 대기열 보관)"}`);
  }

  function scheduleRestart(fast) {
    if (stopped) return;
    fastFailures = fast ? Math.min(fastFailures + 1, 6) : 0;
    const delay = fast ? Math.min(3000 * 2 ** fastFailures, 120_000) : 3000; // 크래시 루프 보호(최대 2분)
    timer = setTimeout(spawnOnce, delay);
    timer.unref?.();
  }

  spawnOnce();
  return {
    get repoRoot() { return repoRoot; },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (child) { try { child.kill("SIGTERM"); } catch { /* 이미 종료 */ } }
      markDown("감독기 중지");
    },
  };
}
