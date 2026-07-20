// health contract 정본 생성기 — 카탈로그를 ops/health-contracts/*.json(machine-readable 정본)으로 출력한다.
// 코드와 분리된 계약 정본(§4.3) + coverage 산출물(§4.7): target-coverage.json / evaluator-usage.json
// --check: 커밋된 산출물이 카탈로그와 어긋나면(정본 드리프트) 실패한다. CI(guardrails)가 이 모드로 게이트한다.
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { buildContractCatalog, catalogCoverage, CONTRACT_SCHEMA_VERSION, MIN_CONTRACTS } from "./lib/contract-catalog.mjs";
import { EVALUATOR_NAMES } from "./lib/contract-engine.mjs";
import { readApps, readText, REPO_ROOT } from "./lib/sources.mjs";

const CONTRACT_DIR = "ops/health-contracts";

// 카탈로그로부터 만들어져야 할 파일 전체를 {상대경로 -> 내용}으로 계산한다(디스크에 쓰지 않음).
// 생성과 검사가 같은 소스에서 나오도록 분리해, --check가 실제 산출물과 1:1 대조할 수 있게 한다.
export function buildContractFileMap(root = REPO_ROOT) {
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

  const files = new Map();
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
    files.set(`${target}.json`, JSON.stringify(doc, null, 1) + "\n");
  }
  const coverage = catalogCoverage(contracts);
  files.set("generated/target-coverage.json", JSON.stringify({ generatedNote: "진단률(정의) 집계", coverage }, null, 1) + "\n");
  const evaluatorUsage = {};
  for (const c of contracts) evaluatorUsage[c.evaluator] = (evaluatorUsage[c.evaluator] || 0) + 1;
  files.set("generated/evaluator-usage.json", JSON.stringify(evaluatorUsage, null, 1) + "\n");

  return { files, contracts: contracts.length, targets: Object.keys(byTarget).length, coverage };
}

export function generateContractFiles(root = REPO_ROOT) {
  const { files, ...meta } = buildContractFileMap(root);
  const dir = join(root, CONTRACT_DIR);
  rmSync(join(dir, "generated"), { recursive: true, force: true });
  mkdirSync(join(dir, "generated"), { recursive: true });
  for (const [rel, content] of files) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return meta;
}

// 커밋된 산출물이 카탈로그와 어긋나는지 검사한다. 내용 드리프트 + 고아 파일(카탈로그가 더는 만들지 않는
// 옛 타깃 JSON) 둘 다 잡는다. 어긋난 상대경로 목록을 반환한다(빈 배열이면 일치).
export function checkContractFiles(root = REPO_ROOT) {
  const { files, ...meta } = buildContractFileMap(root);
  const dir = join(root, CONTRACT_DIR);
  const drift = [];
  for (const [rel, content] of files) {
    const abs = join(dir, rel);
    const actual = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (actual !== content) drift.push(actual === null ? `${rel} (누락)` : `${rel} (내용 다름)`);
  }
  // 고아: 디스크에 있으나 카탈로그가 생성하지 않는 *.json(폐기된 타깃 잔존)
  const onDisk = [];
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) if (name.endsWith(".json")) onDisk.push(name);
    const gdir = join(dir, "generated");
    if (existsSync(gdir)) for (const name of readdirSync(gdir)) if (name.endsWith(".json")) onDisk.push(`generated/${name}`);
  }
  for (const rel of onDisk) if (!files.has(rel)) drift.push(`${rel} (고아 — 카탈로그가 만들지 않음)`);
  return { drift, ...meta };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--check")) {
    const { drift, contracts, targets } = checkContractFiles();
    if (drift.length) {
      console.error(`[health-contracts] 정본 드리프트: 커밋된 산출물이 카탈로그와 다릅니다. build-health-contracts.mjs를 재실행해 커밋하세요.\n- ${drift.join("\n- ")}`);
      process.exit(1);
    }
    console.log(`[health-contracts] --check PASS · 계약 ${contracts}개 · 타깃 ${targets}개 (산출물이 카탈로그와 일치)`);
  } else {
    const out = generateContractFiles();
    console.log(`[health-contracts] 계약 ${out.contracts}개 · 타깃 ${out.targets}개 · 정의 진단률 ${(out.coverage.definedRate * 100).toFixed(0)}% (need_new_source ${out.coverage.needNewSource}건은 정직 표기)`);
  }
}
