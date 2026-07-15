// 캘린더봄 v3 일정 모델 — 사람·반복 series·약 시간 슬롯·기념일 계산·v1/v2 마이그레이션.
// 순수 계산만 담당한다(브라우저 전역과 node:test 양쪽에서 사용).
(function (root, factory) {
  const api = factory(root.CalendarBomCalendarCore || (typeof require === "function" ? require("./calendar-core.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarBomScheduleCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (cal) {
  const SCHEMA_VERSION = 3;
  const KINDS = ["general", "todo", "hospital", "meeting", "medication", "anniversary", "bill"];
  const FREQS = ["once", "daily", "weekly", "monthly", "yearly"];
  const TONES = ["celebrate", "neutral", "memorial"];
  const MAX_ALL_DAY_REMINDERS = 3;

  // 충돌 없는 ID: 내용 해시가 아니라 난수 UUID (A-01)
  let idCounter = 0;
  function newId(prefix) {
    try {
      if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    } catch { /* 아래 fallback */ }
    idCounter += 1;
    const rand = () => Math.random().toString(36).slice(2, 10);
    return `${prefix}-${rand()}${rand()}-${idCounter}`;
  }

  function emptyData() {
    return { version: SCHEMA_VERSION, people: [], series: [], statuses: {}, recents: [], settings: {} };
  }

  // ── 날짜 산술 (dateKey = "YYYY-MM-DD") ──
  function addDays(key, n) {
    const d = cal.parseKey(key);
    if (!d) return null;
    let { year, month, day } = d;
    day += n;
    while (day > cal.daysInMonth(year, month)) {
      day -= cal.daysInMonth(year, month);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    while (day < 1) {
      month -= 1;
      if (month < 1) { month = 12; year -= 1; }
      day += cal.daysInMonth(year, month);
    }
    return cal.dateKey(year, month, day);
  }

  /** n개월 뒤, 해당 달에 같은 날이 없으면 그 달의 마지막 날로 당긴다(예: 1/31 → 2/28). */
  function addMonthsClamped(key, n) {
    const d = cal.parseKey(key);
    if (!d) return null;
    const moved = cal.addMonths(d.year, d.month, n);
    const day = Math.min(d.day, cal.daysInMonth(moved.year, moved.month));
    return cal.dateKey(moved.year, moved.month, day);
  }

  /** n년 뒤. 2월 29일 기준일은 평년에 2월 28일로 당긴다. */
  function addYearsClamped(key, n) {
    const d = cal.parseKey(key);
    if (!d) return null;
    const year = d.year + n;
    const day = Math.min(d.day, cal.daysInMonth(year, d.month));
    return cal.dateKey(year, d.month, day);
  }

  function diffDays(fromKey, toKey) {
    const a = cal.parseKey(fromKey);
    const b = cal.parseKey(toKey);
    if (!a || !b) return NaN;
    const toUtc = (d) => Date.UTC(d.year, d.month - 1, d.day);
    return Math.round((toUtc(b) - toUtc(a)) / 86400000);
  }

  // ── 기념일 계산: 기준일을 1일째로 센다. 100일 = 기준일 + 99일 ──
  function anniversaryDate(baseKey, ruleType, n) {
    if (!cal.parseKey(baseKey) || !Number.isInteger(n) || n < 1) return null;
    if (ruleType === "days") return addDays(baseKey, n - 1);
    if (ruleType === "months") return addMonthsClamped(baseKey, n);
    if (ruleType === "years") return addYearsClamped(baseKey, n);
    return null;
  }

  function anniversaryExplain(baseKey, ruleType, n) {
    const target = anniversaryDate(baseKey, ruleType, n);
    if (!target) return "";
    const base = cal.parseKey(baseKey);
    const baseText = `${base.month}월 ${base.day}일`;
    const targetText = cal.koreanDateTime(target, null);
    if (ruleType === "days") return `${baseText}을 1일째로 계산해요. ${n}일은 ${targetText}이에요.`;
    if (ruleType === "months") return `${baseText}부터 ${n}개월째는 ${targetText}이에요.`;
    return `${baseText}부터 ${n}주년은 ${targetText}이에요.`;
  }

  /** "HH:MM" 형식 + 실제 시각 범위(00:00~23:59)까지 검증한다. */
  function isValidTime(value) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    return Boolean(m) && Number(m[1]) < 24 && Number(m[2]) < 60;
  }

  /** 시각에 어울리는 시간대 라벨(예시용). 05~10 아침 / 11~14 점심 / 15~17 낮 / 18~20 저녁 / 그 외 자기 전 (B-06) */
  function slotLabelForTime(time) {
    if (!isValidTime(time)) return null;
    const hour = Number(time.slice(0, 2));
    if (hour >= 5 && hour <= 10) return "아침";
    if (hour >= 11 && hour <= 14) return "점심";
    if (hour >= 15 && hour <= 17) return "낮";
    if (hour >= 18 && hour <= 20) return "저녁";
    return "자기 전";
  }

  // ── 정규화 ──
  function normalizeSlot(raw) {
    if (!raw || typeof raw !== "object") return null;
    const time = isValidTime(raw.time) ? raw.time : null;
    const reminders = Array.isArray(raw.reminders)
      ? [...new Set(raw.reminders.map(Number).filter((v) => Number.isFinite(v) && v >= 0))].sort((a, b) => a - b)
      : [];
    return { label: raw.label ? String(raw.label).slice(0, 20) : null, time, reminders: time ? reminders : [] };
  }

  function normalizeAllDayReminder(raw) {
    if (!raw || typeof raw !== "object" || !isValidTime(raw.time)) return null;
    return { daysBefore: Math.max(0, Number(raw.daysBefore) || 0), time: raw.time };
  }

  function normalizeSeries(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!cal.parseKey(raw.date)) return null;
    const kind = KINDS.includes(raw.kind) ? raw.kind : "general";
    const slots = (Array.isArray(raw.slots) ? raw.slots : []).map(normalizeSlot).filter(Boolean).slice(0, 4);
    if (slots.length === 0) slots.push({ label: null, time: null, reminders: [] });
    const repeatRaw = raw.repeat && typeof raw.repeat === "object" ? raw.repeat : {};
    const freq = FREQS.includes(repeatRaw.freq) ? repeatRaw.freq : "once";
    const weekdays = Array.isArray(repeatRaw.weekdays)
      ? [...new Set(repeatRaw.weekdays.map(Number).filter((v) => v >= 0 && v <= 6))].sort()
      : null;
    const allDay = slots.every((slot) => !slot.time);
    // v2 단일 allDayReminder → v3 배열로 흡수. 중복(같은 daysBefore+time) 제거, 최대 3개 (A-06)
    const remindersRaw = Array.isArray(raw.allDayReminders) ? raw.allDayReminders : (raw.allDayReminder ? [raw.allDayReminder] : []);
    const seenReminder = new Set();
    const allDayReminders = allDay
      ? remindersRaw.map(normalizeAllDayReminder).filter(Boolean).filter((r) => {
          const key = `${r.daysBefore}@${r.time}`;
          if (seenReminder.has(key)) return false;
          seenReminder.add(key);
          return true;
        }).slice(0, MAX_ALL_DAY_REMINDERS)
      : [];
    const annRaw = raw.anniversary && typeof raw.anniversary === "object" ? raw.anniversary : null;
    const anniversary = annRaw && cal.parseKey(annRaw.baseDate) && ["days", "months", "years"].includes(annRaw.ruleType)
      ? { baseDate: annRaw.baseDate, ruleType: annRaw.ruleType, n: Math.max(1, Number(annRaw.n) || 1), label: String(annRaw.label || "").slice(0, 30) }
      : null;
    // override: v2 {time} → v3 {times:{0:time}} 로 흡수. 슬롯별 시간 덮어쓰기 지원 (A-07)
    const overrides = {};
    if (raw.overrides && typeof raw.overrides === "object") {
      for (const [key, value] of Object.entries(raw.overrides)) {
        if (!cal.parseKey(key) || !value || typeof value !== "object") continue;
        const entry = {};
        if (value.skip === true) entry.skip = true;
        const times = {};
        if (isValidTime(value.time)) times[0] = value.time;
        if (value.times && typeof value.times === "object") {
          for (const [slotIndex, time] of Object.entries(value.times)) {
            const index = Number(slotIndex);
            if (Number.isInteger(index) && index >= 0 && index < 4 && isValidTime(time)) times[index] = time;
          }
        }
        if (Object.keys(times).length > 0) entry.times = times;
        if (Object.keys(entry).length > 0) overrides[key] = entry;
      }
    }
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : newId("sr"),
      kind,
      title: String(raw.title || "일정").slice(0, 40),
      personId: typeof raw.personId === "string" ? raw.personId : null,
      withPersonId: typeof raw.withPersonId === "string" ? raw.withPersonId : null,
      date: raw.date,
      allDay,
      slots,
      allDayReminders,
      repeat: { freq, weekdays: freq === "weekly" ? weekdays : null, until: cal.parseKey(repeatRaw.until) ? repeatRaw.until : null },
      anniversary,
      overrides,
      tone: TONES.includes(raw.tone) ? raw.tone : "neutral",
      place: raw.place ? String(raw.place).slice(0, 60) : null,
      note: raw.note ? String(raw.note).slice(0, 200) : null,
      done: Boolean(raw.done),
      createdAt: Number(raw.createdAt) || 0,
      updatedAt: Number(raw.updatedAt) || 0,
    };
  }

  function normalizePerson(raw) {
    if (!raw || typeof raw !== "object" || !raw.name) return null;
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : newId("p"),
      name: String(raw.name).slice(0, 20),
      relation: raw.relation ? String(raw.relation).slice(0, 10) : null,
      createdAt: Number(raw.createdAt) || 0,
    };
  }

  /**
   * v2(해시 ID 시절)·v3 문서를 정규화한다. 같은 ID가 여러 series에 붙어 있으면
   * 첫 항목만 원래 ID를 유지하고 나머지는 새 난수 ID를 받는다(상태 기록은 첫 항목 소유로 남긴다).
   */
  function normalizeData(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.version !== SCHEMA_VERSION && raw.version !== 2) return null;
    const data = emptyData();
    const seenPeople = new Set();
    for (const person of (Array.isArray(raw.people) ? raw.people : []).map(normalizePerson).filter(Boolean)) {
      if (seenPeople.has(person.id)) continue; // v2 이름 해시 충돌: 동일 항목 중복만 제거
      seenPeople.add(person.id);
      data.people.push(person);
    }
    const seenSeries = new Set();
    let reassigned = 0;
    for (const series of (Array.isArray(raw.series) ? raw.series : []).map(normalizeSeries).filter(Boolean)) {
      if (seenSeries.has(series.id)) {
        series.id = newId("sr");
        reassigned += 1;
      }
      seenSeries.add(series.id);
      data.series.push(series);
    }
    data.idReassigned = reassigned;
    if (raw.statuses && typeof raw.statuses === "object") {
      for (const [key, value] of Object.entries(raw.statuses)) {
        if (!value || typeof value !== "object") continue;
        if (["done", "skipped"].includes(value.state)) data.statuses[key] = { state: value.state, at: Number(value.at) || 0 };
        else if (Number.isFinite(Number(value.snoozeUntil))) data.statuses[key] = { snoozeUntil: Number(value.snoozeUntil) };
      }
    }
    data.recents = (Array.isArray(raw.recents) ? raw.recents : []).slice(0, 5).filter((r) => r && r.label && r.snapshot);
    data.settings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    return data;
  }

  // ── v1 → v3 마이그레이션 (v1 원본은 호출자가 보존한다) ──
  function migrateV1(v1raw, nowMs) {
    const events = v1raw && Array.isArray(v1raw.events) ? v1raw.events : [];
    const data = emptyData();
    let migrated = 0;
    for (const event of events) {
      if (!event || !cal.parseKey(event.date)) continue;
      const time = isValidTime(event.time) ? event.time : null;
      const series = normalizeSeries({
        // v1 ID는 결정적으로 이어받아 중복 마이그레이션이 멱등이 되게 한다.
        id: typeof event.id === "string" && event.id ? `v1-${event.id}` : newId("sr"),
        kind: "general",
        title: event.title,
        date: event.date,
        slots: [{ time, reminders: Array.isArray(event.reminders) ? event.reminders : [] }],
        repeat: { freq: "once" },
        done: Boolean(event.done),
        createdAt: Number(event.createdAt) || nowMs,
        updatedAt: nowMs,
      });
      if (!series) continue;
      if (series.done) data.statuses[occurrenceId(series.id, series.date, 0)] = { state: "done", at: nowMs };
      data.series.push(series);
      migrated += 1;
    }
    return { data, migrated, total: events.length };
  }

  // ── 반복 발생 계산 ──
  function occursOn(series, dateKey) {
    const target = cal.parseKey(dateKey);
    const start = cal.parseKey(series.date);
    if (!target || !start) return false;
    if (dateKey < series.date) return false;
    if (series.repeat.until && dateKey > series.repeat.until) return false;
    if (series.overrides[dateKey] && series.overrides[dateKey].skip) return false;
    const freq = series.repeat.freq;
    if (freq === "once") return dateKey === series.date;
    if (freq === "daily") return true;
    if (freq === "weekly") {
      const weekdays = series.repeat.weekdays && series.repeat.weekdays.length > 0
        ? series.repeat.weekdays
        : [cal.weekdayOf(start.year, start.month, start.day)];
      return weekdays.includes(cal.weekdayOf(target.year, target.month, target.day));
    }
    if (freq === "monthly") {
      const day = Math.min(start.day, cal.daysInMonth(target.year, target.month));
      return target.day === day;
    }
    if (freq === "yearly") {
      if (target.month !== start.month) return false;
      const day = Math.min(start.day, cal.daysInMonth(target.year, target.month));
      return target.day === day;
    }
    return false;
  }

  function occurrenceId(seriesId, dateKey, slotIndex) {
    return `${seriesId}@${dateKey}#${slotIndex}`;
  }

  function overrideTime(series, dateKey, slotIndex) {
    const override = series.overrides[dateKey];
    if (override && override.times && isValidTime(override.times[slotIndex])) return override.times[slotIndex];
    return null;
  }

  /** [startKey, endKey] 범위의 발생 목록. 시각순 정렬. */
  function occurrencesInRange(seriesList, startKey, endKey) {
    const out = [];
    for (const series of seriesList || []) {
      let cursor = startKey < series.date ? series.date : startKey;
      while (cursor && cursor <= endKey) {
        if (occursOn(series, cursor)) {
          series.slots.forEach((slot, slotIndex) => {
            out.push({
              id: occurrenceId(series.id, cursor, slotIndex),
              seriesId: series.id,
              date: cursor,
              slotIndex,
              time: overrideTime(series, cursor, slotIndex) || slot.time,
              allDay: series.allDay,
              series,
            });
          });
        }
        if (series.repeat.freq === "once") break;
        cursor = addDays(cursor, 1);
      }
    }
    return out.sort((a, b) => `${a.date}T${a.time || "99:99"}`.localeCompare(`${b.date}T${b.time || "99:99"}`));
  }

  function nextOccurrence(series, fromKey, horizonDays = 730) {
    let cursor = fromKey < series.date ? series.date : fromKey;
    for (let i = 0; i <= horizonDays; i += 1) {
      if (!cursor) return null;
      if (series.repeat.until && cursor > series.repeat.until) return null;
      if (occursOn(series, cursor)) return cursor;
      if (series.repeat.freq === "once") return null;
      cursor = addDays(cursor, 1);
    }
    return null;
  }

  // ── 알람 발화 계산 (기기 현지 시간) ──
  function occurrenceAtMs(occ) {
    const d = cal.parseKey(occ.date);
    if (!d) return NaN;
    const [h, m] = String(occ.time || "09:00").split(":").map(Number);
    return new Date(d.year, d.month - 1, d.day, h || 0, m || 0, 0, 0).getTime();
  }

  /** 알림이 발생일보다 며칠 앞설 수 있는지(탐색 지평선 보정용, A-05). */
  function maxReminderLeadDays(seriesList) {
    let lead = 0;
    for (const series of seriesList || []) {
      for (const reminder of series.allDayReminders || []) lead = Math.max(lead, reminder.daysBefore);
      for (const slot of series.slots || []) {
        for (const offset of slot.reminders || []) lead = Math.max(lead, Math.ceil(offset / 1440));
      }
    }
    return lead;
  }

  /**
   * 다가오는 알람 발화 목록 (A-05·A-06). 시간 일정=슬롯 reminders(분 전),
   * 하루 종일=allDayReminders(며칠 전+시각, 복수), 조금 있다가=statuses의 snoozeUntil.
   * horizonDays 는 "발화 시각" 기준이며, 발생일 탐색은 사전 알림 lead 만큼 자동 확장한다.
   */
  function upcomingFires(data, nowMs, horizonDays = 3) {
    const today = msToKey(nowMs);
    const scanEnd = addDays(today, horizonDays + maxReminderLeadDays(data.series));
    const fireLimit = nowMs + (horizonDays + 1) * 86400000;
    const fires = [];
    for (const occ of occurrencesInRange(data.series, today, scanEnd)) {
      const status = data.statuses[occ.id];
      if (status && (status.state === "done" || status.state === "skipped")) continue;
      if (occ.series.repeat.freq === "once" && occ.series.done) continue;
      if (status && status.snoozeUntil) {
        if (status.snoozeUntil > nowMs) fires.push({ id: `${occ.id}:snooze:${status.snoozeUntil}`, at: status.snoozeUntil, offset: 0, occ });
        continue;
      }
      if (occ.allDay) {
        for (const reminder of occ.series.allDayReminders || []) {
          const fireDate = addDays(occ.date, -reminder.daysBefore);
          const at = occurrenceAtMs({ date: fireDate, time: reminder.time });
          if (at > nowMs && at <= fireLimit) fires.push({ id: `${occ.id}:allday:${reminder.daysBefore}@${reminder.time}`, at, offset: 0, occ });
        }
        continue;
      }
      const base = occurrenceAtMs(occ);
      const slot = occ.series.slots[occ.slotIndex];
      for (const offset of (slot && slot.reminders) || []) {
        const at = base - offset * 60000;
        if (at > nowMs && at <= fireLimit) fires.push({ id: `${occ.id}:${offset}`, at, offset, occ });
      }
    }
    return fires.sort((a, b) => a.at - b.at);
  }

  function msToKey(ms) {
    const d = new Date(ms);
    return cal.dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // ── 의미 지문: 최근 목록·가져오기 중복 판정용 (A-08·B-10) ──
  function fingerprint(series) {
    return JSON.stringify([
      series.kind,
      series.title,
      series.personId,
      series.withPersonId,
      series.allDay,
      series.slots.map((slot) => [slot.label, slot.time, slot.reminders]),
      series.repeat,
      series.anniversary,
    ]);
  }

  /** 가져오기 중복 판정: 같은 날짜 + 같은 지문. */
  function importKey(series) {
    return `${series.date}|${fingerprint(series)}`;
  }

  // ── 자연어 요약 ──
  function personName(data, personId, fallback = "나") {
    if (!personId) return fallback;
    const person = data.people.find((p) => p.id === personId);
    return person ? person.name : fallback;
  }

  function repeatLabel(series) {
    const freq = series.repeat.freq;
    if (freq === "once") return "이번만";
    if (freq === "daily") return "매일";
    if (freq === "weekly") {
      const weekdays = series.repeat.weekdays;
      if (!weekdays || weekdays.length === 0) return "매주";
      return `매주 ${weekdays.map((w) => cal.WEEKDAYS[w]).join("·")}요일`;
    }
    if (freq === "monthly") return "매월";
    return "매년";
  }

  function slotSummary(series) {
    const times = series.slots.filter((slot) => slot.time);
    if (times.length === 0) return "하루 종일";
    return times.map((slot) => cal.koreanTime(...slot.time.split(":").map(Number))).join(" · ");
  }

  function allDayReminderText(reminder) {
    const day = reminder.daysBefore === 0 ? "당일" : reminder.daysBefore === 1 ? "하루 전" : `${reminder.daysBefore}일 전`;
    return `${day} ${cal.koreanTime(...reminder.time.split(":").map(Number))}`;
  }

  /** 저장 확인 요약(여러 줄) — 자동 기본값도 숨기지 않고 보여준다. */
  function seriesSummaryLines(data, series) {
    const lines = [];
    const owner = personName(data, series.personId);
    const withName = series.withPersonId ? personName(data, series.withPersonId, "") : "";
    lines.push(cal.koreanDateTime(series.date, null) + (series.repeat.freq !== "once" ? `부터 ${repeatLabel(series)}` : ""));
    lines.push(slotSummary(series));
    if (series.kind === "medication") lines.push(`${owner}의 약 · 각 시간에 알려드려요.`);
    else if (series.kind === "meeting" && withName) lines.push(`${withName}와(과) 함께해요.`);
    else if (series.personId) lines.push(`${owner}의 일정이에요.`);
    if (series.allDay) {
      lines.push(series.allDayReminders.length > 0
        ? `${series.allDayReminders.map(allDayReminderText).join(", ")}에 알려드려요.`
        : "알람 없이 저장해요.");
    } else if (series.kind !== "medication") {
      const offsets = [...new Set(series.slots.flatMap((slot) => slot.reminders))].sort((a, b) => a - b);
      const labels = { 0: "정각", 10: "10분 전", 60: "1시간 전", 1440: "하루 전" };
      lines.push(offsets.length > 0 ? `${offsets.map((o) => labels[o] || `${o}분 전`).join(", ")}에 알려드려요.` : "알람 없이 저장해요.");
    }
    lines.push("공개 범위: 나만 보기");
    return lines;
  }

  // ── JSON 백업 (전체 상태, A-08) ──
  function exportJSON(data, exportedAt, appVersion) {
    return JSON.stringify({
      app: "calendarbom",
      appVersion,
      exportedAt,
      version: SCHEMA_VERSION,
      people: data.people,
      series: data.series,
      statuses: data.statuses,
      recents: data.recents,
      settings: data.settings,
    }, null, 2);
  }

  /**
   * v3·v2·v1 파일 모두 수용. 전체 상태를 돌려준다(호출자가 합치기/교체를 결정).
   * 반환: {series, people, statuses, recents, settings, counts}
   */
  function importParsed(parsed, nowMs) {
    const empty = { series: [], people: [], statuses: {}, recents: [], settings: null };
    if (!parsed || typeof parsed !== "object") return empty;
    if ((parsed.version === SCHEMA_VERSION || parsed.version === 2) && Array.isArray(parsed.series)) {
      const normalized = normalizeData(parsed) || emptyData();
      return {
        series: normalized.series,
        people: normalized.people,
        statuses: normalized.statuses,
        recents: normalized.recents,
        settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : null,
      };
    }
    if (Array.isArray(parsed.events) || Array.isArray(parsed)) {
      const migrated = migrateV1(Array.isArray(parsed) ? { events: parsed } : parsed, nowMs);
      return { series: migrated.data.series, people: [], statuses: migrated.data.statuses, recents: [], settings: null };
    }
    return empty;
  }

  return {
    SCHEMA_VERSION,
    MAX_ALL_DAY_REMINDERS,
    KINDS,
    newId,
    emptyData,
    addDays,
    addMonthsClamped,
    addYearsClamped,
    diffDays,
    anniversaryDate,
    anniversaryExplain,
    isValidTime,
    slotLabelForTime,
    normalizeSlot,
    normalizeSeries,
    normalizePerson,
    normalizeData,
    migrateV1,
    occursOn,
    occurrenceId,
    overrideTime,
    occurrencesInRange,
    nextOccurrence,
    occurrenceAtMs,
    maxReminderLeadDays,
    upcomingFires,
    msToKey,
    fingerprint,
    importKey,
    personName,
    repeatLabel,
    slotSummary,
    allDayReminderText,
    seriesSummaryLines,
    exportJSON,
    importParsed,
  };
});
