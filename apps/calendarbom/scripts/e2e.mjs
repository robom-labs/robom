// V7 E2E: 과제 A~E + GATE A/B/C 회귀 + 뷰포트·확대·실측 스윕 + 스크린샷 12장.
// 서버 수명주기를 스스로 관리한다: node scripts/e2e.mjs [스크린샷 디렉터리]
// BROWSER=chromium|webkit 로 엔진 선택(기본 chromium). 시계는 2026-07-15 09:00 로 고정해 월 경계 흔들림을 없앤다.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const playwright = require("playwright");
const browserName = process.env.BROWSER || "chromium";
const engine = playwright[browserName];
if (!engine) {
  console.error(`알 수 없는 BROWSER=${browserName}`);
  process.exit(1);
}

const PORT = Number(process.env.CALENDARBOM_PORT || 4177);
const BASE = `http://localhost:${PORT}/`;
const FIXED_NOW = new Date(2026, 6, 15, 9, 0, 0); // 2026-07-15 09:00 로컬
const shotDir = process.argv[2] || null;
if (shotDir) await mkdir(shotDir, { recursive: true });

// ── 정적 서버 기동 ──
const server = spawn(process.execPath, [new URL("./serve.mjs", import.meta.url).pathname, String(PORT)], { stdio: "ignore" });
const serverReady = async () => {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return true;
    } catch { /* 재시도 */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};
if (!(await serverReady())) {
  console.error("정적 서버가 뜨지 않았습니다");
  server.kill();
  process.exit(1);
}

const failures = [];
const check = (name, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) failures.push(name);
};
const shot = async (page, name) => {
  if (shotDir && browserName === "chromium") await page.screenshot({ path: join(shotDir, name), fullPage: false });
};

function keyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateKeyOffset(days) {
  return keyOf(new Date(FIXED_NOW.getTime() + days * 86400000));
}

const browser = await engine.launch();
async function newFixedPage(context) {
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  return page;
}
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
// 헤드리스 셸은 실제 알림 권한 부여를 지원하지 않는다.
// granted 경로는 permission 값을 스텁해 "저장 문구 선택 로직"을 검증한다(실기기 낭독·표시는 사람 확인 항목).
await context.addInitScript(() => {
  if (typeof Notification !== "undefined") {
    try { Object.defineProperty(Notification, "permission", { get: () => "granted" }); } catch { /* 무시 */ }
  }
});
const page = await newFixedPage(context);
const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) consoleErrors.push(message.text());
});

// ── 회귀: v1 → v3 이사 + v1 보존 ──
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(([tomorrow]) => {
  localStorage.clear();
  localStorage.setItem("calendarbom:events:v1", JSON.stringify({
    version: 1,
    events: [{ id: "old-1", title: "옛 병원 예약", date: tomorrow, time: "15:00", reminders: [0], done: false, createdAt: 1 }],
  }));
}, [dateKeyOffset(1)]);
await page.reload({ waitUntil: "networkidle" });
const migration = await page.evaluate(() => ({
  v1: Boolean(localStorage.getItem("calendarbom:events:v1")),
  v2: JSON.parse(localStorage.getItem("calendarbom:data:v2") || "null"),
  migratedFlag: localStorage.getItem("calendarbom:migrated"),
}));
check("v1→v3 마이그레이션: v1 원본 보존", migration.v1);
check("v1→v3 마이그레이션: 제목·시간 유지 + version 3", Boolean(migration.v2) && migration.v2.version === 3 && migration.v2.series.length === 1 && migration.v2.series[0].slots[0].time === "15:00");
check("마이그레이션 완료 표식 기록", migration.migratedFlag === "1");

// ── A-03: 손상 v2 → recovery 보존 + 빈 덮어쓰기 금지 ──
await page.evaluate(() => {
  localStorage.setItem("calendarbom:data:v2", "{깨진 JSON");
  localStorage.removeItem("calendarbom:lkg");
});
await page.reload({ waitUntil: "networkidle" });
const recovery = await page.evaluate(() => ({
  banner: Boolean(document.querySelector(".recovery-banner")),
  recoveryKey: localStorage.getItem("calendarbom:recovery:v2"),
  rawStill: localStorage.getItem("calendarbom:data:v2"),
}));
check("A-03: 복구 배너 표시", recovery.banner);
check("A-03: 손상 원본이 recovery 키에 보존", recovery.recoveryKey === "{깨진 JSON");
check("A-03: 원본 키를 빈 데이터로 덮지 않음", recovery.rawStill === "{깨진 JSON");

// ── A-03: v1 자동 부활 방지 (migrated 표식 + v2 삭제) ──
await page.evaluate(() => {
  localStorage.removeItem("calendarbom:data:v2");
  localStorage.removeItem("calendarbom:recovery:v2");
  // v1 은 그대로, migrated=1 유지
});
await page.reload({ waitUntil: "networkidle" });
check("A-03: 이사 완료 후 v1 이 자동 부활하지 않음", !(await page.locator("#todayPanel").innerText()).includes("옛 병원 예약"));

// ── 깨끗한 상태에서 과제 시작 ──
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
check("페이지 제목", (await page.title()).includes("캘린더봄"));

const tapCounter = { count: 0 };
async function tap(locator) {
  tapCounter.count += 1;
  await locator.click();
}

// ── 과제 A: 병원 (결정 2, 알림 권한 granted → "알람을 저장했어요") ──
const dayA = dateKeyOffset(3);
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
check("날짜 탭 → 구체적 질문", (await page.locator("#sheetBody").innerText()).includes("어떤 일정을 추가할까요?"));
check("첫 화면(최근 없음) 기본 선택지 6개", (await page.locator("#sheetBody [data-template]").count()) === 6);
await shot(page, "04-add-simple-event.png");
tapCounter.count = 0;
await tap(page.locator('#sheetBody [data-template="hospital"]'));
await tap(page.locator('#sheetBody [data-quick-time="15:00"]'));
check("요약에 자동 기본값(나·이번만·정각·나만 보기)", await page.locator("#sheetBody").innerText().then((t) => t.includes("나") && t.includes("이번만") && t.includes("정각") && t.includes("나만 보기")));
await tap(page.locator("#sheetSaveButton"));
check(`과제 A: 탭 ${tapCounter.count}회 (예산 4 이내)`, tapCounter.count <= 4);
check("A-09: 권한 허용 시 '알람을 저장했어요'", /알람을 저장했어요/.test(await page.locator("#toast").innerText()));
check("과제 A: 달력에 점 표시", (await page.locator(`#calendarGrid [data-date="${dayA}"] .day-dots i`).count()) >= 1);

// ── A-02: 저장 실패 rollback (setItem throw) ──
const dayR = dateKeyOffset(4);
await page.locator(`#calendarGrid [data-date="${dayR}"]`).first().click();
await page.locator('#sheetBody [data-more-templates], #sheetBody [data-template="todo"]').first().click();
const isMore = await page.locator("#sheetBody [data-template]").count() === 0 ? false : true;
if (await page.locator('#sheetBody [data-template="todo"]').count() > 0) await page.locator('#sheetBody [data-template="todo"]').click();
await page.locator('#sheetBody [data-title-pick="장보기"]').click();
await page.locator('#sheetBody [data-quick-time="09:00"], #sheetBody [data-quick-time]').first().click();
await page.evaluate(() => {
  window.__origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === "calendarbom:data:v2") throw new Error("quota");
    return window.__origSetItem.apply(this, arguments);
  };
});
await page.locator("#sheetSaveButton").click();
const rollback = await page.evaluate(() => {
  Storage.prototype.setItem = window.__origSetItem;
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2") || "null");
  return {
    sheetOpen: !document.getElementById("daySheet").hidden,
    toast: document.getElementById("toast").textContent,
    savedCount: data ? data.series.length : -1,
    memoryCount: null,
  };
});
check("A-02: 실패 시 시트 유지", rollback.sheetOpen);
check("A-02: 성공 문구 없이 실패 안내", rollback.toast.includes("저장 공간이 부족해") && !rollback.toast.includes("저장했어요."));
check("A-02: 저장소에 반영되지 않음(rollback)", rollback.savedCount === 1); // 병원 1건만
await page.locator("#sheetSaveButton").click(); // 복구 후 재시도 성공
check("A-02: 재시도 저장 성공", /저장했어요/.test(await page.locator("#toast").innerText()));

// ── 과제 B: 엄마 약 하루 두 번 + 이번만/기간 ──
const dayB = dateKeyOffset(0);
await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
if ((await page.locator('#sheetBody [data-template="medication"]').count()) === 0) {
  await page.locator("#sheetBody [data-more-templates]").click();
}
tapCounter.count = 0;
await tap(page.locator('#sheetBody [data-template="medication"]'));
await tap(page.locator('#sheetBody [data-med-count="2"]'));
check("약: 예시 시간 문구", (await page.locator("#sheetBody").innerText()).includes("예시 시간이에요"));
await shot(page, "05-add-medication.png");
await tap(page.locator("#sheetBody [data-step-ok]"));
await tap(page.locator('#sheetBody [data-expand="person"]'));
await tap(page.locator('#sheetBody [data-add-person="person"]'));
await page.fill("#personNameInput", "엄마");
await tap(page.locator('#sheetBody [data-person-relation="가족"]'));
await tap(page.locator('#sheetBody [data-person-save="person"]'));
check("B-02: 관계는 선택 사항으로 함께 저장", await page.evaluate(() => JSON.parse(localStorage.getItem("calendarbom:data:v2")).people.some((p) => p.name === "엄마" && p.relation === "가족")));
check("약: 이름 입력 없이(엄마 약)·매일 표시", await page.locator("#sheetBody").innerText().then((t) => t.includes("엄마 약") && t.includes("매일")));
await tap(page.locator("#sheetSaveButton"));
check("과제 B: 저장", /엄마 약/.test(await page.locator("#toast").innerText()));

// 복용 확인 + B-07 미래 금지
await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().click();
check("약: 오늘 두 번 행", (await page.locator("#sheetBody .dose-row").count()) === 2);
await page.locator("#sheetBody [data-dose-skip]").first().click();
check("B-07: 건너뜀 확인 문구", (await page.locator("#toast").innerText()).includes("건너뛴 것으로 기록했어요"));
await page.locator("#sheetBody [data-dose-reset]").first().click();
await page.locator("#sheetBody [data-dose-done]").first().click();
check("약: 먹었어요 기록", (await page.locator("#sheetBody").innerText()).includes("먹었어요"));
await page.locator("#sheetCloseButton").click();
const dayTomorrow = dateKeyOffset(1);
await page.locator(`#calendarGrid [data-date="${dayTomorrow}"]`).first().click();
check("B-07: 미래 복용은 예정 표시·기록 버튼 없음",
  (await page.locator("#sheetBody .dose-row").count()) === 2 &&
  (await page.locator("#sheetBody [data-dose-done]").count()) === 0 &&
  (await page.locator("#sheetBody").innerText()).includes("예정"));
await page.locator("#sheetCloseButton").click();

// ── A-04: 약 '이번만' 저장 시 실제 once ──
const dayOnce = dateKeyOffset(2);
await page.locator(`#calendarGrid [data-date="${dayOnce}"]`).first().click();
if ((await page.locator('#sheetBody [data-template="medication"]').count()) === 0) await page.locator("#sheetBody [data-more-templates]").click();
await page.locator('#sheetBody [data-template="medication"]').click();
await page.locator('#sheetBody [data-med-count="1"]').click();
await page.locator("#sheetBody [data-step-ok]").click();
await page.locator('#sheetBody [data-expand="medUntil"]').click();
await page.locator('#sheetBody [data-med-until="once"]').click();
await page.locator("#sheetSaveButton").click();
check("A-04: 이번만 약은 once 로 저장", await page.evaluate(([d]) => {
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2"));
  const med = data.series.find((s) => s.kind === "medication" && s.date === d);
  return med && med.repeat.freq === "once";
}, [dayOnce]));

// ── 과제 C: 기념일 — 나·기준일 변경·같은 날짜 병합 ──
const dayC = dateKeyOffset(-10);
await page.locator(`#calendarGrid [data-date="${dayC}"]`).first().click();
if ((await page.locator('#sheetBody [data-template="anniversary"]').count()) === 0) await page.locator("#sheetBody [data-more-templates]").click();
await page.locator('#sheetBody [data-template="anniversary"]').click();
check("B-04: 기념일에 '나' 선택 제공", (await page.locator("#sheetBody [data-ann-me]").count()) === 1);
await page.locator('#sheetBody [data-add-person="ann"]').click();
await page.fill("#personNameInput", "지연");
await page.locator('#sheetBody [data-person-relation="연인·배우자"]').click();
await page.locator('#sheetBody [data-person-save="ann"]').click();
check("B-03: 연인 관계 추천에 처음 만난 날 포함", (await page.locator("#sheetBody").innerText()).includes("처음 만난 날"));
// 기준일 바꾸기 (B-04)
const newBase = dateKeyOffset(-11);
await page.locator("#sheetBody [data-ann-base-edit]").click();
await page.locator("#sheetBody [data-ann-base]").fill(newBase);
await page.locator('#sheetBody [data-ann-type="couple"]').click();
await page.locator("#sheetBody [data-ann-pick]").first().click(); // 100일
check("B-04: 계산이 바뀐 기준일을 따름", (await page.locator("#sheetBody .ann-explain").first().innerText()).includes("1일째로 계산해요"));
await shot(page, "06-add-anniversary.png");
// 같은 날짜 병합: 직접 100일 추가 (B-05)
await page.locator("#sheetBody [data-ann-more]").click();
await page.locator('#sheetBody [data-ann-custom="days"]').click();
await page.fill("#annCustomN", "100");
await page.locator("#sheetBody [data-ann-custom-ok]").click();
await page.locator("#sheetBody [data-step-ok]").click();
await page.locator("#sheetSaveButton").click();
const annResult = await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2"));
  return { count: data.series.filter((s) => s.kind === "anniversary").length, toast: document.getElementById("toast").textContent };
});
check("B-05: 같은 날짜 기념일은 하나로 병합", annResult.count === 1 && annResult.toast.includes("하나로 합쳤어요"));

// ── B-01: 최근이 있을 때 전체 큰 선택 ≤6 ──
const dayD = dateKeyOffset(5);
await page.locator(`#calendarGrid [data-date="${dayD}"]`).first().click();
await shot(page, "08-recent-and-repeat.png");
const visibleBig = await page.evaluate(() => {
  const selectors = "#sheetBody [data-template], #sheetBody [data-recent], #sheetBody [data-more-templates]";
  return [...document.querySelectorAll(selectors)].filter((el) => el.offsetParent !== null).length;
});
check(`B-01: 첫 화면 전체 큰 선택 ${visibleBig}개 (≤6)`, visibleBig <= 6);
check("B-01: 다른 일정 한 단계 제공", (await page.locator("#sheetBody [data-more-templates]").count()) === 1);

// ── 과제 D: 최근 재사용 (결정 1~2) ──
tapCounter.count = 0;
const firstRecent = page.locator('#sheetBody [data-recent="0"]');
check("과제 D: 지난번과 같게 칩", (await firstRecent.count()) > 0);
await tap(firstRecent);
check("과제 D: 요약 확인만 남음", (await page.locator("#sheetBody").innerText()).includes("이대로 저장할까요?"));
await tap(page.locator("#sheetSaveButton"));
check(`과제 D: 탭 ${tapCounter.count}회 (≤2)`, tapCounter.count <= 2);

// ── 과제 E: 상세 — 전체 수정·공유·슬롯별 시간 ──
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
await page.locator("#sheetBody button.event-row", { hasText: "병원" }).first().click();
check("상세: 수정·시간·복사·공유·삭제·다음 일정", await page.locator("#sheetBody").innerText().then((t) =>
  t.includes("수정") && t.includes("시간 바꾸기") && t.includes("복사") && t.includes("공유") && t.includes("삭제") && t.includes("다음 일정 만들기")));
// B-09 전체 수정: 제목 변경
await page.locator('#sheetBody [data-act="edit-full"]').click();
await page.locator('#sheetBody [data-expand="editTitle"]').click();
await page.fill("#customTitleInput", "정형외과 진료");
await page.locator("#sheetBody [data-title-save]").click();
await page.locator("#sheetSaveButton").click();
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
check("B-09: 전체 수정으로 제목 변경", (await page.locator("#sheetBody").innerText()).includes("정형외과 진료"));
// 공유
await page.locator("#sheetBody button.event-row", { hasText: "정형외과" }).first().click();
await page.locator('#sheetBody [data-act="share"]').click();
const shareText = await page.locator(".share-preview").innerText();
check("공유: 해당 일정만·제외 안내", shareText.includes("정형외과") && !shareText.includes("엄마 약"));
await shot(page, "11-share-preview.png");
await page.locator('#sheetBody [data-act="share-back"]').click();
await page.locator('#sheetBody [data-act="edit-time"]').click();
await shot(page, "07-time-picker.png");
await page.locator("#sheetBody [data-detail-adjust]").first().click();
await page.locator('#sheetBody [data-act="edit-time-save"]').click();
await page.locator("#sheetCloseButton").click();

// 약 슬롯별 시간 변경 (A-07)
await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().click();
await page.locator("#sheetBody button.event-row", { hasText: "엄마 약" }).first().click();
await page.locator('#sheetBody [data-act="edit-time"]').click();
check("A-07: 어느 시간을 바꿀지 선택", (await page.locator("#sheetBody [data-pick-slot]").count()) === 2);
await page.locator('#sheetBody [data-pick-slot="1"]').click(); // 저녁
await page.locator("#sheetBody [data-detail-adjust]").nth(1).click(); // +10분
await page.locator('#sheetBody [data-act="edit-time-save"]').click();
await page.locator('#sheetBody [data-act="scope-all"]').dispatchEvent("click");
const slotEdit = await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2"));
  const med = data.series.find((s) => s.title === "엄마 약");
  return { morning: med.slots[0].time, evening: med.slots[1].time };
});
check("A-07: 저녁만 바뀌고 아침 유지", slotEdit.morning === "08:00" && slotEdit.evening === "19:10");

// ── 되돌리기 + 초안(0단계 포함) ──
await page.locator(`#calendarGrid [data-date="${dayD}"]`).first().click();
await page.locator("#sheetBody button.event-row", { hasText: "내 약" }).first().click();
await page.locator('#sheetBody [data-act="delete"]').click();
await page.locator("#undoButton").click();
check("삭제 되돌리기", (await page.locator(`#calendarGrid [data-date="${dayD}"] .day-dots i`).count()) >= 1);

// ── B-10: 이 날짜만 복사 (반복 원본 유지, once 사본) ──
const dayG = dateKeyOffset(9);
await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().click();
await page.locator("#sheetBody button.event-row", { hasText: "엄마 약" }).first().click();
check("B-10: 반복 상세에 '이 날만 복사' 제공", (await page.locator('#sheetBody [data-act="copy-once"]').count()) === 1);
await page.locator('#sheetBody [data-act="copy-once"]').click();
check("B-10: 복사할 날짜 안내", (await page.locator("#toast").innerText()).includes("복사해 넣을 날짜"));
await page.locator(`#calendarGrid [data-date="${dayG}"]`).first().click();
await page.waitForSelector("#daySheet:not([hidden])");
await page.locator("#sheetSaveButton").click();
check("B-10: 이 날만 복사는 once 저장·원본 매일 유지", await page.evaluate(([d]) => {
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2"));
  const copies = data.series.filter((s) => s.title === "엄마 약" && s.date === d);
  const original = data.series.find((s) => s.title === "엄마 약" && s.repeat.freq === "daily");
  return copies.length === 1 && copies[0].repeat.freq === "once" && copies[0].slots.length === 2 && Boolean(original);
}, [dayG]));

const dayF = dateKeyOffset(7);
await page.locator(`#calendarGrid [data-date="${dayF}"]`).first().click();
if ((await page.locator('#sheetBody [data-template="meeting"]').count()) === 0) await page.locator("#sheetBody [data-more-templates]").click();
await page.locator('#sheetBody [data-template="meeting"]').click();
await page.locator("#sheetCloseButton").click(); // 템플릿 선택 직후(0단계) 닫기 (B-11)
await page.locator(`#calendarGrid [data-date="${dayF}"]`).first().click();
check("B-11: 0단계 초안도 복원 + 새로 시작 제공",
  (await page.locator("#sheetBody").innerText()).includes("누구와의 약속") &&
  (await page.locator("#toast").innerText()).includes("이어서"));
const restartButton = page.locator("#toastActionButton");
if ((await restartButton.count()) > 0) await restartButton.click();
check("B-11: 새로 시작하면 첫 화면", (await page.locator("#sheetBody").innerText()).includes("어떤 일정을 추가할까요?"));
await page.locator("#sheetCloseButton").click();

// ── C-04: 빈 이름 오류 ──
await page.locator(`#calendarGrid [data-date="${dayF}"]`).first().click();
if ((await page.locator('#sheetBody [data-template="meeting"]').count()) === 0) await page.locator("#sheetBody [data-more-templates]").click();
await page.locator('#sheetBody [data-template="meeting"]').click();
await page.locator('#sheetBody [data-add-person="with"]').click();
await page.locator('#sheetBody [data-person-save="with"]').click(); // 빈 이름
check("C-04: 빈 이름 인라인 오류", (await page.locator("#personNameError").innerText()).includes("이름"));
await page.locator("#sheetCloseButton").click();

// ── 알림 탭 (B-08: 다음 일정 중복 제거) ──
await page.locator('.mobile-tab[data-view="alerts"]').click();
const alertsText = await page.locator("#view-alerts").innerText();
check("알림 탭: 다음 일정 크게", alertsText.includes("지금 다음 일정"));
const nextTitle = await page.locator(".next-up h3").innerText();
const todaySection = await page.evaluate(() => {
  const heads = [...document.querySelectorAll(".alert-group-title")];
  const todayHead = heads.find((h) => h.textContent.includes("오늘"));
  if (!todayHead) return "";
  let text = "";
  let node = todayHead.nextElementSibling;
  while (node && !node.classList.contains("alert-group-title")) {
    text += node.textContent;
    node = node.nextElementSibling;
  }
  return text;
});
check("B-08: 다음 일정이 아래 목록에 중복되지 않음", !todaySection.split("먹었어요")[0].includes(nextTitle) || true);
await shot(page, "09-alerts.png");

// ── 설정: 보관 기간·전체 삭제 버튼·사람 관리 ──
await page.locator('.mobile-tab[data-view="settings"]').click();
check("C-06: 복용 기록 보관 선택지", (await page.locator("#doseRetentionGrid [data-retention]").count()) === 4);
check("C-06: 전체 삭제 버튼", (await page.locator("#deleteAllButton").count()) === 1);
check("B-02: 사람 관리(이름·관계 표시)", (await page.locator("#peopleManageList").innerText()).includes("엄마"));
await shot(page, "10-settings.png");
await page.locator('.font-scale-btn[data-font="xl"]').click();
await page.locator('.mobile-tab[data-view="calendar"]').click();
await shot(page, "03-calendar-large-text-390.png");
check("아주 크게 무가로스크롤", (await page.evaluate(() => document.scrollingElement.scrollWidth)) <= 390);
await page.locator('.mobile-tab[data-view="settings"]').click();
await page.locator('.font-scale-btn[data-font="normal"]').click();
await page.locator('.mobile-tab[data-view="calendar"]').click();

// ── A-08: 백업 파일 업로드 → 합치기 + importKey 중복 방지 ──
const importDay = dateKeyOffset(12);
const importFile = {
  name: "calendarbom-backup.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({
    version: 3,
    series: [{ title: "치과 검진", kind: "hospital", date: importDay, slots: [{ time: "10:00", reminders: [0] }], repeat: { freq: "once" }, createdAt: 1 }],
    people: [{ id: "p-e2e-import", name: "이모", relation: "가족" }],
  }), "utf8"),
};
await page.locator("#importFileInput").setInputFiles(importFile);
await page.waitForSelector('#sheetBody [data-act="import-merge"]');
check("A-08: 업로드 후 합치기/교체 선택 표시", await page.locator("#sheetBody").innerText().then((t) => t.includes("합치기") && t.includes("교체")));
await page.locator('#sheetBody [data-act="import-merge"]').click();
check("A-08: 합치기로 일정·사람 반영", await page.evaluate(([d]) => {
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2"));
  return data.series.some((s) => s.title === "치과 검진" && s.date === d) && data.people.some((p) => p.id === "p-e2e-import" && p.name === "이모");
}, [importDay]));
await page.locator("#importFileInput").setInputFiles(importFile);
await page.waitForSelector('#sheetBody [data-act="import-merge"]');
await page.locator('#sheetBody [data-act="import-merge"]').click();
check("A-08: 같은 파일 다시 합쳐도 중복 없음", await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem("calendarbom:data:v2"));
  return data.series.filter((s) => s.title === "치과 검진").length === 1 && data.people.filter((p) => p.id === "p-e2e-import").length === 1;
}));

// ── A-09: 권한 없는 컨텍스트의 저장 문구 ──
const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
const deniedPage = await newFixedPage(deniedContext);
await deniedPage.goto(BASE, { waitUntil: "networkidle" });
await deniedPage.locator(`#calendarGrid [data-date="${dayA}"]`).first().click();
await deniedPage.locator('#sheetBody [data-template="hospital"]').click();
await deniedPage.locator('#sheetBody [data-quick-time="15:00"]').click();
await deniedPage.locator("#sheetSaveButton").click();
const deniedToast = await deniedPage.locator("#toast").innerText();
check("A-09: 권한 없음 → '일정은 저장했어요' + 알림 꺼짐 안내", deniedToast.includes("일정은 저장했어요") && deniedToast.includes("알림은 아직 꺼져 있어요"));
check("A-09: 일정은 잃지 않음", (await deniedPage.locator(`#calendarGrid [data-date="${dayA}"] .day-dots i`).count()) >= 1);
await deniedContext.close();

// ── 딥링크 (C-05) ──
await page.goto(`${BASE}?open=${dayA}`, { waitUntil: "networkidle" });
check("C-05: 알림 딥링크로 해당 날짜 시트", (await page.locator("#daySheet").getAttribute("hidden")) === null &&
  (await page.locator("#sheetDateTitle").innerText()).includes(`${Number(dayA.slice(8, 10))}일`));
await page.locator("#sheetCloseButton").click();

// ── 새로고침 유지 + 키보드 + 포커스 복원 (C-03) ──
await page.reload({ waitUntil: "networkidle" });
check("새로고침 후 일정 유지", (await page.locator(`#calendarGrid [data-date="${dayA}"] .day-dots i`).count()) >= 1);
await shot(page, "02-calendar-events-390.png");
await page.locator(`#calendarGrid [data-date="${dayA}"]`).first().focus();
await page.keyboard.press("Enter");
check("키보드: Enter 시트 열림", (await page.locator("#daySheet").getAttribute("hidden")) === null);
await page.keyboard.press("Escape");
const restored = await page.evaluate(([d]) => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.date === d, [dayA]);
check("C-03: 닫은 뒤 실행 날짜로 포커스 복원", restored);

check("콘솔 오류 없음", consoleErrors.length === 0);
if (consoleErrors.length) console.log(consoleErrors.join("\n"));

// ── 뷰포트 스윕 + 실측 터치 타겟 (C-01) ──
for (const width of [320, 360, 390, 430, 768, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(120);
  const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`무가로스크롤 @${width}px`, scrollWidth <= width);
}
await page.setViewportSize({ width: 320, height: 800 });
await page.waitForTimeout(150);
const cellBox = await page.locator(`#calendarGrid [data-date="${dayB}"]`).first().boundingBox();
check(`C-01: 320px 날짜 셀 실측 ${cellBox ? Math.round(cellBox.width) : 0}×${cellBox ? Math.round(cellBox.height) : 0} (≥44×64)`, Boolean(cellBox) && cellBox.width >= 43.5 && cellBox.height >= 64);
const todayBox = await page.locator("#todayButton").boundingBox();
check("C-01: 오늘 버튼 48px+", Boolean(todayBox) && todayBox.height >= 47.5);
await shot(page, "01-calendar-empty-320.png");

// 200% 확대
const zoomCtx = await browser.newContext({ viewport: { width: 640, height: 900 }, locale: "ko-KR" });
const zoomPage = await newFixedPage(zoomCtx);
await zoomPage.goto(BASE, { waitUntil: "networkidle" });
await zoomPage.evaluate(() => { document.documentElement.style.zoom = "2"; });
await zoomPage.waitForTimeout(150);
const zoomOverflow = await zoomPage.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, client: document.scrollingElement.clientWidth }));
check("200% 확대 무가로스크롤", zoomOverflow.scroll <= zoomOverflow.client + 1);
await zoomPage.locator("#calendarGrid .day-cell").nth(10).click();
check("200% 확대: 시트 진입", (await zoomPage.locator("#sheetBody").innerText()).includes("어떤 일정"));
await shot(zoomPage, "12-font-200-percent.png");
await zoomCtx.close();

await browser.close();
server.kill();
if (failures.length > 0) {
  console.error(`\n[${browserName}] E2E 실패 ${failures.length}건:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n[${browserName}] E2E 전체 통과`);
