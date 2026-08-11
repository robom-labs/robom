// Google Play 공개본과 GitHub·외장하드 복구본의 일치 여부를 검증한다.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "./lib/registry.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--skip-store") {
      args.skipStore = true;
      continue;
    }
    if (!token.startsWith("--") || !argv[index + 1]) throw new Error(`잘못된 인자입니다: ${token}`);
    args[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  if (!args.manifest || !args.repo) throw new Error("--manifest와 --repo가 필요합니다.");
  return args;
}

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

async function verifyChecksums(releaseDir) {
  const source = await readFile(path.join(releaseDir, "SHA256SUMS"), "utf8");
  for (const line of source.trim().split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s+(.+)$/);
    assert(match, `잘못된 SHA256SUMS 행입니다: ${line}`);
    const actual = await sha256(path.join(releaseDir, match[2]));
    assert(actual === match[1], `${match[2]} 체크섬이 다릅니다.`);
  }
}

async function verifyStore(manifest) {
  const url = new URL(manifest.store.url);
  url.searchParams.set("hl", "ko");
  url.searchParams.set("gl", "KR");
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 ROBOM release verifier" } });
  assert(response.ok, `Play Store URL 응답이 ${response.status}입니다.`);
  const html = await response.text();
  assert(html.includes(manifest.packageName), "Play Store 응답에서 package를 확인하지 못했습니다.");
}

export async function verifyReleaseSync({ manifestPath, repo, skipStore = false, registryUrl } = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const releaseDir = path.dirname(manifestPath);
  const errors = [];
  const checks = [];
  const check = async (name, operation) => {
    try {
      await operation();
      checks.push({ name, status: "PASS" });
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      checks.push({ name, status: "FAIL" });
    }
  };

  await check("manifest", async () => {
    assert(manifest.schemaVersion === 1, "schemaVersion은 1이어야 합니다.");
    assert(/^[0-9a-f]{40}$/.test(manifest.github.productSourceSha), "productSourceSha가 올바르지 않습니다.");
    assert(/^[0-9a-f]{40}$/.test(manifest.github.mainSha), "mainSha가 올바르지 않습니다.");
    assert(manifest.store.status === "live", "Store 상태가 live가 아닙니다.");
    assert(Number.isInteger(manifest.store.versionCode), "versionCode가 정수가 아닙니다.");
  });

  await check("repository", async () => {
    await stat(path.join(repo, ".git"));
    assert(git(repo, "status", "--porcelain") === "", "외장하드 Git 복제본에 미커밋 변경이 있습니다.");
    git(repo, "fsck", "--no-progress", "--full");
    git(repo, "cat-file", "-e", `${manifest.github.productSourceSha}^{commit}`);
    git(repo, "cat-file", "-e", `${manifest.github.mainSha}^{commit}`);
    git(repo, "merge-base", "--is-ancestor", manifest.github.productSourceSha, manifest.github.mainSha);
    git(repo, "merge-base", "--is-ancestor", manifest.github.productSourceSha, "origin/main");
  });

  await check("mobile-config", async () => {
    const appJson = JSON.parse(git(repo, "show", `${manifest.github.productSourceSha}:apps/mobile/app.json`));
    assert(appJson.expo.version === manifest.store.version, "공개 제품 소스의 version이 다릅니다.");
    assert(appJson.expo.android.package === manifest.packageName, "공개 제품 소스의 package가 다릅니다.");
    assert(appJson.expo.android.versionCode === manifest.store.versionCode, "공개 제품 소스의 versionCode가 다릅니다.");
  });

  await check("release-files", async () => {
    await verifyChecksums(releaseDir);
    const bundle = path.join(releaseDir, manifest.backup.mainBundle);
    execFileSync("git", ["-C", repo, "bundle", "verify", bundle], { stdio: ["ignore", "pipe", "pipe"] });
    if (manifest.artifact.file) {
      const artifact = path.join(releaseDir, manifest.artifact.file);
      assert(await sha256(artifact) === manifest.artifact.sha256, "AAB SHA-256이 다릅니다.");
      assert(manifest.artifact.availability === "archived", "AAB가 있는데 availability가 archived가 아닙니다.");
    } else {
      assert(manifest.artifact.availability.includes("not-recoverable"), "AAB 미보존 사유가 명시되지 않았습니다.");
    }
  });

  await check("registry", async () => {
    const apps = await readRegistry(registryUrl);
    const app = apps.find((entry) => entry.id === manifest.appId);
    assert(app, `registry에 ${manifest.appId}가 없습니다.`);
    assert(app.version === manifest.store.version, "registry version이 다릅니다.");
    assert(app.android_app_id === manifest.packageName, "registry package가 다릅니다.");
    assert(app.google_play_status === "live", "registry Play 상태가 live가 아닙니다.");
    assert(app.google_play_url === manifest.store.url, "registry Store URL이 다릅니다.");
    assert(app.last_deployed_sha === manifest.github.productSourceSha, "registry 제품 SHA가 다릅니다.");
  });

  if (!skipStore) await check("public-store", () => verifyStore(manifest));
  return { ok: errors.length === 0, appId: manifest.appId, version: manifest.store.version, versionCode: manifest.store.versionCode, checks, errors };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyReleaseSync({
    manifestPath: path.resolve(args.manifest),
    repo: path.resolve(args.repo),
    skipStore: Boolean(args.skipStore),
    registryUrl: args.registry ? new URL(`file://${path.resolve(args.registry)}`) : undefined,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
