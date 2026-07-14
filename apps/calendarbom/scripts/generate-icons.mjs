// icon-v2.svg 에서 PWA·iOS용 PNG 아이콘을 생성한다(Playwright Chromium 렌더).
// maskable 은 안전 영역(중앙 80%) 확보를 위해 여백을 두고 배경색으로 채운다.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

// 로컬 devDependency 가 없어도 전역 설치된 playwright 로 동작한다.
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node22/lib/node_modules/playwright/index.js");
}
const { chromium } = playwright;

const root = resolve(new URL("..", import.meta.url).pathname);
const appDir = join(root, "app");
const svg = await readFile(join(appDir, "icon-v2.svg"), "utf8");

const targets = [
  { file: "icon-192-v2.png", size: 192, pad: 0 },
  { file: "icon-512-v2.png", size: 512, pad: 0 },
  { file: "apple-touch-icon-v2.png", size: 180, pad: 0 },
  { file: "maskable-512-v2.png", size: 512, pad: 64, background: "#6a4ac2" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const target of targets) {
  const inner = target.size - target.pad * 2;
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${target.size}px;height:${target.size}px;background:${target.background || "transparent"};display:grid;place-items:center}
    svg{width:${inner}px;height:${inner}px;display:block}
  </style>${svg}`;
  await page.setViewportSize({ width: target.size, height: target.size });
  await page.setContent(html);
  const buffer = await page.screenshot({ omitBackground: !target.background, type: "png" });
  await writeFile(join(appDir, target.file), buffer);
  console.log(`${target.file} (${target.size}x${target.size}) 생성`);
}

await browser.close();
