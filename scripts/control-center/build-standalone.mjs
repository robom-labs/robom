// 단일 HTML 빌더 — 바탕화면에서 더블클릭하면 열리는 자립형 로봄 본부(미리보기).
// CSS·JS·아이콘·스냅샷을 한 파일에 인라인한다. Node·서버·인터넷 불필요.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/sources.mjs";

const APP = join(REPO_ROOT, "ops/control-center/app");
const SNAP_DIR = join(REPO_ROOT, "ops/control-center/snapshots");
const snapFile = existsSync(join(SNAP_DIR, "latest.json")) ? "latest.json" : "example.json";

const css = readFileSync(join(APP, "styles.css"), "utf8");
const js = readFileSync(join(APP, "app.js"), "utf8");
const icon = readFileSync(join(APP, "icon.svg"), "utf8");
const iconData = "data:image/svg+xml;utf8," + encodeURIComponent(icon);
const snap = JSON.parse(readFileSync(join(SNAP_DIR, snapFile), "utf8"));

let html = readFileSync(join(APP, "index.html"), "utf8");
html = html
  .replace(/<link rel="manifest"[^>]*>\s*/i, "")
  .replace(/<link rel="icon"[^>]*>\s*/i, "")
  .replace(/<link rel="stylesheet" href="\.\/styles\.css" \/>/i, `<style>\n${css}\n</style>`)
  .replace(/src="\.\/icon\.svg"/g, `src="${iconData}"`)
  .replace(/<script src="\.\/app\.js"><\/script>/i,
    `<script>window.__PREVIEW__=true;window.__SNAP__=${JSON.stringify(snap)};</script>\n<script>\n${js}\n</script>`)
  // 미리보기 안내 배너
  .replace(/(<main id="screen")/,
    `<div style="background:rgba(255,207,77,.1);border-bottom:1px solid rgba(255,207,77,.25);color:#ffcf4d;font:600 11px/1.5 var(--mono,monospace);padding:7px 13px;text-align:center">미리보기 · 예시 작업 데이터입니다. 실시간 가동은 저장소에서 <b>bin/robom-hq</b> 실행 →</div>\n      $1`);

const outDir = join(REPO_ROOT, "ops/control-center/dist");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = join(outDir, "로봄본부.html");
writeFileSync(out, html);
console.log(`[robom-hq] 단일 HTML(대시보드): ${out} (${Math.round(html.length / 1024)}KB)`);

// 오피스 게임 단일 HTML (더블클릭 실행)
const officeJs = readFileSync(join(APP, "office.js"), "utf8");
let game = readFileSync(join(APP, "office.html"), "utf8")
  .replace(/<link rel="icon"[^>]*>\s*/i, "")
  .replace(/<script src="\.\/office\.js"><\/script>/i,
    `<script>window.__PREVIEW__=true;window.__SNAP__=${JSON.stringify(snap)};</script>\n<script>\n${officeJs}\n</script>`);
// LPC 스프라이트를 data URI로 인라인(더블클릭 file://에서도 캐릭터 아트가 뜨게)
for (const k of ["body", "shirt", "pants", "hair"]) {
  try { const p = join(APP, "assets", `lpc-${k}.png`); if (existsSync(p)) { const b = readFileSync(p).toString("base64"); game = game.replace(`"./assets/lpc-${k}.png"`, `"data:image/png;base64,${b}"`); } } catch {}
}
const gout = join(outDir, "로봄본부-오피스.html");
writeFileSync(gout, game);
console.log(`[robom-hq] 단일 HTML(오피스 게임): ${gout} (${Math.round(game.length / 1024)}KB, snapshot=${snapFile})`);
