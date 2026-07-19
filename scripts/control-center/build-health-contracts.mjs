// health contract 정본 생성기 — 카탈로그를 ops/health-contracts/*.json(machine-readable 정본)으로 출력한다.
// 코드와 분리된 계약 정본(§4.3) + coverage 산출물(§4.7): target-coverage.json / evaluator-usage.json
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildContractCatalog, catalogCoverage, CONTRACT_SCHEMA_VERSION, MIN_CONTRACTS } from "./lib/contract-catalog.mjs";
import { EVALUATOR_NAMES } from "./lib/contract-engine.mjs";
import { readApps, readText, REPO_ROOT } from "./lib/sources.mjs";

export function generateContractFiles(root = REPO_ROOT) {
  const registryApps = readApps(root).filter((a) => a.registered);
  let siteVersion = "";
  try { siteVersion = JSON.parse(readText(join(root, "site/package.json")) || "{}").version || ""; } catch { /* 없으면 빈 값 */ }
  const contracts = buildContractCatalog({ registryApps, siteVersion });

  // gate: evaluator 미등록 계약 0(§9.7)
  const unknown = contracts.filter((c) => !EVALUATOR_NAMES.includes(c.evaluator));
  if (unknown.length) throw new Error(`evaluator 미등록 계약: ${unknown.map((c) => `${c.id}(${c.evaluator})`).join(", ")}`);
  // gate: registry target마다 최소 계약 수 충족
  const byTarget = {};
  for (const c of contracts) (byTarget[c.target] = byTarget[c.target] || []).push(c);
  for (const [target, min] of Object.entries(MIN_CONTRACTS)) {
    const n = (byTarget[target] || []).length;
    if (n < min) throw new Error(`${target} 계약 ${n}개 < 최소 ${min}개`);
  }

  const dir = join(root, "ops/health-contracts");
  rmSync(join(dir, "generated"), { recursive: true, force: true });
  mkdirSync(join(dir, "generated"), { recursive: true });
  for (const [target, list] of Object.entries(byTarget)) {
    const doc = {
      contract_set: {
        schema_version: CONTRACT_SCHEMA_VERSION, target,
        generated_from: "scripts/control-center/lib/contract-catalog.mjs",
        note: "정본은 카탈로그 모듈. 이 파일은 machine-readable 산출물이며 직접 수정하지 않는다(build-health-contracts.mjs 재실행).",
        rules_count: list.length,
      },
      rules: list,
    };
    writeFileSync(join(dir, `${target}.json`), JSON.stringify(doc, null, 1) + "\n");
  }
  const coverage = catalogCoverage(contracts);
  writeFileSync(join(dir, "generated", "target-coverage.json"), JSON.stringify({ generatedNote: "진단률(정의) 집계", coverage }, null, 1) + "\n");
  const evaluatorUsage = {};
  for (const c of contracts) evaluatorUsage[c.evaluator] = (evaluatorUsage[c.evaluator] || 0) + 1;
  writeFileSync(join(dir, "generated", "evaluator-usage.json"), JSON.stringify(evaluatorUsage, null, 1) + "\n");
  return { contracts: contracts.length, targets: Object.keys(byTarget).length, coverage };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = generateContractFiles();
  console.log(`[health-contracts] 계약 ${out.contracts}개 · 타깃 ${out.targets}개 · 정의 진단률 ${(out.coverage.definedRate * 100).toFixed(0)}% (need_new_source ${out.coverage.needNewSource}건은 정직 표기)`);
}
