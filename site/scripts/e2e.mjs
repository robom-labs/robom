// 로봄 설치 허브의 지정 viewport·터치 영역·오버플로·QR·콘솔·웹 성능을 브라우저에서 검증한다.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const browserName = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const outputDir = fileURLToPath(new URL(`../screenshots/family-final/${browserName}/`, import.meta.url));
const externalBase = process.env.BASE_URL;
const baseUrl = externalBase || "http://127.0.0.1:4193";
const axeSource = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const familyApps = JSON.parse(await readFile(new URL("../public/family/apps.json", import.meta.url), "utf8")).apps;
const familyAppCount = familyApps.length;
const outbomApp = familyApps.find((app) => app.id === "outbom");
assert.ok(outbomApp, "outbom registry metadata missing");
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
  server = spawn("npm", ["run", "start", "--", "--port", "4193"], {
    cwd: new URL("..", import.meta.url),
    detached: process.platform !== "win32",
    stdio: "ignore",
  });
  server.unref();
  await waitForServer(baseUrl);
}

await mkdir(outputDir, { recursive: true });
// 브라우저 리비전이 고정 설치본과 다른 샌드박스에서는 PW_EXECUTABLE_PATH로 실행 파일을 지정한다(CI는 미설정).
const browser = await browserType.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {});
const results = [];

try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    // 외부망이 차단된 샌드박스에서는 로컬 origin 밖 자산 실패만 무시한다(E2E_OFFLINE=1, CI는 미설정이라 엄격 유지).
    const isExternal = (url) => process.env.E2E_OFFLINE === "1" && typeof url === "string" && /^https?:\/\//.test(url) && !url.startsWith(baseUrl);
    page.on("console", (message) => { if (message.type() === "error" && !isExternal(message.location().url) && !isExternal((message.text().match(/https?:\/\/\S+/) || [])[0])) errors.push(`${message.text()} @ ${message.location().url || "inline"}`); });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => { if (!isExternal(request.url())) errors.push(`request failed: ${request.url()} · ${request.failure()?.errorText ?? "unknown"}`); });
    await page.addInitScript(() => {
      window.__robomVitals = { lcp: 0, cls: 0, inp: 0 };
      try { new PerformanceObserver((list) => { const entries = list.getEntries(); window.__robomVitals.lcp = entries.at(-1)?.startTime ?? 0; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* 미지원 */ }
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__robomVitals.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); } catch { /* 미지원 */ }
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__robomVitals.inp = Math.max(window.__robomVitals.inp, entry.duration ?? 0); }).observe({ type: "event", buffered: true, durationThreshold: 16 }); } catch { /* 미지원 */ }
    });
    // 운영 Pages의 CSS까지 반영된 뒤 위치·오버플로를 측정해 캐시 전환 순간의 거짓 실패를 막는다.
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every((link) => link.sheet));
    await page.locator(".quick-install-card").first().waitFor();
    // QR 전용 허브: 카드마다 설치 QR 이미지와 바뀌지 않는 robom.kr/get 주소만 노출한다.
    assert.equal(await page.locator(".quick-install-card").count(), familyAppCount, `${width}: 앱 카드 수`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${width}: 가로 스크롤`);
    const cardQr = page.locator(".quick-install-card img.prelaunch-qr");
    assert.equal(await cardQr.count(), familyAppCount, `${width}: 카드 QR 이미지 수`);
    const cardQrSources = await cardQr.evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")));
    for (const src of cardQrSources) assert.match(src ?? "", /\/install\/qr\/[a-z]+\.svg/, `${width}: 카드 QR 주소 ${src}`);
    // 각 카드가 안내하는 /get/<id> 설치 링크가 카드 자체와 푸터에 존재해야 한다.
    const getLinks = page.locator('a[href*="/get/"]');
    assert.ok(await getLinks.count() >= familyAppCount, `${width}: /get 설치 링크 노출`);
    const cardAddresses = await page.locator(".quick-install-card .install-address").allInnerTexts();
    assert.equal(cardAddresses.length, familyAppCount, `${width}: 카드 설치 주소 수`);
    if (width > 760) {
      for (const address of cardAddresses) assert.match(address, /robom\.kr\/get\/[a-z]+/, `${width}: 카드 설치 주소 ${address}`);
      // 데스크톱에서는 첫 카드의 QR가 첫 화면 가까이에 있어야 한다.
      const firstAction = await cardQr.first().boundingBox();
      assert.ok(firstAction && firstAction.y < Math.max(height, 620), `${width}: 첫 카드 설치 QR가 첫 화면 가까이에 있어야 함`);
      results.push({ width, height, firstActionY: Math.round(firstAction.y) });
    } else {
      // 같은 폰에서 QR을 스캔시키지 않고, 48px 카드 버튼으로 설치 안내를 연다.
      const firstAction = await page.locator(".quick-install-card .install-address").first().boundingBox();
      assert.ok(firstAction && firstAction.height >= 48 && firstAction.y < Math.max(height, 620), `${width}: 첫 카드 설치 안내 버튼`);
      for (const [index, address] of cardAddresses.entries()) {
        const expected = familyApps[index].googlePlayStatus === "live" ? "Google Play 설치 열기" : "설치 안내 열기";
        assert.ok(address.includes(expected), `${width}: 모바일 설치 안내 문구 ${familyApps[index].id}`);
      }
      results.push({ width, height, firstActionY: Math.round(firstAction.y) });
    }
    // 하단 탭바(mobile-tabbar)는 QR 전용 개편 후에도 유지되며 48px 터치 영역을 지킨다.
    const navLinks = page.locator(".mobile-tabbar a:visible");
    for (let index = 0; index < await navLinks.count(); index += 1) {
      const box = await navLinks.nth(index).boundingBox();
      assert.ok(box && box.height >= 48, `${width}: 하단 메뉴 ${index + 1} 터치 영역`);
    }
    await page.locator('a[href*="get/outbom"]').first().focus();
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none", `${width}: 키보드 focus`);
    if (width === 390) {
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })));
      assert.deepEqual(violations, [], `홈 접근성 위반: ${JSON.stringify(violations)}`);
    }
    await page.screenshot({ path: resolve(outputDir, `home-${width}x${height}.png`), fullPage: true });
    await page.goto(`${baseUrl}/get/outbom`, { waitUntil: "domcontentloaded" });
    // registry의 실제 출시 상태에 맞는 설치 안내와 공식 주소를 노출한다.
    assert.equal(await page.locator(".qr-card img").isVisible(), true, `${width}: QR 표시`);
    const installBody = await page.locator("body").innerText();
    assert.ok(installBody.includes("robom.kr/get/outbom"), `${width}: 설치 페이지 공식 주소`);
    if (outbomApp.googlePlayStatus === "live") {
      assert.ok(installBody.includes("출시됨"), `${width}: 설치 페이지 출시 안내`);
      const storeAction = page.locator(".store-action");
      assert.equal(await storeAction.count(), 1, `${width}: 스토어 버튼`);
      assert.equal(await storeAction.getAttribute("href"), outbomApp.googlePlayUrl, `${width}: 스토어 주소`);
      assert.equal(await page.locator('a:has-text("로봄 홈으로")').count(), 0, `${width}: 준비 중 홈 링크 없음`);
    } else {
      assert.ok(installBody.includes("준비 중"), `${width}: 설치 페이지 준비 중 안내`);
      assert.ok(installBody.includes("2026년 8월 초 출시 예정"), `${width}: 설치 페이지 출시 예정 안내`);
      assert.equal(await page.locator('a:has-text("로봄 홈으로")').count(), 1, `${width}: 로봄 홈으로 링크`);
      assert.equal(await page.locator(".store-action").count(), 0, `${width}: 스토어 버튼 없음`);
    }
    assert.equal(await page.locator(".manual-install-guide").count(), 0, `${width}: 수동 설치 안내 없음`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${width}: 설치 페이지 가로 스크롤`);
    if (width === 390) {
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })));
      assert.deepEqual(violations, [], `설치 접근성 위반: ${JSON.stringify(violations)}`);
    }
    await page.screenshot({ path: resolve(outputDir, `install-outbom-${width}x${height}.png`), fullPage: true });
    assert.deepEqual(errors, [], `${width}: console errors`);
    const vitals = await page.evaluate(() => window.__robomVitals);
    Object.assign(results.at(-1), vitals);
    await context.close();
  }

  // registry에서 출시 준비 중인 앱은 QR·준비 중 안내만 노출한다.
  for (const app of familyApps.filter((item) => item.googlePlayStatus !== "live")) {
    const { id } = app;
    const prelaunchContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const prelaunchPage = await prelaunchContext.newPage();
    await prelaunchPage.goto(`${baseUrl}/get/${id}`, { waitUntil: "domcontentloaded" });
    assert.equal(await prelaunchPage.locator(".qr-card img").isVisible(), true, `${id}: QR 표시`);
    assert.ok((await prelaunchPage.locator("body").innerText()).includes("준비 중"), `${id}: 준비 중 안내`);
    assert.ok((await prelaunchPage.locator(".qr-card .install-address").innerText()).includes(`robom.kr/get/${id}`), `${id}: 공식 주소`);
    assert.equal(await prelaunchPage.locator(".store-action").count(), 0, `${id}: 스토어 버튼 없음`);
    await prelaunchContext.close();
  }

  // 출시된 앱은 같은 안정 주소에서 공식 Google Play 설치 버튼을 제공한다.
  for (const app of familyApps.filter((item) => item.googlePlayStatus === "live")) {
    const liveContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const livePage = await liveContext.newPage();
    await livePage.goto(`${baseUrl}/get/${app.id}`, { waitUntil: "domcontentloaded" });
    assert.equal(await livePage.locator(".qr-card img").isVisible(), true, `${app.id}: QR 표시`);
    assert.ok((await livePage.locator("body").innerText()).includes("출시됨"), `${app.id}: 출시 안내`);
    const storeAction = livePage.locator(".store-action");
    assert.equal(await storeAction.count(), 1, `${app.id}: 스토어 버튼`);
    assert.equal(await storeAction.getAttribute("href"), app.googlePlayUrl, `${app.id}: 스토어 주소`);
    const storeBox = await storeAction.boundingBox();
    assert.ok(storeBox && storeBox.height >= 48, `${app.id}: 스토어 버튼 터치 영역`);
    await liveContext.close();
  }

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
  if (server?.pid) {
    try {
      if (process.platform === "win32") server.kill("SIGTERM");
      else process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}
