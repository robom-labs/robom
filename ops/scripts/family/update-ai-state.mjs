// 로컬 저장소·registry·compatibility에서 다음 AI 작업용 현재 상태와 검증 기준을 생성한다.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function git(repo, ...args) {
  try { return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim(); } catch { return "unavailable"; }
}

function pairs(value) {
  return Object.fromEntries(
    value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
      const separator = item.indexOf("=");
      return separator === -1 ? [item, "unavailable"] : [item.slice(0, separator), item.slice(separator + 1)];
    }),
  );
}

async function firstCacheVersion(repo, candidates) {
  for (const candidate of candidates) {
    try {
      const source = await readFile(resolve(repo, candidate), "utf8");
      const match = source.match(/(?:CACHE_NAME|CACHE_VERSION|CACHE)\s*=\s*[`"']([^`"']+)/);
      if (match) return match[1].replace(/\$\{[^}]+\}/g, "<version>");
    } catch { /* 다음 후보 */ }
  }
  return "not-declared";
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const workspace = resolve(arg("workspace") || dirname(root));
const tests = (arg("tests") || "").split(",").map((item) => item.trim()).filter(Boolean);
const smoke = (arg("smoke") || "").split(",").map((item) => item.trim()).filter(Boolean);
const ciRuns = pairs(arg("ci") || "");
const deployments = pairs(arg("deployments") || "");
const apps = await readRegistry(new URL("../../../ops/registry/apps.yml", import.meta.url));
const family = JSON.parse(await readFile(resolve(root, "ops/family/family-version.json"), "utf8"));
const sourceCommit = git(root, "rev-parse", "HEAD");
const cacheCandidates = {
  outbom: ["public/sw.js"],
  homebom: ["apps/web/public/sw.js"],
  runningbom: ["outputs/pushrun-site/sw.js"],
  calendarbom: ["app/sw.js"],
  certbom: ["apps/web/public/sw.js", "apps/web/vite.config.ts"],
};
const entrypoints = {
  outbom: ["app/page.tsx", "app/globals.css", "lib/weather.ts", "lib/scoring.ts"],
  homebom: ["apps/web/src/App.tsx", "apps/web/src/styles.css", "packages/core"],
  runningbom: ["outputs/pushrun-site/index.html", "outputs/pushrun-site/styles.css", "outputs/pushrun-site/app.js", "outputs/pushrun-site/races.json"],
  calendarbom: ["app/index.html", "app/styles.css", "app/app.js", "app/schedule-core.js"],
  certbom: ["apps/web/src/App.tsx", "apps/web/src/styles.css", "packages/core/src", "packages/source-adapters/src"],
};

const appState = [];
for (const app of apps) {
  const repo = resolve(workspace, app.id);
  appState.push({
    id: app.id,
    repo: app.repo,
    mainSha: git(repo, "rev-parse", "HEAD"),
    version: app.version,
    productionUrl: app.web_url,
    deployProvider: app.deploy_provider,
    serviceWorkerCache: await firstCacheVersion(repo, cacheCandidates[app.id] || []),
    familySpecVersion: app.family_spec_version,
    lastSuccessfulCI: ciRuns[app.id] || "unavailable",
    lastDeployment: deployments[app.id] || "unavailable",
    lastVerifiedAt: app.last_verified_at,
    keyEntrypoints: entrypoints[app.id],
    testCommand: app.test,
    buildCommand: app.build,
    workingTree: git(repo, "status", "--porcelain") ? "dirty" : "clean",
  });
}

const generatedAt = new Date().toISOString();
const current = {
  generatedAt,
  familySpecVersion: family.familySpecVersion,
  sourceCommit,
  robom: {
    mainSha: sourceCommit,
    version: (await readFile(resolve(root, "VERSION"), "utf8")).trim(),
    productionUrl: "https://robom.kr",
    deployProvider: "sites+github-pages",
  },
  apps: appState,
  openHighRiskWork: ["store-contract-and-signing", "oauth-provider-credentials", "private-analytics-endpoint", "calendar-sensitive-sync-legal-review"],
};

const hashFiles = [
  "ops/registry/apps.yml",
  "ops/family/family-version.json",
  "ops/family/contracts/analytics.yml",
  "ops/family/contracts/install.yml",
  "ops/family/compatibility.yml",
];
const hashes = {};
for (const relative of hashFiles) {
  const content = await readFile(resolve(root, relative));
  hashes[relative] = `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
const verified = {
  generatedAt,
  sourceCommit,
  files: hashes,
  tests,
  productionSmoke: smoke,
  nextDiffBase: sourceCommit,
};

await writeFile(resolve(root, "ops/family/ai/CURRENT-STATE.json"), `${JSON.stringify(current, null, 2)}\n`);
await writeFile(resolve(root, "ops/family/ai/LAST-VERIFIED.json"), `${JSON.stringify(verified, null, 2)}\n`);
console.log(`AI state generated · ${apps.length} apps · ${sourceCommit.slice(0, 7)}`);
