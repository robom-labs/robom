// 로컬 E2E 스모크: 달력 → 날짜 시트 → 저장 → 알림 탭 확인 + 뷰포트 무가로스크롤 스윕.
// 사용: node scripts/serve.mjs 4177 & node scripts/e2e.mjs [스크린샷 디렉터리]
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node22/lib/node_modules/playwright/index.js");
}
const { chromium } = playwright;

const BASE = process.env.CALENDARBOM_URL || "http://localhost:4177/";
const shotDir = process.argv[2] || null;
if (shotDir) await mkdir(shotDir, { recursive: true });

const failures = [];
const check = (name, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) failures.push(name);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(String(error)));
page.on("console", (message) => {
  // 리소스 로드 실패(폰트 CDN 차단 등 환경 요인)는 앱 오류로 치지 않는다.
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) consoleErrors.push(message.text());
});

await page.goto(BASE, { waitUntil: "networkidle" });
check("페이지 제목", (await page.title()).includes("캘린더봄"));
check("월 제목 표시", /\d{4}년 \d{1,2}월/.test(await page.locator("#monthTitle").innerText()));
check("달력 셀 35개 이상", (await page.locator("#calendarGrid .day-cell").count()) >= 35);
check("오늘 셀 강조", (await page.locator("#calendarGrid .day-cell.today").count()) === 1);

// 날짜 시트: 내일 셀을 눌러 빠른 추가 흐름을 저장까지 진행한다.
// (오늘 오후 3시는 실행 시각에 따라 이미 지났을 수 있어 D-day 검증이 흔들린다.)
const tomorrowKey = (() => {
  const date = new Date(Date.now() + 86400000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
})();
await page.locator(`#calendarGrid [data-date="${tomorrowKey}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
const sheetTitle = await page.locator("#sheetDateTitle").innerText();
check("시트 자연어 날짜", /\d{1,2}월 \d{1,2}일 .요일/.test(sheetTitle));

await page.locator('#titleChipGrid [data-title="병원"]').click();
await page.locator('#hourGrid [data-hour="3"]').click();
await page.locator('#quickAddForm').evaluate((form) => form.requestSubmit());
await page.waitForSelector("#daySheet[hidden]", { state: "attached" });
const toast = await page.locator("#toast").innerText();
check("자연어 확인 문장", /오후 3시, “병원” 알람을 저장했어요\./.test(toast));
check("달력에 일정 점 표시", (await page.locator(`#calendarGrid [data-date="${tomorrowKey}"] .day-dots i`).count()) >= 1);

// 알림 탭
await page.locator('.mobile-tab[data-view="alerts"]').click();
const alertsText = await page.locator("#alertList").innerText();
check("알림 탭에 D-day 카드", alertsText.includes("내일") && alertsText.includes("병원"));

// 설정 탭: 글자 크기 아주 크게
await page.locator('.mobile-tab[data-view="settings"]').click();
await page.locator('.font-scale-btn[data-font="xl"]').click();
check("글자 크기 반영", (await page.evaluate(() => document.documentElement.dataset.font)) === "xl");
await page.locator('.font-scale-btn[data-font="normal"]').click();

// 새로고침 후 데이터 유지
await page.reload({ waitUntil: "networkidle" });
check("새로고침 후 일정 유지", (await page.locator(`#calendarGrid [data-date="${tomorrowKey}"] .day-dots i`).count()) >= 1);

check("콘솔 오류 없음", consoleErrors.length === 0);
if (consoleErrors.length) console.log(consoleErrors.join("\n"));

// 뷰포트 스윕: 가로 스크롤 금지 + 스크린샷
for (const width of [320, 360, 390, 430, 768, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(120);
  const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`무가로스크롤 @${width}px (scrollWidth=${scrollWidth})`, scrollWidth <= width);
  if (shotDir) await page.screenshot({ path: join(shotDir, `calendar-${width}.png`), fullPage: false });
}

if (shotDir) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#calendarGrid .day-cell.today").click();
  await page.waitForSelector("#daySheet:not([hidden])");
  await page.screenshot({ path: join(shotDir, "sheet-390.png") });
  await page.locator("#sheetCloseButton").click();
  await page.locator('.mobile-tab[data-view="alerts"]').click();
  await page.screenshot({ path: join(shotDir, "alerts-390.png") });
  await page.locator('.mobile-tab[data-view="settings"]').click();
  await page.screenshot({ path: join(shotDir, "settings-390.png") });
}

await browser.close();
if (failures.length > 0) {
  console.error(`\nE2E 실패 ${failures.length}건:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nE2E 전체 통과");
