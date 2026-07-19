// 로봄 본부 로컬 실행 서버 — 기존 스냅샷·정적 화면과 Company OS 저장 API를 함께 제공한다.
// 기본은 127.0.0.1 로컬 전용. ROBOM_HQ_REMOTE_TOKEN(12자 이상)을 설정한 경우에만
// 같은 네트워크(권장: Tailscale 사설망)의 휴대폰이 토큰 인증으로 접속할 수 있다.
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
import { readMobileAccess, writeMobileAccess, connectUrls, DEFAULT_MOBILE_PORT } from "./lib/mobile-access.mjs";
import { readAuthority, writeAuthority, isDelegable, currentShift, COMPANY_MODES, COMPANY_MODE_LABELS, APPROVAL_MODES } from "./lib/company-authority.mjs";
import { classifyFix, classifyIncidents, resolutionLine } from "./lib/incident-fix.mjs";
import { createLoop, transitionLoop, openIteration, findLoopByContract, findLoopByTask, summarizeLoops } from "./lib/loop-engine.mjs";
import { loadRoster, computeWorkforce, orgTree, currentShiftId } from "./lib/workforce.mjs";
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

let snapshotRefresh = null;
function buildSnapshotInBackground() {
  // 첫 자동 점검이 예시 폴백을 실제 상태로 오인하지 않도록, 같은 시각의 생성 요청은 하나만 실행한다.
  if (snapshotRefresh) return snapshotRefresh;
  snapshotRefresh = new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(REPO_ROOT, "scripts/control-center/build-snapshot.mjs")], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`스냅샷 갱신 실패 (${code})`));
    });
  }).finally(() => { snapshotRefresh = null; });
  return snapshotRefresh;
}

function refreshSnapshotAndReview() {
  return buildSnapshotInBackground()
    .then(() => runDailyReviewIfDue())
    .catch((error) => console.error("[robom-hq] 스냅샷/자동 점검 실패", error.message));
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

// ── 심층 계약 엔진(진단률 100%): 카탈로그의 모든 계약(동적 집계)을 실제 실행한다 ──
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
// 계약 실패 계열 → Loop 종류(§6 loop_type). 회장 화면에서 어떤 성격의 개선인지 보여준다.
function loopTypeFor(failureClass = "") {
  const map = {
    security: "security", quota: "maintenance", freshness: "data_quality", data_stale: "data_quality",
    availability: "reliability", production: "reliability", ci: "reliability", transport: "reliability",
    observability: "reliability", schema: "data_quality", integrity: "data_quality", parity: "maintenance",
    storage: "maintenance", automation: "maintenance", notification: "user_experience",
  };
  return map[failureClass] || "reliability";
}

// §12 유지보수: 가장 최근 백업의 나이(시간)를 잰다. 백업이 없으면 Infinity.
const BACKUP_MAX_AGE_HOURS = Number(process.env.ROBOM_HQ_BACKUP_MAX_AGE_HOURS || 24); // 하루 1회 자동 백업
function newestBackupAgeHours(backupsDir, now = new Date()) {
  try {
    const files = readdirSync(backupsDir).filter((f) => f.startsWith("company-backup-") && f.endsWith(".json.local"));
    if (!files.length) return Infinity;
    let newest = 0;
    for (const f of files) { try { const m = statSync(join(backupsDir, f)).mtimeMs; if (m > newest) newest = m; } catch { /* skip */ } }
    if (!newest) return Infinity;
    return (now.getTime() - newest) / 3.6e6;
  } catch { return Infinity; }
}

async function runDailyReviewIfDue({ store = createCompanyStore(), snapDir = SNAP_DIR, force = false, now = new Date() } = {}) {
  if (!AUTO_REVIEW && !force) return { skipped: "disabled" };
  // v2.0.0: 회사 모드가 정본. RUNNING·MONITOR_ONLY = 상시 관제(감시기 주기마다), PAUSED = 중지.
  const authority = readAuthority();
  if (!force && ["PAUSED", "EMERGENCY_STOP"].includes(authority.mode)) return { skipped: `company-${authority.mode.toLowerCase()}` };
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

  // 1) 결정론적 health 엔진 — 심층 계약 엔진(카탈로그 전량, 동적)을 먼저 실행하고, anti-flap 판정 후 확정 incident만 결재 상신
  let healthSummary = null;
  let healthResults = []; // 원래 계약 자동 재검증에 쓰기 위해 바깥으로 끌어낸다
  try {
    let runner = null; try { runner = readRunnerStatus(); } catch { /* 러너 상태 없음 */ }
    const contractReport = await runDeepContracts({ now });
    const extraResults = contractResultsToRaw(contractReport);
    const health = runHealthEngine({ snapshot, runtimeDir: DEFAULT_COMPANY_RUNTIME_DIR, now, runner, watchdogMinutes: WATCHDOG_MINUTES, extraResults });
    healthResults = health.results || [];
    healthSummary = { ...health.summary, contracts: contractReport?.coverage || null };
    // v2.5.0: 신호가 회복되면(recoveries) 그 계약으로 올렸던 pending 결재를 자동으로 닫는다("회복되면 자동 종료"를 실제로 이행).
    let autoClosed = 0;
    try {
      const st0 = await store.getState();
      const recoveredKeys = new Set(health.recoveries.map((r) => r.contractId));
      for (const a of (st0.records.approvals || [])) {
        if ((!a.status || a.status === "pending") && a.requestedBy === "auto-review" && recoveredKeys.has(a.proposalKey)) {
          try { await store.updateStatus("approvals", a.id, { status: "resolved", comment: "신호 회복 — 컴퓨터가 자동 종료" }); autoClosed += 1; } catch { /* skip */ }
        }
      }
      // 신호가 회복된 계약의 Loop도 CLOSED로 닫는다(원래 계약 재검증 통과 = 진짜 해결).
      for (const contractId of recoveredKeys) {
        try { const loop = findLoopByContract(contractId); if (loop) transitionLoop(loop.loopId, "CLOSED", { now, note: "신호 회복 자동 종료", evidence: { origin_recheck: "PASS" } }); } catch { /* skip */ }
      }
    } catch { /* 회복 자동종료 실패는 무시 */ }
    healthSummary.autoClosed = autoClosed;
    // 알림 예산(§8.1): critical·error 무제한, warning은 run당 10건, info는 결재 상신 안 함(기록만)
    // v2.5.0 분류: self_heal(재점검·회복형)은 결재로 올리지 않고 컴퓨터가 자동 처리한다.
    //             codex(코드 변경)·human(비밀키·권한·결제)만 회장 결재로 올린다.
    let warningBudget = 10, selfHealed = 0;
    for (const inc of health.newIncidents) {
      if (existingKeys.has(inc.contractId)) continue;
      if (inc.severity === "info") continue;
      const text = `${inc.userImpact || ""} ${inc.recommendedAction || ""}`;
      const fixClass = classifyFix({ failureClass: inc.failureClass, text, requestedBy: "auto-review" });
      if (fixClass === "self_heal") { selfHealed += 1; existingKeys.add(inc.contractId); continue; } // 컴퓨터가 재점검·자동종료로 처리
      if (inc.severity === "warning" && warningBudget-- <= 0) continue;
      const priority = inc.severity === "critical" ? "urgent" : inc.severity === "error" ? "high" : "normal";
      const body = inc.actual ? `확인된 값: ${inc.actual}${inc.expected ? ` / 기대: ${inc.expected}` : ""}` : (inc.userImpact || "");
      try {
        const rec = await store.createRecord("approvals", {
          title: inc.userImpact || `${inc.target} 확인 필요`, appId: appTarget(inc.target), body,
          recommendation: inc.recommendedAction, priority, requestedBy: "auto-review", proposalKey: inc.contractId,
          fixClass, failureClass: inc.failureClass || "", detectedAt: inc.detectedAt || null, status: "pending",
        });
        // §6 Loop 생성 — 확정 사건마다 목표·합격기준·담당·검증자를 갖춘 Loop를 연다(원래 계약 재검증이 필수 기준).
        try {
          const loop = createLoop({
            objective: inc.userImpact || `${inc.target} 문제 해결`, contractId: inc.contractId, fixClass,
            appId: appTarget(inc.target), userImpact: inc.userImpact, expected: inc.expected, severity: inc.severity,
            loopType: loopTypeFor(inc.failureClass), approvalId: rec.id,
            baselineFailCount: (health.results || []).filter((r) => r.confirmed && r.target === inc.target).length, // §17 회귀 기준선
            nextAction: fixClass === "human" ? "회장 확인 필요(비밀키·권한·결제 등)" : "회장 승인 대기",
          }, { now });
          await store.updateStatus("approvals", rec.id, { loopId: loop.loopId });
        } catch { /* loop 생성 실패는 결재를 막지 않는다 */ }
        created.push(rec.id); existingKeys.add(inc.contractId);
      } catch { /* 개별 실패는 건너뛴다 */ }
    }
    healthSummary.selfHealed = selfHealed;
  } catch (error) { console.error("[robom-hq] health 엔진 실행 실패", error?.message); }

  // §7 핵심: Codex가 작업을 끝냈다(in_review)고 해결이 아니다. 원래 실패했던 계약이 이번 점검에서
  // 다시 PASS해야만 그 Loop를 CLOSED로 닫고 업무를 완료 처리한다. 아직 실패면 새 iteration으로 재시도한다.
  let reverified = 0, reiterated = 0, regressionHeld = 0;
  try {
    const passContracts = new Set(healthResults.filter((r) => r.status === "PASS").map((r) => r.contractId));
    const stillFailing = new Set(healthResults.filter((r) => r.confirmed).map((r) => r.contractId));
    const st4 = await store.getState();
    // 회장이 '확인 완료'한 작업(성장 Loop 등, 원래 계약이 health 대상이 아닌 경우)의 Loop를 닫는다.
    for (const task of (st4.records.tasks || []).filter((t) => t.status === "completed" && t.loopId)) {
      try { const loop = findLoopByTask(task.id); if (loop && loop.state !== "CLOSED") transitionLoop(loop.loopId, "CLOSED", { now, note: "회장 확인 완료" }); } catch { /* skip */ }
    }
    // §17 감사2(회귀 방지): 앱별 확정 실패 계약 수. 수정 후 이 앱의 실패가 늘었다면 다른 걸 깨뜨린 것 → 종료 보류.
    const appFailNow = {};
    for (const r of healthResults) if (r.confirmed) appFailNow[r.target] = (appFailNow[r.target] || 0) + 1;
    const reviewTasks = (st4.records.tasks || []).filter((t) => t.status === "in_review" && t.originContract);
    for (const task of reviewTasks) {
      if (passContracts.has(task.originContract)) {
        const loop = (() => { try { return findLoopByTask(task.id); } catch { return null; } })();
        // 회귀 감사: 이 앱의 현재 실패 수가 Loop 시작 시 기준선보다 크면 = 다른 것을 깨뜨림 → 닫지 않고 재시도.
        const appKey = task.appId || (loop && loop.targetApp) || "";
        const baseline = loop && Number.isFinite(loop.baselineFailCount) ? loop.baselineFailCount : null;
        const nowFail = appFailNow[appKey] || 0;
        if (baseline !== null && nowFail > baseline) {
          try { if (loop) openIteration(loop.loopId, { now, failureSignature: `regression:${appKey}:${nowFail}>${baseline}` }); } catch { /* skip */ }
          try { await store.updateStatus("tasks", task.id, { status: "blocked", reason: "원래 문제는 고쳤으나 이 앱에 새 장애가 생김(회귀) — 재검토 필요" }); } catch { /* skip */ }
          regressionHeld += 1;
          continue;
        }
        try { await store.updateStatus("tasks", task.id, { status: "completed", verifiedBy: "origin-recheck+regression-guard" }); } catch { /* skip */ }
        try { if (loop) transitionLoop(loop.loopId, "CLOSED", { now, note: "원래 계약 재검증 PASS + 회귀 없음", evidence: { origin_recheck: "PASS", regression_guard: "PASS" } }); } catch { /* skip */ }
        if (task.approvalId) { try { await store.updateStatus("approvals", task.approvalId, { status: "resolved", comment: "원래 계약 재검증 통과 + 회귀 없음 — 자동 종료" }); } catch { /* skip */ } }
        reverified += 1;
      } else if (stillFailing.has(task.originContract)) {
        try { const loop = findLoopByTask(task.id); if (loop) openIteration(loop.loopId, { now, failureSignature: `origin-still-failing:${task.originContract}` }); } catch { /* skip */ }
        try { await store.updateStatus("tasks", task.id, { status: "blocked", reason: "원래 계약이 아직 실패 — 새 iteration 필요" }); } catch { /* skip */ }
        reiterated += 1;
      }
      // PASS도 확정 실패도 아니면(UNAVAILABLE 등) 판정 보류 — in_review 유지
    }
  } catch (error) { console.error("[robom-hq] 원래 계약 재검증 실패", error?.message); }
  if (healthSummary) { healthSummary.reverified = reverified; healthSummary.reiterated = reiterated; healthSummary.regressionHeld = regressionHeld; }

  // 2) 성장 제안(다음 개선 행동)·회사 보안만 기존 제안기에서 가져온다(건강/CI/PR은 엔진이 담당 — 중복 방지)
  const growth = generateProposals(snapshot, existing, { limit: 20 }).filter((p) => /:next$|:security$/.test(p.key));
  for (const p of growth) {
    if (existingKeys.has(p.key)) continue;
    try {
      const fixClass = classifyFix({ failureClass: /:security$/.test(p.key) ? "security" : "", text: `${p.title} ${p.body} ${p.recommendation}`, requestedBy: "auto-review" });
      const rec = await store.createRecord("approvals", {
        title: p.title, appId: p.appId, body: p.body, recommendation: p.recommendation,
        priority: p.priority, requestedBy: "auto-review", proposalKey: p.key, fixClass, status: "pending",
      });
      // §13 성장 Loop — 개선 제안도 목표·합격기준을 갖춘 닫힌 Loop로 만든다(단순 backlog로 남기지 않음).
      try {
        const loop = createLoop({
          objective: p.title, contractId: p.key, fixClass, appId: p.appId, userImpact: p.body,
          loopType: /:security$/.test(p.key) ? "security" : "product_growth", approvalId: rec.id, nextAction: "회장 승인 대기",
        }, { now });
        await store.updateStatus("approvals", rec.id, { loopId: loop.loopId });
      } catch { /* loop 생성 실패는 결재를 막지 않는다 */ }
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
            originContract: approval.proposalKey || "", approvalId: approval.id, loopId: approval.loopId || null,
          });
          try { enqueueTask(task, { snapshot: readSnapshotValue(snapDir) }); }
          catch { await store.updateStatus("tasks", task.id, { status: "blocked" }); }
          if (approval.loopId) { try { transitionLoop(approval.loopId, "DELEGATED_APPROVAL", { now, note: "수석부회장 전결", patch: { taskId: task.id } }); transitionLoop(approval.loopId, "QUEUED", { now, note: "대기열 등록" }); } catch { /* skip */ } }
          delegated += 1;
        } catch { /* 개별 전결 실패는 건너뛴다 */ }
      }
    } catch (error) { console.error("[robom-hq] 전결 처리 실패", error?.message); }
  }
  // v2.5.0: Codex 실행기가 연결돼 있으면, 일시적 사유(미연결·클론 없음)로 막힌 업무를 자동으로 다시 큐에 넣는다.
  //         ("코덱스가 붙으면 자동으로 다시 시도한다"를 실제로 이행 — 회장이 누를 것 없음). 한 번에 최대 20건.
  let requeued = 0;
  try {
    let runner2 = null; try { runner2 = readRunnerStatus(); } catch { /* 러너 상태 없음 */ }
    if (runner2?.codex === "connected") {
      const st3 = await store.getState();
      const blocked = (st3.records.tasks || []).filter((t) => t.status === "blocked").slice(0, 20);
      for (const task of blocked) {
        try { enqueueTask(task, { snapshot: readSnapshotValue(snapDir) }); await store.updateStatus("tasks", task.id, { status: "queued" }); requeued += 1; }
        catch { /* 재큐 실패는 막힘 유지 */ }
      }
    }
  } catch (error) { console.error("[robom-hq] 막힘 자동 재시도 실패", error?.message); }
  if (healthSummary) healthSummary.requeued = requeued;
  // §12 유지보수 Loop(self_heal): 백업이 오래됐으면 컴퓨터가 AI 없이 스스로 백업한다(로컬 파일, 안전·되돌릴 필요 없음).
  let autoBackedUp = false, backupAgeH = null;
  try {
    backupAgeH = newestBackupAgeHours(store.paths.backupsDir, now);
    if (backupAgeH > BACKUP_MAX_AGE_HOURS) {
      try { await store.backup(); autoBackedUp = true; backupAgeH = 0; } catch (error) { console.error("[robom-hq] 자동 백업 실패", error?.message); }
    }
  } catch { /* 백업 점검 실패 무시 */ }
  if (healthSummary) { healthSummary.backupAgeHours = Number.isFinite(backupAgeH) ? Math.round(backupAgeH) : null; healthSummary.autoBackedUp = autoBackedUp; }
  try {
    mkdirSync(DEFAULT_COMPANY_RUNTIME_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(REVIEW_MARKER, JSON.stringify({ at: new Date().toISOString(), created: created.length, delegated, health: healthSummary }), { mode: 0o600 });
  } catch { /* 마커 기록 실패 무시 */ }
  return { created: created.length, delegated, health: healthSummary };
}
// 인력 배치 도출 — 최근 계약 결과 + 큐 작업 + 회사 권한으로 80명 상태 계산(companyOperations)
function readWorkforce(tasks = []) {
  try {
    const report = readContractReport();
    const authority = readAuthority();
    let executorConnected = false;
    try { const rs = readRunnerStatus(); executorConnected = rs && ["running", "working", "busy", "processing"].includes(String(rs.state)); } catch { /* 러너 상태 없음 → 미연결 */ }
    return computeWorkforce({ report, tasks, authority, now: new Date(), executorConnected });
  } catch (error) {
    return { companyMode: "RUNNING", staff: [], summary: { total: 0 }, byDivision: [], error: String(error?.message || error).slice(0, 80) };
  }
}
// 최근 health 요약(hq-status 노출용) — 심층 계약 coverage(진단률) 포함
function readHealthSummary() {
  try {
    const summary = JSON.parse(readFileSync(join(DEFAULT_COMPANY_RUNTIME_DIR, "health", "latest.json"), "utf8")).summary || null;
    if (!summary) return null;
    const report = readContractReport();
    // 자동 처리 실적(self_heal·회복 자동종료·원래 계약 재검증·회귀 보류·자동 백업)은 마지막 리뷰 마커에 담긴다 — 병합해 화면에 노출.
    let marker = {};
    try { const m = JSON.parse(readFileSync(REVIEW_MARKER, "utf8")); if (m && m.health) marker = m.health; } catch { /* 마커 없음 */ }
    const extra = {};
    for (const k of ["selfHealed", "autoClosed", "reverified", "reiterated", "regressionHeld", "requeued", "backupAgeHours", "autoBackedUp"]) {
      if (marker[k] !== undefined) extra[k] = marker[k];
    }
    return { ...summary, ...extra, contracts: report?.coverage || null, contractsRunAt: report?.runAt || null };
  } catch { return null; }
}

// v2.5.0: 확정 사건·대기 결재를 "자동/Codex/회장" 3갈래 보드로 묶어 화면에 해결경로를 제공한다.
// self_heal 은 결재로 올리지 않으므로 health results(확정)에서 뽑고, codex·human 은 대기 결재에서 뽑는다.
function buildIncidentBoard(pendingApprovals, codexReady) {
  let results = [];
  try { results = JSON.parse(readFileSync(join(DEFAULT_COMPANY_RUNTIME_DIR, "health", "latest.json"), "utf8")).results || []; } catch { /* 없음 */ }
  const selfHeal = results.filter((r) => r.confirmed).map((r) => ({
    id: r.contractId, target: r.target, title: r.userImpact || r.contractId, detectedAt: r.firstFailedAt || r.checkedAt,
    severity: r.severity, recommendedAction: r.recommendedAction,
    fixClass: classifyFix({ failureClass: r.failureClass, text: `${r.userImpact || ""} ${r.recommendedAction || ""}` }),
  })).filter((r) => r.fixClass === "self_heal");
  const codex = [], human = [];
  for (const a of (pendingApprovals || [])) {
    const text = `${a.title || ""} ${a.body || ""} ${a.recommendation || ""}`;
    const fixClass = a.fixClass || classifyFix({ failureClass: a.failureClass, text, requestedBy: a.requestedBy });
    if (fixClass === "self_heal") continue;
    (fixClass === "human" ? human : codex).push({
      id: a.id, target: a.appId || "", title: a.title || "확인 필요", detectedAt: a.detectedAt || a.createdAt || null,
      severity: a.priority === "urgent" ? "critical" : a.priority === "high" ? "error" : "warning", fixClass,
      resolution: resolutionLine(fixClass, { recommendedAction: a.recommendation, codexReady }),
    });
  }
  const withRes = (list) => list.map((r) => ({ ...r, resolution: r.resolution || resolutionLine(r.fixClass, { recommendedAction: r.recommendedAction, codexReady }) }));
  return { selfHeal: withRes(selfHeal), codex, human, counts: { selfHeal: selfHeal.length, codex: codex.length, human: human.length } };
}

async function handleApi(req, res, path, store, maxBodyBytes, snapDir, local) {
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
    let wf = null, board = null; try {
      let ec = false; try { const rs = summary.runner; ec = rs && ["running", "working", "busy", "processing"].includes(String(rs.state)); } catch { /* noop */ }
      let stTasks = []; let stApprovals = [];
      try { const s = await store.getState(); stTasks = s.records?.tasks || []; stApprovals = s.records?.approvals || []; } catch { /* 상태 없음 */ }
      wf = computeWorkforce({ report: readContractReport(), tasks: stTasks, authority, now: new Date(), executorConnected: ec });
      const codexReady = summary.runner?.codex === "connected";
      const pendingApprovals = stApprovals.filter((a) => !a.status || a.status === "pending");
      board = buildIncidentBoard(pendingApprovals, codexReady);
    } catch { /* 인력·보드 계산 실패 무시 */ }
    let loops = null; try { loops = summarizeLoops(); } catch { /* loop 요약 실패 무시 */ }
    sendJson(res, 200, { ok: true, ...summary, remote: REMOTE_ENABLED || mobileEnabled() ? "token" : "local-only", mobile: mobileEnabled(), reviewEveryMinutes: AUTO_REVIEW ? readReviewEveryMinutes() : 0, reviewMinMinutes: REVIEW_MIN_MINUTES, health: readHealthSummary(), incidentBoard: board, loops, company: { mode: authority.mode, modeLabel: COMPANY_MODE_LABELS[authority.mode] || authority.mode, approvalMode: authority.approvalMode, delegatedAt: authority.delegatedAt, shift: currentShift() }, workforce: wf ? { summary: wf.summary, running: wf.running, contractsAssigned: wf.contractsAssigned, contractsFailing: wf.contractsFailing, contractsAutoFixing: wf.contractsAutoFixing, contractsNeedHuman: wf.contractsNeedHuman, executorConnected: wf.executorConnected, byDivision: wf.byDivision } : null });
    return;
  }

  // 휴대폰 연결(연동) — 토큰·주소는 이 컴퓨터(로컬 창)에서만 보여준다. 원격에서 토큰 재노출 금지.
  if (path === "/api/mobile-access") {
    if (req.method === "GET") {
      if (!local) { sendJson(res, 200, { ok: true, enabled: mobileEnabled(), connectedRemotely: true }); return; }
      const state = MOBILE_STATE || readMobileAccess();
      sendJson(res, 200, { ok: true, enabled: Boolean(state.enabled), port: state.port, token: state.enabled ? state.token : null, urls: connectUrls(state), listening: Boolean(mobileServer) });
      return;
    }
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "GET, POST" }); return; }
    if (!local) throw new HttpError("휴대폰 연결 설정은 이 컴퓨터에서만 바꿀 수 있습니다.", 403, "LOCAL_ONLY");
    const body = await readJsonBody(req, maxBodyBytes);
    if (typeof body.enabled !== "boolean") throw new HttpError("enabled(boolean)가 필요합니다.", 400, "INVALID_BODY");
    MOBILE_STATE = writeMobileAccess({ enabled: body.enabled });
    if (body.enabled) await startMobileListener(store);
    else stopMobileListener();
    sendJson(res, 200, { ok: true, enabled: Boolean(MOBILE_STATE.enabled), port: MOBILE_STATE.port, token: MOBILE_STATE.enabled ? MOBILE_STATE.token : null, urls: connectUrls(MOBILE_STATE), listening: Boolean(mobileServer) });
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
  // 인력 배치·직원별 업무 상태(80명) — 21B 우선순위로 도출(랜덤 금지)
  if (path === "/api/workforce") {
    if (req.method !== "GET") { sendText(res, 405, "method not allowed", { Allow: "GET" }); return; }
    let tasks = [];
    try { tasks = (await store.getState()).records?.tasks || []; } catch { /* 작업 없음 */ }
    sendJson(res, 200, { ok: true, ...readWorkforce(tasks) });
    return;
  }
  // 조직도 트리(공공기관형) + roster 정본
  if (path === "/api/org-chart") {
    if (req.method !== "GET") { sendText(res, 405, "method not allowed", { Allow: "GET" }); return; }
    try {
      const roster = loadRoster();
      sendJson(res, 200, { ok: true, tree: orgTree(), divisions: roster.divisions, careerLadder: roster.careerLadder, staffCount: roster.staff.length });
    } catch { sendJson(res, 200, { ok: false, message: "조직 정본을 읽지 못했습니다." }); }
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
    // 실제 스냅샷을 먼저 생성한다. 새 설치에서 example.json만 남은 상태로 계약을 실행하면
    // snapshot-exists가 거짓 장애를 만들 수 있다.
    buildSnapshotInBackground()
      .then(() => runDeepContracts({ force: true }))
      .then(() => runDailyReviewIfDue({ force: true }))
      .catch((error) => console.error("[robom-hq] 수동 점검 준비 실패", error.message));
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

  // v2.5.0 실행기 설정: 회장이 Codex 모델·추론 강도를 고른다(codex exec에 전달).
  if (path === "/api/executor-config") {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const body = await readJsonBody(req, maxBodyBytes);
    const changes = {};
    if (body.effort !== undefined) {
      const e = String(body.effort);
      if (!["low", "medium", "high", ""].includes(e)) throw new HttpError("effort는 low·medium·high 중 하나여야 합니다.", 400, "INVALID_EFFORT");
      changes.codexEffort = e;
    }
    if (body.model !== undefined) {
      const m = String(body.model).trim().slice(0, 80);
      if (m && !/^[A-Za-z0-9._-]+$/.test(m)) throw new HttpError("모델 이름 형식이 올바르지 않습니다.", 400, "INVALID_MODEL");
      changes.codexModel = m;
    }
    if (!Object.keys(changes).length) throw new HttpError("model 또는 effort가 필요합니다.", 400, "INVALID_EXECUTOR_CONFIG");
    sendJson(res, 200, { ok: true, control: writeControl(changes) });
    return;
  }

  // v2.5.0 막힘 업무 다시 시도: 회장 버튼. 막힌 업무를 대기열에 다시 넣는다.
  const retryMatch = path.match(/^\/api\/retry-task\/([^/]+)$/);
  if (retryMatch) {
    if (req.method !== "POST") { sendText(res, 405, "method not allowed", { Allow: "POST" }); return; }
    const id = decodeURIComponent(retryMatch[1]);
    const state = await store.getState();
    const task = (state.records.tasks || []).find((t) => t.id === id);
    if (!task) throw new HttpError("업무를 찾을 수 없습니다.", 404, "TASK_NOT_FOUND");
    if (!["blocked", "failed"].includes(task.status)) throw new HttpError("막힘·실패 상태의 업무만 다시 시도할 수 있습니다.", 409, "NOT_RETRYABLE");
    try { enqueueTask(task, { snapshot: readSnapshotValue(snapDir) }); }
    catch (error) { throw new HttpError(`작업 패킷 생성 실패: ${error.message}`, 500, "PACKET_FAILED"); }
    const updated = await store.updateStatus("tasks", id, { status: "queued" });
    sendJson(res, 200, { ok: true, task: updated });
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
      originContract: approval.proposalKey || "", approvalId: approval.id, loopId: approval.loopId || null,
    });
    try { enqueueTask(task, { snapshot: readSnapshotValue(snapDir) }); }
    catch (error) { await store.updateStatus("tasks", task.id, { status: "blocked" }); }
    if (approval.loopId) { try { transitionLoop(approval.loopId, "QUEUED", { note: "회장 재가 — 대기열 등록", patch: { taskId: task.id } }); } catch { /* skip */ } }
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

// ── 원격(휴대폰) 인증: 환경변수 토큰(고급) 또는 프로그램에서 켠 휴대폰 연결 토큰 ──
const remoteSessions = new Map(); // ip → {count, windowStart} 간이 rate limit
let MOBILE_STATE = null; // 시작·토글 시 갱신되는 캐시(파일 정본)
let mobileServer = null;
function mobileEnabled() { return Boolean(MOBILE_STATE?.enabled && MOBILE_STATE.token); }
function remoteAllowed() { return REMOTE_ENABLED || mobileEnabled(); }
function tokenMatches(candidate) {
  if (typeof candidate !== "string" || !candidate) return false;
  const valids = [];
  if (REMOTE_ENABLED) valids.push(REMOTE_TOKEN);
  if (mobileEnabled()) valids.push(MOBILE_STATE.token);
  const actual = Buffer.from(candidate);
  return valids.some((v) => {
    const expected = Buffer.from(v);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
}
// 휴대폰 연결 리스너: 켜면 0.0.0.0에 별도 포트로 열되, 모든 비로컬 요청은 토큰 인증을 거친다.
async function startMobileListener(store) {
  if (mobileServer) return true;
  const state = MOBILE_STATE;
  if (!state?.enabled) return false;
  const server = createControlCenterServer({ store });
  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen);
      server.listen(state.port || DEFAULT_MOBILE_PORT, "0.0.0.0", () => { server.off("error", rejectListen); resolveListen(); });
    });
    server.unref(); // 보조 리스너가 프로세스 종료를 막지 않는다(메인 서버가 수명 정본)
    mobileServer = server;
    console.log(`[robom-hq] 휴대폰 연결 대기 중 — 같은 와이파이에서 포트 ${state.port} (토큰 인증)`);
    return true;
  } catch (error) {
    console.error("[robom-hq] 휴대폰 연결 리스너 시작 실패", error?.message);
    return false;
  }
}
function stopMobileListener() {
  if (!mobileServer) return;
  try { mobileServer.close(); } catch { /* 무시 */ }
  mobileServer = null;
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
    if (!remoteAllowed()) {
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
    await handleApi(req, res, path, store, maxBodyBytes, snapDir, local);
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
  const store = createCompanyStore(); // 메인·휴대폰 리스너가 같은 저장소 인스턴스를 공유(동시 쓰기 경합 방지)
  const server = createControlCenterServer({ store });
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
  // 회장이 프로그램에서 켠 휴대폰 연결을 재시작 후에도 이어간다(설정 파일이 정본).
  MOBILE_STATE = readMobileAccess();
  if (MOBILE_STATE.enabled) await startMobileListener(store);
  server.once("close", stopMobileListener); // 메인 서버가 닫히면 휴대폰 리스너도 함께 닫는다
  // 데스크톱은 Electron 드라이버가 이미 등록됨. 개발·CI에서는 Playwright가 있으면 활성(없으면 브라우저 계약만 점검 불가로 정직 표기).
  tryActivatePlaywrightDriver(process.env.ROBOM_HQ_PLAYWRIGHT || "playwright").then((ok) => {
    if (ok) console.log("[robom-hq] 브라우저 심층 점검: Playwright 드라이버 활성");
  }).catch(() => {});
  if (refreshSnapshot) {
    console.log("[robom-hq] 기존 화면을 먼저 열고 스냅샷은 백그라운드에서 갱신합니다.");
    // 결정론적 감시기: 실제 스냅샷 생성 성공 뒤에만 자동 점검을 이어간다.
    // 예시 폴백을 계약 엔진의 운영 증거로 사용하지 않는다.
    void refreshSnapshotAndReview();
    if (Number.isFinite(WATCHDOG_MINUTES) && WATCHDOG_MINUTES > 0) {
      const timer = setInterval(() => { void refreshSnapshotAndReview(); }, WATCHDOG_MINUTES * 60_000);
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
        // v2.7.0: 앱이 종료되면 자식 러너도 반드시 함께 종료한다(고아 프로세스로 남아 계속 돌지 않게).
        let stopped = false;
        const stopRunner = () => { if (stopped) return; stopped = true; try { supervisor.stop(); } catch { /* 이미 종료 */ } };
        process.once("exit", stopRunner);
        process.once("SIGTERM", () => { stopRunner(); process.exit(0); });
        process.once("SIGINT", () => { stopRunner(); process.exit(0); });
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
