// 캘린더봄 알람 순수 계산 모듈 — 발화 시각·다가오는 일정·자연어 확인 문장.
// 발화 시각은 사용자의 기기 현지 시간 기준이다(일정은 사용자가 자기 시간대로 입력).
(function (root, factory) {
  const api = factory(root.CalendarBomCalendarCore || (typeof require === "function" ? require("./calendar-core.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarBomAlarmCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (calendar) {
  const OFFSET_LABELS = { 0: "정각", 10: "10분 전", 60: "1시간 전", 1440: "하루 전" };

  function eventAtMs(event) {
    const d = calendar.parseKey(event.date);
    if (!d) return NaN;
    const [h, m] = String(event.time || "09:00").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return new Date(d.year, d.month - 1, d.day, h, m, 0, 0).getTime();
  }

  function fireAtMs(event, offsetMin) {
    const at = eventAtMs(event);
    return Number.isFinite(at) ? at - offsetMin * 60000 : NaN;
  }

  /** 이벤트 하나의 (미래) 알람 발화 목록. 지난 시각은 제외한다. */
  function pendingFires(event, now) {
    if (!event || event.done) return [];
    const offsets = Array.isArray(event.reminders) ? event.reminders : [];
    return offsets
      .map((offset) => ({ offset, at: fireAtMs(event, offset), id: `${event.id}:${event.date}T${event.time}:${offset}` }))
      .filter((fire) => Number.isFinite(fire.at) && fire.at > now)
      .sort((a, b) => a.at - b.at);
  }

  /** 모든 이벤트에서 다가오는 발화를 시각순으로. */
  function upcomingFires(events, now) {
    return (events || [])
      .flatMap((event) => pendingFires(event, now).map((fire) => ({ ...fire, event })))
      .sort((a, b) => a.at - b.at);
  }

  /** 알림 탭 목록: 지나지 않은 일정(알람 유무 무관)을 시각순으로. */
  function upcomingEvents(events, now) {
    return (events || [])
      .map((event) => ({ event, at: eventAtMs(event) }))
      .filter((item) => Number.isFinite(item.at) && item.at >= now)
      .sort((a, b) => a.at - b.at);
  }

  function ddayLabel(event, now) {
    const d = calendar.parseKey(event.date);
    if (!d) return "";
    const target = new Date(d.year, d.month - 1, d.day).getTime();
    const today = new Date(now);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const diff = Math.round((target - base) / 86400000);
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    if (diff > 1) return `D-${diff}`;
    return diff === -1 ? "어제" : `D+${-diff}`;
  }

  // "7월 20일 월요일 오후 3시, '병원 예약' 알람을 저장했어요."
  function confirmationSentence(event) {
    const when = calendar.koreanDateTime(event.date, event.time);
    const suffix = (event.reminders || []).length > 0 ? "알람을 저장했어요" : "일정을 저장했어요";
    return `${when}, “${event.title}” ${suffix}.`;
  }

  function offsetLabel(offset) {
    return OFFSET_LABELS[offset] || `${offset}분 전`;
  }

  return { OFFSET_LABELS, eventAtMs, fireAtMs, pendingFires, upcomingFires, upcomingEvents, ddayLabel, confirmationSentence, offsetLabel };
});
