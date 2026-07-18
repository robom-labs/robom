// 로봄 본부 로컬 실행 서버 — 기존 스냅샷·정적 화면과 Company OS 저장 API를 함께 제공한다.
// 기본은 127.0.0.1 로컬 전용. ROBOM_HQ_REMOTE_TOKEN(12자 이상)을 설정한 경우에만
// 같은 네트워크(권장: Tailscale 사설망)의 휴대폰이 토큰 인증으로 접속할 수 있다.
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import {
  CompanyStoreError,
  createCompanyStore,
} from "./lib/company-store.mjs";
import {
  cancelPendingTask, enqueueTask, queueSummary, recoverStaleLeases, writeControl,
} from "./lib/task-queue.mjs";
import { REPO_ROOT } from "./lib/sources.mjs";

const DEFAULT_PORT = Number(process.env.ROBOM_HQ_PORT || 4321);
export const LOCAL_HOST = "127.0.0.1";
export const MAX_REQUEST_BYTES = 32 * 1024;
const APP_DIR = join(REPO_ROOT, "ops/control-center/app");
const SNAP_DIR = process.env.ROBOM_HQ_SNAP_DIR || join(REPO_ROOT, "ops/control-center/snapshots");
const REMOTE_TOKEN = String(process.env.ROBOM_HQ_REMOTE_TOKEN || "").trim();
const REMOTE_ENABLED = REMOTE_TOKEN.length >= 12;
const WATCHDOG_MINUTES = Number(process.env.ROBOM_HQ_WATCH_MINUTES ?? 10);
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
    sendJson(res, 200, { ok: true, ...queueSummary(), remote: REMOTE_ENABLED ? "token" : "local-only" });
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
  if (refreshSnapshot) {
    console.log("[robom-hq] 기존 화면을 먼저 열고 스냅샷은 백그라운드에서 갱신합니다.");
    buildSnapshotInBackground();
    // 결정론적 감시기: Codex 없이 주기적으로 실데이터 스냅샷을 갱신한다(0이면 끔).
    if (Number.isFinite(WATCHDOG_MINUTES) && WATCHDOG_MINUTES > 0) {
      const timer = setInterval(buildSnapshotInBackground, WATCHDOG_MINUTES * 60_000);
      timer.unref?.();
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
