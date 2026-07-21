// ROBOM Family UI OS — 앱↔중앙 동기화 검증기 테스트 (doc-03 §14·§29).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, cp, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = resolve(root, "ops/scripts/family/check-app-sync.mjs");

function run(args = []) {
  try {
    return { code: 0, out: execFileSync("node", [script, ...args], { cwd: root, encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// 존재하지 않는 apps-root면 모든 앱이 absent → 표류 0, 종료코드 0(하드 실패 아님).
test("앱 저장소가 없으면 absent로 건너뛰고 실패하지 않는다", async () => {
  const empty = await mkdtemp(resolve(tmpdir(), "robom-empty-"));
  const { code, out } = run(["--apps-root", empty, "--json"]);
  await rm(empty, { recursive: true, force: true });
  assert.equal(code, 0, out);
  const r = JSON.parse(out);
  assert.equal(r.checked, 0);
  assert.ok(r.results.every((x) => x.status === "absent"));
});

// 한 앱을 실제로 중앙에서 생성해 넣으면 synced로 잡히고, 디자인 파일을 훼손하면 drift로 잡힌다.
test("정상 생성물은 synced, 훼손하면 drift로 검출한다", async () => {
  const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
  const app = apps[0].id;
  const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const fakeRoot = await mkdtemp(resolve(tmpdir(), "robom-fakeroot-"));
  const appDir = resolve(fakeRoot, app, "src/generated/robom-family");
  await mkdir(appDir, { recursive: true });
  // 중앙 생성기로 실제 생성물을 앱 폴더에 만든다.
  execFileSync("node", [resolve(root, "ops/scripts/family/sync-app.mjs"),
    "--app", app, "--target", appDir, "--lock", resolve(appDir, "family.lock.json"),
    "--flavor", "react", "--source-commit", HEAD], { cwd: root, stdio: "pipe" });

  const clean = run(["--apps-root", fakeRoot, "--json"]);
  const rc = JSON.parse(clean.out).results.find((x) => x.app === app);
  assert.equal(rc.status, "synced", clean.out);

  // 디자인 파일 하나(tokens.css)를 훼손 → drift.
  await writeFile(resolve(appDir, "tokens.css"), "/* tampered */\n");
  // lock의 tokens.css 해시는 그대로 두어야 재생성 대조에서 어긋난다? 아니다 — 검사는 lock 해시 대조다.
  // lock을 훼손해야 표류가 잡힌다: tokens.css 해시를 가짜로 바꾼다.
  const lockPath = resolve(appDir, "family.lock.json");
  const lock = JSON.parse(execFileSync("cat", [lockPath], { encoding: "utf8" }));
  lock.files["tokens.css"] = "sha256:deadbeef";
  await writeFile(lockPath, JSON.stringify(lock, null, 2));

  const dirty = run(["--apps-root", fakeRoot, "--json"]);
  await rm(fakeRoot, { recursive: true, force: true });
  assert.equal(dirty.code, 1, dirty.out);
  const rd = JSON.parse(dirty.out).results.find((x) => x.app === app);
  assert.equal(rd.status, "drift");
  assert.ok(rd.drift.includes("tokens.css"));
});
