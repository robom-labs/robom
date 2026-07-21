#!/usr/bin/env node
// ROBOM Context & Family OS v1.0.0 — 요청 하나를 최소 read-plan(context pack)으로 라우팅한다.
// 매 작업 전체 재독 대신, 이 pack의 read-next만 먼저 읽고 위험 시 단계적으로 확장한다(doc-03 §7·§17·§21).
// 사용법: node ops/scripts/family/route-task.mjs --request "청약봄 버튼 문구 수정" [--app homebom] [--json]
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";
import { loadRouting, buildPack } from "./lib/context-os.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1] ?? fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

if (has("help") || process.argv.length <= 2) {
  console.log(`ROBOM 작업 라우터 (Context OS v1.0.0)
사용법:
  node ops/scripts/family/route-task.mjs --request "<요청 문장>" [--app <id>] [--json]
옵션:
  --request  자연어 작업 요청(필수)
  --app      대상 앱 id(생략 시 요청에서 자동 감지)
  --json     JSON 출력
  --help     이 도움말
종료코드: 0 성공 · 2 잘못된 인자 · 1 예산 초과 경고`);
  process.exit(has("help") ? 0 : 2);
}

const request = arg("request");
if (!request) {
  console.error("오류: --request가 필요합니다. --help 참고.");
  process.exit(2);
}

const routing = await loadRouting(root);
const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
const repoMapText = await readFile(resolve(root, "ops/family/ai/REPO-MAP.yml"), "utf8");
const appArg = arg("app") || null;
const pack = await buildPack({ request, appId: appArg, root, routing, apps, repoMapText });

if (has("json")) {
  console.log(JSON.stringify({ request, ...pack, generatedAt: null }, null, 2));
} else {
  console.log(`요청: ${request}`);
  console.log(`프로파일: ${pack.profile}${pack.matchedKeyword ? ` (키워드 "${pack.matchedKeyword}")` : " (기본)"}`);
  console.log(`레벨: ${pack.level}${pack.escalationReasons.length ? ` — 상향: ${pack.escalationReasons.join(", ")}` : ""}`);
  console.log(`대상: ${pack.app || "본사/포트폴리오"}`);
  console.log(`추정 컨텍스트: ~${pack.estimatedTokens.toLocaleString()} 토큰 / 예산 ${pack.budget || "무제한"}` +
    `${pack.withinBudget ? " (예산 내)" : " ⚠ 예산 초과"}`);
  console.log(`읽지 않음: ${pack.neverLoad.join(", ") || "-"}`);
  console.log(`\n먼저 읽을 것(read-next):`);
  for (const p of pack.readNext) console.log(`  - ${p}`);
  if (pack.readNext.length === 0) console.log("  (대상 앱 미지정 — --app 지정 또는 요청에 앱 이름 포함)");
  console.log(`\n항상 로드: ${pack.constitutionPath}`);
}
process.exit(pack.withinBudget ? 0 : 1);
