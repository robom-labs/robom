// ROBOM Family UI OS — 계약 검증기 테스트 (doc-03 §14·§28).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = resolve(root, "ops/scripts/family/check-family-ui.mjs");

function run(args = []) {
  try {
    const out = execFileSync("node", [script, ...args], { cwd: root, encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

test("현재 중앙 계약은 모두 정합(통과, 종료코드 0)", () => {
  const { code, out } = run(["--json"]);
  assert.equal(code, 0, `위반 발생: ${out}`);
  const r = JSON.parse(out);
  assert.equal(r.problems.length, 0);
  assert.equal(r.passed, r.total);
});

test("registry의 모든 앱이 검증 대상(동적, 하드코딩 아님)", async () => {
  const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
  const r = JSON.parse(run(["--json"]).out);
  assert.deepEqual(new Set(r.apps), new Set(apps.map((a) => a.id)));
  assert.ok(r.apps.length >= 3);
});

test("MUST_SHARE 항목은 모두 실재하는 contract를 근거로 한다", async () => {
  const matrix = JSON.parse(await readFile(resolve(root, "ops/family/contracts/COMMON-UNIQUE-MATRIX.json"), "utf8"));
  const { existsSync } = await import("node:fs");
  for (const item of matrix.MUST_SHARE) {
    assert.ok(item.contract, `${item.id}에 contract 근거 없음`);
    assert.ok(existsSync(resolve(root, "ops/family/contracts", item.contract)), `${item.contract} 없음`);
  }
});

test("모든 예외는 registry 앱 + reason·owner·verification을 갖춘다", async () => {
  const exc = JSON.parse(await readFile(resolve(root, "ops/family/contracts/EXCEPTIONS.json"), "utf8"));
  const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
  const ids = new Set(apps.map((a) => a.id));
  for (const e of exc.exceptions) {
    assert.ok(ids.has(e.app), `예외 app ${e.app}가 registry에 없음`);
    assert.ok(e.reason && e.owner && e.verification, `예외 ${e.app} 필드 누락`);
    assert.equal(e.withinContract, true);
  }
});

test("설정 순서 계약 불변: app-meta 마지막·family-apps가 그 앞", async () => {
  const settings = await readFile(resolve(root, "ops/family/contracts/settings.yml"), "utf8");
  const lines = settings.split(/\r?\n/);
  const s = [];
  for (const l of lines.slice(lines.findIndex((x) => x.trim() === "sections:") + 1)) {
    const m = l.match(/^\s+-\s+(.+?)\s*$/);
    if (m) s.push(m[1].trim());
    else if (l.trim() && !l.startsWith(" ")) break; // 다음 최상위 키에서 멈춘다
  }
  assert.equal(s[s.length - 1], "app-meta");
  assert.ok(s.indexOf("family-apps") < s.indexOf("app-meta"));
});
