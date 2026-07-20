// 로봄 본부 자동 시작 LaunchAgent가 로컬 전용·무창 실행·자동 복구 계약을 지키는지 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLaunchAgentPlist, LAUNCH_AGENT_LABEL, stageRuntime } from "./install-autostart.mjs";

test("자동 시작 LaunchAgent는 로그인 1회 실행하되 종료 후 되살리지 않는다('끄면 꺼질 것')", () => {
  const plist = buildLaunchAgentPlist({
    nodePath: "/opt/homebrew/bin/node",
    scriptPath: "/tmp/robom/scripts/control-center/serve.mjs",
    workingDirectory: "/tmp/robom",
    stdoutPath: "/tmp/robom.log",
    stderrPath: "/tmp/robom-error.log",
  });
  assert.match(plist, new RegExp(`<string>${LAUNCH_AGENT_LABEL}</string>`));
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
  // KeepAlive=false: 회장이 끄면 launchd가 되살리지 않는다(회장 요구 5 "끄면 꺼질 것").
  assert.match(plist, /<key>KeepAlive<\/key><false\/>/);
  assert.doesNotMatch(plist, /<key>KeepAlive<\/key><true\/>/);
  assert.match(plist, /<key>ROBOM_HQ_OPEN_BROWSER<\/key><string>0<\/string>/);
  assert.match(plist, /scripts\/control-center\/serve\.mjs/);
});

test("자동 시작 LaunchAgent는 상대 경로를 거부한다", () => {
  assert.throws(() => buildLaunchAgentPlist({
    nodePath: "node",
    scriptPath: "/tmp/serve.mjs",
    workingDirectory: "/tmp/robom",
    stdoutPath: "/tmp/out.log",
    stderrPath: "/tmp/err.log",
  }), /절대 경로/);
});

test("자동 시작 실행본은 Application Support용 사본을 만들고 기존 기록을 보존한다", () => {
  const target = mkdtempSync(join(tmpdir(), "robom-hq-runtime-"));
  const record = join(target, "ops", "control-center", "runtime", "records", "tasks.jsonl");
  mkdirSync(join(target, "ops", "control-center", "runtime", "records"), { recursive: true });
  writeFileSync(record, "preserve-me\n");
  stageRuntime(target);
  assert.match(readFileSync(join(target, "scripts", "control-center", "serve.mjs"), "utf8"), /startControlCenter/);
  assert.match(readFileSync(join(target, "ops", "control-center", "app", "office.html"), "utf8"), /전원 업무 시연/);
  assert.doesNotThrow(() => JSON.parse(readFileSync(join(target, "site", "package.json"), "utf8")));
  assert.equal(readFileSync(record, "utf8"), "preserve-me\n");
});
