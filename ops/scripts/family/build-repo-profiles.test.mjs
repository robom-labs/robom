// ROBOM Context OS v1.1 — Repository Profile v2 커버리지 테스트 (doc-04 §E·§10).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = resolve(root, "ops/scripts/family/build-repo-profiles.mjs");
const dir = resolve(root, "ops/family/ai/repositories");

test("모든 registry 앱이 PRODUCT PROFILE을 갖는다(--check 통과)", () => {
  const out = execFileSync("node", [script, "--check"], { cwd: root, encoding: "utf8" });
  assert.match(out, /정합/);
});

test("생성물이 registry 앱 집합과 정확히 일치(하드코딩 아님)", async () => {
  const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
  const files = new Set((await readdir(dir)).filter((f) => f.endsWith(".yml") && !["robom.yml"].includes(f)));
  assert.deepEqual(files, new Set(apps.map((a) => `${a.id}.yml`)));
});
