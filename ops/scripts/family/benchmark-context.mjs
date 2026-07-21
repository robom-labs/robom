#!/usr/bin/env node
// ROBOM Context & Family OS v1.0.0 — 라우팅 전/후 컨텍스트 실측 벤치마크 (doc-03 §29).
// 실측한 숫자만 보고한다. 추정 토큰은 chars/4 결정론적 근사이며 항상 "estimated"다.
// 사용법: node ops/scripts/family/benchmark-context.mjs [--json]
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";
import { loadRouting, buildPack, estimateTokens } from "./lib/context-os.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const has = (n) => process.argv.includes(`--${n}`);

// 기준선 = 매 작업 전체 재독 후보(doc-03 §5). 실제로 존재하는 파일만 합산한다.
const BASELINE_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  "ops/company-os/ROBOM_ULTIMATE_COMPANY_OS.md",
  "ops/ai-meetings/PROTOCOL.md",
  "ops/ai-meetings/COMPANY-MODE.md",
  "ops/family/ai/FAMILY-CONTEXT.md",
  "ops/family/ai/REPO-MAP.yml",
  "ops/registry/apps.yml",
  "ops/family/ai/CURRENT-STATE.json",
];

async function fileTokens(rel) {
  try {
    await stat(resolve(root, rel));
    const text = await readFile(resolve(root, rel), "utf8");
    return estimateTokens(text);
  } catch {
    return null; // 없는 파일은 기준선에서 제외(가짜로 부풀리지 않음)
  }
}

let baselineTokens = 0;
const baselineDetail = [];
for (const f of BASELINE_FILES) {
  const t = await fileTokens(f);
  if (t !== null) { baselineTokens += t; baselineDetail.push({ file: f, estTokens: t }); }
}

const routing = await loadRouting(root);
const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
const repoMapText = await readFile(resolve(root, "ops/family/ai/REPO-MAP.yml"), "utf8");
const { fixtures } = JSON.parse(await readFile(resolve(root, "ops/family/ai/context-fixtures.json"), "utf8"));

const rows = [];
for (const fx of fixtures) {
  const pack = await buildPack({ request: fx.request, appId: fx.app, root, routing, apps, repoMapText });
  const saved = baselineTokens - pack.estimatedTokens;
  rows.push({
    id: fx.id,
    profile: pack.profile,
    level: pack.level,
    routedTokens: pack.estimatedTokens,
    savedTokens: saved,
    savedPct: Math.round((saved / baselineTokens) * 100),
  });
}

const avgRouted = Math.round(rows.reduce((s, r) => s + r.routedTokens, 0) / rows.length);
const avgSavedPct = Math.round(rows.reduce((s, r) => s + r.savedPct, 0) / rows.length);
const summary = {
  baselineFiles: baselineDetail.length,
  baselineEstTokens: baselineTokens,
  fixtures: rows.length,
  avgRoutedEstTokens: avgRouted,
  avgSavedPct,
  note: "estimated tokens = chars/4 결정론적 근사. baseline = 매 작업 전체 재독 후보 파일 실측 합.",
};

if (has("json")) {
  console.log(JSON.stringify({ summary, baselineDetail, rows }, null, 2));
} else {
  console.log(`ROBOM Context 벤치마크 (v1.0.0)\n`);
  console.log(`기준선(전체 재독 후보 ${summary.baselineFiles}개 파일): ~${baselineTokens.toLocaleString()} est 토큰`);
  console.log(`fixture ${rows.length}개 라우팅 결과:\n`);
  console.log(`  ${"fixture".padEnd(28)} ${"profile".padEnd(18)} lvl  routed   saved%`);
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(28)} ${r.profile.padEnd(18)} ${r.level}  ${String(r.routedTokens).padStart(6)}   ${String(r.savedPct).padStart(3)}%`);
  }
  console.log(`\n평균 라우팅 컨텍스트: ~${avgRouted.toLocaleString()} est 토큰 · 평균 절감 ${avgSavedPct}%`);
  console.log(summary.note);
}
