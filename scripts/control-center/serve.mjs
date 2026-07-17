// 로봄 본부 로컬 실행 서버 — 스냅샷을 새로 만들고 대시보드를 연다.
// 바탕화면 런처(bin/robom-hq.*)가 이 파일을 호출한다. 외부에 배포하지 않는다(내부 전용).
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./lib/sources.mjs";

const PORT = Number(process.env.ROBOM_HQ_PORT || 4321);
const APP_DIR = join(REPO_ROOT, "ops/control-center/app");
const SNAP_DIR = join(REPO_ROOT, "ops/control-center/snapshots");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

function buildSnapshot() {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, "scripts/control-center/build-snapshot.mjs")], { encoding: "utf8", cwd: REPO_ROOT });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.status !== 0 && r.stderr) process.stderr.write(r.stderr);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = url.pathname;
  if (path === "/" ) path = "/index.html";
  // 스냅샷: latest.json 우선, 없으면 example.json 폴백
  if (path === "/snapshot.json") {
    const latest = join(SNAP_DIR, "latest.json");
    const example = join(SNAP_DIR, "example.json");
    const file = existsSync(latest) ? latest : example;
    if (!existsSync(file)) { res.writeHead(404); res.end("no snapshot"); return; }
    res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
    res.end(readFileSync(file));
    return;
  }
  const file = join(APP_DIR, path.replace(/^\/+/, ""));
  if (!file.startsWith(APP_DIR) || !existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

console.log("[robom-hq] 스냅샷 생성 중...");
buildSnapshot();
server.listen(PORT, () => {
  const link = `http://localhost:${PORT}/office.html`;
  console.log(`\n  로봄 본부 ROBOM Control Center 실행됨\n  → ${link}\n  (종료: Ctrl+C)\n`);
  // 브라우저 자동 열기(가능한 OS에서)
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", link] : [link];
  try { spawnSync(opener, args, { stdio: "ignore" }); } catch { /* 헤드리스 환경이면 무시 */ }
});
