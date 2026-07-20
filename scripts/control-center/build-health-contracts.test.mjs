// health contract 정본 --check(드리프트 감지)가 실제 커밋 산출물과 카탈로그의 일치를 지키는지 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/sources.mjs";
import { buildContractFileMap, checkContractFiles } from "./build-health-contracts.mjs";

test("커밋된 ops/health-contracts 산출물이 카탈로그와 일치한다(드리프트 0)", () => {
  const { drift } = checkContractFiles(REPO_ROOT);
  assert.deepEqual(drift, [], `정본 드리프트 발견 — build-health-contracts.mjs 재실행 필요: ${drift.join(", ")}`);
});

test("--check는 내용 드리프트·누락·고아 파일을 모두 잡는다", () => {
  // 실 저장소를 임시로 복제해 산출물을 변형하고 checkContractFiles가 잡는지 확인한다.
  const root = mkdtempSync(join(tmpdir(), "robom-hc-"));
  cpSync(join(REPO_ROOT, "ops"), join(root, "ops"), { recursive: true });
  cpSync(join(REPO_ROOT, "scripts"), join(root, "scripts"), { recursive: true });
  cpSync(join(REPO_ROOT, "site", "package.json"), join(root, "site", "package.json"), { recursive: true });

  const dir = join(root, "ops/health-contracts");
  // 기준: 복제본은 드리프트 0
  assert.deepEqual(checkContractFiles(root).drift, []);

  // (1) 내용 드리프트
  const { files } = buildContractFileMap(root);
  const [firstRel] = [...files.keys()];
  writeFileSync(join(dir, firstRel), "{}\n");
  assert.ok(checkContractFiles(root).drift.some((d) => d.includes(firstRel)), "내용 드리프트를 잡아야 함");

  // 복원 후 (2) 고아 파일
  writeFileSync(join(dir, firstRel), files.get(firstRel));
  writeFileSync(join(dir, "deprecatedbom.json"), "{}\n");
  assert.ok(checkContractFiles(root).drift.some((d) => d.includes("deprecatedbom.json")), "고아 파일을 잡아야 함");

  rmSync(root, { recursive: true, force: true });
});
