// 로봄 본부 로컬 실행 서버 — 기존 스냅샷·정적 화면과 Company OS 저장 API를 함께 제공한다.
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  CompanyStoreError,
  createCompanyStore,
} from "./lib/company-store.mjs";
import { REPO_ROOT } from "./lib/sources.mjs";

const DEFAULT_PORT = Number(process.env.ROBOM_HQ_PORT || 4321);
export const LOCAL_HOST = "127.0.0.1";
export const MAX_REQUEST_BYTES = 32 * 1024;
const APP_DIR = join(REPO_ROOT, "ops/control-center/app");
const SNAP_DIR = join(REPO_ROOT, "ops/control-center/snapshots");
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

function buildSnapshot() {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, "scripts/control-center/build-snapshot.mjs")], {
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0 && result.stderr) process.stderr.write(result.stderr);
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

async function handleApi(req, res, path, store, maxBodyBytes) {
  if (path === "/api/company-state") {
    if (req.method !== "GET") {
      sendText(res, 405, "method not allowed", { Allow: "GET" });
      return;
    }
    sendJson(res, 200, await store.getState());
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

async function handleRequest(req, res, { store, appDir, snapDir, maxBodyBytes }) {
  if (!isLocalHostHeader(req.headers.host)) {
    sendJson(res, 403, { error: "LOCAL_ONLY", message: "localhost 요청만 허용합니다." });
    return;
  }
  const path = decodeSafePath(req.url);
  if (path.startsWith("/api/")) {
    await handleApi(req, res, path, store, maxBodyBytes);
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
  if (refreshSnapshot) {
    console.log("[robom-hq] 스냅샷 생성 중...");
    buildSnapshot();
  }
  const server = createControlCenterServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, LOCAL_HOST, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const actualPort = server.address().port;
  const link = `http://${LOCAL_HOST}:${actualPort}/`;
  const officeLink = `${link}office.html`;
  console.log(`\n  로봄 본부 ROBOM Company OS 실행됨\n  → 경영 OS: ${link}\n  → 6층 오피스: ${officeLink}\n  (종료: Ctrl+C)\n`);
  if (openBrowser) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", link] : [link];
    try { spawnSync(opener, args, { stdio: "ignore" }); } catch { /* 헤드리스 환경이면 무시 */ }
  }
  return { server, link };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  startControlCenter().catch((error) => {
    console.error("[robom-hq] 시작 실패", error);
    process.exitCode = 1;
  });
}
