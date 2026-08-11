// Google Play 공개본 3면 동기화 검사기의 핵심 규칙을 테스트한다.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyReleaseSync } from "./verify-play-release-sync.mjs";

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("공개 제품 커밋·registry·복구 묶음이 일치하면 통과한다", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "robom-release-sync-"));
  const repo = path.join(root, "app");
  const release = path.join(root, "release");
  await mkdir(path.join(repo, "apps/mobile"), { recursive: true });
  await mkdir(release, { recursive: true });
  run("git", ["init", "-b", "main"], repo);
  run("git", ["config", "user.email", "test@robom.kr"], repo);
  run("git", ["config", "user.name", "ROBOM Test"], repo);
  await writeFile(path.join(repo, "apps/mobile/app.json"), JSON.stringify({ expo: { version: "1.2.3", android: { package: "kr.robom.sample", versionCode: 7 } } }));
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "release"], repo);
  const productSha = run("git", ["rev-parse", "HEAD"], repo);
  run("git", ["remote", "add", "origin", repo], repo);
  run("git", ["fetch", "origin", "main:refs/remotes/origin/main"], repo);
  const source = Buffer.from("source archive");
  await writeFile(path.join(release, "sample-source.tar.gz"), source);
  run("git", ["bundle", "create", path.join(release, "sample-main.bundle"), "main"], repo);
  const bundle = await readFile(path.join(release, "sample-main.bundle"));
  await writeFile(path.join(release, "SHA256SUMS"), `${hash(source)}  sample-source.tar.gz\n${hash(bundle)}  sample-main.bundle\n`);
  const manifest = {
    schemaVersion: 1,
    appId: "sample",
    packageName: "kr.robom.sample",
    store: { url: "https://play.google.com/store/apps/details?id=kr.robom.sample", version: "1.2.3", versionCode: 7, status: "live" },
    github: { productSourceSha: productSha, mainSha: productSha },
    artifact: { file: null, sha256: "0".repeat(64), availability: "published-hash-recorded-original-aab-not-recoverable" },
    backup: { mainBundle: "sample-main.bundle" },
  };
  const manifestPath = path.join(release, "RELEASE-MANIFEST.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  const registryPath = path.join(root, "apps.yml");
  await writeFile(registryPath, `apps:\n  - id: sample\n    version: 1.2.3\n    android_app_id: kr.robom.sample\n    google_play_url: https://play.google.com/store/apps/details?id=kr.robom.sample\n    google_play_status: live\n    last_deployed_sha: ${productSha}\n`);
  const result = await verifyReleaseSync({ manifestPath, repo, skipStore: true, registryUrl: new URL(`file://${registryPath}`) });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("registry 제품 SHA가 다르면 실패한다", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "robom-release-sync-mismatch-"));
  const repo = path.join(root, "app");
  const release = path.join(root, "release");
  await mkdir(path.join(repo, "apps/mobile"), { recursive: true });
  await mkdir(release, { recursive: true });
  run("git", ["init", "-b", "main"], repo);
  run("git", ["config", "user.email", "test@robom.kr"], repo);
  run("git", ["config", "user.name", "ROBOM Test"], repo);
  await writeFile(path.join(repo, "apps/mobile/app.json"), JSON.stringify({ expo: { version: "1.2.3", android: { package: "kr.robom.sample", versionCode: 7 } } }));
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "release"], repo);
  const productSha = run("git", ["rev-parse", "HEAD"], repo);
  run("git", ["remote", "add", "origin", repo], repo);
  run("git", ["fetch", "origin", "main:refs/remotes/origin/main"], repo);
  const source = Buffer.from("source archive");
  await writeFile(path.join(release, "sample-source.tar.gz"), source);
  run("git", ["bundle", "create", path.join(release, "sample-main.bundle"), "main"], repo);
  const bundle = await readFile(path.join(release, "sample-main.bundle"));
  await writeFile(path.join(release, "SHA256SUMS"), `${hash(source)}  sample-source.tar.gz\n${hash(bundle)}  sample-main.bundle\n`);
  const manifestPath = path.join(release, "RELEASE-MANIFEST.json");
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    appId: "sample",
    packageName: "kr.robom.sample",
    store: { url: "https://play.google.com/store/apps/details?id=kr.robom.sample", version: "1.2.3", versionCode: 7, status: "live" },
    github: { productSourceSha: productSha, mainSha: productSha },
    artifact: { file: null, sha256: "0".repeat(64), availability: "published-hash-recorded-original-aab-not-recoverable" },
    backup: { mainBundle: "sample-main.bundle" },
  }));
  const registryPath = path.join(root, "apps.yml");
  await writeFile(registryPath, "apps:\n  - id: sample\n    version: 1.2.3\n    android_app_id: kr.robom.sample\n    google_play_url: https://play.google.com/store/apps/details?id=kr.robom.sample\n    google_play_status: live\n    last_deployed_sha: 0000000000000000000000000000000000000000\n");
  const result = await verifyReleaseSync({ manifestPath, repo, skipStore: true, registryUrl: new URL(`file://${registryPath}`) });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /registry 제품 SHA가 다릅니다/);
});
