// macOS 로그인 시 로봄 본부를 1회 자동 실행하는 LaunchAgent를 설치한다(레거시 수동 도구).
// "끄면 꺼질 것"(회장 요구 5): 종료하면 다시 살리지 않는다 — KeepAlive는 쓰지 않는다(RunAtLoad만).
// 정식 자동시작은 데스크톱 앱의 로그인 항목이 담당하며, 앱은 실행 시 이 레거시 에이전트를 제거한다.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const LAUNCH_AGENT_LABEL = "kr.robom.company-os";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function stageRuntime(runtimeRoot) {
  const sourceOps = join(REPO_ROOT, "ops");
  const sourceScripts = join(REPO_ROOT, "scripts", "control-center");
  const sourceRecords = join(sourceOps, "control-center", "runtime");
  const targetRecords = join(runtimeRoot, "ops", "control-center", "runtime");
  const hadRecords = existsSync(targetRecords);
  mkdirSync(runtimeRoot, { recursive: true });
  cpSync(sourceOps, join(runtimeRoot, "ops"), {
    recursive: true,
    force: true,
    filter: (source) => source !== sourceRecords && !source.startsWith(`${sourceRecords}${sep}`),
  });
  cpSync(sourceScripts, join(runtimeRoot, "scripts", "control-center"), { recursive: true, force: true });
  mkdirSync(join(runtimeRoot, "site"), { recursive: true });
  cpSync(join(REPO_ROOT, "site", "package.json"), join(runtimeRoot, "site", "package.json"), { force: true });
  if (!hadRecords && existsSync(sourceRecords)) cpSync(sourceRecords, targetRecords, { recursive: true, force: true });
  return runtimeRoot;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

export function buildLaunchAgentPlist({ nodePath, scriptPath, workingDirectory, stdoutPath, stderrPath }) {
  const values = { nodePath, scriptPath, workingDirectory, stdoutPath, stderrPath };
  for (const [name, value] of Object.entries(values)) {
    if (!value || !String(value).startsWith("/")) throw new TypeError(`${name}에는 절대 경로가 필요합니다.`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${escapeXml(nodePath)}</string><string>${escapeXml(scriptPath)}</string></array>
  <key>WorkingDirectory</key><string>${escapeXml(workingDirectory)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ROBOM_HQ_OPEN_BROWSER</key><string>0</string>
    <key>ROBOM_HQ_MANAGE_RUNNER</key><string>1</string>
    <key>PATH</key><string>${escapeXml(`${dirname(nodePath)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${escapeXml(stdoutPath)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(stderrPath)}</string>
</dict>
</plist>
`;
}

function launchctl(args, allowFailure = false) {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr.trim() || `launchctl ${args.join(" ")} 실패`);
  return result;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function installAutostart({ home = homedir(), uid = process.getuid(), nodePath = process.execPath } = {}) {
  if (process.platform !== "darwin") throw new Error("로봄 본부 자동 시작 설치는 macOS에서만 지원합니다.");
  const agentDirectory = join(home, "Library", "LaunchAgents");
  const logDirectory = join(home, "Library", "Logs");
  const plistPath = join(agentDirectory, `${LAUNCH_AGENT_LABEL}.plist`);
  const runtimeRoot = join(home, "Library", "Application Support", "RobomHQ");
  const domain = `gui/${uid}`;
  mkdirSync(agentDirectory, { recursive: true });
  mkdirSync(logDirectory, { recursive: true });
  stageRuntime(runtimeRoot);
  writeFileSync(plistPath, buildLaunchAgentPlist({
    nodePath,
    scriptPath: join(runtimeRoot, "scripts", "control-center", "serve.mjs"),
    workingDirectory: runtimeRoot,
    stdoutPath: join(logDirectory, "robom-hq.log"),
    stderrPath: join(logDirectory, "robom-hq-error.log"),
  }), { mode: 0o644 });
  launchctl(["bootout", `${domain}/${LAUNCH_AGENT_LABEL}`], true);
  let bootstrapResult;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    wait(attempt === 0 ? 300 : 700);
    bootstrapResult = launchctl(["bootstrap", domain, plistPath], true);
    if (bootstrapResult.status === 0) break;
  }
  if (bootstrapResult?.status !== 0) throw new Error(bootstrapResult.stderr.trim() || "launchctl bootstrap 실패");
  launchctl(["kickstart", "-k", `${domain}/${LAUNCH_AGENT_LABEL}`]);
  return { plistPath, runtimeRoot, service: `${domain}/${LAUNCH_AGENT_LABEL}` };
}

export function uninstallAutostart({ home = homedir(), uid = process.getuid() } = {}) {
  const plistPath = join(home, "Library", "LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
  launchctl(["bootout", `gui/${uid}/${LAUNCH_AGENT_LABEL}`], true);
  rmSync(plistPath, { force: true });
  return { plistPath };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const result = process.argv.includes("--uninstall") ? uninstallAutostart() : installAutostart();
    console.log(process.argv.includes("--uninstall") ? `자동 시작 해제: ${result.plistPath}` : `자동 시작 설치: ${result.service}`);
  } catch (error) {
    console.error(`[robom-hq] 자동 시작 설정 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
