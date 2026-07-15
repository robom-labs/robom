// V6 E2E: 대표 과제 A~E + v1 마이그레이션 + 질문 예산 + 뷰포트·확대 스윕 + 스크린샷 12장.
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
const shot = async (page, name) => {
  if (shotDir) await page.screenshot({ path: join(shotDir, name), fullPage: false });
};

function dateKeyOffset(days) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) consoleErrors.push(message.text());
});

// ── 회귀: v1 데이터가 있는 상태로 처음 열기 → v2 이사 + v1 보존 ──
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("calendarbom:events:v1", JSON.stringify({
    version: 1,
    events: [{ id: "old-1", title: "옛 병원 예약", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: "15:00", reminders: [0], done: false, createdAt: 1 }],
  }));
});
await page.reload({ waitUntil: "networkidle" });
const migration = await page.evaluate(() => ({
  v1: Boolean(localStorage.getItem("calendarbom:events:v1")),
  v2: JSON.parse(localStorage.getItem("calendarbom:data:v2") || "null"),
}));
check("v1→v2 마이그레이션: v1 원본 보존", migration.v1);
check("v1→v2 마이그레이션: 제목·시간 유지", Boolean(migration.v2) && migration.v2.series.length === 1 && migration.v2.series[0].title === "옛 병원 예약" && migration.v2.series[0].slots[0].time === "15:00");
check("마이그레이션 일정이 달력 미리보기에 보임", (await page.locator("#todayPanel").innerText()).includes("옛 병원 예약"));

// 깨끗한 상태에서 과제 시작
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
check("페이지 제목", (await page.title()).includes("캘린더봄"));
check("달력 셀 35개 이상", (await page.locator("#calendarGrid .day-cell").count()) >= 35);

const tapCounter = { count: 0 };
async function tap(locator) {
  tapCounter.count += 1;
  await locator.click();
}

// ── 과제 A: 70대 첫 사용자 — 내 병원 (필수 결정 2~3) ──
const dayA = dateKeyOffset(3);
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
check("날짜 탭 → 구체적 질문", (await page.locator("#sheetBody").innerText()).includes("어떤 일정을 추가할까요?"));
check("첫 화면 기본 선택지 6개", (await page.locator("#sheetBody [data-template]").count()) === 6);
await shot(page, "04-add-simple-event.png");

tapCounter.count = 0;
await tap(page.locator('#sheetBody [data-template="hospital"]')); // 결정 1
check("병원: 사람을 먼저 묻지 않음", (await page.locator("#sheetBody").innerText()).includes("몇 시에 가나요?"));
await tap(page.locator('#sheetBody [data-quick-time="15:00"]')); // 결정 2
check("요약에 자동 기본값 표시(나·이번만·정각·나만 보기)", await page.locator("#sheetBody").innerText().then((t) => t.includes("나") && t.includes("이번만") && t.includes("정각") && t.includes("나만 보기")));
await tap(page.locator("#sheetSaveButton")); // 저장
check(`과제 A: 탭 ${tapCounter.count}회 (예산 4 이내)`, tapCounter.count <= 4);
const toastA = await page.locator("#toast").innerText();
check("과제 A: 자연어 확인 문장", /오후 3시, “병원” 알람을 저장했어요\./.test(toastA));
check("과제 A: 달력에 점 표시", (await page.locator(`#calendarGrid [data-date="${dayA}"] .day-dots i`).count()) >= 1);

// ── 과제 B: 엄마 약 하루 두 번 (첫 등록 결정 4 이내 + 사람 추가) ──
const dayB = dateKeyOffset(0); // 오늘부터 매일
await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
tapCounter.count = 0;
await tap(page.locator('#sheetBody [data-template="medication"]')); // 결정 1
await tap(page.locator('#sheetBody [data-med-count="2"]')); // 결정 2
check("약: 아침·저녁 기본 시간이 채워져 보임", await page.locator("#sheetBody").innerText().then((t) => t.includes("아침") && t.includes("오전 8시") && t.includes("저녁") && t.includes("오후 7시")));
check("약: 처방 안내 문구", (await page.locator("#sheetBody").innerText()).includes("처방받은 안내에 맞게"));
await shot(page, "05-add-medication.png");
await tap(page.locator("#sheetBody [data-step-ok]")); // 결정 3(시간 확인)
// 누가: 나 → 엄마 (기본값 변경)
await tap(page.locator('#sheetBody [data-expand="person"]'));
await tap(page.locator('#sheetBody [data-add-person="person"]'));
await page.fill("#personNameInput", "엄마");
await tap(page.locator('#sheetBody [data-person-save="person"]'));
check("약: 반복 기본 매일 표시", (await page.locator("#sheetBody").innerText()).includes("매일"));
check("약: 이름 입력 없이 저장 가능(엄마 약)", (await page.locator("#sheetBody").innerText()).includes("엄마 약"));
await tap(page.locator("#sheetSaveButton"));
check("과제 B: 엄마 약 저장 문장", /엄마 약/.test(await page.locator("#toast").innerText()));

// 오늘 날짜 시트에서 복용 확인
await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
check("약: 하루 두 번이 한 묶음+시간별 행", (await page.locator("#sheetBody .dose-row").count()) === 2);
await page.locator("#sheetBody [data-dose-done]").first().click();
check("약: 먹었어요 기록", (await page.locator("#sheetBody").innerText()).includes("먹었어요"));
await page.locator("#sheetBody [data-dose-snooze]").first().click();
await page.locator('#sheetBody [data-snooze-min="10"]').first().click();
check("약: 조금 있다가 10분", (await page.locator("#sheetBody").innerText()).includes("조금 있다가"));
await page.locator("#sheetCloseButton").click();
check("약: 달력은 묶음 1개 표시(점 1)", (await page.locator(`#calendarGrid [data-date="${dayB}"] .day-dots i`).count()) === 1);

// ── 과제 C: 연인 기념일 — 100일·1주년만 선택 (결정 4 이내) ──
const dayC = dateKeyOffset(-10); // 사귀기 시작한 날(과거)
const cellC = page.locator(`#calendarGrid [data-date="${dayC}"]`);
if ((await cellC.count()) > 0) {
  await cellC.first().click();
  await page.waitForSelector("#daySheet:not([hidden])");
  tapCounter.count = 0;
  await tap(page.locator('#sheetBody [data-template="anniversary"]')); // 결정 1
  await tap(page.locator('#sheetBody [data-add-person="ann"]'));
  await page.fill("#personNameInput", "지연");
  await tap(page.locator('#sheetBody [data-person-save="ann"]')); // 결정 2(사람)
  await tap(page.locator('#sheetBody [data-ann-type="couple"]')); // 결정 3(어떤 날)
  check("기념일: 추천 최대 4개(3+다른 날)", (await page.locator("#sheetBody [data-ann-pick]").count()) <= 4);
  await tap(page.locator("#sheetBody [data-ann-pick]").first()); // 100일
  check("기념일: 계산 확인 문장", (await page.locator("#sheetBody").innerText()).includes("1일째로 계산해요"));
  await shot(page, "06-add-anniversary.png");
  await tap(page.locator("#sheetBody [data-ann-pick]").nth(2)); // 1주년
  await tap(page.locator("#sheetBody [data-step-ok]")); // 결정 4(이 날들로)
  await tap(page.locator("#sheetSaveButton"));
  const annCount = await page.evaluate(() => JSON.parse(localStorage.getItem("calendarbom:data:v2")).series.filter((s) => s.kind === "anniversary").length);
  check("과제 C: 고른 기념일만 생성(2개)", annCount === 2);
} else {
  check("과제 C: 기준일 셀이 이번 달 grid 안에 있음", false);
}

// ── 과제 D: 지난번과 같게 (결정 1~2) ──
const dayD = dateKeyOffset(5);
await page.locator(`#calendarGrid [data-date="${dayD}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
await shot(page, "08-recent-and-repeat.png");
tapCounter.count = 0;
const hospitalRecent = page.locator("#sheetBody [data-recent]", { hasText: "병원" }).first();
check("과제 D: 최근 일정 칩 존재(병원)", (await hospitalRecent.count()) > 0);
await tap(hospitalRecent); // 결정 1
check("과제 D: 값이 채워져 요약 확인만 남음", (await page.locator("#sheetBody").innerText()).includes("이대로 저장할까요?"));
await tap(page.locator("#sheetSaveButton"));
check(`과제 D: 탭 ${tapCounter.count}회 (예산 2 이내)`, tapCounter.count <= 2);

// ── 과제 E: 일정 한 건 공유 + 시간 수정 ──
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
await page.locator("#sheetBody button.event-row", { hasText: "병원" }).first().click();
check("상세: 수정·복사·공유·삭제", await page.locator("#sheetBody").innerText().then((t) => t.includes("시간 바꾸기") && t.includes("복사") && t.includes("공유") && t.includes("삭제")));
check("상세: 병원은 다음 일정 만들기", (await page.locator("#sheetBody").innerText()).includes("다음 일정 만들기"));
await page.locator('#sheetBody [data-act="share"]').click();
const shareText = await page.locator(".share-preview").innerText();
check("공유: 해당 일정만 + 제외 안내", shareText.includes("병원") && (await page.locator("#sheetBody").innerText()).includes("공유하지 않는 것"));
check("공유: 다른 일정 내용 미포함", !shareText.includes("엄마 약") && !shareText.includes("지연"));
await shot(page, "11-share-preview.png");
await page.locator('#sheetBody [data-act="share-back"]').click();

await page.locator('#sheetBody [data-act="edit-time"]').click();
await shot(page, "07-time-picker.png");
await page.locator("#sheetBody [data-detail-adjust]").first().click(); // −10분
await page.locator('#sheetBody [data-act="edit-time-save"]').click();
await page.locator("#sheetCloseButton").click();
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
check("수정: 시간이 오후 2시 50분으로", (await page.locator("#sheetBody").innerText()).includes("오후 2시 50분"));
await page.locator("#sheetCloseButton").click();

// ── 되돌리기: 삭제 후 undo ──
await page.locator(`#calendarGrid [data-date="${dayD}"]`).first().click();
await page.locator("#sheetBody button.event-row", { hasText: "병원" }).first().click();
await page.locator('#sheetBody [data-act="delete"]').click();
await page.locator("#undoButton").click();
check("삭제 되돌리기: 일정 복구", (await page.locator(`#calendarGrid [data-date="${dayD}"] .day-dots i`).count()) >= 1);

// ── 입력 유지: 시트 중간에 닫아도 draft 복원 ──
const dayF = dateKeyOffset(7);
await page.locator(`#calendarGrid [data-date="${dayF}"]`).first().click();
await page.locator('#sheetBody [data-template="meeting"]').click();
await page.locator('#sheetBody [data-add-person="with"]').click();
await page.fill("#personNameInput", "민수");
await page.locator('#sheetBody [data-person-save="with"]').click();
await page.locator("#sheetCloseButton").click(); // 시간 단계에서 닫음
await page.locator(`#calendarGrid [data-date="${dayF}"]`).first().click();
check("초안 복원: 민수와 약속 이어서", (await page.locator("#sheetBody").innerText()).includes("민수"));
await page.locator("#sheetCloseButton").click();

// ── 알림 탭 ──
await page.locator('.mobile-tab[data-view="alerts"]').click();
const alertsText = await page.locator("#view-alerts").innerText();
check("알림 탭: 다음 일정 크게", alertsText.includes("지금 다음 일정"));
check("알림 탭: 오늘 약 확인 버튼", alertsText.includes("먹었어요") || alertsText.includes("조금 있다가"));
await shot(page, "09-alerts.png");

// ── 설정·글자 크기 ──
await page.locator('.mobile-tab[data-view="settings"]').click();
await shot(page, "10-settings.png");
await page.locator('.font-scale-btn[data-font="xl"]').click();
check("아주 크게 반영", (await page.evaluate(() => document.documentElement.dataset.font)) === "xl");
await page.locator('.mobile-tab[data-view="calendar"]').click();
await shot(page, "03-calendar-large-text-390.png");
const xlScroll = await page.evaluate(() => document.scrollingElement.scrollWidth);
check(`아주 크게 무가로스크롤 (scrollWidth=${xlScroll})`, xlScroll <= 390);
await page.locator('.mobile-tab[data-view="settings"]').click();
await page.locator('.font-scale-btn[data-font="normal"]').click();
await page.locator('.mobile-tab[data-view="calendar"]').click();

// ── 새로고침 후 데이터 유지 ──
await page.reload({ waitUntil: "networkidle" });
check("새로고침 후 일정 유지", (await page.locator(`#calendarGrid [data-date="${dayA}"] .day-dots i`).count()) >= 1);
await shot(page, "02-calendar-events-390.png");

// ── 키보드 조작 ──
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().focus();
await page.keyboard.press("Enter");
check("키보드: Enter 로 시트 열림", (await page.locator("#daySheet").getAttribute("hidden")) === null);
await page.keyboard.press("Escape");
check("키보드: Escape 로 닫힘", (await page.locator("#daySheet").getAttribute("hidden")) !== null);

check("콘솔 오류 없음", consoleErrors.length === 0);
if (consoleErrors.length) console.log(consoleErrors.join("\n"));

// ── 뷰포트 스윕 ──
for (const width of [320, 360, 390, 430, 768, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(120);
  const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`무가로스크롤 @${width}px (scrollWidth=${scrollWidth})`, scrollWidth <= width);
}

// 320px 빈 달력 + 저장 흐름 (새 컨텍스트)
const fresh = await browser.newContext({ viewport: { width: 320, height: 800 }, locale: "ko-KR" });
const freshPage = await fresh.newPage();
await freshPage.goto(BASE, { waitUntil: "networkidle" });
await shot(freshPage, "01-calendar-empty-320.png");
await freshPage.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
await freshPage.locator('[data-template="hospital"]').click();
await freshPage.locator('[data-quick-time="15:00"]').click();
check("320px: 저장 버튼이 화면에 보임(sticky)", await freshPage.locator("#sheetSaveButton").isVisible());
await fresh.close();

// 200% 확대(reflow): 640px 화면 + zoom 2 = 실질 320px
const zoomCtx = await browser.newContext({ viewport: { width: 640, height: 900 }, locale: "ko-KR" });
const zoomPage = await zoomCtx.newPage();
await zoomPage.goto(BASE, { waitUntil: "networkidle" });
await zoomPage.evaluate(() => { document.documentElement.style.zoom = "2"; });
await zoomPage.waitForTimeout(150);
const zoomOverflow = await zoomPage.evaluate(() => {
  const el = document.scrollingElement;
  return { scroll: el.scrollWidth, client: el.clientWidth };
});
check(`200% 확대 무가로스크롤 (scroll=${zoomOverflow.scroll}, client=${zoomOverflow.client})`, zoomOverflow.scroll <= zoomOverflow.client + 1);
await zoomPage.locator(`#calendarGrid .day-cell`).nth(10).click();
check("200% 확대: 시트 진입 가능", (await zoomPage.locator("#sheetBody").innerText()).includes("어떤 일정"));
await shot(zoomPage, "12-font-200-percent.png");
await zoomCtx.close();

await browser.close();
if (failures.length > 0) {
  console.error(`\nE2E 실패 ${failures.length}건:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nE2E 전체 통과");
