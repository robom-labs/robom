// 결정론적 계약 실행 엔진 — 카탈로그의 계약을 evaluator allowlist로 실제 실행한다(AI 판정 없음).
// v2.0.0 프롬프트 PART 07~08 반영: 전역 선행조건, 동일 source 요청 병합(run planner), 예산 초과 시
// budget_exhausted UNAVAILABLE, GitHub ETag 캐시(304는 rate limit 미소모), 증거 redaction, monitor-the-monitor.
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, statfsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import tls from "node:tls";
import vm from "node:vm";
import { DEFAULT_COMPANY_RUNTIME_DIR } from "./company-store.mjs";
import { runAssertions, resolvePath, safeRegex } from "./contract-assert.mjs";
import { getBrowserDriver } from "./browser-driver.mjs";
import { loadRoster, orgTree, assignOwnership, computeWorkforce } from "./workforce.mjs";
import { COMPANY_MODES } from "./company-authority.mjs";
import { buildContractCatalog, MIN_CONTRACTS } from "./contract-catalog.mjs";
import { readApps } from "./sources.mjs";

export const C_STATUS = Object.freeze({ PASS: "PASS", DEGRADED: "DEGRADED", FAIL: "FAIL", UNAVAILABLE: "UNAVAILABLE", BLOCKED_EXTERNAL: "BLOCKED_EXTERNAL", SKIPPED: "SKIPPED" });
const SECRET_SCRUB = /(-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|eyJ[A-Za-z0-9._-]{40,})/g;

// 증거에서 secret·긴 원문 제거 — CI 필수 gate(redaction self-test가 검증)
export function redactEvidence(value) {
  if (typeof value === "string") return value.replace(SECRET_SCRUB, "[redacted]").slice(0, 400);
  if (Array.isArray(value)) return value.slice(0, 20).map(redactEvidence);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 40)) {
      if (/authorization|cookie|token|secret|password/i.test(k)) continue;
      out[k] = redactEvidence(v);
    }
    return out;
  }
  return value;
}

const sha = (text) => createHash("sha256").update(String(text)).digest("hex").slice(0, 16);

// ── run context: fetch 캐시(동일 URL 병합)·예산·전역 선행조건 ──
function createRunContext({ now, budget, fetchImpl }) {
  return {
    now, nowMs: now.getTime(),
    fetchImpl: fetchImpl || fetch,
    cache: new Map(), surfaces: new Map(),
    requests: 0,
    budget: { maxRequests: 250, maxDurationMs: 150_000, startedAt: Date.now(), ...budget },
    preconditions: {},
    budgetExhausted() {
      return this.requests >= this.budget.maxRequests || (Date.now() - this.budget.startedAt) >= this.budget.maxDurationMs;
    },
  };
}

async function cachedFetch(ctx, url, { method = "GET", headers = {}, timeoutMs = 20_000, userAgent } = {}) {
  const key = `${method} ${url} ${userAgent || ""}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  ctx.requests += 1;
  const started = Date.now();
  let record;
  try {
    const response = await ctx.fetchImpl(url, {
      method, cache: "no-store", redirect: "follow",
      headers: { accept: "text/html,application/json,text/javascript,*/*", "cache-control": "no-cache", ...(userAgent ? { "user-agent": userAgent } : {}), ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bodyText = method === "HEAD" ? "" : await response.text();
    record = {
      ok: true, status: response.status, finalUrl: response.url || url,
      contentType: String(response.headers.get("content-type") || ""),
      headers: Object.fromEntries([...response.headers.entries()].filter(([k]) => !/set-cookie|authorization/i.test(k))),
      bodyText: bodyText.slice(0, 5_000_000), bytes: bodyText.length, durationMs: Date.now() - started,
    };
  } catch (error) {
    const msg = String(error?.message || error);
    record = { ok: false, status: 0, error: msg, errorClass: /timeout|abort/i.test(msg) ? "timeout" : /ENOTFOUND|EAI_AGAIN/i.test(msg) ? "dns" : /ECONNRESET|ECONNREFUSED/i.test(msg) ? "reset" : "transport", durationMs: Date.now() - started, bodyText: "", bytes: 0, headers: {}, contentType: "" };
  }
  ctx.cache.set(key, record);
  return record;
}

// 운영 표면(HTML + same-origin 핵심 자산) 1회 수집·병합 — 여러 marker 계약이 공유한다.
function extractAssetUrls(html, baseUrl) {
  const urls = new Set();
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"'#]+)["'][^>]*>/gi)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.origin === new URL(baseUrl).origin && /\.(?:js|css)(?:$|\?)/.test(u.pathname + u.search)) urls.add(u.href);
    } catch { /* 잘못된 자산 URL은 무시 */ }
  }
  return [...urls];
}
async function getSurface(ctx, url, baseUrl) {
  const key = baseUrl || url;
  if (ctx.surfaces.has(key)) return ctx.surfaces.get(key);
  const home = await cachedFetch(ctx, url, { timeoutMs: 25_000 });
  const parts = [home.bodyText];
  let failedAssets = 0; const failedList = []; let discovered = 0; let incomplete = false;
  if (home.ok && home.status === 200) {
    const queue = extractAssetUrls(home.bodyText, baseUrl || url).slice(0, 20);
    discovered = queue.length;
    const seen = new Set();
    for (const asset of queue) {
      if (seen.size >= 30) break;
      if (ctx.budgetExhausted()) { incomplete = true; break; } // 예산 소진으로 남은 자산을 못 봄 — '전부 200'으로 위장 금지
      if (seen.has(asset)) continue;
      seen.add(asset);
      const r = await cachedFetch(ctx, asset, { timeoutMs: 20_000 });
      if (!r.ok || r.status !== 200) { failedAssets += 1; failedList.push(`${r.status || r.errorClass} ${asset.slice(-60)}`); }
      else {
        parts.push(r.bodyText);
        if (/\.js(?:$|\?)/.test(asset)) {
          for (const m of r.bodyText.matchAll(/[A-Za-z0-9_./-]{4,}\.js/g)) {
            try { const nested = new URL(m[0], asset).href;
              if (new URL(nested).origin === new URL(baseUrl || url).origin && !seen.has(nested) && seen.size < 30) { seen.add(nested);
                const nr = await cachedFetch(ctx, nested, { timeoutMs: 20_000 });
                if (nr.ok && nr.status === 200) parts.push(nr.bodyText);
              }
            } catch { /* 중첩 자산 오류 무시 */ }
          }
        }
      }
    }
  }
  const surface = { home, combined: parts.join("\n"), failedAssets, failedList, assetCount: parts.length - 1, discovered, incomplete };
  ctx.surfaces.set(key, surface);
  return surface;
}

// ── GitHub REST: ETag 캐시(304는 rate limit 미소모)·rate limit 시 캐시 폴백 = BLOCKED_EXTERNAL ──
function ghCacheFile(runtimeDir) { return join(resolve(runtimeDir), "health", "source-cache", "github.json"); }
function readGhCache(runtimeDir) { try { return JSON.parse(readFileSync(ghCacheFile(runtimeDir), "utf8")); } catch { return {}; } }
function writeGhCache(runtimeDir, cache) {
  try {
    mkdirSync(join(resolve(runtimeDir), "health", "source-cache"), { recursive: true, mode: 0o700 });
    writeFileSync(ghCacheFile(runtimeDir), JSON.stringify(cache), { encoding: "utf8", mode: 0o600 });
  } catch { /* 캐시 저장 실패는 치명적이지 않다 */ }
}
async function ghGet(ctx, runtimeDir, path) {
  const cache = ctx.ghCache || (ctx.ghCache = readGhCache(runtimeDir));
  const entry = cache[path];
  const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  if (entry?.etag) headers["if-none-match"] = entry.etag;
  ctx.requests += 1;
  try {
    let r = await ctx.fetchImpl(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(20_000) });
    if (r.status === 401 && headers.authorization) {
      // 토큰이 무효여도 공개 저장소는 무인증으로 읽는다(§9.4 — API 문제를 앱 장애와 구분)
      const { authorization, ...rest } = headers;
      r = await ctx.fetchImpl(`https://api.github.com${path}`, { headers: rest, signal: AbortSignal.timeout(20_000) });
    }
    if (r.status === 304 && entry) return { ok: true, cached: true, payload: entry.payload };
    if (r.status === 403 || r.status === 429) return { ok: false, blocked: true, cachedPayload: entry?.payload, detail: `HTTP ${r.status} (rate limit)` };
    if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
    const payload = await r.json();
    cache[path] = { etag: r.headers.get("etag") || "", at: new Date().toISOString(), payload };
    ctx.ghCacheDirty = true;
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, detail: String(error?.message || error), cachedPayload: entry?.payload };
  }
}
// raw.githubusercontent.com — 앱 저장소 최신 main 읽기 전용 감사(§2)
async function rawMain(ctx, repo, path) {
  return cachedFetch(ctx, `https://raw.githubusercontent.com/${repo}/main/${path}`, { timeoutMs: 20_000 });
}

// ── 개별 evaluator (allowlist §4.2) ──
const pass = (actual, expected) => ({ status: C_STATUS.PASS, actual, expected });
const fail = (actual, expected, note) => ({ status: C_STATUS.FAIL, actual, expected, note });
const degraded = (actual, expected, note) => ({ status: C_STATUS.DEGRADED, actual, expected, note });
const unavailable = (reason, note) => ({ status: C_STATUS.UNAVAILABLE, actual: reason, expected: null, note });

async function evalHttpStatus(c, ctx) {
  const r = await cachedFetch(ctx, c.config.url, { timeoutMs: c.timeoutMs });
  if (!r.ok) return r.errorClass === "timeout" ? degraded(`timeout`, "응답", "네트워크 timeout 1회는 확정 장애가 아님") : fail(r.errorClass, "응답");
  const expect = c.config.expectStatus || [200];
  if (!expect.includes(r.status)) return fail(`HTTP ${r.status}`, `HTTP ${expect.join("/")}`);
  if (c.config.finalHostSuffixes) {
    try {
      const host = new URL(r.finalUrl).hostname;
      if (!c.config.finalHostSuffixes.some((s) => host === s || host.endsWith(`.${s}`))) {
        return fail(`redirect → ${host}`, `${c.config.finalHostSuffixes.join("/")} 내부`);
      }
    } catch { /* URL parse 실패는 아래 PASS 유지 */ }
  }
  return pass(`HTTP ${r.status}`, "정상");
}

async function evalHttpHtml(c, ctx) {
  const r = await cachedFetch(ctx, c.config.url, { timeoutMs: c.timeoutMs });
  if (!r.ok) return r.errorClass === "timeout" ? degraded("timeout", "응답") : fail(r.errorClass, "응답");
  if (r.status !== 200) return fail(`HTTP ${r.status}`, "HTTP 200");
  const problems = [];
  if (c.config.contentTypeIncludes && !r.contentType.includes(c.config.contentTypeIncludes)) problems.push(`content-type ${r.contentType || "없음"}`);
  else if (!c.config.contentTypeIncludes && c.config.minBytes && !r.contentType.includes("html")) problems.push(`content-type ${r.contentType || "없음"}`);
  if (c.config.minBytes && r.bytes < c.config.minBytes) problems.push(`본문 ${r.bytes}B < ${c.config.minBytes}B`);
  for (const m of c.config.markers || []) if (!r.bodyText.includes(m)) problems.push(`marker 누락: ${m}`);
  for (const m of c.config.negativeMarkers || []) if (r.bodyText.includes(m)) problems.push(`금지 marker 발견: ${m}`);
  // 정규식 marker: 단순 substring으로는 못 잡는 '내용이 실제로 있는지'(예: <title>가 비어있지 않은지)를 검사한다.
  for (const pattern of c.config.regexMarkers || []) {
    const re = safeRegex(pattern);
    if (!re) problems.push(`잘못된 regexMarker: ${pattern}`);
    else if (!re.test(r.bodyText.slice(0, 200_000))) problems.push(`regexMarker 불일치: ${pattern}`);
  }
  return problems.length ? fail(problems.join(" · "), "계약 충족") : pass(`HTTP 200 · ${r.bytes}B`, "계약 충족");
}

async function evalHttpTiming(c, ctx) {
  const r = await cachedFetch(ctx, c.config.url, { timeoutMs: c.timeoutMs });
  if (!r.ok || r.status !== 200) return unavailable(r.ok ? `HTTP ${r.status}` : r.errorClass, "응답 실패 시 시간 측정 무의미(가용성 계약이 담당)");
  return r.durationMs > (c.config.warnMs || 8000) ? degraded(`${r.durationMs}ms`, `≤ ${c.config.warnMs}ms`) : pass(`${r.durationMs}ms`, `≤ ${c.config.warnMs}ms`);
}

async function evalSurfaceAssets(c, ctx) {
  const s = await getSurface(ctx, c.config.url, c.config.baseUrl);
  if (!s.home.ok || s.home.status !== 200) return unavailable("home 실패", "가용성 계약이 담당");
  if (s.failedAssets > 0) return fail(`실패 자산 ${s.failedAssets}개: ${s.failedList.slice(0, 3).join(", ")}`, "0개");
  // 예산 소진으로 일부 자산을 못 봤으면 '전부 200'으로 위장하지 않는다(미점검을 정상으로 포장 금지).
  if (s.incomplete) return unavailable("요청 예산 소진 — 일부 자산 미점검", "예산 회복 후 재점검");
  // 동일 출처 js/css 자산을 하나도 못 찾았으면 '자산 0개 전부 200'이 아니라 점검 대상 없음으로 표기한다.
  if (!s.discovered) return unavailable("동일 출처 자산(js/css) 없음", "빈 껍데기 여부는 http_html·browser_smoke가 담당");
  return pass(`자산 ${s.assetCount}개 전부 200`, "0개 실패");
}

async function evalSurfaceMarker(c, ctx) {
  const s = await getSurface(ctx, c.config.url, c.config.baseUrl);
  if (!s.home.ok || s.home.status !== 200) return unavailable("home 실패", "가용성 계약이 담당");
  const problems = [];
  const any = c.config.markersAny || [];
  if (any.length && !any.some((m) => s.combined.includes(m))) problems.push(`marker 누락(any): ${any.slice(0, 3).join("|")}`);
  for (const m of c.config.markersAll || []) if (!s.combined.includes(m)) problems.push(`marker 누락: ${m}`);
  const forbidden = c.config.forbiddenMarkers || [];
  let forbiddenHit = false;
  for (const m of forbidden) if (s.combined.includes(m)) { problems.push(`금지 패턴 발견: ${m}`); forbiddenHit = true; }
  if (problems.length) return fail(problems.join(" · "), "marker 계약 충족");
  // 금지 marker(비밀키·analytics 등)의 '없음=PASS'는 표면 전체를 실제로 봤을 때만 유효하다. 자산 일부가
  // 안 떠서(실패/예산 소진) 못 본 채로 통과시키면 비밀 노출을 초록으로 가린다(거짓 성과). evalSurfaceAssets와
  // 동일한 가드를 금지 marker에도 적용 — 미점검이면 PASS가 아니라 UNAVAILABLE.
  if (forbidden.length && !forbiddenHit) {
    if (s.incomplete) return unavailable("요청 예산 소진 — 표면 일부 미점검", "금지 marker 부재를 확정할 수 없음(예산 회복 후 재점검)");
    if (s.failedAssets > 0) return unavailable(`자산 ${s.failedAssets}개 미수신: ${s.failedList.slice(0, 2).join(", ")}`, "금지 marker 부재를 확정할 수 없음");
    if (!s.discovered) return unavailable("동일 출처 자산(js/css) 없음 — HTML만 검사", "번들 내 금지 marker 존재 여부 확정 불가");
  }
  return pass(`표면 ${s.assetCount + 1}개 파일 검사 통과`, "marker 계약 충족");
}

async function evalTls(c, ctx) {
  if (ctx.preconditions.network === false) return unavailable("network", "전역 네트워크 불가");
  const host = c.config.host;
  try {
    const validTo = await new Promise((res, rej) => {
      const socket = tls.connect({ host, port: 443, servername: host, timeout: 15_000 }, () => {
        const cert = socket.getPeerCertificate(); socket.end();
        cert?.valid_to ? res(cert.valid_to) : rej(new Error("인증서 정보 없음"));
      });
      socket.on("timeout", () => { socket.destroy(); rej(new Error("TLS timeout")); });
      socket.on("error", rej);
    });
    const days = (Date.parse(validTo) - ctx.nowMs) / 86_400_000;
    if (!Number.isFinite(days)) return fail("만료일 parse 실패", "유효한 인증서");
    if (days < 10) return { ...fail(`잔여 ${Math.floor(days)}일`, "≥ 10일"), severity: "critical" };
    if (days < 21) return degraded(`잔여 ${Math.floor(days)}일`, "≥ 21일");
    return pass(`잔여 ${Math.floor(days)}일`, "≥ 21일");
  } catch (error) {
    // 인증서 자체 문제(만료·자가서명·호스트 불일치)는 rejectUnauthorized로 secureConnect 전에 error가 나
    // valid_to 검사에 도달하지 못한다. 이걸 네트워크 오탐과 뭉뚱그려 degraded로 삼키면 "만료돼 접속 차단"이라는
    // 이 계약이 존재 이유(하드다운)를 놓친다 → 인증서 오류는 critical FAIL, 순수 연결 실패만 degraded.
    const code = String(error?.code || "");
    const msg = String(error?.message || error);
    const certInvalid = /CERT|_SSL|SIGNATURE|ALTNAME|SELF_SIGNED|EXPIRED|UNTRUSTED|HOSTNAME/i.test(code) || /expired|certificate|self.?signed|altname|인증서/i.test(msg);
    return certInvalid
      ? { ...fail(msg.slice(0, 80), "유효한 인증서", "인증서 자체 오류(만료·자가서명 등) — 접속 차단"), severity: "critical" }
      : degraded(msg.slice(0, 80), "TLS 연결", "조회 실패는 만료 임박과 구분(네트워크 오탐 방지)");
  }
}

async function evalDns(c, ctx) {
  const bad = [];
  for (const host of c.config.hosts || []) {
    try { await dns.lookup(host); } catch { bad.push(host); }
  }
  return bad.length ? fail(`해석 실패: ${bad.join(", ")}`, "전체 해석") : pass(`${(c.config.hosts || []).length}개 host 해석`, "전체 해석");
}

async function evalManifest(c, ctx) {
  const url = new URL("manifest.webmanifest", c.config.baseUrl).href;
  const r = await cachedFetch(ctx, url, { timeoutMs: c.timeoutMs });
  if (!r.ok) return r.errorClass === "timeout" ? degraded("timeout", "응답") : fail(r.errorClass, "응답");
  if (r.status !== 200) return fail(`HTTP ${r.status}`, "HTTP 200");
  let manifest;
  try { manifest = JSON.parse(r.bodyText); } catch { return fail("JSON parse 실패", "유효한 manifest"); }
  if (c.config.iconCheck) {
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    if (!icons.length) return fail("icons 없음", "icons ≥ 1");
    let checked = 0, broken = 0;
    for (const icon of icons.slice(0, 4)) {
      if (!icon?.src) continue;
      const iconUrl = new URL(icon.src, url).href;
      const ir = await cachedFetch(ctx, iconUrl, { method: "HEAD", timeoutMs: 15_000 });
      checked += 1; if (!ir.ok || ir.status !== 200) broken += 1;
    }
    if (checked === 0) return fail("검사 가능한 아이콘 src 없음", "아이콘 ≥ 1 (src 유효)"); // 거짓 PASS 금지: 0개 검사를 '전부 200'으로 통과시키지 않는다
    return broken ? fail(`아이콘 ${broken}/${checked} 실패`, "전부 200") : pass(`아이콘 ${checked}개 200`, "전부 200");
  }
  const missing = ["name", "start_url"].filter((k) => !manifest[k]);
  if (!Array.isArray(manifest.icons) || !manifest.icons.length) missing.push("icons");
  return missing.length ? fail(`필드 누락: ${missing.join(",")}`, "필수 필드") : pass("manifest 유효", "필수 필드");
}

async function evalServiceWorker(c, ctx) {
  const url = new URL(c.config.scriptPath || "sw.js", c.config.baseUrl).href;
  const r = await cachedFetch(ctx, url, { timeoutMs: c.timeoutMs });
  if (!r.ok) return r.errorClass === "timeout" ? degraded("timeout", "응답") : fail(r.errorClass, "응답");
  if (r.status !== 200) {
    return c.sourceUnavailableStatus === "SKIPPED" ? { status: C_STATUS.SKIPPED, actual: `HTTP ${r.status}`, expected: null } : fail(`HTTP ${r.status}`, "HTTP 200");
  }
  const problems = [];
  if (c.config.syntax) {
    try { new vm.Script(r.bodyText, { filename: url }); } catch (e) { problems.push(`문법 오류: ${String(e.message).slice(0, 80)}`); }
  }
  const any = c.config.mustContainAny || [];
  if (any.length && !any.some((m) => r.bodyText.includes(m))) problems.push(`내용 누락(any): ${any.join("|")}`);
  for (const m of c.config.mustNotContainAny || []) if (r.bodyText.includes(m)) problems.push(`금지 내용: ${m}`);
  return problems.length ? fail(problems.join(" · "), "SW 계약") : pass(`SW 200 · ${r.bytes}B`, "SW 계약");
}

async function evalVersionParity(c, ctx) {
  const r = await cachedFetch(ctx, c.config.rawUrl, { timeoutMs: c.timeoutMs });
  if (!r.ok || r.status !== 200) return unavailable(r.ok ? `HTTP ${r.status}` : r.errorClass, "version source 접근 불가");
  let json; try { json = JSON.parse(r.bodyText); } catch { return fail("version source JSON parse 실패", "유효한 package.json"); }
  return json.version === c.config.expected ? pass(json.version, c.config.expected) : fail(`main ${json.version}`, `registry ${c.config.expected}`);
}

function evalDataFreshness(c, ctx) {
  const t = Date.parse(c.config.value || "");
  if (!Number.isFinite(t)) return unavailable("timestamp 없음", "source가 시각을 제공하지 않으면 현재 시각으로 채우지 않는다");
  const ageHours = (ctx.nowMs - t) / 3_600_000;
  if (ageHours < -0.17) return degraded(`미래 시각 ${Math.round(-ageHours * 60)}분`, "과거 시각", "시계 오차 또는 기록 오류");
  return ageHours > c.config.maxHours ? degraded(`${Math.round(ageHours)}시간 경과`, `≤ ${c.config.maxHours}시간`) : pass(`${Math.round(ageHours)}시간 경과`, `≤ ${c.config.maxHours}시간`);
}

// 실제 실패(완료 못한 배포)만 FAIL로 올린다. skipped·neutral·action_required·stale·cancelled은 실패가 아니므로
// health-engine ciResult(3.3.19)와 동일하게 DEGRADED-info로 — deep 계약 severityIfFail이 error여도 incident로
// 안 새게 severity:"info"를 명시한다(두 엔진 판정 일치·거짓 경보 방지).
const CI_HARD_FAIL = new Set(["failure", "timed_out", "startup_failure"]);
const ciDegradedInfo = (name, conclusion) => ({ ...degraded(`${name || "workflow"}: ${conclusion}`, "성공", "성공 아님(실패는 아님) — 확인 권장"), severity: "info" });
async function evalGithubActions(c, ctx, runtimeDir) {
  const path = c.config.workflowFile
    ? `/repos/${c.config.repo}/actions/workflows/${c.config.workflowFile}/runs?per_page=1&status=success`
    : `/repos/${c.config.repo}/actions/runs?branch=main&per_page=1`;
  const g = await ghGet(ctx, runtimeDir, path);
  if (!g.ok) {
    if (g.blocked) return { status: C_STATUS.BLOCKED_EXTERNAL, actual: g.detail, expected: null, note: "GitHub rate limit — 캐시로 다음 실행에서 재시도" };
    return unavailable(g.detail, "GitHub API 접근 불가(앱 장애와 구분)");
  }
  const run = g.payload?.workflow_runs?.[0];
  if (!run) return unavailable("실행 이력 없음", "Actions 미사용과 실패를 구분");
  if (c.config.maxAgeHours) {
    // workflowFile 없이 조회하면 성공·실패·취소가 섞인 '최신 run'이 온다. 최근성만 보고 '성공 N시간 전'으로
    // 위장하지 말고 실제 conclusion을 확인한다(실패한 파이프라인이 초록으로 보이던 거짓 성과 차단).
    if (run.status && run.status !== "completed") return pass(`실행 중(${run.status})`, "완료", "실행 중은 정상");
    if (run.conclusion && run.conclusion !== "success") {
      return CI_HARD_FAIL.has(run.conclusion)
        ? fail(`${run.name || "workflow"}: ${run.conclusion}`, "성공")
        : ciDegradedInfo(run.name, run.conclusion); // cancelled·skipped·neutral·action_required 등은 실패 아님 → DEGRADED-info
    }
    const age = (ctx.nowMs - Date.parse(run.updated_at)) / 3_600_000;
    return age > c.config.maxAgeHours ? fail(`마지막 성공 ${Math.round(age)}시간 전`, `≤ ${c.config.maxAgeHours}시간`) : pass(`성공 ${Math.round(age)}시간 전`, `≤ ${c.config.maxAgeHours}시간`);
  }
  if (run.status !== "completed") return pass(`실행 중(${run.status})`, "완료", "실행 중은 정상");
  // success만 통과. 완료 못한 실패(failure·timed_out·startup_failure)만 FAIL. cancelled·skipped·neutral·
  // action_required 등은 실패가 아니므로 DEGRADED-info로(health-engine ciResult와 동일 — 두 엔진 판정 일치).
  if (run.conclusion === "success") return pass("success", "success");
  if (CI_HARD_FAIL.has(run.conclusion)) return fail(`${run.name || "workflow"}: ${run.conclusion}`, "success");
  return ciDegradedInfo(run.name, run.conclusion || "미상");
}

async function evalGithubPrs(c, ctx, runtimeDir) {
  const g = await ghGet(ctx, runtimeDir, `/repos/${c.config.repo}/pulls?state=open&per_page=30`);
  if (!g.ok) {
    if (g.blocked) return { status: C_STATUS.BLOCKED_EXTERNAL, actual: g.detail, expected: null };
    return unavailable(g.detail, "GitHub API 접근 불가");
  }
  const prs = g.payload || [];
  if (!prs.length) return pass("열린 PR 0", "정체 없음");
  const oldest = Math.max(...prs.map((p) => (ctx.nowMs - Date.parse(p.created_at)) / 86_400_000));
  if (oldest >= (c.config.errorDays || 30)) return fail(`최장 ${Math.round(oldest)}일`, `< ${c.config.errorDays || 30}일`);
  if (oldest >= (c.config.warnDays || 14)) return degraded(`최장 ${Math.round(oldest)}일`, `< ${c.config.warnDays || 14}일`);
  return pass(`열린 PR ${prs.length} · 최장 ${Math.round(oldest)}일`, "정체 없음");
}

async function evalGithubRelease(c, ctx, runtimeDir) {
  const g = await ghGet(ctx, runtimeDir, `/repos/${c.config.repo}/releases?per_page=10`);
  if (!g.ok) {
    if (g.blocked) return { status: C_STATUS.BLOCKED_EXTERNAL, actual: g.detail, expected: null };
    return unavailable(g.detail, "GitHub API 접근 불가");
  }
  const release = (g.payload || []).find((r) => String(r.tag_name || "").startsWith(c.config.tagPrefix || ""));
  if (!release) return unavailable("릴리스 없음", "릴리스 이력 필요");
  const assets = release.assets || [];
  const zero = assets.filter((a) => !a.size);
  if (assets.length < (c.config.minAssets || 1)) return fail(`${release.tag_name} 산출물 ${assets.length}개`, `≥ ${c.config.minAssets}개`);
  if (zero.length) return fail(`크기 0 산출물 ${zero.length}개`, "0개");
  return pass(`${release.tag_name} · 산출물 ${assets.length}개`, "산출물 무결");
}

// url 또는 urlCandidates(고정 순서·첫 200 채택 — 결정론) 해석. 전부 실패하면 첫 후보의 결과를 반환.
async function fetchJsonSource(ctx, config, timeoutMs) {
  const candidates = config.urlCandidates || [config.url];
  let first = null;
  for (const url of candidates) {
    const r = await cachedFetch(ctx, url, { headers: { accept: "application/json" }, timeoutMs });
    if (!first) first = r;
    if (r.ok && r.status === 200) return r;
  }
  return first;
}
async function evalHttpJsonContract(c, ctx, runtimeDir) {
  const r = await fetchJsonSource(ctx, c.config, c.timeoutMs);
  if (!r.ok) return r.errorClass === "timeout" ? degraded("timeout", "응답") : fail(r.errorClass, "응답");
  if (r.status !== 200) return fail(`HTTP ${r.status}`, "HTTP 200");
  if (c.config.contentTypeIncludes && !r.contentType.includes(c.config.contentTypeIncludes)) return fail(`content-type ${r.contentType || "없음"}`, c.config.contentTypeIncludes);
  // 헤더 계약
  const headerFailed = runAssertions(r.headers, c.config.headerAssertions || [], { nowMs: ctx.nowMs });
  if (headerFailed.length) return fail(headerFailed.map((f) => `${f.label || f.path}: ${f.op} 실패(${f.actual})`).join(" · "), "헤더 계약");
  // stale 헤더가 '실제 stale을 뜻하는 값'일 때만 DEGRADED. 서버가 x-data-stale: 0(명시적 fresh)을 보내면
  // "0"은 truthy 문자열이라 예전엔 신선한 데이터를 stale로 오표기했다 → 0/false/no/off는 fresh로 취급.
  if (c.config.staleHeaderDegraded) {
    const sv = String(r.headers[c.config.staleHeaderDegraded] ?? "").trim().toLowerCase();
    if (sv && !["0", "false", "no", "off", "fresh"].includes(sv)) {
      return degraded(`${c.config.staleHeaderDegraded}=${r.headers[c.config.staleHeaderDegraded]}`, "신선한 데이터", "LKG 제공 중 — 업스트림 수집 확인 필요");
    }
  }
  // 단조 증가(state 비교)
  if (c.config.monotonicHeader) {
    const value = r.headers[c.config.monotonicHeader];
    if (!value) return unavailable(`${c.config.monotonicHeader} 없음`, "헤더 필요");
    const stateFile = join(resolve(runtimeDir), "health", "source-cache", `${c.config.stateKey || c.id}.json`);
    let prev = null; try { prev = JSON.parse(readFileSync(stateFile, "utf8")); } catch { /* 첫 실행 */ }
    try {
      mkdirSync(join(resolve(runtimeDir), "health", "source-cache"), { recursive: true, mode: 0o700 });
      writeFileSync(stateFile, JSON.stringify({ value, at: ctx.now.toISOString() }), { encoding: "utf8", mode: 0o600 });
    } catch { /* 상태 저장 실패는 판정을 막지 않는다 */ }
    if (prev?.value && Date.parse(value) < Date.parse(prev.value) - 60_000) return fail(`${value} < 직전 ${prev.value}`, "단조 증가");
    return pass(value, "단조 증가");
  }
  // 거짓 PASS 금지: assertion이 없어도 본문이 실제 JSON으로 파싱되는지는 확인한다(200인데 깨진 본문을 '충족'으로 넘기지 않음).
  if (!c.config.assertions?.length) { try { JSON.parse(r.bodyText); } catch { return fail("JSON parse 실패", "유효한 JSON"); } return pass(`HTTP 200 JSON`, "계약 충족"); }
  let json; try { json = JSON.parse(r.bodyText); } catch { return fail("JSON parse 실패", "유효한 JSON"); }
  // 항목 경로 후보를 고정 순서로 해석(결정론) — 배열을 찾은 첫 후보 사용
  let items = null;
  for (const p of c.config.itemsPathCandidates || [""]) {
    const v = p === "" ? json : resolvePath(json, p);
    if (Array.isArray(v)) { items = v; break; }
  }
  if ((c.config.itemsPathCandidates || []).length && !items) return fail("배열을 찾지 못함(오류 객체를 배열로 오인 금지)", "JSON 배열");
  const subject = items ?? json;
  const failed = runAssertions(subject, c.config.assertions, { nowMs: ctx.nowMs });
  return failed.length
    ? fail(failed.slice(0, 4).map((f) => `${f.label || f.path || "$"}: ${f.op} 실패(${f.actual ?? "없음"})`).join(" · "), "데이터 계약", `실패 assertion ${failed.length}건`)
    : pass(`항목 ${Array.isArray(subject) ? subject.length : 1}개 계약 통과`, "데이터 계약");
}

async function evalRepoText(c, ctx) {
  for (const path of c.config.pathCandidates || []) {
    const r = await rawMain(ctx, c.config.repo, path);
    if (r.ok && r.status === 200) {
      const any = c.config.mustContainAny || [];
      const missing = any.length && !any.some((m) => r.bodyText.includes(m));
      const forbidden = (c.config.mustNotContainAny || []).filter((m) => r.bodyText.includes(m));
      if (missing) return fail(`${path}: 기대 내용 없음(${any.join("|")})`, "내용 계약");
      if (forbidden.length) return fail(`${path}: 금지 내용 ${forbidden.join(",")}`, "내용 계약");
      return pass(`${path} 감사 통과`, "내용 계약");
    }
  }
  return unavailable("후보 경로 없음", "main 읽기 전용 감사 실패 — 경로 선언 필요");
}

// ── 등록된 순수 데이터 검증기(앱 심층 계약) ──
const DATA_VALIDATORS = {
  // 러닝봄 races.json 심층 — 필수 필드·중복·날짜·접수 순서·상태-날짜 모순·미래 접수·종료 비율
  runningbom_races(json, ctx) {
    const races = [...(json.scheduleFeed || json.races || []), ...(json.featuredRaces || [])];
    if (!races.length) return fail("대회 0건", "≥ 1건");
    const problems = [];
    const keys = new Set(); let dup = 0, badDate = 0, badOrder = 0, futureOpen = 0, ended = 0, contradiction = 0;
    for (const race of races) {
      const key = race.id || race.slug || `${race.name}|${race.raceDate || race.date}`;
      if (keys.has(key)) dup += 1; keys.add(key);
      const dateValue = race.raceDate || race.date;
      const t = Date.parse(dateValue || "");
      if (!Number.isFinite(t)) { badDate += 1; continue; }
      if (t < ctx.nowMs) ended += 1;
      const open = Date.parse(race.registrationOpenAt || race.registrationOpen || "");
      const close = Date.parse(race.registrationCloseAt || race.registrationClose || "");
      if (Number.isFinite(open) && Number.isFinite(close) && open > close) badOrder += 1;
      if (Number.isFinite(open) && open > ctx.nowMs) futureOpen += 1;
      if (Number.isFinite(close) && close > t + 86_400_000) contradiction += 1; // 마감이 대회일 하루 뒤보다 늦으면 모순
    }
    if (dup) problems.push(`중복 대회 ${dup}건`);
    if (badDate) problems.push(`날짜 parse 실패 ${badDate}건`);
    if (badOrder) problems.push(`접수 시작>마감 역순 ${badOrder}건`);
    if (contradiction) problems.push(`마감이 대회일 이후 ${contradiction}건`);
    const endedRatio = ended / races.length;
    if (endedRatio >= 0.95) problems.push(`종료 대회 비율 ${(endedRatio * 100).toFixed(0)}%(과거만 남음)`);
    if (!futureOpen && endedRatio > 0.5) problems.push("미래 접수 창 0건");
    return problems.length ? fail(problems.join(" · "), "데이터 무결") : pass(`대회 ${races.length}건 · 미래 접수 ${futureOpen}건`, "데이터 무결");
  },
  // 러닝봄 공식 링크 회전 표본 — 하루 1개 결정론 선택(day-of-year), 403은 정책과 구분
  async runningbom_link_sample(json, ctx) {
    const races = (json.scheduleFeed || json.races || []).filter((r) => /^https?:/.test(String(r.registrationUrl || r.officialUrl || "")));
    if (!races.length) return unavailable("공식 URL 있는 대회 없음", "표본 불가");
    const dayOfYear = Math.floor((ctx.nowMs - Date.UTC(ctx.now.getUTCFullYear(), 0, 0)) / 86_400_000);
    const race = races[dayOfYear % races.length];
    const url = race.registrationUrl || race.officialUrl;
    const r = await cachedFetch(ctx, url, { timeoutMs: 20_000 });
    if (!r.ok) return degraded(`${r.errorClass}: ${String(url).slice(0, 60)}`, "응답", "외부 사이트 네트워크 요인 가능");
    if (r.status === 403 || r.status === 429) return pass(`HTTP ${r.status}(source 정책 차단 — 404와 구분)`, "링크 존재");
    if (r.status >= 200 && r.status < 300) return pass(`HTTP ${r.status}: ${race.name || ""}`, "유효한 공식 링크");
    // 404·410뿐 아니라 5xx·401·400 등 오류 응답도 '유효한 링크'로 위장하지 않는다(깨진 링크는 깨진 링크).
    return fail(`HTTP ${r.status}: ${race.name || ""}`, "유효한 공식 링크(2xx)");
  },
  // 자격증봄 source registry 심층
  certbom_sources(json) {
    const sources = json.sources || json;
    if (!Array.isArray(sources)) return fail("sources 배열 없음", "배열");
    if (!sources.length) return fail("source 0건", "≥ 1건");
    const problems = [];
    const ids = new Set();
    let dupId = 0, badUrl = 0, noOwner = 0, noParser = 0, badVerified = 0;
    for (const s of sources) {
      if (ids.has(s.sourceId || s.id)) dupId += 1; ids.add(s.sourceId || s.id);
      const url = s.officialUrl || s.url;
      try { if (new URL(url).protocol !== "https:") badUrl += 1; } catch { badUrl += 1; }
      if (!s.owner) noOwner += 1;
      if (s.parserVersion === "" || s.parserVersion === null) noParser += 1;
      if (s.lastVerifiedAt && !Number.isFinite(Date.parse(s.lastVerifiedAt))) badVerified += 1;
    }
    if (dupId) problems.push(`sourceId 중복 ${dupId}`);
    if (badUrl) problems.push(`비HTTPS·무효 URL ${badUrl}`);
    if (noOwner) problems.push(`owner 누락 ${noOwner}`);
    if (noParser) problems.push(`parserVersion 빈 값 ${noParser}`);
    if (badVerified) problems.push(`lastVerifiedAt parse 실패 ${badVerified}`);
    return problems.length ? fail(problems.join(" · "), "source registry 무결") : pass(`source ${sources.length}건 무결`, "source registry 무결");
  },
  // 자격증봄 마케팅 숫자 parity — 화면 문구의 N과 데이터 수 비교(표면 텍스트 기반)
  async certbom_marketing_parity(_json, ctx, c) {
    const r = await cachedFetch(ctx, c.config.url, { timeoutMs: 20_000 });
    if (!r.ok || r.status !== 200) return unavailable("화면 접근 불가", "가용성 계약이 담당");
    const counts = [...r.bodyText.matchAll(/(\d{2,4})\s*(?:개|곳|종)/g)].map((m) => Number(m[1]));
    if (!counts.length) return pass("마케팅 숫자 문구 없음", "parity 위반 없음");
    // 거짓 PASS 금지: 여기서는 화면 숫자를 실제 데이터 수와 대조하지 않는다 → 관찰만 했음을 정직하게 UNAVAILABLE로 표기(가짜 통과 금지).
    return unavailable(`화면 숫자 ${counts.slice(0, 5).join(",")} 관찰 — 데이터 대조 미수행`, "데이터 parity 계약 필요");
  },
};

async function evalRepoJson(c, ctx) {
  for (const path of c.config.pathCandidates || []) {
    const r = await rawMain(ctx, c.config.repo, path);
    if (r.ok && r.status === 200) {
      let json; try { json = JSON.parse(r.bodyText); } catch { return fail(`${path}: JSON parse 실패`, "유효한 JSON"); }
      const validator = DATA_VALIDATORS[c.config.validator];
      if (!validator) return unavailable(`validator 미등록: ${c.config.validator}`, "코드 등록 필요");
      return validator(json, ctx, c);
    }
  }
  return unavailable("정본 파일 후보 경로에서 발견 못함", "registry에 경로 선언 필요(need_new_source 후보)");
}

async function evalAppDataValidator(c, ctx) {
  const validator = DATA_VALIDATORS[c.config.validator];
  if (!validator) return unavailable(`validator 미등록: ${c.config.validator}`, "코드 등록 필요");
  if (c.config.validator === "certbom_marketing_parity") return validator(null, ctx, c);
  const r = await fetchJsonSource(ctx, c.config, c.timeoutMs);
  if (!r.ok) return r.errorClass === "timeout" ? degraded("timeout", "응답") : fail(r.errorClass, "응답");
  if (r.status !== 200) return fail(`HTTP ${r.status}`, "HTTP 200");
  let json; try { json = JSON.parse(r.bodyText); } catch { return fail("JSON parse 실패", "유효한 JSON"); }
  return validator(json, ctx, c);
}

// 러닝봄 ASSET_VERSION: HTML 캐시버스트와 SW 캐시 버전 정합
async function evalAssetVersionParity(c, ctx) {
  const s = await getSurface(ctx, c.config.url, c.config.baseUrl);
  if (!s.home.ok || s.home.status !== 200) return unavailable("home 실패", "가용성 계약이 담당");
  const htmlVersion = s.home.bodyText.match(/[?&]v=([A-Za-z0-9._-]+)/)?.[1] || null;
  const sw = await cachedFetch(ctx, new URL("sw.js", c.config.baseUrl).href, { timeoutMs: 15_000 });
  if (!sw.ok || sw.status !== 200) return unavailable("sw.js 접근 불가", "SW 계약이 담당");
  if (!htmlVersion) return pass("HTML 캐시버스트 미사용", "정합 위반 없음");
  return sw.bodyText.includes(htmlVersion) ? pass(`v=${htmlVersion} 정합`, "HTML==SW") : degraded(`HTML v=${htmlVersion}가 SW에 없음`, "HTML==SW");
}

// robom.kr 라우트 행렬·sitemap·SEO·UA parity·내부 링크
async function evalRouteMatrix(c, ctx) {
  const broken = []; const titles = new Map();
  for (const url of c.config.urls || []) {
    const r = await cachedFetch(ctx, url, { timeoutMs: 20_000 });
    if (!r.ok || r.status !== 200) broken.push(`${r.ok ? r.status : r.errorClass} ${new URL(url).pathname}`);
    else if (c.config.uniqueTitles) {
      const title = r.bodyText.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
      if (title) titles.set(title, (titles.get(title) || 0) + 1);
    }
  }
  if (broken.length) return fail(`실패 라우트: ${broken.slice(0, 5).join(", ")}`, "전부 200");
  const dupTitles = [...titles.entries()].filter(([, n]) => n > 1);
  if (dupTitles.length) return degraded(`중복 title ${dupTitles.length}건`, "title 고유");
  return pass(`${(c.config.urls || []).length}개 라우트 200`, "전부 200");
}

async function evalSitemap(c, ctx) {
  const r = await cachedFetch(ctx, c.config.url, { timeoutMs: 20_000 });
  if (!r.ok || r.status !== 200) return fail(r.ok ? `HTTP ${r.status}` : r.errorClass, "HTTP 200");
  const urls = [...r.bodyText.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (!urls.length) return fail("<loc> 0건", "URL 목록");
  const problems = [];
  if (new Set(urls).size !== urls.length) problems.push("중복 URL");
  if (urls.some((u) => u.includes("?") || u.includes("#"))) problems.push("query/fragment URL");
  const paths = urls.map((u) => { try { return new URL(u).pathname; } catch { return ""; } });
  const missing = (c.config.requiredPathPrefixes || []).filter((p) => !paths.some((x) => x.startsWith(p)));
  if (missing.length) problems.push(`누락 경로 ${missing.slice(0, 4).join(",")}`);
  let broken = 0;
  for (const u of urls.slice(0, c.config.maxUrls || 100)) {
    if (ctx.budgetExhausted()) break;
    const pr = await cachedFetch(ctx, u, { method: "HEAD", timeoutMs: 15_000 });
    if (!pr.ok || pr.status !== 200) broken += 1;
  }
  if (broken) problems.push(`404 등 실패 URL ${broken}건`);
  return problems.length ? fail(problems.join(" · "), "sitemap 무결") : pass(`URL ${urls.length}건 전수 200`, "sitemap 무결");
}

async function evalSeoHtml(c, ctx) {
  const r = await cachedFetch(ctx, c.config.url, { timeoutMs: 20_000 });
  if (!r.ok || r.status !== 200) return unavailable(r.ok ? `HTTP ${r.status}` : r.errorClass, "가용성 계약이 담당");
  const html = r.bodyText; const problems = [];
  const count = (re) => (html.match(re) || []).length;
  if (c.config.requireTitle && count(/<title[^>]*>/gi) !== 1) problems.push(`title ${count(/<title[^>]*>/gi)}개`);
  if (c.config.requireDescription && count(/<meta[^>]+name=["']description["']/gi) !== 1) problems.push("description ≠ 1");
  if (c.config.requireCanonical && count(/<link[^>]+rel=["']canonical["']/gi) !== 1) problems.push("canonical ≠ 1");
  if (c.config.requireH1 && count(/<h1[\s>]/gi) !== 1) problems.push(`H1 ${count(/<h1[\s>]/gi)}개`);
  for (const type of c.config.requireJsonLdTypes || []) {
    const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    const found = blocks.some((b) => { try { return JSON.stringify(JSON.parse(b[1])).includes(`"${type}"`); } catch { return false; } });
    if (!found) problems.push(`JSON-LD ${type} 없음`);
  }
  return problems.length ? fail(problems.join(" · "), "SEO 계약") : pass("SEO 메타 계약 통과", "SEO 계약");
}

async function evalUaParity(c, ctx) {
  const normal = await cachedFetch(ctx, c.config.url, { timeoutMs: 20_000 });
  const bot = await cachedFetch(ctx, c.config.url, { timeoutMs: 20_000, userAgent: c.config.botUserAgent });
  if (!normal.ok || !bot.ok) return unavailable("요청 실패", "네트워크 요인");
  if ([403, 429].includes(bot.status) && normal.status === 200) return fail(`Yeti UA만 HTTP ${bot.status}`, "동일 응답");
  const missing = (c.config.markers || []).filter((m) => normal.bodyText.includes(m) && !bot.bodyText.includes(m));
  return missing.length ? fail(`Yeti 응답에 marker 누락: ${missing.slice(0, 3).join(",")}`, "핵심 marker 동일") : pass("일반·Yeti UA 핵심 marker 동일", "동일 응답");
}

async function evalInternalLinks(c, ctx) {
  const r = await cachedFetch(ctx, c.config.url, { timeoutMs: 20_000 });
  if (!r.ok || r.status !== 200) return unavailable("home 실패", "가용성 계약이 담당");
  const origin = new URL(c.config.url).origin;
  const links = new Set();
  for (const m of r.bodyText.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    try { const u = new URL(m[1], c.config.url); if (u.origin === origin) links.add(u.href.split("?")[0]); } catch { /* 무시 */ }
  }
  const broken = [];
  for (const link of [...links].slice(0, c.config.maxLinks || 40)) {
    if (ctx.budgetExhausted()) break;
    const lr = await cachedFetch(ctx, link, { method: "HEAD", timeoutMs: 15_000 });
    if (!lr.ok || ![200, 405].includes(lr.status)) broken.push(`${lr.ok ? lr.status : lr.errorClass} ${new URL(link).pathname}`);
  }
  return broken.length ? fail(`죽은 링크: ${broken.slice(0, 5).join(", ")}`, "내부 404 0건") : pass(`내부 링크 ${links.size}건 정상`, "내부 404 0건");
}

// ── browser_smoke: Electron(데스크톱) 또는 Playwright(개발)로 실제 렌더 검사 ──
async function evalBrowserSmoke(c, ctx) {
  const driver = getBrowserDriver();
  if (!driver) return unavailable("browser_missing", "브라우저 capability 없음 — HTTP 계약은 계속 실행(§6.4)");
  const problems = []; const evidence = [];
  for (const viewport of c.config.viewports || [{ width: 390, height: 844 }]) {
    let m;
    try {
      m = await driver.run({
        url: c.config.url, viewport, timeoutMs: c.timeoutMs || 45_000,
        seedStorage: c.config.seedStorage || null,
        collectStorageKeys: (c.config.storageAssertions || []).map((a) => a.key),
      });
    } catch (error) { problems.push(`${viewport.width}px: 드라이버 오류 ${String(error?.message || error).slice(0, 60)}`); continue; }
    evidence.push(`${viewport.width}px: HTTP ${m.httpStatus ?? "?"}·콘솔오류 ${m.consoleErrors.length}·폭 ${m.scrollWidth}/${m.innerWidth}`);
    // HTTP 오류 페이지(404/500 등)를 '정상'으로 통과시키지 않는다 — 가장 흔한 배포 사고를 잡는다.
    if (Number.isInteger(m.httpStatus) && m.httpStatus >= 400) problems.push(`${viewport.width}px HTTP ${m.httpStatus} 오류 페이지`);
    if (m.consoleErrors.length > (c.config.maxConsoleErrors ?? 0)) problems.push(`${viewport.width}px 콘솔 오류 ${m.consoleErrors.length}건: ${redactEvidence(m.consoleErrors[0] || "")}`);
    if (c.config.checkOverflow && m.scrollWidth > m.innerWidth + 1) problems.push(`${viewport.width}px 가로 넘침 ${m.scrollWidth - m.innerWidth}px`);
    // 본문 텍스트가 0자면(완전 빈 화면) 계약 설정과 무관하게 실패로 본다 — 텍스트 앱에서 빈 화면은 절대 정상이 아니다.
    const minText = c.config.bodyMinTextLength || 1;
    if (m.bodyTextLength < minText) problems.push(`${viewport.width}px 본문 텍스트 ${m.bodyTextLength}자(빈 화면 의심)`);
    for (const a of c.config.storageAssertions || []) {
      const value = m.storage?.[a.key];
      if (a.op === "not_eq_empty_overwrite" || a.op === "preserved_or_recovery") {
        const seeded = c.config.seedStorage?.[a.key];
        const preserved = value === seeded;
        const recovery = Object.keys(m.storage || {}).some((k) => /recovery|backup|lkg/i.test(k) && m.storage[k]);
        const emptied = value === undefined || value === "" || value === "{}" || value === "[]";
        if (emptied && !recovery && !preserved) problems.push(`${a.label || a.key}: 원문이 빈 값으로 덮임(recovery 없음)`);
      }
    }
  }
  return problems.length ? fail(problems.join(" · "), "브라우저 smoke 계약") : pass(evidence.join(" · "), "브라우저 smoke 계약");
}

// ── HQ 로컬 런타임 계약(§10) ──
function newestMtime(dir) {
  try {
    let newest = 0;
    for (const f of readdirSync(dir)) { const t = statSync(join(dir, f)).mtimeMs; if (t > newest) newest = t; }
    return newest || null;
  } catch { return null; }
}
function dirSize(dir, cap = 500) {
  let total = 0; let count = 0;
  const walk = (d) => {
    let entries; try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count++ > cap) return;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { try { total += statSync(p).size; } catch { /* 무시 */ } }
    }
  };
  walk(dir); return total;
}
function evalHqRuntime(c, ctx, env) {
  const { runtimeDir, repoRoot, snapDir, registryAppCount, manageRunner, expectedContracts, executedContracts } = env;
  const check = c.config.check;
  try {
    switch (check) {
      case "snapshot-exists": {
        const latest = join(snapDir, "latest.json");
        if (!existsSync(latest)) return fail("latest.json 없음(예시 폴백 상태)", "실제 스냅샷");
        const snap = JSON.parse(readFileSync(latest, "utf8"));
        return snap.example ? fail("example 스냅샷", "실제 스냅샷") : pass("실제 스냅샷 존재", "실제 스냅샷");
      }
      case "snapshot-age": {
        const latest = join(snapDir, "latest.json");
        if (!existsSync(latest)) return unavailable("스냅샷 없음", "snapshot-exists 계약이 담당");
        const gen = Date.parse(JSON.parse(readFileSync(latest, "utf8")).generatedAt || "");
        if (!Number.isFinite(gen)) return fail("generatedAt 없음", "생성 시각");
        const ageMin = (ctx.nowMs - gen) / 60_000;
        const limit = (env.watchdogMinutes || 10) * 3 + 5;
        return ageMin > limit ? degraded(`${Math.round(ageMin)}분 전`, `≤ ${limit}분`) : pass(`${Math.round(ageMin)}분 전`, `≤ ${limit}분`);
      }
      case "snapshot-app-count": {
        const latest = join(snapDir, "latest.json");
        if (!existsSync(latest)) return unavailable("스냅샷 없음", "snapshot-exists 계약이 담당");
        const apps = JSON.parse(readFileSync(latest, "utf8")).apps || [];
        const expected = registryAppCount + 1; // + robom 본사
        return apps.length === expected ? pass(`${apps.length}개`, `${expected}개`) : fail(`${apps.length}개`, `${expected}개(누락 앱은 무점검 상태)`);
      }
      case "queue-integrity": {
        const qdir = join(resolve(runtimeDir), "queue");
        if (!existsSync(qdir)) return pass("대기열 미생성(작업 0)", "무결");
        const ids = new Set(); let dup = 0, parseFail = 0;
        for (const sub of ["pending", "running", "done", "failed"]) {
          const d = join(qdir, sub);
          if (!existsSync(d)) continue;
          for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
            try { const p = JSON.parse(readFileSync(join(d, f), "utf8")); if (ids.has(p.task_id || p.taskId || f)) dup += 1; ids.add(p.task_id || p.taskId || f); }
            catch { parseFail += 1; }
          }
        }
        if (parseFail || dup) return fail(`parse 실패 ${parseFail}·중복 ${dup}`, "무결");
        return pass(`패킷 ${ids.size}개 무결`, "무결");
      }
      // 거짓 PASS 금지: 여기서 실제 stale lease 유무를 실측하지 않는다(회수는 hq-status 요청 경로에서 수행).
      // 검증하지 못하는 항목을 '동작함'으로 통과시키지 않고 점검 불가로 정직하게 표기한다.
      case "stale-lease": return unavailable("lease 회수는 요청 경로에서 수행 — 이 점검에서 실측 안 함", "실측 미구현");
      case "control-flags": {
        const f = join(resolve(runtimeDir), "queue", "control.json");
        if (!existsSync(f)) return pass("기본값(제어 플래그 없음)", "parse 유효");
        JSON.parse(readFileSync(f, "utf8"));
        return pass("control.json parse 유효", "parse 유효");
      }
      case "authority-valid": {
        const f = join(resolve(runtimeDir), "company-authority.json");
        if (!existsSync(f)) return pass("기본값(초기화 전)", "유효");
        const v = JSON.parse(readFileSync(f, "utf8"));
        // 정본 6종 전부를 유효로 본다. 과거의 3종 목록은 회장이 EMERGENCY_STOP/DRAINING/SAFE_MODE로
        // 정당하게 세운 상태를 '권한 정본 깨짐'으로 오탐해, 안전 정지 중에 복구를 종용하는 헛경보를 냈다.
        return COMPANY_MODES.includes(v.mode) ? pass(v.mode, "유효한 모드") : fail(String(v.mode), "유효한 모드");
      }
      case "review-marker": {
        const f = join(resolve(runtimeDir), "last-auto-review.json");
        if (!existsSync(f)) return degraded("점검 marker 없음", "최근 실행", "첫 실행 전이거나 루프 정지");
        const at = Date.parse(JSON.parse(readFileSync(f, "utf8")).at || "");
        const ageMin = (ctx.nowMs - at) / 60_000;
        const limit = Math.max((env.watchdogMinutes || 10) * 3, 45);
        return ageMin > limit ? degraded(`${Math.round(ageMin)}분 전`, `≤ ${limit}분`) : pass(`${Math.round(ageMin)}분 전`, `≤ ${limit}분`);
      }
      case "settings-parity": {
        const f = join(resolve(runtimeDir), "review-schedule.json");
        if (!existsSync(f)) return pass("설정 파일 없음(기본값 사용)", "parity");
        JSON.parse(readFileSync(f, "utf8"));
        return pass("설정 parse 유효", "parity");
      }
      case "runner-status": {
        const f = join(resolve(runtimeDir), "queue", "runner-status.json");
        if (!existsSync(f)) return manageRunner ? degraded("실행기 상태 없음", "상태 파일", "관리 모드에서 재시작 대기") : pass("실행기 미관리 모드", "해당 없음");
        const v = JSON.parse(readFileSync(f, "utf8"));
        const age = (ctx.nowMs - Date.parse(v.updatedAt || v.at || "")) / 60_000;
        if (Number.isFinite(age) && age > 30 && manageRunner) return degraded(`상태 ${Math.round(age)}분 전`, "≤ 30분");
        return pass(v.state || "확인", "신선한 상태");
      }
      case "codex-cli": {
        const home = process.env.HOME || "";
        const authExists = home && existsSync(join(home, ".codex", "auth.json"));
        return authExists ? pass("Codex 로그인 확인(단일 실행기)", "연결") : degraded("Codex 미로그인(NOT_CONNECTED)", "codex login 1회", "점검은 계속 동작 — 자동 수정만 대기");
      }
      case "disk-free": {
        const s = statfsSync(resolve(runtimeDir));
        const free = s.bavail * s.bsize;
        if (free < 524_288_000) return { ...fail(`${Math.round(free / 1e6)}MB`, "≥ 500MB"), severity: "critical" };
        if (free < 2_147_483_648) return degraded(`${(free / 1e9).toFixed(1)}GB`, "≥ 2GB");
        return pass(`${(free / 1e9).toFixed(1)}GB`, "≥ 2GB");
      }
      case "backup-age": {
        const dir = join(resolve(runtimeDir), "backups");
        const newest = newestMtime(dir);
        if (!newest) return degraded("백업 없음", "≤ 7일", "기록 화면에서 백업 실행");
        const days = (ctx.nowMs - newest) / 86_400_000;
        return days > 7 ? degraded(`${Math.round(days)}일 전`, "≤ 7일") : pass(`${Math.round(days)}일 전`, "≤ 7일");
      }
      case "health-history-size": {
        const size = dirSize(join(resolve(runtimeDir), "health"));
        return size > 200_000_000 ? degraded(`${Math.round(size / 1e6)}MB`, "≤ 200MB") : pass(`${Math.round(size / 1e6)}MB`, "≤ 200MB");
      }
      case "version-triad": {
        // 패키지 앱 payload에는 desktop/package.json이 없다 — 있으면 3중, 없으면 version.json(빌드 주입)·HQ_VERSION 2중 비교
        const appVersion = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app", "version.json"), "utf8")).version;
        const appJs = readFileSync(join(repoRoot, "ops/control-center/app", "app.js"), "utf8");
        const hqVersion = appJs.match(/HQ_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
        const desktopFile = join(repoRoot, "desktop", "package.json");
        const desktop = existsSync(desktopFile) ? JSON.parse(readFileSync(desktopFile, "utf8")).version : appVersion;
        return desktop === appVersion && appVersion === hqVersion
          ? pass(`${appVersion} 일치`, "일치") : fail(`desktop ${desktop} · app ${appVersion} · js ${hqVersion}`, "일치");
      }
      case "org-canon": {
        const org = JSON.parse(readFileSync(join(repoRoot, "ops/organization/organization.json"), "utf8"));
        const ok = Array.isArray(org.divisions) && org.divisions.length >= 12 && Array.isArray(org.executives) && org.executives.length >= 6;
        return ok ? pass(`본부 ${org.divisions.length}·임원 ${org.executives.length}`, "정본 유효") : fail("조직 구성 부족", "12본부·임원 6+");
      }
      // ── 인력·조직 자체 점검(18A workforce/organization) ──
      case "wf-roster-count": { const r = loadRoster(repoRoot); return r.staff.length === 80 ? pass(`${r.staff.length}명`, "80명") : fail(`${r.staff.length}명`, "80명"); }
      case "wf-unique-ids": { const r = loadRoster(repoRoot); const s = new Set(r.staff.map((x) => x.id)); return s.size === r.staff.length ? pass("중복 0", "고유 id") : fail(`중복 ${r.staff.length - s.size}`, "고유 id"); }
      case "wf-every-duty": { const r = loadRoster(repoRoot); const bad = r.staff.filter((x) => !x.title || !x.division); return bad.length ? fail(`직무 누락 ${bad.length}`, "전원 1차 임무") : pass("전원 임무 보유", "전원 1차 임무"); }
      case "wf-reports-valid": { const r = loadRoster(repoRoot); const ids = new Set(r.staff.map((x) => x.id)); const bad = r.staff.filter((x) => x.reportsTo && !ids.has(x.reportsTo)); return bad.length ? fail(`무효 보고선 ${bad.length}`, "전부 유효") : pass("보고선 전부 유효", "전부 유효"); }
      case "wf-deputy-coverage": { const r = loadRoster(repoRoot); const ids = new Set(r.staff.map((x) => x.id)); const bad = r.staff.filter((x) => !x.welfare && (!x.deputy || !ids.has(x.deputy))); return bad.length ? fail(`대직 누락 ${bad.length}`, "운영직 전원 대직") : pass("대직 전원 지정", "운영직 전원 대직"); }
      case "wf-no-cycle": { const r = loadRoster(repoRoot); const by = Object.fromEntries(r.staff.map((x) => [x.id, x.reportsTo])); let cyc = 0; for (const x of r.staff) { let cur = x.reportsTo, g = 0; while (cur && g++ < 20) { if (cur === x.id) { cyc++; break; } cur = by[cur]; } } return cyc ? fail(`순환 ${cyc}`, "0") : pass("계층 순환 0", "0"); }
      case "wf-owner-coverage": {
        // 소유권 배정 속성: 대표 (target,category) 조합 전부 owner 지정 + owner != verifier
        const targets = ["outbom", "homebom", "runningbom", "calendarbom", "certbom", "notebom", "robom", "robom-hq", "company"];
        const cats = ["production", "data", "pwa", "security", "version", "ci", "github", "user_surface", "self", "seo", "network", "release"];
        const staffIds = new Set(loadRoster(repoRoot).staff.map((x) => x.id));
        let noOwner = 0, sameVer = 0, n = 0;
        for (const t of targets) for (const cat of cats) { n++; const { owner, verifier } = assignOwnership({ id: `${t}:${cat}:probe`, target: t, category: cat }); if (!owner || !staffIds.has(owner)) noOwner++; if (owner === verifier) sameVer++; }
        if (noOwner) return fail(`owner 미배정 ${noOwner}`, "전 계약 owner");
        if (sameVer) return fail(`owner=verifier ${sameVer}`, "구현≠검증 분리");
        return pass(`${n}개 조합 owner·검증자 분리`, "owner·검증 분리");
      }
      case "wf-org-tree": { const t = orgTree(); return t && t.id === "chairman" && (t.children || []).length >= 2 ? pass(`회장 root · 직속 ${t.children.length}`, "트리 유효") : fail("트리 무효", "회장 root"); }
      case "wf-welfare-not-executor": { const r = loadRoster(repoRoot); const bad = r.staff.filter((x) => x.welfare && x.executor); return bad.length ? fail(`복지 executor ${bad.length}`, "0") : pass("복지=생활 연출(비집계)", "0"); }
      case "wf-growth-standby": { const r = loadRoster(repoRoot); const g = r.staff.filter((x) => x.division === "growth"); const bad = g.filter((x) => !x.standby); return bad.length ? fail(`홍보 비대기 ${bad.length}`, "전원 STANDBY") : pass(`홍보 ${g.length}명 STANDBY`, "전원 STANDBY"); }
      case "office-b4-pool": { const m = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app/office-map.json"), "utf8")); const ok = m.floors.some((f) => f.id === "B4") && m.zones.some((z) => z.code === "POOL"); return ok ? pass("B4 수영장 존재", "B4·수영장") : fail("B4/수영장 없음", "B4·수영장"); }
      case "office-family-center": { const m = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app/office-map.json"), "utf8")); const ok = m.zones.some((z) => z.code === "FAMILY LOUNGE") && m.zones.some((z) => z.code === "KIDS LIBRARY"); return ok ? pass("가족 라운지·도서관 존재", "가족센터") : fail("가족센터 없음", "가족센터"); }
      case "office-family-actors": { const m = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app/office-map.json"), "utf8")); const fam = (m.visitors || []).filter((v) => v.life); return fam.length >= 5 ? pass(`생활 연출 인원 ${fam.length}`, "≥ 5") : fail(`생활 인원 ${fam.length}`, "≥ 5"); }
      case "office-staff-parity": { const m = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app/office-map.json"), "utf8")); const r = loadRoster(repoRoot); const ids = new Set(r.staff.map((x) => x.id)); const orphan = (m.desks || []).filter((d) => !ids.has(d.id) && !["room-01", "room-02", "room-03", "out", "home", "run", "cert", "cal", "note"].includes(d.id)); return orphan.length ? degraded(`정본 밖 데스크 ${orphan.length}`, "조직 정합") : pass("오피스 데스크 조직 정합", "조직 정합"); }
      case "office-logo": { const m = readFileSync(join(repoRoot, "ops/control-center/app/office.html"), "utf8"); return m.includes("./icon.svg") ? pass("공식 로고 사용", "robom 로고") : fail("임시 로고", "robom 로고"); }
      case "wf-mode-6": { return COMPANY_MODES.length >= 6 ? pass(`가동 모드 ${COMPANY_MODES.length}종`, "≥ 6종") : fail(`가동 모드 ${COMPANY_MODES.length}종`, "≥ 6종"); }
      case "wf-full-coverage": {
        const apps = readApps(repoRoot).filter((a) => a.registered !== false);
        const cs = buildContractCatalog({ registryApps: apps, siteVersion: "0.0.0" }).filter((x) => !x.needNewSource);
        const results = cs.map((x) => ({ contractId: x.id, target: x.target, category: x.category, status: "PASS", what: x.what }));
        const wf = computeWorkforce({ report: { runAt: new Date().toISOString(), results }, tasks: [], authority: { mode: "RUNNING" } });
        const working = wf.staff.filter((s) => !s.welfare && !s.standby && s.id !== "chairman");
        const idle = working.filter((s) => s.ownedCount === 0);
        return idle.length ? fail(`미배정 근무자 ${idle.length}명`, "근무 전원 배정") : pass(`근무 ${working.length}명 전원 담당 계약 보유`, "근무 전원 배정");
      }
      case "wf-24h": {
        const wf = computeWorkforce({ report: { runAt: new Date().toISOString(), results: [] }, tasks: [], authority: { mode: "RUNNING" } });
        const off = wf.staff.filter((s) => s.state === "OFF_DUTY");
        return off.length ? fail(`비번 ${off.length}명`, "OFF_DUTY 0(무교대)") : pass("가동 중 전원 근무(무교대)", "OFF_DUTY 0");
      }
      case "wf-riri": { const r = loadRoster(repoRoot); const v = r.staff.find((x) => x.id === "executive-vice-chair"); return v && v.name === "리리" && v.reportsTo === "chairman" ? pass("리리(수석부회장)·회장 직속", "2인자=리리") : fail(`${v?.name || "없음"}`, "2인자=리리"); }
      case "wf-divisions": { const r = loadRoster(repoRoot); const divs = (r.divisions || []).length; const welfare = r.staff.filter((x) => x.welfare).length; return divs >= 16 && welfare === 7 ? pass(`본부 ${divs}·복지 ${welfare}`, "16본부·복지7") : fail(`본부 ${divs}·복지 ${welfare}`, "16본부·복지7"); }
      case "wf-deputy-distinct": { const r = loadRoster(repoRoot); const bad = r.staff.filter((x) => x.deputy && x.deputy === x.id); return bad.length ? fail(`자기 대직 ${bad.length}`, "0") : pass("대직 != 본인", "0"); }
      case "wf-career-ladder": { const r = loadRoster(repoRoot); const n = (r.careerLadder || []).length; return n >= 10 ? pass(`승진 ${n}단계`, "≥10") : degraded(`승진 ${n}단계`, "≥10"); }
      case "office-floors-11": { const m = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app/office-map.json"), "utf8")); return (m.floors || []).length >= 11 ? pass(`${m.floors.length}개 층`, "≥11") : fail(`${(m.floors || []).length}개 층`, "≥11"); }
      case "office-desk-unique": { const m = JSON.parse(readFileSync(join(repoRoot, "ops/control-center/app/office-map.json"), "utf8")); const ids = (m.desks || []).map((d) => d.id); const set = new Set(ids); return set.size === ids.length ? pass("데스크 id 고유", "중복 0") : fail(`중복 ${ids.length - set.size}`, "중복 0"); }
      case "contracts-min-per-app": {
        const apps = readApps(repoRoot).filter((a) => a.registered !== false);
        const cs = buildContractCatalog({ registryApps: apps, siteVersion: "0.0.0" });
        const bad = [];
        for (const [appId, min] of Object.entries(MIN_CONTRACTS)) { const n = cs.filter((x) => x.target === appId).length; if (n < min) bad.push(`${appId} ${n}/${min}`); }
        return bad.length ? fail(bad.join(", "), "앱별 하한 충족") : pass("앱별 최소 계약 충족", "앱별 하한 충족");
      }
      case "contracts-total": {
        const apps = readApps(repoRoot).filter((a) => a.registered !== false);
        const n = buildContractCatalog({ registryApps: apps, siteVersion: "0.0.0" }).length;
        return n >= 300 ? pass(`전체 계약 ${n}`, "≥300") : degraded(`전체 계약 ${n}`, "≥300");
      }
      case "owner-verifier-split": {
        const apps = readApps(repoRoot).filter((a) => a.registered !== false);
        const cs = buildContractCatalog({ registryApps: apps, siteVersion: "0.0.0" }).filter((x) => !x.needNewSource).slice(0, 200);
        const bad = cs.filter((x) => { const { owner, verifier } = assignOwnership({ id: x.id, target: x.target, category: x.category }); return owner === verifier; });
        return bad.length ? fail(`구현=검증 ${bad.length}`, "전수 분리") : pass(`표본 ${cs.length} 전수 구현≠검증`, "전수 분리");
      }
      case "runtime-permissions": {
        const mode = statSync(resolve(runtimeDir)).mode & 0o777;
        if (process.platform === "win32") return pass("Windows(POSIX 권한 비적용)", "700");
        return mode === 0o700 ? pass("700", "700") : degraded(mode.toString(8), "700");
      }
      case "clock-seoul": {
        const h = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(ctx.now);
        return Number.isFinite(Number(h)) ? pass(`서울 ${h}시`, "계산 정상") : fail("시간 계산 실패", "계산 정상");
      }
      case "engine-self": {
        if (!expectedContracts) return pass("첫 실행", "완결");
        // engine-self는 항상 마지막에 실행되고 executedContracts 증가는 각 evaluator '이후'에 일어난다.
        // 따라서 자기 차례엔 executedContracts = expected-1 이다 → 자신(+1)을 세어 비교(정상 run이 늘 degraded로
        // 오표기되던 off-by-one 제거). 그래도 부족하면 루프가 중간에 끊긴 것 → degraded.
        return executedContracts + 1 >= expectedContracts
          ? pass(`계약 ${executedContracts + 1}/${expectedContracts} 실행`, "전체 실행")
          : degraded(`계약 ${executedContracts + 1}/${expectedContracts} 실행(예산 소진 등)`, "전체 실행");
      }
      case "redaction-selftest": {
        const sample = redactEvidence("token sk-proj-abcdefghijklmnop and Bearer abcdefghijklmnopqrstuvwx end");
        return sample.includes("sk-proj-") || sample.includes("Bearer a") ? fail("redaction 실패", "secret 제거") : pass("secret 패턴 제거 확인", "secret 제거");
      }
      case "remote-optin": {
        const token = String(process.env.ROBOM_HQ_REMOTE_TOKEN || "").trim();
        if (!token) return pass("localhost 전용(기본)", "opt-in");
        return token.length >= 12 ? pass("원격 opt-in·토큰 길이 충족", "≥ 12자") : fail(`토큰 ${token.length}자`, "≥ 12자");
      }
      case "login-item-status": {
        // 데스크톱 main이 기록한 실제 OS 로그인 항목 상태를 읽는다(desktop-status.json).
        const f = join(resolve(runtimeDir), "desktop-status.json");
        if (!existsSync(f)) return unavailable("desktop-status 없음(브라우저·개발 모드)", "데스크톱 앱에서만 판정");
        let d; try { d = JSON.parse(readFileSync(f, "utf8")); } catch { return fail("desktop-status parse 실패", "유효 JSON"); }
        if (d.platform && !["darwin", "win32"].includes(d.platform)) return pass(`${d.platform}(자동시작 비적용)`, "해당 없음");
        if (!d.loginItem) return unavailable("loginItem 미기록", "데스크톱 상태 필요");
        // 자동 시작은 기본 OFF가 정상(회장 선택). ON/OFF 모두 정상 상태로 보고만 한다.
        return d.loginItem.openAtLogin ? pass("부팅 자동 시작 ON(회장이 켬)", "자동 시작 상태 보고") : pass("부팅 자동 시작 OFF(기본값)", "자동 시작 상태 보고");
      }
      default: return unavailable(`미구현 check: ${check}`, "코드 등록 필요");
    }
  } catch (error) {
    return fail(`검사 오류: ${String(error?.message || error).slice(0, 80)}`, "정상 실행");
  }
}

// 회사 전역 선행조건(§9.0)
async function evalCompanyPrecondition(c, ctx) {
  switch (c.config.check) {
    case "network": {
      const probes = ["https://robom.kr/", "https://robom-labs.github.io/", "https://api.github.com/"];
      let anyOk = false;
      for (const url of probes) {
        const r = await cachedFetch(ctx, url, { method: "HEAD", timeoutMs: 10_000 });
        if (r.ok || (r.status >= 200 && r.status < 500)) { anyOk = true; break; }
      }
      ctx.preconditions.network = anyOk;
      return anyOk ? pass("외부 응답 수신", "연결") : fail("모든 외부 응답 실패", "연결");
    }
    case "github": {
      const r = await cachedFetch(ctx, "https://api.github.com/rate_limit", { timeoutMs: 10_000, headers: { accept: "application/json" } });
      if (!r.ok) return degraded(r.errorClass, "접근 가능");
      try {
        const remaining = JSON.parse(r.bodyText)?.resources?.core?.remaining;
        ctx.preconditions.githubRemaining = remaining;
        return remaining === 0 ? degraded("rate limit 소진(캐시로 대체)", "여유") : pass(`잔여 ${remaining}회`, "여유");
      } catch { return degraded("응답 parse 실패", "접근 가능"); }
    }
    case "clock": {
      const r = await cachedFetch(ctx, "https://robom.kr/", { method: "HEAD", timeoutMs: 10_000 });
      const dateHeader = r.headers?.date;
      if (!r.ok || !dateHeader) return unavailable("Date 헤더 없음", "판정 불가");
      const skewMin = Math.abs(ctx.nowMs - Date.parse(dateHeader)) / 60_000;
      return skewMin > (c.config.maxSkewMinutes || 5) ? degraded(`${Math.round(skewMin)}분 차이`, `≤ ${c.config.maxSkewMinutes}분`) : pass(`${skewMin.toFixed(1)}분 차이`, `≤ ${c.config.maxSkewMinutes}분`);
    }
    case "captive": {
      const r = await cachedFetch(ctx, "https://api.github.com/rate_limit", { timeoutMs: 10_000, headers: { accept: "application/json" } });
      if (!r.ok) return unavailable(r.errorClass, "판정 불가");
      return r.contentType.includes("json") ? pass("JSON 응답 정상", "가로채기 없음") : fail(`content-type ${r.contentType}(포털 가로채기 의심)`, "JSON");
    }
    case "host": {
      const r = await cachedFetch(ctx, `https://${c.config.host}/`, { method: "HEAD", timeoutMs: 12_000 });
      const reachable = r.ok || (r.status >= 200 && r.status < 500);
      ctx.preconditions[`host:${c.config.host}`] = reachable;
      return reachable ? pass(`응답 ${r.status || "OK"}`, "접근 가능") : fail(r.errorClass || `HTTP ${r.status}`, "접근 가능");
    }
    default: return unavailable(`미구현: ${c.config.check}`, "코드 등록 필요");
  }
}

const EVALUATORS = {
  http_status: evalHttpStatus,
  http_html: evalHttpHtml,
  http_timing: evalHttpTiming,
  surface_assets: evalSurfaceAssets,
  surface_marker: evalSurfaceMarker,
  tls_certificate: evalTls,
  dns_resolution: evalDns,
  manifest_contract: evalManifest,
  service_worker_contract: evalServiceWorker,
  version_parity: evalVersionParity,
  data_freshness: (c, ctx) => evalDataFreshness(c, ctx),
  github_actions: evalGithubActions,
  github_prs: evalGithubPrs,
  github_release: evalGithubRelease,
  http_json_contract: evalHttpJsonContract,
  repo_text_contract: evalRepoText,
  repo_json_contract: evalRepoJson,
  app_data_validator: evalAppDataValidator,
  asset_version_parity: evalAssetVersionParity,
  route_matrix: evalRouteMatrix,
  sitemap_contract: evalSitemap,
  seo_html_contract: evalSeoHtml,
  ua_parity: evalUaParity,
  internal_links: evalInternalLinks,
  browser_smoke: evalBrowserSmoke,
  hq_runtime: null, // env 주입형 — 아래 run에서 바인딩
  company_precondition: evalCompanyPrecondition,
  need_new_source: (c) => ({ status: C_STATUS.UNAVAILABLE, actual: "새 신호 필요", expected: c.sourceNeeded || null, note: c.whyNeeded || "" }),
  local_file_contract: (c, ctx, runtimeDir, env) => {
    try {
      const file = join(env.repoRoot, c.config.path);
      const json = JSON.parse(readFileSync(file, "utf8"));
      const value = resolvePath(json, c.config.jsonPath);
      return value === c.config.expected ? pass(String(value), String(c.config.expected)) : fail(String(value), String(c.config.expected));
    } catch (error) { return unavailable(String(error?.message || error).slice(0, 60), "파일 접근"); }
  },
};
export const EVALUATOR_NAMES = Object.freeze(Object.keys(EVALUATORS));

// 네트워크 필요 계약이 전역 네트워크 다운 시 UNAVAILABLE(개별 스팸 억제 §5.2)
function needsNetwork(c) {
  return (c.requiredCapabilities || []).includes("network") && c.evaluator !== "company_precondition";
}

// ── 엔진 실행 ──
export async function runContractEngine({
  contracts, runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, repoRoot, snapDir,
  registryAppCount = 0, watchdogMinutes = 10, manageRunner = false,
  now = new Date(), fetchImpl, budget, tiers = ["cheap", "standard", "deep"],
} = {}) {
  const ctx = createRunContext({ now, budget, fetchImpl });
  const results = [];
  const env = { runtimeDir, repoRoot, snapDir, registryAppCount, watchdogMinutes, manageRunner, expectedContracts: 0, executedContracts: 0 };
  const runnable = contracts.filter((c) => c.enabled !== false && tiers.includes(c.runTier));
  env.expectedContracts = runnable.length;

  // planner: 선행조건(company) → cheap → standard → deep. engine-self는 마지막.
  const order = { company_precondition: 0 };
  const tierOrder = { cheap: 1, standard: 2, deep: 3 };
  const sorted = [...runnable].sort((a, b) => {
    const pa = order[a.evaluator] ?? tierOrder[a.runTier] ?? 2;
    const pb = order[b.evaluator] ?? tierOrder[b.runTier] ?? 2;
    if (a.config?.check === "engine-self") return 1;
    if (b.config?.check === "engine-self") return -1;
    return pa - pb;
  });

  for (const c of sorted) {
    const started = Date.now();
    let verdict;
    if (ctx.preconditions.network === false && needsNetwork(c)) {
      verdict = { status: C_STATUS.UNAVAILABLE, actual: "local_network_unavailable", expected: null, note: "전역 네트워크 장애 — 회사 incident 1건으로 묶음(앱별 스팸 금지)" };
    } else if (ctx.budgetExhausted() && c.runTier !== "cheap" && c.config?.check !== "engine-self") {
      verdict = { status: C_STATUS.UNAVAILABLE, actual: "budget_exhausted", expected: null, note: "이번 run 예산 초과 — SKIPPED가 아니라 명시적 UNAVAILABLE(§6.3)" };
    } else {
      try {
        const evaluator = c.evaluator === "hq_runtime" ? (cc, cx) => evalHqRuntime(cc, cx, env) : EVALUATORS[c.evaluator];
        if (!evaluator) verdict = { status: C_STATUS.UNAVAILABLE, actual: `evaluator 미등록: ${c.evaluator}`, expected: null };
        else verdict = await evaluator(c, ctx, runtimeDir, env);
      } catch (error) {
        verdict = { status: C_STATUS.FAIL, actual: `엔진 오류: ${String(error?.message || error).slice(0, 100)}`, expected: "정상 실행", note: "evaluator 내부 오류" };
      }
    }
    env.executedContracts += 1;
    results.push({
      contractId: c.id, target: c.target, category: c.category, runTier: c.runTier, required: Boolean(c.required),
      status: verdict.status, severity: verdict.severity || c.severityIfFail || "info",
      failureClass: c.failureClass || "availability", needNewSource: Boolean(c.needNewSource),
      what: c.what || "", userImpact: c.userImpact || "", recommendedAction: c.recommendedAction || "",
      actual: redactEvidence(verdict.actual), expected: redactEvidence(verdict.expected ?? c.what ?? ""),
      note: verdict.note || "", durationMs: Date.now() - started, checkedAt: now.toISOString(),
      evidenceFingerprint: sha(`${c.id}|${verdict.status}|${JSON.stringify(verdict.actual ?? "")}`),
    });
  }

  if (ctx.ghCacheDirty) writeGhCache(runtimeDir, ctx.ghCache);

  const count = (s) => results.filter((r) => r.status === s).length;
  const coverage = {
    totalContracts: runnable.length, executed: results.length,
    pass: count(C_STATUS.PASS), degraded: count(C_STATUS.DEGRADED), fail: count(C_STATUS.FAIL),
    unavailable: count(C_STATUS.UNAVAILABLE), blocked: count(C_STATUS.BLOCKED_EXTERNAL), skipped: count(C_STATUS.SKIPPED),
    needNewSource: results.filter((r) => r.needNewSource).length,
    definedRate: 1, // 프롬프트 계약은 전부 카탈로그에 정의됨(진단률 100%)
    byTarget: {},
  };
  for (const r of results) {
    const t = coverage.byTarget[r.target] || (coverage.byTarget[r.target] = { total: 0, pass: 0, degraded: 0, fail: 0, unavailable: 0 });
    t.total += 1;
    if (r.status === C_STATUS.PASS) t.pass += 1;
    else if (r.status === C_STATUS.DEGRADED) t.degraded += 1;
    else if (r.status === C_STATUS.FAIL) t.fail += 1;
    else t.unavailable += 1;
  }

  const report = { runAt: now.toISOString(), durationMs: Date.now() - ctx.budget.startedAt, requests: ctx.requests, coverage, results };
  try {
    const dir = join(resolve(runtimeDir), "health");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(join(dir, "contracts-latest.json.tmp"), JSON.stringify(report, null, 1), { encoding: "utf8", mode: 0o600 });
    writeFileSync(join(dir, "contracts-latest.json"), JSON.stringify(report, null, 1), { encoding: "utf8", mode: 0o600 });
  } catch { /* 증거 저장 실패가 엔진을 멈추지 않는다 */ }
  return report;
}

// health-engine(anti-flap·incident) 원시 결과 형태로 변환 — FAIL·DEGRADED만 확정 대상
export function contractResultsToRaw(report) {
  if (!report?.results) return [];
  return report.results
    .filter((r) => !r.needNewSource) // 새 신호 필요 항목은 incident 스팸 금지(§18 — 화면 표시로만)
    .map((r) => ({
      contractId: r.contractId, target: r.target, category: r.category,
      status: r.status === C_STATUS.BLOCKED_EXTERNAL || r.status === C_STATUS.SKIPPED ? "UNAVAILABLE" : r.status,
      severity: r.severity, failureClass: r.failureClass,
      userImpact: r.userImpact, recommendedAction: r.recommendedAction,
      actual: typeof r.actual === "string" ? r.actual : JSON.stringify(r.actual ?? ""), expected: typeof r.expected === "string" ? r.expected : JSON.stringify(r.expected ?? ""),
    }));
}
