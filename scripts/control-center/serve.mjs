// 로봄 본부 로컬 실행 서버 — 기존 스냅샷·정적 화면과 Company OS 저장 API를 함께 제공한다.
// 기본은 127.0.0.1 로컬 전용. ROBOM_HQ_REMOTE_TOKEN(12자 이상)을 설정한 경우에만
// 같은 네트워크(권장: Tailscale 사설망)의 휴대폰이 토큰 인증으로 접속할 수 있다.
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import {
  CompanyStoreError,
  DEFAULT_COMPANY_RUNTIME_DIR,
  createCompanyStore,
} from "./lib/company-store.mjs";
import {
  cancelPendingTask, enqueueTask, queueSummary, readRunnerStatus, recoverStaleLeases, writeControl,
} from "./lib/task-queue.mjs";
import { generateProposals } from "./lib/propose-improvements.mjs";
import { runHealthEngine } from "./lib/health-engine.mjs";
import { runContractEngine, contractResultsToRaw } from "./lib/contract-engine.mjs";
import { buildContractCatalog, catalogCoverage } from "./lib/contract-catalog.mjs";
import { readApps } from "./lib/sources.mjs";
import { tryActivatePlaywrightDriver } from "./lib/browser-driver.mjs";
import { readAuthority, writeAuthority, isDelegable, currentShift, COMPANY_MODES, APPROVAL_MODES } from "./lib/company-authority.mjs";
import { startRunnerSupervisor } from "./lib/runner-supervisor.mjs";
import { REPO_ROOT } from "./lib/sources.mjs";

const DEFAULT_PORT = Number(process.env.ROBOM_HQ_PORT || 4321);
export const LOCAL_HOST = "127.0.0.1";
export const MAX_REQUEST_BYTES = 32 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 이미지 첨부 상한 10MB
const APP_DIR = join(REPO_ROOT, "ops/control-center/app");
const SNAP_DIR = process.env.ROBOM_HQ_SNAP_DIR || join(REPO_ROOT, "ops/control-center/snapshots");
const ATTACH_DIR = join(DEFAULT_COMPANY_RUNTIME_DIR, "attachments");
const REVIEW_MARKER = join(DEFAULT_COMPANY_RUNTIME_DIR, "last-auto-review.json");
const REMOTE_TOKEN = String(process.env.ROBOM_HQ_REMOTE_TOKEN || "").trim();
const REMOTE_ENABLED = REMOTE_TOKEN.length >= 12;
const WATCHDOG_MINUTES = Number(process.env.ROBOM_HQ_WATCH_MINUTES ?? 10);
const MANAGE_RUNNER = process.env.ROBOM_HQ_MANAGE_RUNNER === "1"; // 데스크톱·자동시작에서 러너를 HQ가 직접 관리
// 자동 점검 주기(분). 회장이 프로그램에서 직접 조절한다. 점검은 로컬·무료라 자주 돌려도 안전.
// 최대 빈도 = 감시기 간격(10분). 0 = 자동 점검 끔. 저장 위치: runtime/review-schedule.json
export const REVIEW_MIN_MINUTES = Math.max(5, WATCHDOG_MINUTES); // 10분 미만으로는 못 내려간다(감시기 granularity)
const REVIEW_MAX_MINUTES = 1440; // 하루 1번
const REVIEW_DEFAULT_MINUTES = Number(process.env.ROBOM_HQ_REVIEW_MINUTES || 120); // 기본 2시간마다
const REVIEW_SCHEDULE_FILE = join(DEFAULT_COMPANY_RUNTIME_DIR, "review-schedule.json");
export function normalizeReviewMinutes(value, fallback = REVIEW_DEFAULT_MINUTES) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return 0; // 끔
  return Math.min(REVIEW_MAX_MINUTES, Math.max(REVIEW_MIN_MINUTES, Math.round(n)));
}
export function readReviewEveryMinutes() {
  try {
    if (existsSync(REVIEW_SCHEDULE_FILE)) {
      const v = JSON.parse(readFileSync(REVIEW_SCHEDULE_FILE, "utf8"));
      if (v && v.everyMinutes !== undefined) return normalizeReviewMinutes(v.everyMinutes);
    }
  } catch { /* 손상 시 기본값 */ }
  return normalizeReviewMinutes(REVIEW_DEFAULT_MINUTES);
}
export function writeReviewEveryMinutes(value) {
  const everyMinutes = normalizeReviewMinutes(value);
  mkdirSync(DEFAULT_COMPANY_RUNTIME_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(REVIEW_SCHEDULE_FILE, JSON.stringify({ everyMinutes, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  return everyMinutes;
}
const AUTO_REVIEW = process.env.ROBOM_HQ_AUTO_REVIEW !== "0"; // 매일 자동 개선 제안(끄려면 0)
// 첨부 이미지 매직바이트 → 확장자
const IMAGE_SIGNATURES = [
  { ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { ext: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];
const ATTACHMENT_ID = /^att_[a-z0-9]{6,40}\.(png|jpg|webp|gif)$/;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

class HttpError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function buildSnapshotInBackground() {
  const child = spawn(process.execPath, [join(REPO_ROOT, "scripts/control-center/build-snapshot.mjs")], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  child.on("error", (error) => console.error("[robom-hq] 스냅샷 갱신 시작 실패", error));
  child.on("exit", (code) => {
    if (code !== 0) console.error(`[robom-hq] 스냅샷 갱신 실패 (${code})`);
  });
  child.unref();
}

function isLocalHostHeader(host = "") {
  const value = String(host).trim().toLowerCase();
  return /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(value);
}

function decodeSafePath(rawUrl = "/") {
  const rawPath = String(rawUrl).split("?", 1)[0] || "/";
  let decoded;
  try { decoded = decodeURIComponent(rawPath); }
  catch { throw new HttpError("잘못 인코딩된 경로입니다.", 400, "INVALID_PATH"); }
  if (decoded.includes("\0") || decoded.includes("\\") || decoded.split("/").includes("..")) {
    throw new HttpError("허용되지 않은 경로입니다.", 400, "INVALID_PATH");
  }
  return decoded;
}

function sendJson(res, statusCode, value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function sendText(res, statusCode, text, headers = {}) {
  const body = Buffer.from(text, "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes) {
  const declared = req.headers["content-length"];
  if (declared !== undefined) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0) throw new HttpError("Content-Length가 올바르지 않습니다.", 400, "INVALID_LENGTH");
    if (length > maxBytes) {
      req.resume();
      throw new HttpError("요청 본문이 너무 큽니다.", 413, "BODY_TOO_LARGE");
    }
  }
  const chunks = [];
  let total = 0;
  let oversized = false;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) oversized = true;
    else if (!oversized) chunks.push(chunk);
  }
  if (oversized) throw new HttpError("요청 본문이 너무 큽니다.", 413, "BODY_TOO_LARGE");
  if (total === 0) return {};
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new HttpError("application/json 요청만 허용합니다.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError("올바른 JSON 본문이 아닙니다.", 400, "INVALID_JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError("JSON 객체가 필요합니다.", 400, "INVALID_BODY");
  }
  return value;
}

function assertEmptyOperationBody(body) {
  if (Object.keys(body).length !== 0) {
    throw new HttpError("이 API는 요청 본문을 받지 않습니다.", 400, "UNEXPECTED_BODY");
  }
}

function readSnapshotValue(snapDir) {
  try {
    const latest = join(snapDir, "latest.json");
    const example = join(snapDir, "example.json");
    const file = existsSync(latest) ? latest : example;
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  } catch { return null; }
}

function seoulDate(now = new Date()) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now); }
  catch { return now.toISOString().slice(0, 10); }
}

// ── 심층 계약 엔진(진단률 100%): 카탈로그 257개 계약을 실제 실행한다 ──
// cheap·standard는 매 점검, deep(브라우저 렌더)은 60분 TTL. 이전 run에서만 실행된 계약은 cached로 이어 붙인다.
const DEEP_TTL_MINUTES = 60;
const CONTRACTS_LATEST = join(DEFAULT_COMPANY_RUNTIME_DIR, "health", "contracts-latest.json");
const DEEP_MARKER = join(DEFAULT_COMPANY_RUNTIME_DIR, "health", "last-deep-run.json");
let CONTRACT_RUNNING = false;
function readContractReport() {
  try { return JSON.parse(readFileSync(CONTRACTS_LATEST, "utf8")); } catch { return null; }
}
export async function runDeepContracts({ now = new Date(), force = false } = {}) {
  if (CONTRACT_RUNNING) return readContractReport(); // 동시 실행 방지(run lease)
  CONTRACT_RUNNING = true;
  try {
    const registryApps = readApps(REPO_ROOT).filter((a) => a.registered);
    const contracts = buildContractCatalog({ registryApps });
    let deepDue = force;
    try {
      const last = JSON.parse(readFileSync(DEEP_MARKER, "utf8"));
      deepDue = deepDue || (now.getTime() - Date.parse(last.at || 0)) > DEEP_TTL_MINUTES * 60_000;
    } catch { deepDue = true; }
    const tiers = deepDue ? ["cheap", "standard", "deep"] : ["cheap", "standard"];
    const previous = readContractReport();
    const report = await runContractEngine({
      contracts, runtimeDir: DEFAULT_COMPANY_RUNTIME_DIR, repoRoot: REPO_ROOT, snapDir: SNAP_DIR,
      registryAppCount: registryApps.length, watchdogMinutes: WATCHDOG_MINUTES, manageRunner: MANAGE_RUNNER,
      now, tiers,
    });
    // 이번 tier에 없던 계약(deep 미실행 회차)은 직전 증거를 cached로 유지 — 현재 PASS처럼 위장하지 않는다(§5.4)
    if (previous?.results) {
      const currentIds = new Set(report.results.map((r) => r.contractId));
      const carried = previous.results.filter((r) => !currentIds.has(r.contractId)).map((r) => ({ ...r, usedCachedEvidence: true }));
      if (carried.length) {
        report.results.push(...carried);
        try { writeFileSync(CONTRACTS_LATEST, JSON.stringify(report, null, 1), { mode: 0o600 }); } catch { /* 무시 */ }
      }
    }
    if (deepDue) {
      try {
        mkdirSync(join(DEFAULT_COMPANY_RUNTIME_DIR, "health"), { recursive: true, mode: 0o700 });
        writeFileSync(DEEP_MARKER, JSON.stringify({ at: now.toISOString() }), { mode: 0o600 });
      } catch { /* 무시 */ }
    }
    return report;
  } catch (error) {
    console.error("[robom-hq] 계약 엔진 실행 실패", error?.message);
    return readContractReport();
  } finally { CONTRACT_RUNNING = false; }
}
// 설정된 주기(분)마다 실제 스냅샷 신호로 종합 점검해 개선 제안을 결재(approvals)에 올린다.
// 감시기가 10분마다 호출하며, 마지막 점검 이후 everyMinutes가 지났을 때만 실행한다(마커로 관리).
async function runDailyReviewIfDue({ store = createCompanyStore(), snapDir = SNAP_DIR, force = false, now = new Date() } = {}) {
  if (!AUTO_REVIEW && !force) return { skipped: "disabled" };
  // v2.0.0: 회사 모드가 정본. RUNNING·MONITOR_ONLY = 상시 관제(감시기 주기마다), PAUSED = 중지.
  const authority = readAuthority();
  if (!force && authority.mode === "PAUSED") return { skipped: "company-paused" };
  if (!force) {
    // 감시기 겹침(시작 직후 reviewSoon + interval) 중복 방지 최소 간격
    try {
      if (existsSync(REVIEW_MARKER)) {
        const last = JSON.parse(readFileSync(REVIEW_MARKER, "utf8"));
        const lastAt = Date.parse(last.at || "");
        if (Number.isFinite(lastAt) && (now.getTime() - lastAt) < (WATCHDOG_MINUTES - 1) * 60_000) {
          return { skipped: "not-due" };
        }
      }
    } catch { /* 마커 손상 시 진행 */ }
  }
  const snapshot = readSnapshotValue(snapDir);
  if (!snapshot) return { skipped: "no-snapshot" };
  const state = await store.getState();
  const existing = (state.records.approvals || []).filter((a) => !["approved", "rejected", "dismissed", "archived"].includes(a.status));
  const existingKeys = new Set(existing.map((a) => a.proposalKey).filter(Boolean));
  const created = [];
  const appTarget = (t) => (t === "company" || t === "robom-hq" ? "" : t);

  // 1) 결정론적 health 엔진 — 심층 계약 엔진(257개)을 먼저 실행하고, anti-flap 판정 후 확정 incident만 결재 상신
  let healthSummary = null;
  try {
    let runner = null; try { runner = readRunnerStatus(); } catch { /* 러너 상태 없음 */ }
    const contractReport = await runDeepContracts({ now });
    const extraResults = contractResultsToRaw(contractReport);
    const health = runHealthEngine({ snapshot, runtimeDir: DEFAULT_COMPANY_RUNTIME_DIR, now, runner, watchdogMinutes: WATCHDOG_MINUTES, extraResults });
    healthSummary = { ...health.summary, contracts: contractReport?.coverage || null };
    // 알림 예산(§8.1): critical·error 무제한, warning은 run당 10건, info는 결재 상신 안 함(기록만)
    let warningBudget = 10;
    for (const inc of health.newIncidents) {
      if (existingKeys.has(inc.contractId)) continue;
      if (inc.severity === "info") continue;
      if (inc.severity === "warning" && warningBudget-- <= 0) continue;
      const priority = inc.severity === "critical" ? "urgent" : inc.severity === "error" ? "high" : "normal";
      const body = inc.actual ? `확인된 값: ${inc.actual}${inc.expected ? ` / 기대: ${inc.expected}` : ""}` : (inc.userImpact || "");
      try {
        const rec = await store.createRecord("approvals", {
          title: inc.userImpact || `${inc.target} 확인 필요`, appId: appTarget(inc.target), body,
          recommendation: inc.recommendedAction, priority, requestedBy: "auto-review", proposalKey: inc.contractId, status: "pending",
        });
        created.push(rec.id); existingKeys.add(inc.contractId);
      } catch { /* 개별 실패는 건너뛴다 */ }
    }
  } catch (error) { console.error("[robom-hq] health 엔진 실행 실패", error?.message); }

  // 2) 성장 제안(다음 개선 행동)·회사 보안만 기존 제안기에서 가져온다(건강/CI/PR은 엔진이 담당 — 중복 방지)
  const growth = generateProposals(snapshot, existing, { limit: 20 }).filter((p) => /:next$|:security$/.test(p.key));
  for (const p of growth) {
    if (existingKeys.has(p.key)) continue;
    try {
      const rec = await store.createRecord("approvals", {
        title: p.title, appId: p.appId, body: p.body, recommendation: p.recommendation,
        priority: p.priority, requestedBy: "auto-review", proposalKey: p.key, status: "pending",
      });
      created.push(rec.id); existingKeys.add(p.key);
    } catch { /* 개별 실패는 건너뛴다 */ }
  }
  // 수석부회장 전결: RUNNING + 위임 모드에서 위임 가능한 시스템 상신만 자동 승인 → 업무 등록·대기열
  let delegated = 0;
  if (authority.mode === "RUNNING" && authority.approvalMode === "VICE_CHAIR_DELEGATED") {
    try {
      const st2 = await store.getState();
      const pendings = (st2.records.approvals || []).filter((a) => (!a.status || a.status === "pending") && isDelegable(a));
      for (const approval of pendings) {
        try {
          await store.updateStatus("approvals", approval.id, { status: "approved", approvedBy: "executive-vice-chair", comment: "수석부회장 전결" });
          const task = await store.createRecord("tasks", {
            title: approval.title, appId: approval.appId || "", problem: approval.body || "",
            desiredOutcome: approval.recommendation || "", priority: approval.priority || "normal",
            autonomy: "implement_and_review", status: "queued",
          });
          try { enqueueTask(task, { snapshot: readSnapshotValue(snapDir) }); }
          catch { await store.updateStatus("tasks", task.id, { status: "blocked" }); }
          delegated += 1;
        } catch { /* 개별 전결 실패는 건너뛴다 */ }
      }
    } catch (error) { console.error("[robom-hq] 전결 처리 실패", error?.message); }
  }
  try {
    mkdirSync(DEFAULT_COMPANY_RUNTIME_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(REVIEW_MARKER, JSON.stringify({ at: new Date().toISOString(), created: created.length, delegated, health: healthSummary }), { mode: 0o600 });
  } catch { /* 마커 기록 실패 무시 */ }
  return { created: created.length, delegated, health: healthSummary };
}
// 최근 health 요약(hq-status 노출용) — 심층 계약 coverage(진단률) 포함
function readHealthSummary() {
  try {
    const summary = JSON.parse(readFileSync(join(DEFAULT_COMPANY_RUNTIME_DIR, "health", "latest.json"), "utf8")).summary || null;
    if (!summary) return null;
    const report = readContractReport();
    return { ...summary, contracts: report?.coverage || null, contractsRunAt: report?.runAt || null };
  } catch { return null; }
}

async function handleApi(req, res, path, store, maxBodyBytes, snapDir) {
  if (path === "/api/company-state") {
    if (req.method !== "GET") {
      sendText(res, 405, "method not allowed", { Allow: "GET" });
      return;
    }
    sendJson(res, 200, await store.getState());
    return;
  }

  // HQ 상태: 대기열·러너·긴급 제어를 화면이 한 번에 읽는다.
  if (path === "/api/hq-status") {
    if (req.method !== "GET") { sendText(res, 405, "method not allowed", { Allow: "GET" }); return; }
    recoverStaleLeases();
    const summary = queueSummary();
    if (summary.runner) summary.runner.managed = MANAGE_RUNNER; // 러너 자동 관리 여부는 서버가 정본
    const authority = readAuthority();
    sendJson(res, 200, { ok: true, ...summary, remote: REMOTE_ENABLED ? "token" : "local-only", reviewEveryMinutes: AUTO_REVIEW ? readReviewEveryMinutes() : 0, reviewMinMinutes: REVIEW_MIN_MINUTES, health: readHealthSummary(), company: { mode: authority.mode, approvalMode: authority.approvalMode, delegatedAt: authority.delegatedAt, shift: currentShift() } });
    return;
  }

  // 회사 가동 모드(RUNNING/MONITOR_ONLY/PAUSED) — 적용 즉시, 감사 기록
  if (path === "/api/company-mode") {
    if (req.method === "GET") { sendJson(res, 200, { ok: true, ...readAuthority(), shift: currentShift() }); return; }
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "GET, POST" }); return; }
    const body = await readJsonBody(req, maxBodyBytes);
    if (!COMPANY_MODES.includes(body.mode)) throw new HttpError("mode는 RUNNING·MONITOR_ONLY·PAUSED만 허용합니다.", 400, "INVALID_MODE");
    sendJson(res, 200, { ok: true, ...writeAuthority({ mode: body.mode }) });
    return;
  }
  // 수석부회장 전결 위임/해제 — 위임 가능 안건만 자동 승인(비위임은 회장 전용 유지)
  if (path === "/api/delegation") {
    if (req.method === "GET") { sendJson(res, 200, { ok: true, ...readAuthority() }); return; }
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "GET, POST" }); return; }
    const body = await readJsonBody(req, maxBodyBytes);
    if (!APPROVAL_MODES.includes(body.approvalMode)) throw new HttpError("approvalMode가 올바르지 않습니다.", 400, "INVALID_APPROVAL_MODE");
    const next = writeAuthority({ approvalMode: body.approvalMode });
    if (next.approvalMode === "VICE_CHAIR_DELEGATED" && next.mode === "RUNNING") {
      runDailyReviewIfDue({ force: true }).catch(() => {}); // 위임 즉시 대기 안건 전결 처리
    }
    sendJson(res, 200, { ok: true, ...next });
    return;
  }
  // 심층 계약 진단(진단률 100%) — 최근 실행 결과 + 카탈로그 정의 집계
  if (path === "/api/health-contracts") {
    if (req.method !== "GET") { sendText(res, 405, "method not allowed", { Allow: "GET" }); return; }
    const report = readContractReport();
    let defined = null;
    try {
      const registryApps = readApps(REPO_ROOT).filter((a) => a.registered);
      defined = catalogCoverage(buildContractCatalog({ registryApps }));
    } catch { /* 카탈로그 빌드 실패 시 실행 결과만 */ }
    sendJson(res, 200, { ok: true, defined, report });
    return;
  }
  // 지금 재점검(심층 포함) — 회장 버튼. 비동기 시작 후 즉시 응답.
  if (path === "/api/health-run") {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const body = await readJsonBody(req, maxBodyBytes);
    assertEmptyOperationBody(body);
    runDeepContracts({ force: true }).then(() => runDailyReviewIfDue({ force: true })).catch(() => {});
    sendJson(res, 202, { ok: true, started: true });
    return;
  }
  // 조직 정본(조직도·팀·시설) — ops/organization/organization.json
  if (path === "/api/organization") {
    if (req.method !== "GET") { sendText(res, 405, "method not allowed", { Allow: "GET" }); return; }
    try {
      const org = JSON.parse(readFileSync(join(REPO_ROOT, "ops/organization/organization.json"), "utf8"));
      sendJson(res, 200, { ok: true, ...org });
    } catch { sendJson(res, 200, { ok: false, message: "조직 정본을 읽지 못했습니다." }); }
    return;
  }

  // 자동 점검 주기 설정(레거시 호환 — v2.0.0부터 회사 모드가 정본)
  if (path === "/api/review-schedule") {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const body = await readJsonBody(req, maxBodyBytes);
    if (body.everyMinutes === undefined || (typeof body.everyMinutes !== "number" && typeof body.everyMinutes !== "string")) {
      throw new HttpError("everyMinutes(분) 값이 필요합니다.", 400, "INVALID_SCHEDULE");
    }
    const everyMinutes = writeReviewEveryMinutes(body.everyMinutes);
    sendJson(res, 200, { ok: true, everyMinutes, minMinutes: REVIEW_MIN_MINUTES });
    return;
  }

  // 긴급 제어: 전체 일시정지 / 새 작업 접수 중지
  if (path === "/api/control") {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const body = await readJsonBody(req, maxBodyBytes);
    const allowed = new Set(["paused", "intakeClosed"]);
    const keys = Object.keys(body);
    if (!keys.length || keys.some((key) => !allowed.has(key) || typeof body[key] !== "boolean")) {
      throw new HttpError("paused·intakeClosed boolean만 허용합니다.", 400, "INVALID_CONTROL");
    }
    sendJson(res, 200, { ok: true, control: writeControl(body) });
    return;
  }

  // 업무 접수: 회장 요청 → 기록 저장 + Codex 작업 패킷을 대기열에 넣는다.
  if (path === "/api/tasks") {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const control = queueSummary().control;
    if (control.intakeClosed) throw new HttpError("새 작업 접수가 중지된 상태입니다.", 409, "INTAKE_CLOSED");
    const body = await readJsonBody(req, maxBodyBytes);
    const record = await store.createRecord("tasks", body);
    let packet = null;
    try { packet = enqueueTask(record, { snapshot: readSnapshotValue(snapDir) }); }
    catch (error) {
      await store.updateStatus("tasks", record.id, { status: "blocked" });
      throw new HttpError(`작업 패킷 생성 실패: ${error.message}`, 500, "PACKET_FAILED");
    }
    sendJson(res, 201, { ok: true, record, packet, state: await store.getState() });
    return;
  }

  // 이미지 첨부 업로드/조회: 내부 runtime에만 저장(공개·커밋 금지). EXIF는 클라이언트가 canvas 재인코딩으로 제거.
  if (path === "/api/attachments") {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const body = await readJsonBody(req, MAX_ATTACHMENT_BYTES);
    if (typeof body.dataBase64 !== "string") throw new HttpError("dataBase64가 필요합니다.", 400, "INVALID_ATTACHMENT");
    let buf;
    try { buf = Buffer.from(body.dataBase64, "base64"); } catch { throw new HttpError("base64 디코딩 실패", 400, "INVALID_ATTACHMENT"); }
    if (!buf.length || buf.length > MAX_ATTACHMENT_BYTES) throw new HttpError("이미지 크기가 허용 범위를 벗어났습니다.", 413, "ATTACHMENT_TOO_LARGE");
    const sig = IMAGE_SIGNATURES.find((s) => s.bytes.every((b, i) => buf[i] === b));
    if (!sig) throw new HttpError("이미지 파일만 첨부할 수 있습니다.", 415, "NOT_IMAGE");
    mkdirSync(ATTACH_DIR, { recursive: true, mode: 0o700 });
    const id = `att_${randomUUID().replaceAll("-", "").slice(0, 24)}.${sig.ext}`;
    writeFileSync(join(ATTACH_DIR, id), buf, { mode: 0o600 });
    sendJson(res, 201, { ok: true, id });
    return;
  }
  const attachMatch = path.match(/^\/api\/attachments\/([^/]+)$/);
  if (attachMatch) {
    if (req.method !== "GET" && req.method !== "HEAD") { sendText(res, 405, "method not allowed", { Allow: "GET" }); return; }
    const id = decodeURIComponent(attachMatch[1]);
    if (!ATTACHMENT_ID.test(id)) throw new HttpError("잘못된 첨부 id입니다.", 400, "INVALID_ID");
    const file = join(ATTACH_DIR, id);
    if (!existsSync(file)) { sendText(res, 404, "not found"); return; }
    const buf = readFileSync(file);
    const ext = id.split(".").pop();
    res.writeHead(200, { "Content-Type": ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg", "Content-Length": buf.length, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : buf);
    return;
  }

  // 자동 개선 제안 승인 → 업무로 전환 + Codex 대기열 등록
  const approveMatch = path.match(/^\/api\/approve-proposal\/([^/]+)$/);
  if (approveMatch) {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const id = decodeURIComponent(approveMatch[1]);
    const state = await store.getState();
    const approval = (state.records.approvals || []).find((r) => r.id === id);
    if (!approval) throw new HttpError("제안을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await store.updateStatus("approvals", id, { status: "approved" });
    const task = await store.createRecord("tasks", {
      title: approval.title,
      appId: approval.appId || "",
      problem: approval.body || "",
      desiredOutcome: approval.recommendation || "",
      priority: approval.priority || "normal",
      autonomy: "implement_and_review",
      status: "queued",
    });
    try { enqueueTask(task, { snapshot: readSnapshotValue(snapDir) }); }
    catch (error) { await store.updateStatus("tasks", task.id, { status: "blocked" }); }
    sendJson(res, 200, { ok: true, task, state: await store.getState() });
    return;
  }

  if (path === "/api/export" || path === "/api/backup") {
    if (req.method !== "POST") {
      sendText(res, 405, "method not allowed", { Allow: "POST" });
      return;
    }
    const body = await readJsonBody(req, maxBodyBytes);
    assertEmptyOperationBody(body);
    if (path === "/api/export") {
      const exported = await store.exportData();
      sendJson(res, 200, {
        ok: true,
        name: exported.filename,
        file: exported.filename,
        payload: exported.data,
        state: await store.getState(),
      });
    } else {
      const backedUp = await store.backup();
      sendJson(res, 201, {
        ok: true,
        file: backedUp.filename,
        createdAt: backedUp.createdAt,
        counts: backedUp.counts,
        state: await store.getState(),
      });
    }
    return;
  }

  const match = path.match(/^\/api\/records\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) {
    sendJson(res, 404, { error: "API_NOT_FOUND", message: "허용되지 않은 API입니다." });
    return;
  }
  const [, collection, id] = match;
  if (req.method === "POST" && !id) {
    const body = await readJsonBody(req, maxBodyBytes);
    const record = await store.createRecord(collection, body);
    sendJson(res, 201, { ok: true, record, state: await store.getState() });
    return;
  }
  if (req.method === "PATCH" && id) {
    const body = await readJsonBody(req, maxBodyBytes);
    const record = await store.updateStatus(collection, id, body);
    if (collection === "tasks" && ["cancelled", "dismissed", "on_hold", "held"].includes(record.status)) {
      cancelPendingTask(id); // 대기열에서도 제거(실행 중이면 러너가 안전 중단 판단)
    }
    sendJson(res, 200, { ok: true, record, state: await store.getState() });
    return;
  }
  sendText(res, 405, "method not allowed", { Allow: id ? "PATCH" : "POST" });
}

function resolveStaticFile(appDir, path) {
  const relativePath = path.replace(/^\/+/, "");
  const file = resolve(appDir, relativePath);
  const fromRoot = relative(resolve(appDir), file);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  return file;
}

// ── 원격(휴대폰) 인증: 토큰이 설정된 경우에만 localhost 밖 요청을 허용 ──
const remoteSessions = new Map(); // ip → {count, windowStart} 간이 rate limit
function tokenMatches(candidate) {
  if (!REMOTE_ENABLED || typeof candidate !== "string") return false;
  const expected = Buffer.from(REMOTE_TOKEN);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function remoteAuthorized(req) {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ") && tokenMatches(header.slice(7).trim())) return true;
  const cookies = String(req.headers.cookie || "");
  const match = cookies.match(/(?:^|;\s*)robomhq=([^;]+)/);
  if (match && tokenMatches(decodeURIComponent(match[1]))) return true;
  const query = new URL(req.url, "http://x").searchParams.get("token");
  return query ? tokenMatches(query) : false;
}
function rateLimited(req) {
  const ip = req.socket.remoteAddress || "unknown";
  const nowMs = Date.now();
  const entry = remoteSessions.get(ip) || { count: 0, windowStart: nowMs };
  if (nowMs - entry.windowStart > 60_000) { entry.count = 0; entry.windowStart = nowMs; }
  entry.count += 1;
  remoteSessions.set(ip, entry);
  return entry.count > 240;
}

async function handleRequest(req, res, { store, appDir, snapDir, maxBodyBytes }) {
  const local = isLocalHostHeader(req.headers.host) && [LOCAL_HOST, "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
  if (!local) {
    if (!REMOTE_ENABLED) {
      sendJson(res, 403, { error: "LOCAL_ONLY", message: "localhost 요청만 허용합니다." });
      return;
    }
    if (rateLimited(req)) { sendJson(res, 429, { error: "RATE_LIMITED", message: "요청이 너무 많습니다." }); return; }
    if (!remoteAuthorized(req)) {
      sendJson(res, 401, { error: "UNAUTHORIZED", message: "휴대폰 연결 토큰이 필요합니다." });
      return;
    }
    // 첫 접속(?token=)이면 세션 쿠키로 고정해 URL에서 토큰을 지울 수 있게 한다.
    const query = new URL(req.url, "http://x").searchParams.get("token");
    if (query) res.setHeader("Set-Cookie", `robomhq=${encodeURIComponent(query)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
  }
  const path = decodeSafePath(req.url);
  if (path.startsWith("/api/")) {
    await handleApi(req, res, path, store, maxBodyBytes, snapDir);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "method not allowed", { Allow: "GET, HEAD" });
    return;
  }
  const normalizedPath = path === "/" ? "/index.html" : path;
  if (normalizedPath === "/snapshot.json") {
    const latest = join(snapDir, "latest.json");
    const example = join(snapDir, "example.json");
    const file = existsSync(latest) ? latest : example;
    if (!existsSync(file)) { sendText(res, 404, "no snapshot"); return; }
    const body = readFileSync(file);
    res.writeHead(200, {
      "Content-Type": MIME[".json"],
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  const file = resolveStaticFile(appDir, normalizedPath);
  if (!file || !existsSync(file)) { sendText(res, 404, "not found"); return; }
  const body = readFileSync(file);
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

export function createControlCenterServer({
  store = createCompanyStore(),
  appDir = APP_DIR,
  snapDir = SNAP_DIR,
  maxBodyBytes = MAX_REQUEST_BYTES,
} = {}) {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 128) throw new TypeError("maxBodyBytes가 올바르지 않습니다.");
  return createServer((req, res) => {
    handleRequest(req, res, { store, appDir, snapDir, maxBodyBytes }).catch((error) => {
      if (res.headersSent) { res.destroy(); return; }
      const statusCode = error instanceof CompanyStoreError || error instanceof HttpError ? error.statusCode : 500;
      const code = error instanceof CompanyStoreError || error instanceof HttpError ? error.code : "INTERNAL_ERROR";
      const message = statusCode === 500 ? "로컬 저장 처리 중 오류가 발생했습니다." : error.message;
      sendJson(res, statusCode, { error: code, message });
      if (statusCode === 500) console.error("[robom-hq] request failed", error);
    });
  });
}

export async function startControlCenter({ port = DEFAULT_PORT, openBrowser = true, refreshSnapshot = true } = {}) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) throw new TypeError("ROBOM_HQ_PORT가 올바르지 않습니다.");
  const server = createControlCenterServer();
  const bindHost = REMOTE_ENABLED ? "0.0.0.0" : LOCAL_HOST;
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, bindHost, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const actualPort = server.address().port;
  const link = `http://${LOCAL_HOST}:${actualPort}/`;
  const officeLink = `${link}office.html`;
  console.log(`\n  로봄 본부 ROBOM HQ 실행됨\n  → 경영 OS: ${link}\n  → 6층 오피스(부가기능): ${officeLink}\n  (종료: Ctrl+C)\n`);
  if (REMOTE_ENABLED) {
    console.log(`[robom-hq] 휴대폰 연결 허용됨(토큰 인증). 같은 사설망에서 http://<이 컴퓨터 IP>:${actualPort}/?token=<토큰> 으로 1회 접속하면 이후 쿠키로 유지됩니다.`);
  }
  // 데스크톱은 Electron 드라이버가 이미 등록됨. 개발·CI에서는 Playwright가 있으면 활성(없으면 브라우저 계약만 점검 불가로 정직 표기).
  tryActivatePlaywrightDriver(process.env.ROBOM_HQ_PLAYWRIGHT || "playwright").then((ok) => {
    if (ok) console.log("[robom-hq] 브라우저 심층 점검: Playwright 드라이버 활성");
  }).catch(() => {});
  if (refreshSnapshot) {
    console.log("[robom-hq] 기존 화면을 먼저 열고 스냅샷은 백그라운드에서 갱신합니다.");
    buildSnapshotInBackground();
    // 결정론적 감시기: Codex 없이 주기적으로 실데이터 스냅샷을 갱신하고, 하루 1회 개선 제안을 올린다.
    const reviewSoon = () => setTimeout(() => runDailyReviewIfDue().catch((e) => console.error("[robom-hq] 자동 점검 실패", e)), 12_000);
    reviewSoon();
    if (Number.isFinite(WATCHDOG_MINUTES) && WATCHDOG_MINUTES > 0) {
      const timer = setInterval(() => { buildSnapshotInBackground(); runDailyReviewIfDue().catch(() => {}); }, WATCHDOG_MINUTES * 60_000);
      timer.unref?.();
    }
    if (AUTO_REVIEW) {
      const m = readReviewEveryMinutes();
      console.log(`[robom-hq] 자동 점검 주기: ${m > 0 ? `${m}분마다` : "꺼짐"} — 프로그램 설정에서 조절(최소 ${REVIEW_MIN_MINUTES}분). 개선 제안을 '오늘' 화면 결재로 올립니다.`);
    }
    // 완전 자동: HQ가 codex-runner를 직접 실행·감시(터미널 불필요). 데스크톱/자동시작에서 켜진다.
    if (MANAGE_RUNNER) {
      try {
        const supervisor = startRunnerSupervisor({ runtimeDir: DEFAULT_COMPANY_RUNTIME_DIR, snapDir: SNAP_DIR });
        console.log(`[robom-hq] codex-runner 자동 관리 활성${supervisor.repoRoot ? ` · 작업 저장소 ${supervisor.repoRoot}` : " (작업 저장소 미발견 — 요청은 대기열에 안전 보관)"}`);
      } catch (error) {
        console.error("[robom-hq] 러너 자동 관리 시작 실패", error);
      }
    }
  }
  if (openBrowser) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", link] : [link];
    try { spawnSync(opener, args, { stdio: "ignore" }); } catch { /* 헤드리스 환경이면 무시 */ }
  }
  return { server, link };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  startControlCenter({ openBrowser: process.env.ROBOM_HQ_OPEN_BROWSER !== "0" }).catch((error) => {
    console.error("[robom-hq] 시작 실패", error);
    process.exitCode = 1;
  });
}
