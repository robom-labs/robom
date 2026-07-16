// 안정 설치 URL의 QR SVG·PNG를 빌드 시 생성하고 실제 디코더로 왕복 검증한다.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(resolve(root, "site/package.json"));
const QRCode = require("qrcode");
const jsQR = require("jsqr");
const { PNG } = require("pngjs");
const checkOnly = process.argv.includes("--check");
const apps = await readRegistry(new URL("../../../ops/registry/apps.yml", import.meta.url));
const outputDir = resolve(root, "site/public/install/qr");
const outputs = new Map();

for (const app of apps) {
  const options = {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
    color: { dark: "#111111", light: "#ffffff" },
  };
  const svg = await QRCode.toString(app.stable_install_url, { ...options, type: "svg" });
  const png = await QRCode.toBuffer(app.stable_install_url, { ...options, type: "png" });
  const decodedPng = PNG.sync.read(png);
  const decoded = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height, { inversionAttempts: "dontInvert" });
  if (decoded?.data !== app.stable_install_url) {
    throw new Error(`${app.id}: QR decode 불일치 (${decoded?.data ?? "읽기 실패"})`);
  }
  outputs.set(resolve(outputDir, `${app.id}.svg`), svg);
  outputs.set(resolve(outputDir, `${app.id}.png`), png);
}
outputs.set(
  resolve(outputDir, "manifest.json"),
  `${JSON.stringify({ generatedFrom: "ops/registry/apps.yml", apps: apps.map((app) => ({ id: app.id, destination: app.stable_install_url })) }, null, 2)}\n`,
);

let changed = 0;
for (const [path, desired] of outputs) {
  let actual = null;
  try { actual = await readFile(path); } catch { /* 새 생성물 */ }
  const desiredBuffer = Buffer.isBuffer(desired) ? desired : Buffer.from(desired);
  if (actual?.equals(desiredBuffer)) continue;
  changed += 1;
  if (checkOnly) {
    console.error(`drift: ${path.replace(`${root}/`, "")}`);
    continue;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, desiredBuffer);
  console.log(`generated ${path.replace(`${root}/`, "")}`);
}
if (checkOnly && changed) process.exit(1);
console.log(`QR decode pass · ${apps.length} stable destinations · ${changed} updated`);
