// ICS 가져오기·내보내기 검증 — 왕복 보존·접힌 줄·이스케이프.
import assert from "node:assert/strict";
import test from "node:test";
import ics from "../app/ics-core.js";

const events = [
  { id: "ev-1", title: "병원 예약", date: "2026-07-20", time: "15:00" },
  { id: "ev-2", title: "가족 모임", date: "2026-08-01", time: null },
];

test("exportICS 는 표준 골격과 CRLF 를 지킨다", () => {
  const text = ics.exportICS(events);
  assert.match(text, /^BEGIN:VCALENDAR\r\n/);
  assert.match(text, /END:VCALENDAR\r\n$/);
  assert.match(text, /DTSTART:20260720T150000/);
  assert.match(text, /DTSTART;VALUE=DATE:20260801/);
  assert.match(text, /SUMMARY:병원 예약/);
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
});

test("잘못된 날짜의 이벤트는 내보내지 않는다", () => {
  const text = ics.exportICS([{ title: "이상함", date: "잘못됨", time: "15:00" }]);
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 0);
});

test("내보낸 파일을 다시 읽으면 같은 일정이 나온다(왕복)", () => {
  const parsed = ics.parseICS(ics.exportICS(events));
  assert.deepEqual(parsed, [
    { title: "병원 예약", date: "2026-07-20", time: "15:00" },
    { title: "가족 모임", date: "2026-08-01", time: null },
  ]);
});

test("외부 달력의 접힌 줄과 파라미터·Z 표기를 수용한다", () => {
  const external = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "SUMMARY:아주 긴 제목이 접혀서 오는 경",
    " 우도 있다",
    "DTSTART;TZID=Asia/Seoul:20260720T090000",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "SUMMARY:UTC 표기",
    "DTSTART:20261225T000000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const parsed = ics.parseICS(external);
  assert.deepEqual(parsed, [
    { title: "아주 긴 제목이 접혀서 오는 경우도 있다", date: "2026-07-20", time: "09:00" },
    { title: "UTC 표기", date: "2026-12-25", time: "00:00" },
  ]);
});

test("특수문자는 이스케이프 왕복을 보존한다", () => {
  const tricky = [{ id: "ev-3", title: "쉼표, 세미콜론; 역슬래시\\", date: "2026-07-21", time: "08:00" }];
  const parsed = ics.parseICS(ics.exportICS(tricky));
  assert.equal(parsed[0].title, "쉼표, 세미콜론; 역슬래시\\");
});

test("DTSTART 없는 VEVENT 는 건너뛴다", () => {
  const text = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:날짜 없음\r\nEND:VEVENT\r\nEND:VCALENDAR";
  assert.deepEqual(ics.parseICS(text), []);
});
