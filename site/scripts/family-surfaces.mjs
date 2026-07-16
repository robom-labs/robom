// 로봄 웹 표면을 Chromium·WebKit의 지정 viewport와 200% 글자 확대에서 공통 검증한다.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const defaults = [
  { id: "robom", url: "https://robom.kr", expected: "로봄", action: ".quick-install-card a:first-of-type" },
  { id: "outbom", url: "https://robom-labs.github.io/outbom/", expected: "야외봄", nav: ".family-bottom-nav button:visible", settings: ".family-bottom-nav button:nth-of-type(4):visible", family: ".family-app-row" },
  { id: "homebom", url: "https://robom-labs.github.io/homebom/", expected: "청약봄", nav: ".nav__tab:visible", settings: ".nav__tab:nth-of-type(3):visible", family: "section:has(#family-apps) a.settings-row" },
  { id: "runningbom", url: "https://robom-labs.github.io/runningbom/", expected: "러닝봄", nav: ".mobile-tab:visible, .nav-pill:visible", settings: "[data-view='settings']:visible", family: "[data-family-app]" },
  { id: "calendarbom", url: "https://robom-labs.github.io/calendarbom/", expected: "캘린더봄", nav: ".mobile-tab:visible", settings: ".mobile-tab:nth-of-type(3):visible", family: "#familyAppsList > a" },
  { id: "certbom", url: "https://certbom.vercel.app", expected: "자격증봄", nav: ".bottom-nav button:visible", settings: ".bottom-nav button:nth-of-type(5):visible", family: ".family-app-list a" }
];
const surfaces = process.env.FAMILY_SURFACES_JSON ? JSON.parse(process.env.FAMILY_SURFACES_JSON) : defaults;
const browserName = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const viewports = [[320, 568], [360, 800], [375, 667], [390, 844], [412, 915], [430, 932], [768, 1024], [1024, 768], [1440, 1000]];
const outputDir = fileURLToPath(new URL(`../screenshots/family-surfaces/${browserName}/`, import.meta.url));
const browser = await browserType.launch();
const results = [];

await mkdir(outputDir, { recursive: true });

try {
  for (const surface of surfaces) {
    for (const [width, height] of viewports) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__familyVitals = { lcp: 0, cls: 0 };
        try { new PerformanceObserver((list) => { window.__familyVitals.lcp = list.getEntries().at(-1)?.startTime ?? 0; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* 미지원 */ }
        try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__familyVitals.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); } catch { /* 미지원 */ }
      });
      await page.goto(surface.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(Number(process.env.SURFACE_SETTLE_MS ?? 1_200));
      assert.match(await page.locator("body").innerText(), new RegExp(surface.expected), `${surface.id} ${width}: 핵심 문구`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${surface.id} ${width}: 가로 스크롤`);
      const bodyText = await page.locator("body").innerText();
      assert.equal(/\b(?:undefined|NaN|null)\b/.test(bodyText), false, `${surface.id} ${width}: 잘못된 값 노출`);
      if (surface.nav) {
        const nav = page.locator(surface.nav);
        assert.ok(await nav.count() >= 3, `${surface.id} ${width}: 하단 메뉴`);
        for (let index = 0; index < await nav.count(); index += 1) {
          const box = await nav.nth(index).boundingBox();
          assert.ok(box && box.width >= 48 && box.height >= 48, `${surface.id} ${width}: 하단 메뉴 ${index + 1}`);
        }
      }
      if (surface.action) {
        const action = page.locator(surface.action).first();
        const box = await action.boundingBox();
        assert.ok(box && box.width >= 48 && box.height >= 48, `${surface.id} ${width}: 주 행동`);
      }
      if (width === 390 && surface.settings && surface.family) {
        await page.locator(surface.settings).first().click();
        await page.locator(surface.family).first().waitFor({ state: "attached", timeout: 5_000 });
        assert.equal(await page.locator(surface.family).count(), 5, `${surface.id}: 설정의 다섯 앱`);
      }
      assert.deepEqual(errors, [], `${surface.id} ${width}: console 오류`);
      results.push({ id: surface.id, width, height, ...(await page.evaluate(() => window.__familyVitals)) });
      if (process.env.CAPTURE === "1" && width === 390) await page.screenshot({ path: resolve(outputDir, `${surface.id}-${width}x${height}.png`), fullPage: true });
      await context.close();
    }

    const zoomContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto(surface.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await zoomPage.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await zoomPage.waitForTimeout(250);
    assert.equal(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${surface.id}: 200% 글자 가로 스크롤`);
    await zoomContext.close();
  }

  await writeFile(resolve(outputDir, "metrics.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`${browserName}: ${surfaces.length} surfaces · ${viewports.length} viewports · overflow 0 · touch 48px+ · console 0`);
} finally {
  await browser.close();
}
