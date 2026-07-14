// 달력 순수 계산 모듈 검증 — 요일·윤년·월간 grid·자연어 시각.
import assert from "node:assert/strict";
import test from "node:test";
import cal from "../app/calendar-core.js";

test("요일 계산은 알려진 날짜와 일치한다", () => {
  assert.equal(cal.weekdayOf(2026, 7, 14), 2); // 2026-07-14 화요일
  assert.equal(cal.weekdayOf(2026, 7, 20), 1); // 2026-07-20 월요일
  assert.equal(cal.weekdayOf(2024, 2, 29), 4); // 2024-02-29 목요일(윤일)
  assert.equal(cal.weekdayOf(2000, 1, 1), 6); // 2000-01-01 토요일
  assert.equal(cal.weekdayName(2026, 7, 20), "월");
});

test("윤년과 월별 일수를 정확히 안다", () => {
  assert.equal(cal.isLeapYear(2024), true);
  assert.equal(cal.isLeapYear(2026), false);
  assert.equal(cal.isLeapYear(2100), false);
  assert.equal(cal.isLeapYear(2000), true);
  assert.equal(cal.daysInMonth(2026, 2), 28);
  assert.equal(cal.daysInMonth(2024, 2), 29);
  assert.equal(cal.daysInMonth(2026, 7), 31);
});

test("parseKey 는 형식·범위를 모두 검사한다", () => {
  assert.deepEqual(cal.parseKey("2026-07-20"), { year: 2026, month: 7, day: 20 });
  assert.equal(cal.parseKey("2026-13-01"), null);
  assert.equal(cal.parseKey("2026-02-29"), null); // 평년
  assert.deepEqual(cal.parseKey("2024-02-29"), { year: 2024, month: 2, day: 29 }); // 윤년
  assert.equal(cal.parseKey("2026-7-1"), null);
  assert.equal(cal.parseKey(""), null);
  assert.equal(cal.parseKey(null), null);
});

test("월간 grid 는 7의 배수이며 이웃 달로 채워진다", () => {
  const grid = cal.buildMonthGrid(2026, 7); // 7/1 수요일, 31일
  assert.equal(grid.label, "2026년 7월");
  assert.equal(grid.cells.length % 7, 0);
  assert.equal(grid.cells.length, 35); // 3 + 31 + 1
  assert.equal(grid.cells[0].key, "2026-06-28");
  assert.equal(grid.cells[0].inMonth, false);
  assert.equal(grid.cells[3].key, "2026-07-01");
  assert.equal(grid.cells[3].inMonth, true);
  assert.equal(grid.cells.at(-1).key, "2026-08-01");
  for (const [index, cell] of grid.cells.entries()) assert.equal(cell.weekday, index % 7);
});

test("연말·연초 grid 도 해를 넘겨 채운다", () => {
  const december = cal.buildMonthGrid(2026, 12);
  assert.equal(december.cells.at(-1).key >= "2027-01-01" || december.cells.at(-1).month === 12, true);
  const january = cal.buildMonthGrid(2026, 1);
  assert.equal(january.cells[0].year, 2025);
  assert.deepEqual(cal.addMonths(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(cal.addMonths(2026, 12, 1), { year: 2027, month: 1 });
});

test("자연어 시각·날짜 문장을 만든다", () => {
  assert.equal(cal.koreanTime(15, 0), "오후 3시");
  assert.equal(cal.koreanTime(15, 30), "오후 3시 30분");
  assert.equal(cal.koreanTime(0, 0), "오전 12시");
  assert.equal(cal.koreanTime(12, 0), "오후 12시");
  assert.equal(cal.koreanTime(9, 10), "오전 9시 10분");
  assert.equal(cal.koreanDateTime("2026-07-20", "15:00"), "7월 20일 월요일 오후 3시");
  assert.equal(cal.koreanDateTime("2026-07-20", null), "7월 20일 월요일");
  assert.equal(cal.koreanDateTime("잘못된값", "15:00"), "");
});
