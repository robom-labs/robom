// 캘린더봄 ICS 가져오기·내보내기 — 외부 달력과 주고받는 최소 안전 구현.
// 시간대 정보 없는 floating local time으로 다룬다(일정은 사용자의 현지 시각).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarBomIcsCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeText(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  function unescapeText(value) {
    return String(value)
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  function exportICS(events) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//robom//calendarbom//KO", "CALSCALE:GREGORIAN"];
    for (const event of events || []) {
      const date = String(event.date || "").replace(/-/g, "");
      if (!/^\d{8}$/.test(date)) continue;
      const time = String(event.time || "").replace(":", "");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${event.id || `${date}-${Math.abs(hash(`${event.title}${event.time}`))}`}@calendarbom.robom`);
      if (/^\d{4}$/.test(time)) {
        lines.push(`DTSTART:${date}T${time}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${date}`);
      }
      lines.push(`SUMMARY:${escapeText(event.title || "일정")}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
    return h;
  }

  /** 접힌 줄(개행+공백) 펼치기 → 라인 배열. */
  function unfoldLines(text) {
    return String(text)
      .replace(/\r\n[ \t]/g, "")
      .replace(/\n[ \t]/g, "")
      .split(/\r?\n/);
  }

  /**
   * VEVENT의 SUMMARY·DTSTART만 뽑는 관용적 파서.
   * 반환: [{ title, date: "YYYY-MM-DD", time: "HH:MM" | null }]
   */
  function parseICS(text) {
    const out = [];
    let current = null;
    for (const rawLine of unfoldLines(text)) {
      const line = rawLine.trim();
      if (/^BEGIN:VEVENT$/i.test(line)) {
        current = { title: "", date: null, time: null };
        continue;
      }
      if (/^END:VEVENT$/i.test(line)) {
        if (current && current.date) out.push({ title: current.title || "가져온 일정", date: current.date, time: current.time });
        current = null;
        continue;
      }
      if (!current) continue;
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const nameWithParams = line.slice(0, idx).toUpperCase();
      const value = line.slice(idx + 1);
      const name = nameWithParams.split(";")[0];
      if (name === "SUMMARY") current.title = unescapeText(value).trim().slice(0, 80);
      if (name === "DTSTART") {
        // 20260720 / 20260720T150000 / ...T150000Z(UTC 표기는 로컬 벽시계로 그대로 수용)
        const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(value);
        if (m) {
          current.date = `${m[1]}-${m[2]}-${m[3]}`;
          current.time = m[4] ? `${m[4]}:${m[5]}` : null;
        }
      }
    }
    return out;
  }

  return { exportICS, parseICS, escapeText, unescapeText, unfoldLines };
});
