// 캘린더봄 — 큰 달력·쉬운 알람. 키보드 없이 버튼만으로 일정을 저장한다.
// 데이터는 이 기기의 localStorage 에만 저장한다(서버 전송 없음).
(function () {
  "use strict";

  const cal = window.CalendarBomCalendarCore;
  const alarm = window.CalendarBomAlarmCore;
  const ics = window.CalendarBomIcsCore;

  const APP_VERSION = "0.1.0";
  const BUILD_SHA = "__BUILD_SHA__";
  const EVENTS_KEY = "calendarbom:events:v1";
  const SETTINGS_KEY = "calendarbom:settings:v1";

  const TITLE_PRESETS = ["병원", "약 먹기", "가족 모임", "생일", "장보기", "은행", "여행", "운동"];
  const REMINDER_CHOICES = [0, 10, 60, 1440];
  const MINUTE_CHOICES = [0, 10, 20, 30, 40, 50];
  const MAX_NOTIFIED_IDS = 300;

  const $ = (id) => document.getElementById(id);

  // ── 저장소 ──
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      showToast("저장 공간이 가득 찼어요. 지난 일정을 정리해 주세요.");
    }
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
    const date = cal.parseKey(raw.date) ? raw.date : null;
    if (!date) return null;
    const time = /^\d{2}:\d{2}$/.test(String(raw.time || "")) ? raw.time : null;
    const reminders = Array.isArray(raw.reminders)
      ? raw.reminders.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      title: String(raw.title || "일정").slice(0, 40),
      date,
      time,
      reminders: time ? [...new Set(reminders)].sort((a, b) => a - b) : [],
      done: Boolean(raw.done),
      createdAt: Number(raw.createdAt) || Date.now(),
    };
  }

  function makeId() {
    return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const state = {
    events: (loadJSON(EVENTS_KEY, { events: [] }).events || []).map(normalizeEvent).filter(Boolean),
    settings: Object.assign({ fontScale: "normal", notifiedIds: [] }, loadJSON(SETTINGS_KEY, {})),
    cursor: null, // {year, month}
    sheet: null, // 열려 있는 날짜 시트 상태
    alarmTimers: [],
  };

  function persistEvents() {
    saveJSON(EVENTS_KEY, { version: 1, events: state.events });
  }

  function persistSettings() {
    saveJSON(SETTINGS_KEY, state.settings);
  }

  function todayKey() {
    const now = new Date();
    return cal.dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  // ── 화면 전환 ──
  function switchView(name) {
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("active", section.id === `view-${name}`);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      if (button.classList.contains("mobile-tab") || button.classList.contains("nav-pill")) {
        button.classList.toggle("active", button.dataset.view === name);
      }
    });
    if (name === "alerts") renderAlerts();
    if (name === "settings") renderSettings();
    window.scrollTo({ top: 0 });
  }

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  // ── 달력 렌더 ──
  function eventsOn(dateKey) {
    return state.events
      .filter((event) => event.date === dateKey)
      .sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));
  }

  function renderWeekdays() {
    $("weekdayRow").innerHTML = cal.WEEKDAYS
      .map((name, index) => `<span class="${index === 0 ? "wd-sun" : index === 6 ? "wd-sat" : ""}">${name}</span>`)
      .join("");
  }

  function renderCalendar() {
    const { year, month } = state.cursor;
    const grid = cal.buildMonthGrid(year, month);
    const today = todayKey();
    $("monthTitle").textContent = grid.label;

    $("calendarGrid").innerHTML = grid.cells
      .map((cell) => {
        const events = eventsOn(cell.key);
        const classes = ["day-cell"];
        if (!cell.inMonth) classes.push("out");
        if (cell.weekday === 0) classes.push("sun");
        if (cell.weekday === 6) classes.push("sat");
        if (cell.key === today) classes.push("today");
        const dots = events.slice(0, 3).map(() => "<i></i>").join("");
        const count = events.length > 0 ? `<span class="day-count">${events.length}개</span>` : "";
        const label = `${cell.month}월 ${cell.day}일 ${cal.weekdayName(cell.year, cell.month, cell.day)}요일` +
          (cell.key === today ? ", 오늘" : "") +
          (events.length > 0 ? `, 일정 ${events.length}개` : ", 일정 없음");
        return `<button type="button" role="gridcell" class="${classes.join(" ")}" data-date="${cell.key}" aria-label="${label}">` +
          `<span class="day-no" aria-hidden="true">${cell.day}</span><span class="day-dots" aria-hidden="true">${dots}</span>${count}</button>`;
      })
      .join("");

    renderTodayPanel();
  }

  function renderTodayPanel() {
    const now = Date.now();
    const upcoming = alarm.upcomingEvents(state.events.filter((event) => !event.done), now).slice(0, 3);
    const panel = $("todayPanel");
    if (upcoming.length === 0) {
      panel.innerHTML = `<div class="empty-note">저장된 일정이 없어요.<br />달력에서 날짜를 눌러 첫 일정을 만들어 보세요.</div>`;
      return;
    }
    panel.innerHTML = `<h2 class="panel-title">다가오는 일정</h2>` + upcoming
      .map(({ event }) => {
        const dday = alarm.ddayLabel(event, now);
        const when = cal.koreanDateTime(event.date, event.time) || "";
        return `<button type="button" class="upcoming-row" data-open-date="${event.date}">` +
          `<span class="dday${dday === "오늘" ? " dday-today" : ""}">${dday}</span>` +
          `<span><strong>${escapeHtml(event.title)}</strong><small>${when}</small></span>` +
          `<span class="row-go" aria-hidden="true">›</span></button>`;
      })
      .join("");
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  $("calendarGrid").addEventListener("click", (eventObject) => {
    const cell = eventObject.target.closest("[data-date]");
    if (cell) openDaySheet(cell.dataset.date);
  });
  $("todayPanel").addEventListener("click", (eventObject) => {
    const row = eventObject.target.closest("[data-open-date]");
    if (row) openDaySheet(row.dataset.openDate);
  });

  $("prevMonthButton").addEventListener("click", () => moveMonth(-1));
  $("nextMonthButton").addEventListener("click", () => moveMonth(1));
  $("todayButton").addEventListener("click", () => {
    const now = new Date();
    state.cursor = { year: now.getFullYear(), month: now.getMonth() + 1 };
    renderCalendar();
  });

  function moveMonth(delta) {
    state.cursor = cal.addMonths(state.cursor.year, state.cursor.month, delta);
    renderCalendar();
  }

  // ── 날짜 시트(빠른 추가) ──
  function defaultSheetDraft() {
    return { title: TITLE_PRESETS[0], customTitle: "", customMode: false, allDay: false, ampm: "pm", hour12: 3, minute: 0, reminders: [0] };
  }

  function openDaySheet(dateKey) {
    state.sheet = { date: dateKey, draft: defaultSheetDraft() };
    $("sheetDateTitle").textContent = cal.koreanDateTime(dateKey, null);
    renderSheetExisting();
    renderSheetForm();
    $("daySheet").hidden = false;
    document.body.style.overflow = "hidden";
    document.querySelectorAll("#calendarGrid .day-cell").forEach((cell) => {
      cell.classList.toggle("selected", cell.dataset.date === dateKey);
    });
    $("sheetCloseButton").focus({ preventScroll: true });
  }

  function closeDaySheet() {
    state.sheet = null;
    $("daySheet").hidden = true;
    document.body.style.overflow = "";
  }

  $("sheetCloseButton").addEventListener("click", closeDaySheet);
  $("daySheet").addEventListener("click", (eventObject) => {
    if (eventObject.target === $("daySheet")) closeDaySheet();
  });
  document.addEventListener("keydown", (eventObject) => {
    if (eventObject.key === "Escape" && state.sheet) closeDaySheet();
  });

  function renderSheetExisting() {
    const existing = eventsOn(state.sheet.date);
    const wrap = $("sheetExisting");
    wrap.hidden = existing.length === 0;
    $("sheetEventList").innerHTML = existing
      .map((event) => {
        const when = event.time ? cal.koreanTime(...event.time.split(":").map(Number)) : "하루 종일";
        const reminders = event.reminders.length > 0 ? ` · 알람 ${event.reminders.map(alarm.offsetLabel).join(", ")}` : "";
        return `<div class="sheet-event-row${event.done ? " done" : ""}">` +
          `<span><strong>${escapeHtml(event.title)}</strong><small>${when}${reminders}</small></span>` +
          `<button type="button" data-toggle-done="${event.id}">${event.done ? "되돌리기" : "완료"}</button>` +
          `<button type="button" class="ev-delete" data-delete-event="${event.id}">삭제</button></div>`;
      })
      .join("");
  }

  $("sheetEventList").addEventListener("click", (eventObject) => {
    const doneButton = eventObject.target.closest("[data-toggle-done]");
    const deleteButton = eventObject.target.closest("[data-delete-event]");
    if (doneButton) {
      const target = state.events.find((event) => event.id === doneButton.dataset.toggleDone);
      if (target) {
        target.done = !target.done;
        afterDataChange();
        renderSheetExisting();
        showToast(target.done ? `"${target.title}" 완료했어요.` : `"${target.title}" 다시 챙겨드릴게요.`);
      }
    }
    if (deleteButton) {
      const target = state.events.find((event) => event.id === deleteButton.dataset.deleteEvent);
      if (target && window.confirm(`"${target.title}" 일정을 삭제할까요?`)) {
        state.events = state.events.filter((event) => event.id !== target.id);
        afterDataChange();
        renderSheetExisting();
        showToast("일정을 삭제했어요.");
      }
    }
  });

  function renderSheetForm() {
    const draft = state.sheet.draft;

    $("titleChipGrid").innerHTML = TITLE_PRESETS
      .map((preset) => `<button class="chip" type="button" data-title="${preset}" aria-pressed="${!draft.customMode && draft.title === preset}">${preset}</button>`)
      .join("") + `<button class="chip" type="button" data-custom-title aria-pressed="${draft.customMode}">직접 입력</button>`;
    $("customTitleRow").hidden = !draft.customMode;

    $("allDayChip").setAttribute("aria-pressed", String(draft.allDay));
    $("timePicker").classList.toggle("off", draft.allDay);
    $("ampmGrid").querySelectorAll("[data-ampm]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.ampm === draft.ampm));
    });
    $("hourGrid").innerHTML = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      .map((hour) => `<button class="chip" type="button" data-hour="${hour}" aria-pressed="${draft.hour12 === hour}">${hour}시</button>`)
      .join("");
    $("minuteGrid").innerHTML = MINUTE_CHOICES
      .map((minute) => `<button class="chip" type="button" data-minute="${minute}" aria-pressed="${draft.minute === minute}">${minute === 0 ? "정각" : `${minute}분`}</button>`)
      .join("");

    $("reminderStep").style.display = draft.allDay ? "none" : "";
    $("reminderGrid").innerHTML = `<button class="chip" type="button" data-reminder="none" aria-pressed="${draft.reminders.length === 0}">알람 없음</button>` +
      REMINDER_CHOICES
        .map((offset) => `<button class="chip" type="button" data-reminder="${offset}" aria-pressed="${draft.reminders.includes(offset)}">${alarm.offsetLabel(offset)}</button>`)
        .join("");

    renderSheetPreview();
  }

  function draftTitle() {
    const draft = state.sheet.draft;
    return draft.customMode ? draft.customTitle.trim() || "일정" : draft.title;
  }

  function draftTime() {
    const draft = state.sheet.draft;
    if (draft.allDay) return null;
    let hour = draft.hour12 % 12;
    if (draft.ampm === "pm") hour += 12;
    return `${cal.pad2(hour)}:${cal.pad2(draft.minute)}`;
  }

  function renderSheetPreview() {
    $("sheetPreview").textContent = `${cal.koreanDateTime(state.sheet.date, draftTime())} · ${draftTitle()}`;
  }

  $("quickAddForm").addEventListener("click", (eventObject) => {
    const draft = state.sheet && state.sheet.draft;
    if (!draft) return;
    const target = eventObject.target.closest("button");
    if (!target || target.type === "submit") return;

    if (target.dataset.title) {
      draft.customMode = false;
      draft.title = target.dataset.title;
    } else if (target.hasAttribute("data-custom-title")) {
      draft.customMode = true;
      renderSheetForm();
      $("customTitleInput").focus();
      return;
    } else if (target.id === "allDayChip") {
      draft.allDay = !draft.allDay;
      if (draft.allDay) draft.reminders = [];
      else if (draft.reminders.length === 0) draft.reminders = [0];
    } else if (target.dataset.ampm) {
      draft.ampm = target.dataset.ampm;
    } else if (target.dataset.hour) {
      draft.hour12 = Number(target.dataset.hour);
    } else if (target.dataset.minute !== undefined) {
      draft.minute = Number(target.dataset.minute);
    } else if (target.dataset.reminder !== undefined) {
      if (target.dataset.reminder === "none") {
        draft.reminders = [];
      } else {
        const offset = Number(target.dataset.reminder);
        draft.reminders = draft.reminders.includes(offset)
          ? draft.reminders.filter((value) => value !== offset)
          : [...draft.reminders, offset].sort((a, b) => a - b);
      }
    } else {
      return;
    }
    renderSheetForm();
  });

  $("customTitleInput").addEventListener("input", () => {
    if (!state.sheet) return;
    state.sheet.draft.customTitle = $("customTitleInput").value;
    renderSheetPreview();
  });

  $("quickAddForm").addEventListener("submit", (eventObject) => {
    eventObject.preventDefault();
    if (!state.sheet) return;
    const event = normalizeEvent({
      id: makeId(),
      title: draftTitle(),
      date: state.sheet.date,
      time: draftTime(),
      reminders: state.sheet.draft.reminders,
      done: false,
      createdAt: Date.now(),
    });
    state.events.push(event);
    afterDataChange();
    closeDaySheet();
    showToast(alarm.confirmationSentence(event), 5000);
  });

  // ── 알림 탭 ──
  function renderAlerts() {
    const now = Date.now();
    const active = state.events.filter((event) => !event.done);
    const upcoming = alarm.upcomingEvents(active, now - 3600000); // 방금 지난 1시간까지는 보여준다
    const upcomingIds = new Set(upcoming.map(({ event }) => event.id));
    const past = state.events
      .filter((event) => !upcomingIds.has(event.id))
      .sort((a, b) => String(b.date + (b.time || "")).localeCompare(String(a.date + (a.time || ""))));

    const list = $("alertList");
    if (upcoming.length === 0) {
      list.innerHTML = `<div class="empty-note">다가오는 일정이 없어요.<br />달력에서 날짜를 눌러 일정을 추가해 보세요.</div>`;
    } else {
      list.innerHTML = upcoming.map(({ event }) => alertCardHtml(event, now)).join("");
    }

    const disclosure = $("pastDisclosure");
    disclosure.hidden = past.length === 0;
    $("pastCountText").textContent = past.length > 0 ? `${past.length}개` : "";
    $("pastList").innerHTML = past.slice(0, 30).map((event) => alertCardHtml(event, now)).join("");
  }

  function alertCardHtml(event, now) {
    const dday = alarm.ddayLabel(event, now);
    const when = cal.koreanDateTime(event.date, event.time);
    const reminders = event.reminders.length > 0
      ? `알람: <b>${event.reminders.map(alarm.offsetLabel).join(", ")}</b>`
      : "알람 없이 저장한 일정이에요.";
    return `<article class="alert-card${event.done ? " done" : ""}">` +
      `<div class="alert-card-top"><span class="dday${dday === "오늘" ? " dday-today" : ""}">${dday}</span><span class="alert-when">${when}</span></div>` +
      `<h3>${escapeHtml(event.title)}</h3>` +
      `<p class="alert-reminders">${reminders}</p>` +
      `<div class="alert-card-actions">` +
      `<button type="button" class="act-open" data-open-date="${event.date}">달력에서 보기</button>` +
      `<button type="button" data-toggle-done="${event.id}">${event.done ? "되돌리기" : "완료"}</button>` +
      `<button type="button" class="act-delete" data-delete-event="${event.id}">삭제</button>` +
      `</div></article>`;
  }

  $("view-alerts").addEventListener("click", (eventObject) => {
    const openButton = eventObject.target.closest("[data-open-date]");
    const doneButton = eventObject.target.closest("[data-toggle-done]");
    const deleteButton = eventObject.target.closest("[data-delete-event]");
    if (openButton) {
      const parsed = cal.parseKey(openButton.dataset.openDate);
      if (parsed) {
        state.cursor = { year: parsed.year, month: parsed.month };
        switchView("calendar");
        renderCalendar();
        openDaySheet(openButton.dataset.openDate);
      }
      return;
    }
    if (doneButton) {
      const target = state.events.find((event) => event.id === doneButton.dataset.toggleDone);
      if (target) {
        target.done = !target.done;
        afterDataChange();
        renderAlerts();
        showToast(target.done ? `"${target.title}" 완료했어요.` : `"${target.title}" 다시 챙겨드릴게요.`);
      }
    }
    if (deleteButton) {
      const target = state.events.find((event) => event.id === deleteButton.dataset.deleteEvent);
      if (target && window.confirm(`"${target.title}" 일정을 삭제할까요?`)) {
        state.events = state.events.filter((event) => event.id !== target.id);
        afterDataChange();
        renderAlerts();
        showToast("일정을 삭제했어요.");
      }
    }
  });

  // ── 알람 엔진: 페이지가 열려 있는 동안 setTimeout 으로 발화한다 ──
  function rearmAlarms() {
    state.alarmTimers.forEach(clearTimeout);
    state.alarmTimers = [];
    const now = Date.now();
    const horizon = now + 24 * 3600000;
    const fires = alarm.upcomingFires(state.events.filter((event) => !event.done), now)
      .filter((fire) => fire.at <= horizon && !state.settings.notifiedIds.includes(fire.id))
      .slice(0, 30);
    for (const fire of fires) {
      state.alarmTimers.push(setTimeout(() => fireAlarm(fire), Math.max(0, fire.at - Date.now())));
    }
    // 자정·시간 경과로 지평선이 옮겨가도 하루에 한 번은 다시 예약한다.
    state.alarmTimers.push(setTimeout(rearmAlarms, 6 * 3600000));
  }

  function fireAlarm(fire) {
    if (state.settings.notifiedIds.includes(fire.id)) return;
    state.settings.notifiedIds = [...state.settings.notifiedIds, fire.id].slice(-MAX_NOTIFIED_IDS);
    persistSettings();

    const event = fire.event;
    const body = `${cal.koreanDateTime(event.date, event.time)} · ${alarm.offsetLabel(fire.offset)} 알람`;
    if ("Notification" in window && Notification.permission === "granted") {
      const shown = navigator.serviceWorker && navigator.serviceWorker.ready
        ? navigator.serviceWorker.ready
            .then((registration) => registration.showNotification(`캘린더봄: ${event.title}`, {
              body,
              tag: fire.id,
              icon: "./icon-192-v2.png",
              badge: "./icon-192-v2.png",
              data: { url: "./" },
            }))
            .catch(() => null)
        : Promise.resolve(null);
      shown.then((result) => {
        if (result === null) {
          try {
            new Notification(`캘린더봄: ${event.title}`, { body, tag: fire.id });
          } catch {
            /* 알림 생성 실패 시 아래 토스트로 대신한다 */
          }
        }
      });
    }
    showToast(`⏰ ${event.title} — ${body}`, 8000);
    renderAlerts();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) rearmAlarms();
  });

  // ── 설정 ──
  function applyFontScale() {
    const scale = state.settings.fontScale;
    if (scale === "large" || scale === "xl") document.documentElement.dataset.font = scale;
    else delete document.documentElement.dataset.font;
    document.querySelectorAll(".font-scale-btn").forEach((button) => {
      button.classList.toggle("active", (button.dataset.font === "normal" ? "normal" : button.dataset.font) === (scale || "normal"));
    });
  }

  $("fontScaleGrid").addEventListener("click", (eventObject) => {
    const button = eventObject.target.closest("[data-font]");
    if (!button) return;
    state.settings.fontScale = button.dataset.font;
    persistSettings();
    applyFontScale();
    showToast("글자 크기를 바꿨어요.");
  });

  function renderSettings() {
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    const text = {
      granted: "알림이 켜져 있어요. 페이지가 열려 있으면 알람이 울립니다.",
      denied: "알림이 차단되어 있어요. 브라우저 주소창 옆 자물쇠에서 알림을 허용해 주세요.",
      default: "알림을 켜면 저장한 시간에 맞춰 알려드려요.",
      unsupported: "이 브라우저는 알림을 지원하지 않아요. 화면 안내로만 알려드립니다.",
    }[permission];
    $("permissionText").textContent = text;
    $("requestPermissionButton").hidden = permission !== "default";
    $("backupCountText").textContent = `현재 저장된 일정: ${state.events.length}개`;
    applyFontScale();
  }

  $("requestPermissionButton").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    try {
      await Notification.requestPermission();
    } catch {
      /* 사용자가 닫으면 그대로 둔다 */
    }
    renderSettings();
    if (Notification.permission === "granted") showToast("알림을 켰어요. 시간에 맞춰 알려드릴게요.");
  });

  // ── 보관·이동(JSON/ICS) ──
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  $("exportJsonButton").addEventListener("click", () => {
    download(`calendarbom-${todayKey()}.json`, JSON.stringify({ app: "calendarbom", version: 1, events: state.events }, null, 2), "application/json");
    showToast("보관용 파일을 저장했어요.");
  });

  $("exportIcsButton").addEventListener("click", () => {
    download(`calendarbom-${todayKey()}.ics`, ics.exportICS(state.events), "text/calendar");
    showToast("달력 파일을 저장했어요.");
  });

  $("importButton").addEventListener("click", () => $("importFileInput").click());
  $("importFileInput").addEventListener("change", async () => {
    const file = $("importFileInput").files && $("importFileInput").files[0];
    $("importFileInput").value = "";
    if (!file) return;
    const text = await file.text();
    let incoming = [];
    try {
      if (/BEGIN:VCALENDAR/i.test(text)) {
        incoming = ics.parseICS(text).map((item) => normalizeEvent({ ...item, reminders: item.time ? [0] : [] }));
      } else {
        const parsed = JSON.parse(text);
        incoming = (Array.isArray(parsed) ? parsed : parsed.events || []).map(normalizeEvent);
      }
    } catch {
      showToast("파일을 읽지 못했어요. 캘린더봄에서 저장한 파일인지 확인해 주세요.");
      return;
    }
    incoming = incoming.filter(Boolean);
    if (incoming.length === 0) {
      showToast("가져올 일정을 찾지 못했어요.");
      return;
    }
    const known = new Set(state.events.map((event) => `${event.date}|${event.time}|${event.title}`));
    const fresh = incoming.filter((event) => !known.has(`${event.date}|${event.time}|${event.title}`));
    state.events = [...state.events, ...fresh];
    afterDataChange();
    renderSettings();
    showToast(`일정 ${fresh.length}개를 가져왔어요.${incoming.length - fresh.length > 0 ? ` (중복 ${incoming.length - fresh.length}개 제외)` : ""}`);
  });

  // ── 공통 ──
  function afterDataChange() {
    persistEvents();
    renderCalendar();
    rearmAlarms();
  }

  let toastTimer = null;
  function showToast(message, duration = 3200) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  // ── 서비스워커·버전 표기 ──
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }

  $("appVersionText").textContent = APP_VERSION;
  $("buildShaText").textContent = BUILD_SHA.startsWith("__") ? "로컬" : BUILD_SHA;
  $("cacheVersionText").textContent = `calendarbom-v${APP_VERSION}`;

  // ── 시작 ──
  const now = new Date();
  state.cursor = { year: now.getFullYear(), month: now.getMonth() + 1 };
  applyFontScale();
  renderWeekdays();
  renderCalendar();
  renderSettings();
  rearmAlarms();
})();
