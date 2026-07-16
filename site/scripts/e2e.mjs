// 로봄 설치 허브의 지정 viewport·터치 영역·오버플로·QR·콘솔·웹 성능을 브라우저에서 검증한다.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const browserName = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const outputDir = fileURLToPath(new URL(`../screenshots/family-final/${browserName}/`, import.meta.url));
const externalBase = process.env.BASE_URL;
const baseUrl = externalBase || "http://127.0.0.1:4193";
const viewports = [
  [320, 568], [360, 800], [375, 667], [390, 844], [412, 915], [430, 932], [768, 1024], [1024, 768], [1440, 1000],
];
let server = null;

async function waitForServer(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* 시작 대기 */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`서버 시작 실패: ${url}`);
}

if (!externalBase) {
  server = spawn("npm", ["run", "start", "--", "--port", "4193"], { cwd: new URL("..", import.meta.url), stdio: ["ignore", "pipe", "pipe"] });
  await waitForServer(baseUrl);
}

await mkdir(outputDir, { recursive: true });
const browser = await browserType.launch();
const results = [];

try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${message.text()} @ ${message.location().url || "inline"}`); });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(`request failed: ${request.url()} · ${request.failure()?.errorText ?? "unknown"}`));
    await page.addInitScript(() => {
      window.__robomVitals = { lcp: 0, cls: 0, inp: 0 };
      try { new PerformanceObserver((list) => { const entries = list.getEntries(); window.__robomVitals.lcp = entries.at(-1)?.startTime ?? 0; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* 미지원 */ }
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__robomVitals.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); } catch { /* 미지원 */ }
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__robomVitals.inp = Math.max(window.__robomVitals.inp, entry.duration ?? 0); }).observe({ type: "event", buffered: true, durationThreshold: 16 }); } catch { /* 미지원 */ }
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".quick-install-card").first().waitFor();
    assert.equal(await page.locator(".quick-install-card").count(), 5, `${width}: 앱 카드 수`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${width}: 가로 스크롤`);
    const installLinks = page.locator(".quick-install-card > div:last-child a:first-child");
    for (let index = 0; index < await installLinks.count(); index += 1) {
      const box = await installLinks.nth(index).boundingBox();
      assert.ok(box && box.height >= 48 && box.width >= 48, `${width}: 설치 CTA ${index + 1} 터치 영역`);
    }
    const firstCta = await installLinks.first().boundingBox();
    assert.ok(firstCta && firstCta.y < Math.max(height, 620), `${width}: 첫 설치 CTA가 첫 화면 가까이에 있어야 함`);
    if (width >= 1024) {
      const lastCta = await installLinks.last().boundingBox();
      assert.ok(lastCta && lastCta.y + lastCta.height <= height + 20, `${width}: 데스크톱 첫 viewport에 다섯 앱 행동 노출`);
    }
    const navLinks = page.locator(".mobile-tabbar a:visible");
    for (let index = 0; index < await navLinks.count(); index += 1) {
      const box = await navLinks.nth(index).boundingBox();
      assert.ok(box && box.height >= 48, `${width}: 하단 메뉴 ${index + 1} 터치 영역`);
    }
    await page.locator('a[href*="get/outbom"]').first().focus();
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none", `${width}: 키보드 focus`);
    await page.screenshot({ path: resolve(outputDir, `home-${width}x${height}.png`), fullPage: true });
    await page.goto(`${baseUrl}/get/outbom`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator(".qr-card img").isVisible(), true, `${width}: QR 표시`);
    const primary = await page.locator(".store-action.primary").boundingBox();
    assert.ok(primary && primary.height >= 48, `${width}: 설치 주 CTA 48px`);
    assert.match(await page.locator(".qr-card a").textContent(), /https:\/\/robom\.kr\/get\/outbom/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${width}: 설치 페이지 가로 스크롤`);
    await page.screenshot({ path: resolve(outputDir, `install-outbom-${width}x${height}.png`), fullPage: true });
    assert.deepEqual(errors, [], `${width}: console errors`);
    const vitals = await page.evaluate(() => window.__robomVitals);
    results.push({ width, height, ...vitals, firstCtaY: Math.round(firstCta.y) });
    await context.close();
  }

  const iosContext = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
  const iosPage = await iosContext.newPage();
  await iosPage.goto(`${baseUrl}/get/calendarbom`, { waitUntil: "domcontentloaded" });
  await iosPage.locator(".store-action.primary", { hasText: "Safari에서 캘린더봄 열기" }).waitFor();
  assert.match(await iosPage.locator(".store-action.primary").textContent(), /Safari에서 캘린더봄 열기/);
  assert.match(await iosPage.locator(".manual-install-guide").textContent(), /홈 화면에 추가/);
  await iosContext.close();

  const androidContext = await browser.newContext({ viewport: { width: 412, height: 915 }, userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36" });
  const androidPage = await androidContext.newPage();
  await androidPage.goto(`${baseUrl}/get/runningbom`, { waitUntil: "domcontentloaded" });
  await androidPage.locator(".store-action.primary", { hasText: "러닝봄 열고 설치" }).waitFor();
  assert.match(await androidPage.locator(".store-action.primary").textContent(), /러닝봄 열고 설치/);
  await androidContext.close();

  const zoomContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const zoomPage = await zoomContext.newPage();
  await zoomPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await zoomPage.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, "200% 글자 확대 가로 스크롤");
  await zoomContext.close();

  const authContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const authPage = await authContext.newPage();
  await authPage.goto(`${baseUrl}/auth/callback?code=must-not-render&state=must-not-render`, { waitUntil: "domcontentloaded" });
  await authPage.waitForFunction(() => location.search === "");
  assert.equal((await authPage.locator("body").innerText()).includes("must-not-render"), false, "인증 query 화면 노출 금지");
  await authContext.close();

  await writeFile(resolve(outputDir, "metrics.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`${browserName}: ${viewports.length} viewports · overflow 0 · touch 48px+ · console error 0`);
} finally {
  await browser.close();
  if (server) server.kill("SIGTERM");
}
