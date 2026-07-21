// ROBOM Context & Family OS v1.0.0 — 요청 기반 라우팅/컨텍스트 팩 공용 로직 (doc-03 §7·§17·§29).
// 외부 의존성 없이 Node 내장만 사용한다(비용 0원).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// 결정론적 토큰 추정. 로컬 tokenizer가 없을 때의 근사이며 항상 "estimated"로만 취급한다.
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil([...text].length / 4);
}

export async function loadRouting(root) {
  return JSON.parse(await readFile(resolve(root, "ops/family/ai/routing.json"), "utf8"));
}

// REPO-MAP.yml에서 한 앱의 블록 텍스트를 뽑는다. 최상위 헤더(^key:)를 라인 스캔해
// 다음 헤더 또는 파일 끝까지 모은다(마지막 앱도 정확히 잡는다).
export function appMapBlock(repoMapText, appId) {
  const lines = repoMapText.split(/\r?\n/);
  const isTopHeader = (l) => /^[a-z][a-z0-9-]*:\s*$/.test(l) || /^[a-z][a-z0-9-]*:\s+/.test(l);
  const start = lines.findIndex((l) => l.startsWith(`${appId}:`));
  if (start === -1) return "";
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (isTopHeader(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trimEnd();
}

// 앱 블록에서 특정 섹션(shell/domain/pwa/tests)의 라인만 남긴다. 빈 sections면 전체.
export function appMapSections(repoMapText, appId, sections) {
  const block = appMapBlock(repoMapText, appId);
  if (!block) return "";
  if (!sections || sections.length === 0) return block;
  const lines = block.split("\n");
  const kept = [lines[0]]; // 앱 이름 헤더
  for (const line of lines.slice(1)) {
    const key = line.match(/^\s{2}([a-z]+):/)?.[1];
    if (key && sections.includes(key)) kept.push(line);
  }
  return kept.join("\n");
}

// 요청 텍스트를 프로파일로 분류한다. 첫 매칭 우선, 없으면 default.
export function classify(request, routing) {
  const text = (request || "").toLowerCase();
  for (const profile of routing.profiles) {
    const hit = profile.keywords.find((kw) => text.includes(kw.toLowerCase()));
    if (hit) return { profile, matchedKeyword: hit };
  }
  return { profile: routing.default, matchedKeyword: null };
}

// escalation 신호로 레벨을 상향한다(하향은 없다).
const LEVEL_ORDER = ["L0", "L1", "L2", "L3", "L4"];
export function applyEscalation(request, baseLevel, routing) {
  const text = (request || "").toLowerCase();
  let level = baseLevel;
  const reasons = [];
  for (const [target, triggers] of Object.entries(routing.escalationTriggers || {})) {
    const hit = triggers.find((t) => text.includes(t.toLowerCase()));
    if (hit && LEVEL_ORDER.indexOf(target) > LEVEL_ORDER.indexOf(level)) {
      level = target;
      reasons.push(`${hit} → ${target}`);
    }
  }
  return { level, reasons };
}

// 요청에서 대상 앱을 감지한다(한글명·영문명·id 부분일치). 없으면 null.
export function detectApp(request, apps) {
  const text = (request || "").toLowerCase();
  for (const app of apps) {
    const candidates = [app.id, app.english_name, app.name].filter(Boolean).map((s) => String(s).toLowerCase());
    if (candidates.some((c) => text.includes(c))) return app.id;
  }
  return null;
}

// 요청 → context pack(읽을 파일 계획 + 추정 토큰 + manifest). 코드 전문을 인라인하지 않는다.
export async function buildPack({ request, appId, root, routing, apps, repoMapText }) {
  const { profile, matchedKeyword } = classify(request, routing);
  const { level, reasons } = applyEscalation(request, profile.level, routing);
  const app = appId || detectApp(request, apps) || null;
  const appRecord = app ? apps.find((a) => a.id === app) : null;

  const constitutionPath = routing.constitution;
  const constitutionText = await readFile(resolve(root, constitutionPath), "utf8");

  // read-next: 에이전트가 열어야 할 파일/디렉터리 계획(내용 인라인 아님).
  const readNext = [];
  if (app) {
    const mapText = appMapSections(repoMapText, app, profile.mapSections || []);
    for (const line of mapText.split("\n").slice(1)) {
      const paths = line.match(/\[(.*?)\]/)?.[1];
      if (paths) paths.split(",").map((p) => p.trim()).filter(Boolean).forEach((p) => readNext.push(`${app}:${p}`));
    }
  }
  for (const dir of profile.read || []) readNext.push(dir);
  const include = new Set([...(profile.include || []), ...((routing.default.id === profile.id ? [] : []))]);
  if (include.has("allRepoMap")) readNext.push("ops/family/ai/REPO-MAP.yml");
  if (include.has("canonical")) readNext.push("ops/company-os/ROBOM_ULTIMATE_COMPANY_OS.md");
  if (include.has("familyContracts")) readNext.push("ops/family/contracts");

  // 추정 토큰 = 항상 로드하는 캡슐(헌법 + 대상 앱 registry 요약). read-next 코드 본문은 포함하지 않는다.
  const registrySummary = appRecord
    ? `${appRecord.id} v${appRecord.version} · ${appRecord.repo} · ${appRecord.stack || ""} · test: ${appRecord.test || ""} · deployed: ${appRecord.last_deployed_sha || ""}`
    : "(앱 미지정 — 본사/포트폴리오 범위)";
  const capsuleText = `${constitutionText}\n\n## 대상\n${registrySummary}\n\n## read-next\n${readNext.join("\n")}`;
  const estimatedTokens = estimateTokens(capsuleText);
  const budget = routing.levels[level]?.maxEstimatedTokens ?? 0;

  return {
    profile: profile.id,
    matchedKeyword,
    level,
    escalationReasons: reasons,
    app,
    constitutionPath,
    registrySummary,
    readNext,
    neverLoad: profile.neverLoad || [],
    estimatedTokens,
    budget,
    withinBudget: budget === 0 ? true : estimatedTokens <= budget,
  };
}
