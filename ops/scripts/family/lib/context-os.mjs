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
// v1.1: signals를 받으면 부정 조건을 존중한다 — "배포는 하지 마"처럼 배포가 부정되면
// release/store 같은 배포 지향 프로파일의 배포 키워드 매칭을 건너뛴다(부정문 오분류 방지).
const DEPLOY_KW_RE = /배포|deploy|release|릴리스|릴리즈|store|스토어|testflight|출시/i;
export function classify(request, routing, signals) {
  const text = (request || "").toLowerCase();
  for (const profile of routing.profiles) {
    const hit = profile.keywords.find((kw) => {
      if (!text.includes(kw.toLowerCase())) return false;
      // 배포가 명시적으로 부정됐는데 매칭 키워드가 배포성이면 이 매칭은 무시한다.
      if (signals?.noDeploy && DEPLOY_KW_RE.test(kw)) return false;
      return true;
    });
    if (hit) return { profile, matchedKeyword: hit };
  }
  return { profile: routing.default, matchedKeyword: null };
}

// escalation 신호로 레벨을 상향한다(하향은 없다).
const LEVEL_ORDER = ["L0", "L1", "L2", "L3", "L4"];
export function applyEscalation(request, baseLevel, routing, signals) {
  const text = (request || "").toLowerCase();
  let level = baseLevel;
  const reasons = [];
  for (const [target, triggers] of Object.entries(routing.escalationTriggers || {})) {
    const hit = triggers.find((t) => {
      if (!text.includes(t.toLowerCase())) return false;
      // v1.1: 배포가 부정됐는데 트리거가 배포성이면 상향하지 않는다(부정문 오상향 방지).
      if (signals?.noDeploy && DEPLOY_KW_RE.test(t)) return false;
      return true;
    });
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

// v1.1: 한 요청에서 여러 앱을 감지한다(본사+앱, 여러 앱 동시). 등장 순서 유지.
export function detectApps(request, apps) {
  const text = (request || "").toLowerCase();
  const found = [];
  for (const app of apps) {
    const candidates = [app.id, app.english_name, app.name].filter(Boolean).map((s) => String(s).toLowerCase());
    if (candidates.some((c) => text.includes(c)) && !found.includes(app.id)) found.push(app.id);
  }
  return found;
}

// v1.1: 결정론적 보조 신호 — 읽기전용·배포금지·파일경로. 키워드 첫매칭만으로 놓치던 의도를 잡는다.
const READ_ONLY_RE = /(분석만|점검만|리뷰만|읽기만|보고만|확인만|조사만|read[\s-]?only|analyze only|review only)/i;
const NO_DEPLOY_RE = /(배포\s*(는|를)?\s*(하지|안|말|금지)|배포하지|deploy\s*(하지|안)|don'?t\s+deploy|no\s+deploy|without\s+deploy(ing)?)/i;
const PATH_RE = /(?:^|\s)([\w./-]+\.(?:ts|tsx|js|jsx|css|scss|html|json|yml|yaml|mjs|svg))\b/gi;
export function detectSignals(request) {
  const text = request || "";
  const filePaths = [...text.matchAll(PATH_RE)].map((m) => m[1]);
  return {
    readOnly: READ_ONLY_RE.test(text),
    noDeploy: NO_DEPLOY_RE.test(text),
    filePaths,
    hasExplicitPath: filePaths.length > 0,
  };
}

// 요청 → context pack(읽을 파일 계획 + 추정 토큰 + manifest). 코드 전문을 인라인하지 않는다.
export async function buildPack({ request, appId, root, routing, apps, repoMapText, now }) {
  const signals = detectSignals(request);
  const { profile, matchedKeyword } = classify(request, routing, signals);
  const { level, reasons } = applyEscalation(request, profile.level, routing, signals);
  const detectedApps = detectApps(request, apps);
  const app = appId || detectedApps[0] || detectApp(request, apps) || null;
  const appRecord = app ? apps.find((a) => a.id === app) : null;
  // 여러 앱이 지목되면 모두 대상에 담는다(단, 명시 --app이 있으면 그것을 최우선).
  const targetAppIds = appId ? [appId, ...detectedApps.filter((x) => x !== appId)] : detectedApps.length ? detectedApps : (app ? [app] : []);
  const targetRepositories = targetAppIds
    .map((id) => apps.find((a) => a.id === id)?.repo)
    .filter(Boolean);
  if (!targetRepositories.length) targetRepositories.push("robom-labs/robom");

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

  // v1.1: Context Manifest v2 — read-next를 repo·이유·추정토큰과 함께 구조화한다(코드 전문 인라인 아님).
  const included = readNext.map((entry) => {
    const [maybeApp, ...rest] = entry.includes(":") ? entry.split(":") : [null, entry];
    const isAppScoped = maybeApp && targetAppIds.includes(maybeApp);
    const path = isAppScoped ? rest.join(":") : entry;
    const repo = isAppScoped ? apps.find((a) => a.id === maybeApp)?.repo : "robom-labs/robom";
    return {
      repo: repo || "robom-labs/robom",
      path,
      role: isAppScoped ? "target" : "shared-contract",
      reason: isAppScoped ? `${maybeApp} ${profile.id} 대상 경로` : `${profile.id} 공통 계약/지도`,
      lineRanges: [],
      blobSha: null,
    };
  });
  const manifest = {
    schemaVersion: 2,
    contextSystemVersion: "1.1.0",
    requestHash: hashRequest(request),
    profile: profile.id,
    level,
    targetRepositories,
    canonical: [{ path: constitutionPath, sha256: null, ruleIds: ["constitution"] }],
    included,
    tests: (profile.mapSections || []).includes("tests") ? included.filter((i) => /test|__tests__|\.test\./.test(i.path)) : [],
    directDependencies: [],
    flags: { readOnly: signals.readOnly, noDeploy: signals.noDeploy, explicitPaths: signals.filePaths },
    neverLoad: profile.neverLoad || [],
    cacheHits: [],
    escalation: reasons,
    budget: { maxEstimatedTokens: budget, estimatedTokens },
    generatedAt: now || null,
  };

  return {
    profile: profile.id,
    matchedKeyword,
    level,
    escalationReasons: reasons,
    app,
    targetApps: targetAppIds,
    targetRepositories,
    signals,
    constitutionPath,
    registrySummary,
    readNext,
    neverLoad: profile.neverLoad || [],
    estimatedTokens,
    budget,
    withinBudget: budget === 0 ? true : estimatedTokens <= budget,
    manifest,
  };
}

// 결정론적 요청 해시(Date/random 미사용). 같은 요청은 같은 requestHash를 얻는다.
export function hashRequest(request) {
  const s = String(request || "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `req_${h.toString(16)}`;
}
