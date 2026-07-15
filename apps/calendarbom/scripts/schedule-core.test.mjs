// v2 일정 모델 검증 — 마이그레이션·반복·기념일 계산·알람 발화·JSON 왕복.
import assert from "node:assert/strict";
import test from "node:test";
import core from "../app/schedule-core.js";

const NOW = new Date(2026, 6, 15, 6, 0).getTime(); // 2026-07-15 06:00 로컬

function makeSeries(overrides = {}) {
  return core.normalizeSeries({
    id: "sr-test",
    kind: "general",
    title: "병원",
    date: "2026-07-20",
    slots: [{ time: "15:00", reminders: [0, 60] }],
    repeat: { freq: "once" },
    ...overrides,
  });
}

test("v1 → v2 마이그레이션은 제목·날짜·시간·알림·완료를 보존한다", () => {
  const v1 = {
    version: 1,
    events: [
      { id: "ev-1", title: "병원", date: "2026-07-20", time: "15:00", reminders: [0, 60], done: false, createdAt: 1 },
      { id: "ev-2", title: "하루 종일", date: "2026-08-01", time: null, reminders: [], done: true, createdAt: 2 },
      { id: "bad", title: "깨진 항목", date: "잘못됨" },
    ],
  };
  const { data, migrated, total } = core.migrateV1(v1, NOW);
  assert.equal(total, 3);
  assert.equal(migrated, 2); // 깨진 항목은 건너뛰되 나머지는 보존
  const first = data.series.find((s) => s.id === "v1-ev-1");
  assert.equal(first.title, "병원");
  assert.equal(first.date, "2026-07-20");
  assert.deepEqual(first.slots[0], { label: null, time: "15:00", reminders: [0, 60] });
  assert.equal(first.repeat.freq, "once");
  const second = data.series.find((s) => s.id === "v1-ev-2");
  assert.equal(second.allDay, true);
  assert.equal(data.statuses[core.occurrenceId("v1-ev-2", "2026-08-01", 0)].state, "done");
});

test("마이그레이션은 중복 실행해도 같은 ID를 만든다(멱등)", () => {
  const v1 = { version: 1, events: [{ id: "ev-1", title: "a", date: "2026-07-20", time: null, reminders: [] }] };
  const a = core.migrateV1(v1, NOW).data.series[0].id;
  const b = core.migrateV1(v1, NOW).data.series[0].id;
  assert.equal(a, b);
});

test("반복 발생: 매일·매주(요일)·매월(월말 당김)·매년(윤일 당김)", () => {
  const daily = makeSeries({ repeat: { freq: "daily" }, date: "2026-07-01" });
  assert.equal(core.occursOn(daily, "2026-06-30"), false);
  assert.equal(core.occursOn(daily, "2026-07-01"), true);
  assert.equal(core.occursOn(daily, "2026-12-25"), true);

  const weekly = makeSeries({ repeat: { freq: "weekly", weekdays: [1, 3] }, date: "2026-07-01" });
  assert.equal(core.occursOn(weekly, "2026-07-20"), true); // 월요일
  assert.equal(core.occursOn(weekly, "2026-07-21"), false); // 화요일
  assert.equal(core.occursOn(weekly, "2026-07-22"), true); // 수요일

  const monthly31 = makeSeries({ repeat: { freq: "monthly" }, date: "2026-01-31" });
  assert.equal(core.occursOn(monthly31, "2026-02-28"), true); // 월말 당김
  assert.equal(core.occursOn(monthly31, "2026-03-31"), true);
  assert.equal(core.occursOn(monthly31, "2026-04-30"), true);

  const feb29 = makeSeries({ repeat: { freq: "yearly" }, date: "2024-02-29" });
  assert.equal(core.occursOn(feb29, "2026-02-28"), true); // 평년 당김
  assert.equal(core.occursOn(feb29, "2028-02-29"), true); // 윤년 복원
  assert.equal(core.occursOn(feb29, "2026-03-01"), false);
});

test("until·skip override·범위 확장이 동작한다", () => {
  const series = makeSeries({
    repeat: { freq: "daily", until: "2026-07-22" },
    date: "2026-07-20",
    overrides: { "2026-07-21": { skip: true } },
  });
  assert.equal(core.occursOn(series, "2026-07-21"), false);
  assert.equal(core.occursOn(series, "2026-07-23"), false); // until 이후
  const occs = core.occurrencesInRange([series], "2026-07-19", "2026-07-25");
  assert.deepEqual(occs.map((o) => o.date), ["2026-07-20", "2026-07-22"]);
  assert.equal(core.nextOccurrence(series, "2026-07-21"), "2026-07-22");
});

test("시간 override 는 해당 날짜의 발생 시각만 바꾼다", () => {
  const series = makeSeries({ repeat: { freq: "daily" }, date: "2026-07-20", overrides: { "2026-07-21": { time: "10:00" } } });
  const occs = core.occurrencesInRange([series], "2026-07-20", "2026-07-21");
  assert.equal(occs[0].time, "15:00");
  assert.equal(occs[1].time, "10:00");
});

test("약: 여러 시간 슬롯이 각각 발생·발화한다", () => {
  const med = core.normalizeSeries({
    id: "sr-med",
    kind: "medication",
    title: "엄마 혈압약",
    date: "2026-07-15",
    slots: [
      { label: "아침", time: "08:00", reminders: [0] },
      { label: "저녁", time: "19:00", reminders: [0] },
    ],
    repeat: { freq: "daily" },
  });
  const data = { ...core.emptyData(), series: [med] };
  const occs = core.occurrencesInRange([med], "2026-07-15", "2026-07-15");
  assert.equal(occs.length, 2);
  const fires = core.upcomingFires(data, NOW, 0); // 06:00 기준 오늘 08:00·19:00
  assert.deepEqual(fires.map((f) => new Date(f.at).getHours()), [8, 19]);

  // 아침을 먹었으면 아침 발화는 사라진다
  data.statuses[occs[0].id] = { state: "done", at: NOW };
  assert.deepEqual(core.upcomingFires(data, NOW, 0).map((f) => new Date(f.at).getHours()), [19]);

  // 조금 있다가(스누즈)는 스누즈 시각 하나만 발화한다
  data.statuses[occs[0].id] = { snoozeUntil: NOW + 10 * 60000 };
  const snoozed = core.upcomingFires(data, NOW, 0);
  assert.equal(snoozed[0].at, NOW + 10 * 60000);
});

test("하루 종일 일정도 별도 알림 시각을 가진다", () => {
  const birthday = core.normalizeSeries({
    id: "sr-bd",
    kind: "anniversary",
    title: "엄마 생일",
    date: "2026-07-16",
    slots: [{ time: null, reminders: [] }],
    allDayReminder: { daysBefore: 1, time: "09:00" },
    repeat: { freq: "yearly" },
    tone: "celebrate",
  });
  const data = { ...core.emptyData(), series: [birthday] };
  const fires = core.upcomingFires(data, NOW, 2);
  assert.equal(fires.length, 1);
  const fireDate = new Date(fires[0].at);
  assert.deepEqual([fireDate.getMonth() + 1, fireDate.getDate(), fireDate.getHours()], [7, 15, 9]); // 하루 전 오전 9시
});

test("기념일 계산: 기준일이 1일째다 (100일·N개월·N주년·윤년·월말)", () => {
  assert.equal(core.anniversaryDate("2026-04-10", "days", 1), "2026-04-10");
  assert.equal(core.anniversaryDate("2026-04-10", "days", 100), "2026-07-18");
  assert.equal(core.anniversaryDate("2026-04-10", "days", 1000), "2029-01-03"); // 999일 뒤
  assert.equal(core.anniversaryDate("2026-01-31", "months", 1), "2026-02-28"); // 월말 당김
  assert.equal(core.anniversaryDate("2024-02-29", "years", 2), "2026-02-28"); // 평년 당김
  assert.equal(core.anniversaryDate("2024-02-29", "years", 4), "2028-02-29");
  assert.match(core.anniversaryExplain("2026-04-10", "days", 100), /4월 10일을 1일째로 계산해요\. 100일은 7월 18일 토요일이에요\./);
});

test("자연어 요약이 자동 기본값을 숨기지 않는다", () => {
  const data = core.emptyData();
  data.people.push(core.normalizePerson({ id: "p-mom", name: "엄마", createdAt: 1 }));
  const med = core.normalizeSeries({
    kind: "medication", title: "엄마 혈압약", personId: "p-mom", date: "2026-07-15",
    slots: [{ label: "아침", time: "08:00", reminders: [0] }, { label: "저녁", time: "19:00", reminders: [0] }],
    repeat: { freq: "daily" },
  });
  const lines = core.seriesSummaryLines(data, med);
  assert.equal(lines.some((l) => l.includes("매일")), true);
  assert.equal(lines.some((l) => l.includes("오전 8시 · 오후 7시")), true);
  assert.equal(lines.some((l) => l.includes("엄마의 약")), true);
  assert.equal(lines.at(-1), "공개 범위: 나만 보기");
});

test("JSON v2 왕복과 v1 파일 가져오기", () => {
  const data = core.emptyData();
  data.people.push(core.normalizePerson({ id: "p-1", name: "지연", createdAt: 1 }));
  data.series.push(makeSeries({ personId: "p-1" }));
  const json = core.exportJSON(data, "2026-07-15T06:00:00", "0.2.0");
  const back = core.importParsed(JSON.parse(json), NOW);
  assert.equal(back.series.length, 1);
  assert.equal(back.series[0].title, "병원");
  assert.equal(back.people[0].name, "지연");

  const v1file = { version: 1, events: [{ id: "e", title: "옛 일정", date: "2026-07-01", time: "09:00", reminders: [0] }] };
  const fromV1 = core.importParsed(v1file, NOW);
  assert.equal(fromV1.series[0].title, "옛 일정");
  assert.equal(fromV1.series[0].repeat.freq, "once");
});

test("normalizeData 는 깨진 항목을 걸러내고 구조를 보장한다", () => {
  assert.equal(core.normalizeData({ version: 1 }), null);
  const data = core.normalizeData({
    version: 2,
    people: [{ name: "엄마" }, null, { bad: true }],
    series: [{ title: "ok", date: "2026-07-20", slots: [{ time: "25:99" }] }, { date: "잘못" }],
    statuses: { "a@b#0": { state: "done", at: 1 }, bad: "x", snz: { snoozeUntil: 5 } },
  });
  assert.equal(data.people.length, 1);
  assert.equal(data.series.length, 1);
  assert.equal(data.series[0].allDay, true); // 잘못된 시간은 버리고 하루 종일 처리
  assert.deepEqual(Object.keys(data.statuses).sort(), ["a@b#0", "snz"]);
});

test("날짜 산술 보조: addDays·diffDays", () => {
  assert.equal(core.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(core.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(core.diffDays("2026-07-15", "2026-07-18"), 3);
});

// ── V7 GATE A 회귀 ──

test("A-01: 같은 내용이라도 새 ID는 서로 다르다(난수 UUID)", () => {
  const a = core.normalizeSeries({ title: "병원", date: "2026-07-20", kind: "hospital", slots: [{ time: "15:00", reminders: [0] }] });
  const b = core.normalizeSeries({ title: "병원", date: "2026-07-20", kind: "hospital", slots: [{ time: "15:00", reminders: [0] }] });
  assert.notEqual(a.id, b.id);
  const p1 = core.normalizePerson({ name: "민수" });
  const p2 = core.normalizePerson({ name: "민수" });
  assert.notEqual(p1.id, p2.id); // 이름 같은 사람 두 명 허용
  // 기존 ID는 그대로 유지되고 normalize를 반복해도 불변
  const kept = core.normalizeSeries({ id: "sr-keep", title: "x", date: "2026-07-20" });
  assert.equal(core.normalizeSeries(kept).id, "sr-keep");
});

test("A-01: v2 문서의 중복 series ID는 첫 항목만 유지하고 재부여한다", () => {
  const data = core.normalizeData({
    version: 2,
    series: [
      { id: "dup", title: "엄마 병원", date: "2026-07-20", slots: [{ time: "10:00", reminders: [0] }] },
      { id: "dup", title: "아빠 병원", date: "2026-07-20", slots: [{ time: "10:00", reminders: [0] }] },
    ],
    statuses: { "dup@2026-07-20#0": { state: "done", at: 1 } },
  });
  assert.equal(data.series.length, 2);
  assert.equal(data.series[0].id, "dup");
  assert.notEqual(data.series[1].id, "dup");
  assert.equal(data.idReassigned, 1);
  assert.equal(data.statuses["dup@2026-07-20#0"].state, "done"); // 상태는 첫 항목 소유로 보존
});

test("A-05: 7일 전·30일 전 알림이 월·연 경계를 넘어 발화한다", () => {
  const seven = core.normalizeSeries({
    id: "sr-7", kind: "anniversary", title: "생일", date: "2026-07-22",
    slots: [{ time: null, reminders: [] }], allDayReminders: [{ daysBefore: 7, time: "09:00" }], repeat: { freq: "yearly" },
  });
  const data = { ...core.emptyData(), series: [seven] };
  const fires = core.upcomingFires(data, NOW, 1); // 오늘 15일 → 발생일 22일은 지평선 밖이지만 7일 전 발화는 오늘
  assert.equal(fires.length, 1);
  assert.deepEqual([new Date(fires[0].at).getDate(), new Date(fires[0].at).getHours()], [15, 9]);

  const yearEnd = core.normalizeSeries({
    id: "sr-ny", kind: "anniversary", title: "새해", date: "2027-01-10",
    slots: [{ time: null, reminders: [] }], allDayReminders: [{ daysBefore: 30, time: "09:00" }], repeat: { freq: "once" },
  });
  const dec = new Date(2026, 11, 11, 6, 0).getTime(); // 12/11 → 30일 전 발화는 12/11
  const nyFires = core.upcomingFires({ ...core.emptyData(), series: [yearEnd] }, dec, 1);
  assert.equal(nyFires.length, 1);
  assert.equal(new Date(nyFires[0].at).getMonth(), 11); // 12월(연 경계 통과)
});

test("A-06: 하루 종일 복수 알림 — 중복 제거·최대 3개·전부 발화", () => {
  const series = core.normalizeSeries({
    id: "sr-multi", kind: "anniversary", title: "기념일", date: "2026-07-25",
    slots: [{ time: null, reminders: [] }],
    allDayReminders: [
      { daysBefore: 7, time: "09:00" }, { daysBefore: 1, time: "09:00" }, { daysBefore: 0, time: "09:00" },
      { daysBefore: 1, time: "09:00" }, { daysBefore: 0, time: "20:00" },
    ],
    repeat: { freq: "once" },
  });
  assert.equal(series.allDayReminders.length, 3); // 중복 1개 제거 후 최대 3개
  const data = { ...core.emptyData(), series: [series] };
  const fires = core.upcomingFires(data, NOW, 10); // 7/18(7일 전)·7/24(하루 전)·7/25(당일)
  assert.equal(fires.length, 3);
  const lines = core.seriesSummaryLines(data, series);
  assert.equal(lines.some((l) => l.includes("7일 전") && l.includes("하루 전") && l.includes("당일")), true);
});

test("A-07: 슬롯별 시간 override 는 해당 슬롯만 바꾼다", () => {
  const med = core.normalizeSeries({
    id: "sr-slot", kind: "medication", title: "약", date: "2026-07-15",
    slots: [{ label: "아침", time: "08:00", reminders: [0] }, { label: "저녁", time: "19:00", reminders: [0] }],
    repeat: { freq: "daily" },
    overrides: { "2026-07-16": { times: { 1: "21:00" } } },
  });
  const occs = core.occurrencesInRange([med], "2026-07-16", "2026-07-16");
  assert.equal(occs[0].time, "08:00"); // 아침 유지
  assert.equal(occs[1].time, "21:00"); // 저녁만 변경
  // v2 형식 {time} 은 슬롯 0 으로 흡수
  const legacy = core.normalizeSeries({ id: "sr-legacy", title: "x", date: "2026-07-15", slots: [{ time: "09:00", reminders: [] }], overrides: { "2026-07-16": { time: "10:00" } } });
  assert.equal(legacy.overrides["2026-07-16"].times[0], "10:00");
});

test("A-08: 전체 상태 백업 왕복(statuses·settings·recents 포함)", () => {
  const data = core.emptyData();
  data.people.push(core.normalizePerson({ id: "p-1", name: "엄마", relation: "가족", createdAt: 1 }));
  data.series.push(makeSeries({ id: "sr-full", personId: "p-1" }));
  data.statuses["sr-full@2026-07-20#0"] = { state: "done", at: 5 };
  data.recents.push({ label: "병원", snapshot: { template: "hospital" }, savedAt: 1 });
  data.settings.fontScale = "xl";
  const back = core.importParsed(JSON.parse(core.exportJSON(data, "t", "0.3.0")), NOW);
  assert.equal(back.series.length, 1);
  assert.equal(back.people[0].relation, "가족");
  assert.equal(back.statuses["sr-full@2026-07-20#0"].state, "done");
  assert.equal(back.recents.length, 1);
  assert.equal(back.settings.fontScale, "xl");
});

test("B-10: 지문(fingerprint)은 대상이 다르면 다르다", () => {
  const mom = makeSeries({ id: "a", personId: "p-mom", title: "병원" });
  const dad = makeSeries({ id: "b", personId: "p-dad", title: "병원" });
  assert.notEqual(core.fingerprint(mom), core.fingerprint(dad));
  assert.notEqual(core.importKey(mom), core.importKey(dad));
  const same = makeSeries({ id: "c", personId: "p-mom", title: "병원" });
  assert.equal(core.importKey(mom), core.importKey(same));
});

test("B-06: 시간대 라벨 제안", () => {
  assert.equal(core.slotLabelForTime("08:00"), "아침");
  assert.equal(core.slotLabelForTime("13:00"), "점심");
  assert.equal(core.slotLabelForTime("16:00"), "낮");
  assert.equal(core.slotLabelForTime("19:30"), "저녁");
  assert.equal(core.slotLabelForTime("22:00"), "자기 전");
  assert.equal(core.slotLabelForTime("03:00"), "자기 전");
});

test("A-04: normalize 는 once 반복을 강제로 바꾸지 않는다", () => {
  const med = core.normalizeSeries({ kind: "medication", title: "감기약", date: "2026-07-15", slots: [{ time: "08:00", reminders: [0] }], repeat: { freq: "once" } });
  assert.equal(med.repeat.freq, "once");
  const until = core.normalizeSeries({ kind: "medication", title: "항생제", date: "2026-07-15", slots: [{ time: "08:00", reminders: [0] }], repeat: { freq: "daily", until: "2026-07-21" } });
  assert.equal(until.repeat.until, "2026-07-21");
});
