// 일곱 운영 표면의 WCAG A·AA 위반을 Chromium과 WebKit에서 같은 기준으로 검사한다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const axeSource = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const defaults = [
  "https://robom.kr/",
  "https://robom-labs.github.io/outbom/",
  "https://robom-labs.github.io/homebom/",
  "https://robom-labs.github.io/runningbom/",
  "https://certbom.vercel.app/",
];
const targets = process.env.A11Y_TARGETS_JSON ? JSON.parse(process.env.A11Y_TARGETS_JSON) : defaults;

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch();
  try {
    for (const url of targets) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(1_500);
        await page.addScriptTag({ content: axeSource });
        const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })));
        assert.deepEqual(violations, [], `${browserName} ${url}: ${JSON.stringify(violations)}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

console.log(`production accessibility: ${targets.length} surfaces × 2 browsers · WCAG A/AA violations 0`);
