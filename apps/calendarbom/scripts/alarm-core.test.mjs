// 알람 순수 계산 모듈 검증 — 발화 시각·중복 방지 ID·D-day·확인 문장.
import assert from "node:assert/strict";
import test from "node:test";
import alarm from "../app/alarm-core.js";

const event = { id: "ev-1", title: "병원 예약", date: "2026-07-20", time: "15:00", reminders: [0, 60], done: false };
const eventAt = new Date(2026, 6, 20, 15, 0, 0, 0).getTime();

test("이벤트 시각과 알람 발화 시각을 계산한다", () => {
  assert.equal(alarm.eventAtMs(event), eventAt);
  assert.equal(alarm.fireAtMs(event, 0), eventAt);
  assert.equal(alarm.fireAtMs(event, 60), eventAt - 3600000);
  assert.equal(alarm.fireAtMs(event, 1440), eventAt - 86400000);
  assert.equal(Number.isNaN(alarm.eventAtMs({ ...event, date: "없는날짜" })), true);
});

test("pendingFires 는 미래 발화만 시각순으로 준다", () => {
  const now = eventAt - 2 * 3600000; // 오후 1시
  const fires = alarm.pendingFires(event, now);
  assert.equal(fires.length, 2);
  assert.deepEqual(fires.map((fire) => fire.offset), [60, 0]);
  assert.equal(fires[0].id, "ev-1:2026-07-20T15:00:60");

  const lateNow = eventAt - 60000; // 1시간 전 알람은 이미 지남
  assert.deepEqual(alarm.pendingFires(event, lateNow).map((fire) => fire.offset), [0]);

  assert.deepEqual(alarm.pendingFires({ ...event, done: true }, now), []);
  assert.deepEqual(alarm.pendingFires({ ...event, reminders: [] }, now), []);
});

test("upcomingFires 는 여러 이벤트를 시각순으로 합친다", () => {
  const other = { id: "ev-2", title: "약 먹기", date: "2026-07-20", time: "13:30", reminders: [0], done: false };
  const now = new Date(2026, 6, 20, 12, 0).getTime();
  const fires = alarm.upcomingFires([event, other], now);
  assert.deepEqual(fires.map((fire) => fire.event.id), ["ev-2", "ev-1", "ev-1"]);
});

test("upcomingEvents 는 지나지 않은 일정을 시각순으로 준다", () => {
  const past = { id: "ev-0", title: "지난 일정", date: "2026-07-10", time: "09:00", reminders: [] };
  const allDay = { id: "ev-3", title: "하루 종일", date: "2026-07-21", time: null, reminders: [] };
  const now = new Date(2026, 6, 20, 12, 0).getTime();
  const upcoming = alarm.upcomingEvents([past, event, allDay], now);
  assert.deepEqual(upcoming.map((item) => item.event.id), ["ev-1", "ev-3"]);
});

test("D-day 라벨은 날짜 단위로 계산한다", () => {
  const now = new Date(2026, 6, 20, 23, 30).getTime(); // 당일 밤이어도 "오늘"
  assert.equal(alarm.ddayLabel(event, now), "오늘");
  assert.equal(alarm.ddayLabel(event, new Date(2026, 6, 19, 1, 0).getTime()), "내일");
  assert.equal(alarm.ddayLabel(event, new Date(2026, 6, 15).getTime()), "D-5");
  assert.equal(alarm.ddayLabel(event, new Date(2026, 6, 21).getTime()), "어제");
  assert.equal(alarm.ddayLabel(event, new Date(2026, 6, 25).getTime()), "D+5");
});

test("저장 확인 문장은 요구된 형태를 따른다", () => {
  assert.equal(alarm.confirmationSentence(event), "7월 20일 월요일 오후 3시, “병원 예약” 알람을 저장했어요.");
  assert.equal(
    alarm.confirmationSentence({ ...event, reminders: [] }),
    "7월 20일 월요일 오후 3시, “병원 예약” 일정을 저장했어요."
  );
  assert.equal(
    alarm.confirmationSentence({ ...event, time: null, reminders: [] }),
    "7월 20일 월요일, “병원 예약” 일정을 저장했어요."
  );
});

test("알람 시점 라벨", () => {
  assert.equal(alarm.offsetLabel(0), "정각");
  assert.equal(alarm.offsetLabel(10), "10분 전");
  assert.equal(alarm.offsetLabel(60), "1시간 전");
  assert.equal(alarm.offsetLabel(1440), "하루 전");
  assert.equal(alarm.offsetLabel(30), "30분 전");
});
