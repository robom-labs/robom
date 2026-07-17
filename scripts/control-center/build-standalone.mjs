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
  // 휴대용 보기 안내 배너
  .replace(/(<main id="screen")/,
    `<div style="background:#f7efe2;border-bottom:1px solid #e3d5c1;color:#604f3c;font:700 12px/1.5 var(--sans,sans-serif);padding:9px 14px;text-align:center">휴대용 보기 · 마지막 생성 스냅샷입니다. 기록·결재·백업은 <b>bin/robom-hq</b>로 실행하세요.</div>\n      $1`);

const outDir = join(REPO_ROOT, "ops/control-center/dist");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = join(outDir, "로봄본부.html");
writeFileSync(out, html);
console.log(`[robom-hq] 단일 HTML(대시보드): ${out} (${Math.round(html.length / 1024)}KB)`);

// 오피스 게임 단일 HTML (더블클릭 실행)
const officeJs = readFileSync(join(APP, "office.js"), "utf8");
const officeMap = existsSync(join(APP, "office-map.json"))
  ? JSON.parse(readFileSync(join(APP, "office-map.json"), "utf8")) : null;
let game = readFileSync(join(APP, "office.html"), "utf8")
  .replace(/<link rel="icon"[^>]*>\s*/i, "")
  .replace(/<script src="\.\/office\.js"><\/script>/i,
    `<script>window.__PREVIEW__=true;window.__SNAP__=${JSON.stringify(snap)};${officeMap ? `window.__MAP__=${JSON.stringify(officeMap)};` : ""}</script>\n<script>\n${officeJs}\n</script>`);
const gout = join(outDir, "로봄본부-오피스.html");
writeFileSync(gout, game);
console.log(`[robom-hq] 단일 HTML(오피스 게임): ${gout} (${Math.round(game.length / 1024)}KB, snapshot=${snapFile})`);
