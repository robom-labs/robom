// 캘린더봄 달력 순수 계산 모듈 — 브라우저(전역)와 node:test 양쪽에서 사용한다.
// 날짜는 전부 (연, 월, 일) 정수로 계산해 시간대 함정을 피한다.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarBomCalendarCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dateKey(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function parseKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > daysInMonth(year, month)) return null;
    return { year, month, day };
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function daysInMonth(year, month) {
    return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  // 0=일요일. Date 없이 순수 계산(Zeller 변형) — 어떤 환경에서도 동일하다.
  function weekdayOf(year, month, day) {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    const y = month < 3 ? year - 1 : year;
    return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7;
  }

  function addMonths(year, month, delta) {
    const index = (year * 12 + (month - 1)) + delta;
    return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
  }

  /**
   * 월간 grid 생성 — 앞뒤 이웃 달 채움 셀 포함, 항상 7의 배수 길이.
   * 셀: { key, year, month, day, weekday, inMonth }
   */
  function buildMonthGrid(year, month) {
    const first = weekdayOf(year, month, 1);
    const days = daysInMonth(year, month);
    const cells = [];
    const prev = addMonths(year, month, -1);
    const prevDays = daysInMonth(prev.year, prev.month);
    for (let i = first - 1; i >= 0; i -= 1) {
      const day = prevDays - i;
      cells.push({ key: dateKey(prev.year, prev.month, day), year: prev.year, month: prev.month, day, weekday: cells.length % 7, inMonth: false });
    }
    for (let day = 1; day <= days; day += 1) {
      cells.push({ key: dateKey(year, month, day), year, month, day, weekday: cells.length % 7, inMonth: true });
    }
    const next = addMonths(year, month, 1);
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ key: dateKey(next.year, next.month, nextDay), year: next.year, month: next.month, day: nextDay, weekday: cells.length % 7, inMonth: false });
      nextDay += 1;
    }
    return { year, month, label: `${year}년 ${month}월`, cells };
  }

  function weekdayName(year, month, day) {
    return WEEKDAYS[weekdayOf(year, month, day)];
  }

  // "오후 3시" / "오후 3시 30분" — 고령 사용자용 자연어 시각.
  function koreanTime(hour, minute) {
    const h = Number(hour);
    const m = Number(minute) || 0;
    const half = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${half} ${h12}시` : `${half} ${h12}시 ${m}분`;
  }

  // "7월 20일 월요일 오후 3시" — 저장 확인 문장과 낭독용.
  function koreanDateTime(key, time) {
    const d = parseKey(key);
    if (!d) return "";
    const base = `${d.month}월 ${d.day}일 ${weekdayName(d.year, d.month, d.day)}요일`;
    if (!time) return base;
    const [h, m] = String(time).split(":").map(Number);
    return `${base} ${koreanTime(h, m)}`;
  }

  return { WEEKDAYS, pad2, dateKey, parseKey, isLeapYear, daysInMonth, weekdayOf, addMonths, buildMonthGrid, weekdayName, koreanTime, koreanDateTime };
});
