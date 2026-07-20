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
const ver = existsSync(join(APP, "version.json")) ? JSON.parse(readFileSync(join(APP, "version.json"), "utf8")) : null;

// 인라인 치환은 index.html 마크업과 글자 단위로 일치해야 한다. .replace()는 매치 실패 시 예외 없이
// 원본을 그대로 돌려주므로, 스타일·스크립트를 못 넣은 외부 참조 그대로의 "깨진 자립형 HTML"이 만들어져도
// 스크립트는 exit 0으로 끝나 CI가 초록불이 된다(더블클릭 시 먹통 화면). 하중을 받는 치환은 매치를 강제한다.
function inlineOrThrow(source, pattern, replacement, label) {
  if (!source.match(pattern)) {
    throw new Error(`[robom-hq] 자립형 HTML 인라인 실패: ${label} 패턴을 찾지 못했습니다(index.html 마크업 변경?). 외부 참조가 남아 더블클릭 시 깨진 화면이 됩니다.`);
  }
  return source.replace(pattern, replacement);
}

let html = readFileSync(join(APP, "index.html"), "utf8");
html = html
  .replace(/<link rel="manifest"[^>]*>\s*/i, "")
  .replace(/<link rel="icon"[^>]*>\s*/i, "");
html = inlineOrThrow(html, /<link rel="stylesheet" href="\.\/styles\.css" \/>/i, `<style>\n${css}\n</style>`, "styles.css 인라인");
html = html.replace(/src="\.\/icon\.svg"/g, `src="${iconData}"`);
html = inlineOrThrow(html, /<script src="\.\/app\.js"><\/script>/i,
  `<script>window.__PREVIEW__=true;window.__SNAP__=${JSON.stringify(snap)};${ver ? `window.__VER__=${JSON.stringify(ver)};` : ""}</script>\n<script>\n${js}\n</script>`, "app.js 인라인");
// 휴대용 보기 안내 배너(누락돼도 기능은 정상이라 hard-fail 아님)
html = html.replace(/(<main id="screen")/,
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
let game = readFileSync(join(APP, "office.html"), "utf8").replace(/<link rel="icon"[^>]*>\s*/i, "");
game = inlineOrThrow(game, /<script src="\.\/office\.js"><\/script>/i,
  `<script>window.__PREVIEW__=true;window.__SNAP__=${JSON.stringify(snap)};${officeMap ? `window.__MAP__=${JSON.stringify(officeMap)};` : ""}</script>\n<script>\n${officeJs}\n</script>`, "office.js 인라인");
const gout = join(outDir, "로봄본부-오피스.html");
writeFileSync(gout, game);
console.log(`[robom-hq] 단일 HTML(오피스 게임): ${gout} (${Math.round(game.length / 1024)}KB, snapshot=${snapFile})`);
