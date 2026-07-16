// 여섯 운영 표면의 WCAG A·AA 위반을 Chromium과 WebKit에서 같은 기준으로 검사한다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const axeSource = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const targets = [
  "https://robom.kr/",
  "https://robom-labs.github.io/outbom/",
  "https://robom-labs.github.io/homebom/",
  "https://robom-labs.github.io/runningbom/",
  "https://robom-labs.github.io/calendarbom/",
  "https://certbom.vercel.app/",
];

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const url of targets) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(1_000);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })));
      assert.deepEqual(violations, [], `${browserName} ${url}: ${JSON.stringify(violations)}`);
    }
  } finally {
    await browser.close();
  }
}

console.log(`production accessibility: 6 surfaces × 2 browsers · WCAG A/AA violations 0`);
