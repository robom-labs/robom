// 캘린더봄 v0.2.0 — 화면에는 지금 필요한 질문만, 안쪽에서는 사람·반복·약·기념일이 자동 준비되는 생활 달력.
// 데이터는 이 기기의 localStorage 에만 저장한다(서버 전송 없음).
(function () {
  "use strict";

  const cal = window.CalendarBomCalendarCore;
  const ics = window.CalendarBomIcsCore;
  const sched = window.CalendarBomScheduleCore;

  const APP_VERSION = "0.2.0";
  const BUILD_SHA = "__BUILD_SHA__";
  const V1_KEY = "calendarbom:events:v1"; // 절대 삭제하지 않는다(회귀·복구용 원본)
  const V1_SETTINGS_KEY = "calendarbom:settings:v1";
  const V2_KEY = "calendarbom:data:v2";
  const DRAFT_KEY = "calendarbom:draft:v2";
  const MAX_NOTIFIED_IDS = 300;

  const $ = (id) => document.getElementById(id);
  const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // ── 저장소 ──
  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("저장 공간이 가득 찼어요. 지난 일정을 정리해 주세요.");
      return false;
    }
  }

  function loadData() {
    const v2 = sched.normalizeData(readJSON(V2_KEY));
    if (v2) return v2;
    // v2가 없거나 깨졌으면 v1에서 이사한다. v1 원본은 그대로 둔다.
    const v1 = readJSON(V1_KEY);
    const data = v1 ? sched.migrateV1(v1, Date.now()).data : sched.emptyData();
    const oldSettings = readJSON(V1_SETTINGS_KEY);
    if (oldSettings && typeof oldSettings === "object") {
      data.settings.fontScale = oldSettings.fontScale || "normal";
    }
    data.settings.migratedFromV1 = Boolean(v1);
    writeJSON(V2_KEY, data);
    return data;
  }

  const state = {
    data: loadData(),
    cursor: null,
    sheet: null, // {date, mode, draft, detail, share, scope}
    alarmTimers: [],
    undo: null, // {snapshot, label}
    pendingCopy: null, // 다음 일정 만들기: 날짜만 고르면 되는 준비된 초안
  };

  function persist() {
    writeJSON(V2_KEY, state.data);
  }

  function snapshotUndo(label) {
    state.undo = { snapshot: JSON.parse(JSON.stringify(state.data)), label };
  }

  function undoLast() {
    if (!state.undo) return;
    state.data = sched.normalizeData(state.undo.snapshot) || state.data;
    state.undo = null;
    persist();
    closeDaySheet();
    renderCalendar();
    renderAlerts();
    rearmAlarms();
    showToast("방금 한 일을 되돌렸어요.");
  }

  function todayKey() {
    return sched.msToKey(Date.now());
  }

  // ── 템플릿 정의: 꼭 물을 것만 단계로 만들고 나머지는 기본값+[바꾸기] ──
  const TEMPLATES = {
    medication: { label: "약 먹기", steps: ["medCount", "medSlots"] },
    hospital: { label: "병원", steps: ["when"] },
    meeting: { label: "약속", steps: ["with", "when"] },
    anniversary: { label: "생일·기념일", steps: ["annWho", "annWhich"] },
    todo: { label: "할 일", steps: ["todoWhat", "when"] },
    custom: { label: "직접 입력", steps: ["customTitle", "when"] },
  };
  const TODO_PRESETS = ["장보기", "은행", "청소", "전화하기"];
  const MED_ALIASES = ["아침약", "점심약", "저녁약", "병원에서 받은 약", "영양제"];
  const MED_DEFAULT_SLOTS = {
    1: [{ label: "아침", time: "08:00" }],
    2: [{ label: "아침", time: "08:00" }, { label: "저녁", time: "19:00" }],
    3: [{ label: "아침", time: "08:00" }, { label: "점심", time: "13:00" }, { label: "저녁", time: "19:00" }],
  };
  const ANN_TYPES = [
    { key: "birthday", label: "생일", repeat: "yearly", tone: "celebrate" },
    { key: "wedding", label: "결혼기념일", repeat: "yearly", tone: "celebrate" },
    { key: "couple", label: "사귀기 시작한 날", repeat: "picks", tone: "celebrate" },
    { key: "memory", label: "기억하는 날", repeat: "yearly", tone: "memorial" },
  ];
  const ANN_PICKS = [
    { ruleType: "days", n: 100, label: "100일" },
    { ruleType: "days", n: 200, label: "200일" },
    { ruleType: "years", n: 1, label: "1주년" },
  ];
  const ANN_MORE_PICKS = [
    { ruleType: "days", n: 300, label: "300일" },
    { ruleType: "days", n: 500, label: "500일" },
    { ruleType: "days", n: 1000, label: "1000일" },
  ];
  const OFFSET_LABELS = { 0: "정각", 10: "10분 전", 60: "1시간 전", 1440: "하루 전" };
  const offsetLabel = (offset) => OFFSET_LABELS[offset] || `${offset}분 전`;

  function newDraft(templateKey) {
    const template = TEMPLATES[templateKey];
    return {
      template: templateKey,
      steps: [...template.steps],
      stepIndex: 0,
      title: null, // null 이면 저장 시 파생
      personId: null, // null = 나
      withPersonId: null,
      time: templateKey === "meeting" ? "18:00" : templateKey === "hospital" ? "10:00" : "09:00",
      allDay: false,
      reminders: [0],
      allDayReminder: { daysBefore: 1, time: "09:00" },
      repeat: templateKey === "medication" ? "daily" : "once",
      weekdays: [],
      med: { perDay: 2, slots: MED_DEFAULT_SLOTS[2].map((slot) => ({ ...slot })), alias: null },
      ann: { personId: null, type: null, picks: [], reminder: { daysBefore: 1, time: "09:00" } },
      expanded: null, // 기본값 [바꾸기] 인라인 확장
      timePanel: false,
      customN: { open: false, ruleType: "days" },
    };
  }

  function draftFromSnapshot(snapshot) {
    const templateKey = snapshot.template in TEMPLATES ? snapshot.template : "custom";
    const draft = newDraft(templateKey);
    Object.assign(draft, JSON.parse(JSON.stringify(snapshot)), { template: templateKey, expanded: null, timePanel: false, customN: { open: false, ruleType: "days" } });
    draft.steps = [];
    draft.stepIndex = 0; // 모든 값이 채워져 있으므로 요약 확인 + 저장만 남는다
    draft.prefilled = true;
    return draft;
  }

  // ── 화면 전환 ──
  function switchView(name) {
    document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${name}`));
    document.querySelectorAll(".mobile-tab[data-view], .nav-pill[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === name);
    });
    if (name === "alerts") renderAlerts();
    if (name === "settings") renderSettings();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

  // ── 달력 ──
  function seriesOnDate(dateKey) {
    const occs = sched.occurrencesInRange(state.data.series, dateKey, dateKey);
    const bySeries = new Map();
    for (const occ of occs) {
      if (!bySeries.has(occ.seriesId)) bySeries.set(occ.seriesId, []);
      bySeries.get(occ.seriesId).push(occ);
    }
    return bySeries;
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
    const rangeOccs = sched.occurrencesInRange(state.data.series, grid.cells[0].key, grid.cells.at(-1).key);
    const counts = new Map();
    for (const occ of rangeOccs) {
      if (!counts.has(occ.date)) counts.set(occ.date, new Set());
      counts.get(occ.date).add(occ.seriesId);
    }

    $("calendarGrid").innerHTML = grid.cells
      .map((cell) => {
        const seriesCount = (counts.get(cell.key) || new Set()).size;
        const classes = ["day-cell"];
        if (!cell.inMonth) classes.push("out");
        if (cell.weekday === 0) classes.push("sun");
        if (cell.weekday === 6) classes.push("sat");
        if (cell.key === today) classes.push("today");
        const dots = Array.from({ length: Math.min(seriesCount, 3) }, () => "<i></i>").join("");
        const count = seriesCount > 0 ? `<span class="day-count">${seriesCount}개</span>` : "";
        const label = `${cell.month}월 ${cell.day}일 ${cal.weekdayName(cell.year, cell.month, cell.day)}요일` +
          (cell.key === today ? ", 오늘" : "") +
          (seriesCount > 0 ? `, 일정 ${seriesCount}개` : ", 일정 없음") + ". 누르면 일정을 보거나 추가해요.";
        return `<button type="button" role="gridcell" class="${classes.join(" ")}" data-date="${cell.key}" aria-label="${label}">` +
          `<span class="day-no" aria-hidden="true">${cell.day}</span><span class="day-dots" aria-hidden="true">${dots}</span>${count}</button>`;
      })
      .join("");
    renderTodayPanel();
  }

  function occurrenceLine(occ) {
    const slot = occ.series.slots[occ.slotIndex];
    const timeText = occ.time ? cal.koreanTime(...occ.time.split(":").map(Number)) : "하루 종일";
    return slot && slot.label ? `${slot.label} ${timeText}` : timeText;
  }

  function ddayLabel(dateKey) {
    const diff = sched.diffDays(todayKey(), dateKey);
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    if (diff > 1) return `D-${diff}`;
    return diff === -1 ? "어제" : `D+${-diff}`;
  }

  function upcomingOccurrences(days = 60) {
    const start = todayKey();
    const nowMs = Date.now();
    return sched.occurrencesInRange(state.data.series, start, sched.addDays(start, days))
      .filter((occ) => {
        const status = state.data.statuses[occ.id];
        if (status && (status.state === "done" || status.state === "skipped")) return false;
        if (occ.series.repeat.freq === "once" && occ.series.done) return false;
        if (occ.date === start && occ.time) return sched.occurrenceAtMs(occ) >= nowMs - 3600000;
        return true;
      });
  }

  function renderTodayPanel() {
    const seen = new Set();
    const upcoming = upcomingOccurrences().filter((occ) => {
      const key = `${occ.seriesId}|${occ.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
    const panel = $("todayPanel");
    if (upcoming.length === 0) {
      panel.innerHTML = `<div class="empty-note">저장된 일정이 없어요.<br />달력에서 날짜를 눌러 첫 일정을 만들어 보세요.</div>`;
      return;
    }
    panel.innerHTML = `<h2 class="panel-title">다가오는 일정</h2>` + upcoming
      .map((occ) => {
        const dday = ddayLabel(occ.date);
        return `<button type="button" class="upcoming-row" data-open-date="${occ.date}">` +
          `<span class="dday${dday === "오늘" ? " dday-today" : ""}">${dday}</span>` +
          `<span><strong>${esc(occ.series.title)}</strong><small>${cal.koreanDateTime(occ.date, null)} · ${occurrenceLine(occ)}</small></span>` +
          `<span class="row-go" aria-hidden="true">›</span></button>`;
      })
      .join("");
  }

  $("calendarGrid").addEventListener("click", (event) => {
    const cell = event.target.closest("[data-date]");
    if (cell) openDaySheet(cell.dataset.date);
  });
  $("todayPanel").addEventListener("click", (event) => {
    const row = event.target.closest("[data-open-date]");
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

  // ── 날짜 시트 ──
  function openDaySheet(dateKey, mode = "home") {
    let draft = null;
    if (mode === "home" && state.pendingCopy) {
      draft = draftFromSnapshot(state.pendingCopy);
      state.pendingCopy = null;
      mode = "add";
    } else if (mode === "home") {
      const saved = readJSON(DRAFT_KEY);
      if (saved && saved.date === dateKey && saved.draft && Date.now() - (saved.at || 0) < 86400000) {
        draft = saved.draft;
        mode = "add";
        showToast("입력하던 일정을 이어서 보여드려요.");
      }
    }
    state.sheet = { date: dateKey, mode, draft, detail: null, share: null, scope: null, saved: false, editTime: null };
    $("daySheet").hidden = false;
    document.body.style.overflow = "hidden";
    document.querySelectorAll("#calendarGrid .day-cell").forEach((cell) => cell.classList.toggle("selected", cell.dataset.date === dateKey));
    renderSheet();
    $("sheetCloseButton").focus({ preventScroll: true });
  }

  function closeDaySheet(keepDraft = false) {
    if (!keepDraft && state.sheet && state.sheet.mode === "add" && state.sheet.draft && state.sheet.draft.stepIndex > 0 && !state.sheet.saved) {
      writeJSON(DRAFT_KEY, { date: state.sheet.date, draft: state.sheet.draft, at: Date.now() });
    } else if (state.sheet && state.sheet.saved) {
      localStorage.removeItem(DRAFT_KEY);
    }
    state.sheet = null;
    $("daySheet").hidden = true;
    document.body.style.overflow = "";
  }

  $("sheetCloseButton").addEventListener("click", () => closeDaySheet());
  $("daySheet").addEventListener("click", (event) => {
    if (event.target === $("daySheet")) closeDaySheet();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.sheet) closeDaySheet();
  });

  function renderSheet() {
    const sheet = state.sheet;
    if (!sheet) return;
    $("sheetDateTitle").textContent = cal.koreanDateTime(sheet.date, null);
    const body = $("sheetBody");
    const sticky = $("sheetSticky");
    sticky.hidden = true;
    if (sheet.mode === "home") {
      $("sheetKicker").textContent = "일정";
      body.innerHTML = renderHomeMode();
    } else if (sheet.mode === "add") {
      $("sheetKicker").textContent = "일정 추가";
      body.innerHTML = renderAddMode();
      renderSticky();
    } else if (sheet.mode === "detail") {
      $("sheetKicker").textContent = "일정";
      body.innerHTML = renderDetailMode();
    } else if (sheet.mode === "scope") {
      $("sheetKicker").textContent = "반복 일정";
      body.innerHTML = renderScopeMode();
    } else if (sheet.mode === "share") {
      $("sheetKicker").textContent = "공유";
      body.innerHTML = renderShareMode();
    }
  }

  // ── home 모드: 그날 일정 + 첫 질문 ──
  function renderHomeMode() {
    const sheet = state.sheet;
    const bySeries = seriesOnDate(sheet.date);
    let html = "";
    if (bySeries.size > 0) {
      html += `<strong class="sheet-step-title">이 날의 일정</strong><div class="sheet-event-list">`;
      for (const [seriesId, occs] of bySeries) {
        const series = occs[0].series;
        if (series.kind === "medication") {
          html += medDayRow(series, occs);
        } else {
          const occ = occs[0];
          const status = state.data.statuses[occ.id];
          const isDone = (status && status.state === "done") || (series.repeat.freq === "once" && series.done);
          html += `<button type="button" class="event-row${isDone ? " done-state" : ""}" data-detail="${seriesId}" data-occ-date="${occ.date}">` +
            `<span><strong>${esc(series.title)}</strong><small>${occurrenceLine(occ)}${series.repeat.freq !== "once" ? ` · ${sched.repeatLabel(series)}` : ""}${isDone ? " · 완료" : ""}</small></span>` +
            `<span class="row-go" aria-hidden="true">›</span></button>`;
        }
      }
      html += `</div>`;
    }
    const month = Number(sheet.date.slice(5, 7));
    const day = Number(sheet.date.slice(8, 10));
    html += `<div class="step-panel"><h3 class="step-title">${month}월 ${day}일에 어떤 일정을 추가할까요?</h3>`;
    const recents = state.data.recents;
    if (recents.length > 0) {
      html += `<div class="chip-grid" style="margin-bottom:8px"><button class="chip" type="button" data-recent="0">지난번과 같게: ${esc(recents[0].label)}</button></div>`;
      const more = recents.slice(1, 3);
      if (more.length > 0) {
        html += `<p class="med-note" style="margin:0 0 6px">최근 사용</p><div class="chip-grid" style="margin-bottom:10px">` +
          more.map((recent, index) => `<button class="chip" type="button" data-recent="${index + 1}">${esc(recent.label)}</button>`).join("") + `</div>`;
      }
      html += `<p class="med-note" style="margin:0 0 6px">자주 쓰는 일정</p>`;
    }
    html += `<div class="chip-grid">` +
      Object.entries(TEMPLATES).map(([key, template]) => `<button class="chip" type="button" data-template="${key}">${template.label}</button>`).join("") +
      `</div></div>`;
    return html;
  }

  function medDayRow(series, occs) {
    const rows = occs.map((occ) => {
      const status = state.data.statuses[occ.id];
      const stateText = status && status.state === "done" ? `<span class="dose-state">✓ 먹었어요</span>`
        : status && status.state === "skipped" ? `<span class="dose-state skipped">건너뛰었어요</span>`
        : status && status.snoozeUntil ? `<span class="dose-state">조금 있다가 (${cal.koreanTime(new Date(status.snoozeUntil).getHours(), new Date(status.snoozeUntil).getMinutes())})</span>`
        : "";
      const actions = status && (status.state === "done" || status.state === "skipped")
        ? `<button class="chip" type="button" data-dose-reset="${occ.id}">되돌리기</button>`
        : `<button class="chip" type="button" data-dose-done="${occ.id}">먹었어요</button>` +
          `<button class="chip" type="button" data-dose-snooze="${occ.id}">조금 있다가</button>` +
          `<button class="chip" type="button" data-dose-skip="${occ.id}">건너뛰었어요</button>`;
      return `<div class="dose-row"><span class="dose-when">${occurrenceLine(occ)}${stateText}</span><div class="dose-actions">${actions}</div></div>`;
    }).join("");
    return `<button type="button" class="event-row" data-detail="${series.id}" data-occ-date="${occs[0].date}">` +
      `<span><strong>${esc(series.title)}</strong><small>${sched.repeatLabel(series)} · ${sched.slotSummary(series)}</small></span>` +
      `<span class="row-go" aria-hidden="true">›</span></button>${rows}`;
  }

  // ── add 모드: 아코디언 ──
  function currentStep(draft) {
    return draft.stepIndex < draft.steps.length ? draft.steps[draft.stepIndex] : null;
  }

  function stepDoneSummary(draft, step) {
    if (step === "with") return { title: "누구와", value: personLabel(draft.withPersonId, "") };
    if (step === "medCount") return { title: "하루 몇 번", value: `하루 ${draft.med.perDay}번` };
    if (step === "medSlots") return { title: "시간", value: draft.med.slots.map((slot) => `${slot.label} ${cal.koreanTime(...slot.time.split(":").map(Number))}`).join(" · ") };
    if (step === "annWho") return { title: "누구의 날", value: personLabel(draft.ann.personId, "") };
    if (step === "annWhich") return { title: "어떤 날", value: annSummary(draft) };
    if (step === "todoWhat" || step === "customTitle") return { title: "일정", value: draft.title || "" };
    if (step === "when") return { title: "시간", value: draft.allDay ? "하루 종일" : cal.koreanTime(...draft.time.split(":").map(Number)) };
    return { title: step, value: "" };
  }

  function annSummary(draft) {
    const type = ANN_TYPES.find((t) => t.key === draft.ann.type);
    if (!type) return "";
    if (type.repeat === "picks") return `${type.label} · ${draft.ann.picks.map((pick) => pick.label).join(", ") || "날 선택"}`;
    return type.label;
  }

  function personLabel(personId, fallback = "나") {
    return sched.personName(state.data, personId, fallback);
  }

  function renderAddMode() {
    const draft = state.sheet.draft;
    let html = "";
    const templateLabel = TEMPLATES[draft.template].label;
    html += doneRow("일정 종류", draft.prefilled ? draftTitle(draft) : templateLabel, "template");
    draft.steps.forEach((step, index) => {
      if (index < draft.stepIndex) {
        const summary = stepDoneSummary(draft, step);
        html += doneRow(summary.title, summary.value, `step-${index}`);
      }
    });
    const step = currentStep(draft);
    if (step) html += renderStepPanel(draft, step);
    else html += renderConfirmPanel(draft);
    return html;
  }

  function doneRow(title, value, backTarget) {
    return `<div class="done-row"><span class="done-check" aria-hidden="true">✓</span>` +
      `<span class="done-copy">${esc(value)}<small>${esc(title)}</small></span>` +
      `<button class="link-btn" type="button" data-back="${backTarget}">변경</button></div>`;
  }

  function chip(label, dataAttr, pressed = false, extraClass = "") {
    return `<button class="chip ${extraClass}" type="button" ${dataAttr} aria-pressed="${pressed}">${label}</button>`;
  }

  function personChips(dataName, selectedId) {
    const chips = state.data.people.map((person) =>
      chip(esc(person.name), `data-${dataName}="${person.id}"`, selectedId === person.id));
    chips.push(chip("사람 추가", `data-add-person="${dataName}"`));
    return chips.join("");
  }

  function renderStepPanel(draft, step) {
    if (step === "with") {
      return stepPanel("누구와의 약속인가요?", `<div class="chip-grid">${personChips("with", draft.withPersonId)}</div>${draft.addingPerson === "with" ? inlineNameRow("with") : ""}`);
    }
    if (step === "medCount") {
      return stepPanel(`${personLabel(draft.personId)}의 약, 하루 몇 번 먹나요?`,
        `<div class="chip-grid">${[1, 2, 3].map((n) => chip(`하루 ${n}번`, `data-med-count="${n}"`, draft.med.perDay === n)).join("")}</div>`);
    }
    if (step === "medSlots") {
      const rows = draft.med.slots.map((slot, index) =>
        `<div class="default-row"><span class="default-label">${esc(slot.label)}</span>` +
        `<span class="default-value">${cal.koreanTime(...slot.time.split(":").map(Number))}</span>` +
        `<button class="link-btn" type="button" data-slot-edit="${index}">변경</button>` +
        (draft.editSlot === index ? `<div class="default-expand">${timeAdjust(slot.time, `data-slot-adjust="${index}"`, `data-slot-native="${index}"`)}</div>` : "") +
        `</div>`).join("");
      return stepPanel("이 시간에 알려드릴까요?",
        `<div class="defaults-box">${rows}</div><p class="med-note">시간은 처방받은 안내에 맞게 바꿔주세요.</p>` +
        `<div class="modal-actions" style="margin-top:10px"><button class="action-btn primary" type="button" data-step-ok>이대로 좋아요</button></div>`);
    }
    if (step === "annWho") {
      return stepPanel("누구의 어떤 날인가요?", `<div class="chip-grid">${personChips("ann", draft.ann.personId)}</div>${draft.addingPerson === "ann" ? inlineNameRow("ann") : ""}`);
    }
    if (step === "annWhich") {
      let html = `<div class="chip-grid">${ANN_TYPES.map((type) => chip(type.label, `data-ann-type="${type.key}"`, draft.ann.type === type.key)).join("")}</div>`;
      const type = ANN_TYPES.find((t) => t.key === draft.ann.type);
      if (type && type.repeat === "picks") {
        const picksHtml = ANN_PICKS.map((pick) => chip(pick.label, `data-ann-pick='${JSON.stringify(pick)}'`, draft.ann.picks.some((p) => p.label === pick.label))).join("") +
          chip("다른 날", "data-ann-more", draft.annMore === true);
        let moreHtml = "";
        if (draft.annMore) {
          moreHtml = `<div class="chip-grid" style="margin-top:8px">` +
            ANN_MORE_PICKS.map((pick) => chip(pick.label, `data-ann-pick='${JSON.stringify(pick)}'`, draft.ann.picks.some((p) => p.label === pick.label))).join("") +
            chip("N일 직접", `data-ann-custom="days"`) + chip("N개월", `data-ann-custom="months"`) + chip("N주년", `data-ann-custom="years"`) + `</div>`;
          if (draft.customN.open) {
            const unit = { days: "일", months: "개월", years: "주년" }[draft.customN.ruleType];
            moreHtml += `<div class="number-row"><input type="number" id="annCustomN" min="1" max="10000" inputmode="numeric" aria-label="숫자 입력" />` +
              `<button class="chip" type="button" data-ann-custom-ok>${unit} 추가</button></div>`;
          }
        }
        const explain = draft.ann.picks.map((pick) => `<p class="ann-explain">${sched.anniversaryExplain(state.sheet.date, pick.ruleType, pick.n)}</p>`).join("");
        html += `<p class="med-note" style="margin-top:10px">챙길 날을 골라주세요. 고른 날만 만들어드려요.</p>` +
          `<div class="chip-grid" style="margin-top:6px">${picksHtml}</div>${moreHtml}${explain}`;
        if (draft.ann.picks.length > 0) html += `<div class="modal-actions" style="margin-top:10px"><button class="action-btn primary" type="button" data-step-ok>이 날들로 좋아요</button></div>`;
      }
      return stepPanel("어떤 날을 챙길까요?", html);
    }
    if (step === "todoWhat") {
      return stepPanel("어떤 일인가요?",
        `<div class="chip-grid">${TODO_PRESETS.map((preset) => chip(preset, `data-title-pick="${esc(preset)}"`, draft.title === preset)).join("")}` +
        chip("직접 입력", "data-title-custom", draft.customOpen === true) + `</div>` +
        (draft.customOpen ? inlineTitleRow() : ""));
    }
    if (step === "customTitle") {
      return stepPanel("어떤 일정인가요?", inlineTitleRow());
    }
    if (step === "when") {
      return stepPanel(whenQuestion(draft), whenBody(draft));
    }
    return "";
  }

  function whenQuestion(draft) {
    if (draft.template === "hospital") return `${personLabel(draft.personId)}, 몇 시에 가나요?`;
    if (draft.template === "meeting") return "몇 시에 만나나요?";
    return "몇 시에 하나요?";
  }

  function stepPanel(question, body) {
    return `<div class="step-panel"><h3 class="step-title">${question}</h3>${body}</div>`;
  }

  function inlineNameRow(target) {
    return `<div class="inline-name-row"><label class="visually-hidden" for="personNameInput">어떻게 부를까요?</label>` +
      `<input id="personNameInput" type="text" maxlength="20" placeholder="예: 엄마" autocomplete="off" />` +
      `<button class="chip" type="button" data-person-save="${target}">저장</button></div>`;
  }

  function inlineTitleRow() {
    return `<div class="inline-name-row" style="margin-top:8px"><label class="visually-hidden" for="customTitleInput">일정 이름</label>` +
      `<input id="customTitleInput" type="text" maxlength="40" placeholder="예: 손주 입학식" autocomplete="off" />` +
      `<button class="chip" type="button" data-title-save>확인</button></div>`;
  }

  function quickTimeChips(draft) {
    const isToday = state.sheet.date === todayKey();
    const chips = [];
    const lastTime = state.data.settings[`lastTime:${draft.template}`];
    if (isToday) {
      const now = new Date();
      const plus = (minutes) => {
        const t = new Date(now.getTime() + minutes * 60000);
        return `${cal.pad2(t.getHours())}:${cal.pad2(t.getMinutes() - (t.getMinutes() % 10))}`;
      };
      chips.push({ label: "30분 뒤", time: plus(30) }, { label: "1시간 뒤", time: plus(60) });
      if (lastTime) chips.push({ label: `지난번 ${cal.koreanTime(...lastTime.split(":").map(Number))}`, time: lastTime });
      chips.push({ label: "저녁 7시", time: "19:00" });
    } else {
      if (lastTime) chips.push({ label: `지난번 ${cal.koreanTime(...lastTime.split(":").map(Number))}`, time: lastTime });
      chips.push({ label: "아침 9시", time: "09:00" }, { label: "점심 12시", time: "12:00" }, { label: "오후 3시", time: "15:00" }, { label: "저녁 7시", time: "19:00" });
    }
    return chips.slice(0, 4);
  }

  function timeAdjust(time, adjustAttr, nativeAttr) {
    return `<div class="time-display">${cal.koreanTime(...time.split(":").map(Number))}</div>` +
      `<div class="time-adjust-grid">` +
      `<button class="chip" type="button" ${adjustAttr} data-delta="-10">−10분</button>` +
      `<button class="chip" type="button" ${adjustAttr} data-delta="10">＋10분</button>` +
      `<button class="chip" type="button" ${adjustAttr} data-delta="0">정각</button></div>` +
      `<div class="time-native-row"><label class="visually-hidden">시간 직접 선택</label>` +
      `<input type="time" ${nativeAttr} value="${time}" aria-label="시간 직접 선택" /></div>`;
  }

  function whenBody(draft) {
    let html = `<div class="time-display">${draft.allDay ? "하루 종일" : cal.koreanTime(...draft.time.split(":").map(Number))}</div>`;
    html += `<div class="chip-grid">` + quickTimeChips(draft).map((quick) => chip(quick.label, `data-quick-time="${quick.time}"`)).join("") +
      chip("시간 없이 (하루 종일)", "data-all-day", draft.allDay) + `</div>`;
    html += `<div class="chip-grid" style="margin-top:8px">` + chip("시간 바꾸기", "data-time-panel", draft.timePanel) + `</div>`;
    if (draft.timePanel) {
      html += `<div class="default-expand" style="margin-top:8px">` +
        `<div class="time-adjust-grid">` +
        `<button class="chip" type="button" data-when-adjust data-delta="-10">−10분</button>` +
        `<button class="chip" type="button" data-when-adjust data-delta="10">＋10분</button>` +
        `<button class="chip" type="button" data-when-adjust data-delta="0">정각</button></div>` +
        `<div class="time-native-row"><input type="time" data-when-native value="${draft.time}" aria-label="시간 직접 선택" /></div>` +
        `<div class="modal-actions" style="margin-top:8px"><button class="action-btn primary" type="button" data-step-ok>이 시간으로 하기</button></div></div>`;
    }
    if (draft.prefilled) {
      html += `<div class="modal-actions" style="margin-top:10px"><button class="action-btn primary" type="button" data-step-ok>이 시간 그대로 좋아요</button></div>`;
    }
    return html;
  }

  function adjustTime(time, delta) {
    let [h, m] = time.split(":").map(Number);
    if (delta === 0) m = 0;
    else {
      m += delta;
      while (m < 0) { m += 60; h = (h + 23) % 24; }
      while (m >= 60) { m -= 60; h = (h + 1) % 24; }
    }
    return `${cal.pad2(h)}:${cal.pad2(m)}`;
  }

  // 자동 기본값: 숨기지 않고 보여주되 질문으로 만들지 않는다
  function renderConfirmPanel(draft) {
    let html = `<div class="defaults-box">`;
    if (["hospital", "medication"].includes(draft.template)) {
      html += defaultRow("누가", personLabel(draft.personId), "person");
      if (draft.expanded === "person") html += `<div class="default-expand"><div class="chip-grid">${chip("나", 'data-person=""', !draft.personId)}${personChips("person", draft.personId)}</div>${draft.addingPerson === "person" ? inlineNameRow("person") : ""}</div>`;
    }
    if (draft.template === "medication") {
      html += defaultRow("이름", medTitle(draft), "medname");
      if (draft.expanded === "medname") {
        html += `<div class="default-expand"><div class="chip-grid">${MED_ALIASES.map((alias) => chip(alias, `data-med-alias="${alias}"`, draft.med.alias === alias)).join("")}${chip("직접 입력", "data-title-custom", draft.customOpen === true)}</div>${draft.customOpen ? inlineTitleRow() : ""}</div>`;
      }
    }
    if (draft.template !== "anniversary") {
      html += defaultRow("반복", repeatText(draft), "repeat");
      if (draft.expanded === "repeat") {
        const options = [["once", "이번만"], ["daily", "매일"], ["weekly", "요일 선택"], ["monthly", "매월"], ["yearly", "매년"]];
        html += `<div class="default-expand"><div class="chip-grid">${options.map(([value, label]) => chip(label, `data-repeat="${value}"`, draft.repeat === value)).join("")}</div>`;
        if (draft.repeat === "weekly") {
          html += `<div class="chip-grid" style="margin-top:8px">${cal.WEEKDAYS.map((name, index) => chip(`${name}요일`, `data-weekday="${index}"`, draft.weekdays.includes(index))).join("")}</div>`;
        }
        html += `</div>`;
      }
    }
    if (draft.template === "anniversary" || draft.allDay) {
      const reminder = draft.template === "anniversary" ? draft.ann.reminder : draft.allDayReminder;
      html += defaultRow("알림", allDayReminderText(reminder), "allDayReminder");
      if (draft.expanded === "allDayReminder") {
        const options = [[7, "7일 전"], [1, "하루 전"], [0, "당일 오전"]];
        html += `<div class="default-expand"><div class="chip-grid">${options.map(([days, label]) => chip(label, `data-adr="${days}"`, Boolean(reminder) && reminder.daysBefore === days)).join("")}${chip("알람 없음", 'data-adr="none"', !reminder)}</div></div>`;
      }
    } else if (draft.template !== "medication") {
      html += defaultRow("알림", draft.reminders.length > 0 ? draft.reminders.map(offsetLabel).join(", ") : "알람 없음", "reminders");
      if (draft.expanded === "reminders") {
        html += `<div class="default-expand"><div class="chip-grid">${chip("알람 없음", 'data-reminder="none"', draft.reminders.length === 0)}${[0, 10, 60, 1440].map((offset) => chip(offsetLabel(offset), `data-reminder="${offset}"`, draft.reminders.includes(offset))).join("")}</div></div>`;
      }
    }
    html += `</div>`;

    const preview = buildSeriesList(draft)[0];
    if (preview) {
      html += `<div class="step-panel"><h3 class="step-title">이대로 저장할까요?</h3><div class="share-preview">` +
        `<strong style="font-size:1.1rem">${esc(preview.title)}</strong>\n` +
        sched.seriesSummaryLines(state.data, preview).map(esc).join("\n") + `</div></div>`;
    }
    return html;
  }

  function defaultRow(label, value, expandKey) {
    return `<div class="default-row"><span class="default-label">${label}</span><span class="default-value">${esc(value)}</span>` +
      `<button class="link-btn" type="button" data-expand="${expandKey}" aria-expanded="${state.sheet.draft.expanded === expandKey}">바꾸기</button></div>`;
  }

  function repeatText(draft) {
    const labels = { once: "이번만", daily: "매일", weekly: "매주", monthly: "매월", yearly: "매년" };
    if (draft.repeat === "weekly" && draft.weekdays.length > 0) return `매주 ${draft.weekdays.map((w) => cal.WEEKDAYS[w]).join("·")}요일`;
    return labels[draft.repeat];
  }

  function allDayReminderText(reminder) {
    if (!reminder) return "알람 없음";
    const day = reminder.daysBefore === 0 ? "당일" : reminder.daysBefore === 1 ? "하루 전" : `${reminder.daysBefore}일 전`;
    return `${day} ${cal.koreanTime(...reminder.time.split(":").map(Number))}`;
  }

  function medTitle(draft) {
    if (draft.title) return draft.title;
    if (draft.med.alias) return draft.personId ? `${personLabel(draft.personId)} ${draft.med.alias}` : `내 ${draft.med.alias}`;
    return draft.personId ? `${personLabel(draft.personId)} 약` : "내 약";
  }

  function draftTitle(draft) {
    if (draft.template === "medication") return medTitle(draft);
    if (draft.title) return draft.title;
    if (draft.template === "hospital") return draft.personId ? `${personLabel(draft.personId)} 병원` : "병원";
    if (draft.template === "meeting") return draft.withPersonId ? `${personLabel(draft.withPersonId, "")}와 약속` : "약속";
    return "일정";
  }

  /** 초안 → 저장할 series 목록(기념일은 고른 날마다 하나). */
  function buildSeriesList(draft) {
    const base = {
      kind: draft.template === "todo" ? "todo" : draft.template === "custom" ? "general" : draft.template,
      personId: draft.personId,
      withPersonId: draft.withPersonId,
      date: state.sheet.date,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (draft.template === "medication") {
      return [sched.normalizeSeries({
        ...base,
        title: medTitle(draft),
        slots: draft.med.slots.map((slot) => ({ label: slot.label, time: slot.time, reminders: [0] })),
        repeat: { freq: draft.repeat === "once" ? "daily" : draft.repeat, weekdays: draft.weekdays },
      })].filter(Boolean);
    }
    if (draft.template === "anniversary") {
      const type = ANN_TYPES.find((t) => t.key === draft.ann.type);
      const name = personLabel(draft.ann.personId, "");
      if (!type) return [];
      if (type.repeat === "picks") {
        return draft.ann.picks.map((pick) => sched.normalizeSeries({
          ...base,
          kind: "anniversary",
          personId: draft.ann.personId,
          title: `${name} ${pick.label}`,
          date: sched.anniversaryDate(state.sheet.date, pick.ruleType, pick.n),
          slots: [{ time: null, reminders: [] }],
          allDayReminder: draft.ann.reminder,
          repeat: { freq: "once" },
          anniversary: { baseDate: state.sheet.date, ruleType: pick.ruleType, n: pick.n, label: pick.label },
          tone: type.tone,
        })).filter(Boolean);
      }
      return [sched.normalizeSeries({
        ...base,
        kind: "anniversary",
        personId: draft.ann.personId,
        title: `${name} ${type.label}`,
        slots: [{ time: null, reminders: [] }],
        allDayReminder: draft.ann.reminder,
        repeat: { freq: "yearly" },
        tone: type.tone,
      })].filter(Boolean);
    }
    return [sched.normalizeSeries({
      ...base,
      title: draftTitle(draft),
      slots: [{ time: draft.allDay ? null : draft.time, reminders: draft.allDay ? [] : draft.reminders }],
      allDayReminder: draft.allDay ? draft.allDayReminder : null,
      repeat: { freq: draft.repeat, weekdays: draft.weekdays },
      tone: "neutral",
    })].filter(Boolean);
  }

  function renderSticky() {
    const draft = state.sheet.draft;
    const sticky = $("sheetSticky");
    const complete = currentStep(draft) === null;
    // 화면의 주 CTA는 하나만: 단계가 남아 있으면 저장 버튼 자체를 숨긴다.
    sticky.hidden = !complete;
    $("sheetSaveButton").disabled = !complete;
    const list = complete ? buildSeriesList(draft) : [];
    $("sheetPreview").textContent = complete && list.length > 0
      ? (list.length > 1 ? `${list.length}개의 날을 만들어드려요.` : `${cal.koreanDateTime(list[0].date, list[0].slots[0].time)} · ${list[0].title}`)
      : "";
  }

  function advanceStep() {
    const draft = state.sheet.draft;
    draft.stepIndex = Math.min(draft.stepIndex + 1, draft.steps.length);
    draft.timePanel = false;
    draft.prefilled = false;
    renderSheet();
  }

  function saveDraft() {
    const draft = state.sheet.draft;
    const list = buildSeriesList(draft);
    if (list.length === 0) return;
    snapshotUndo("save");
    for (const series of list) state.data.series.push(series);
    if (!draft.allDay && draft.time) state.data.settings[`lastTime:${draft.template}`] = draft.time;
    pushRecent(draft, list[0]);
    persist();
    localStorage.removeItem(DRAFT_KEY);
    state.sheet.saved = true;
    const first = list[0];
    const sentence = first.allDay
      ? `${cal.koreanDateTime(first.date, null)}, “${first.title}” 일정을 저장했어요.`
      : `${cal.koreanDateTime(first.date, first.slots[0].time)}, “${first.title}” ${first.slots[0].reminders.length > 0 ? "알람" : "일정"}을 저장했어요.`;
    const extra = list.length > 1 ? ` 외 ${list.length - 1}개.` : "";
    const isHospital = draft.template === "hospital";
    closeDaySheet();
    renderCalendar();
    rearmAlarms();
    showToast(sentence + extra, 8000, true);
    if (isHospital) state.data.settings.lastHospitalId = first.id;
  }

  function snapshotOfSeries(series) {
    return {
      template: series.kind in TEMPLATES ? series.kind : "custom",
      title: series.title,
      personId: series.personId,
      withPersonId: series.withPersonId,
      time: series.slots[0].time || "09:00",
      allDay: series.allDay,
      reminders: series.slots[0].reminders.length > 0 ? series.slots[0].reminders : [0],
      allDayReminder: series.allDayReminder || { daysBefore: 1, time: "09:00" },
      repeat: "once",
      weekdays: [],
      med: {
        perDay: series.slots.length,
        slots: series.slots.map((slot) => ({ label: slot.label || "시간", time: slot.time || "09:00" })),
        alias: null,
      },
      ann: { personId: series.personId, type: null, picks: [], reminder: series.allDayReminder || { daysBefore: 1, time: "09:00" } },
    };
  }

  function pushRecent(draft, series) {
    if (draft.template === "anniversary") return; // 계산된 특정 날짜는 재사용 의미가 없다
    const label = series.title;
    const snapshot = snapshotOfSeries(series);
    snapshot.template = draft.template;
    if (draft.template === "medication") snapshot.repeat = draft.repeat === "once" ? "daily" : draft.repeat;
    state.data.recents = [{ label, snapshot, savedAt: Date.now() }, ...state.data.recents.filter((recent) => recent.label !== label)].slice(0, 5);
  }

  // ── 시트 이벤트 위임 ──
  $("sheetBody").addEventListener("input", (event) => {
    const sheet = state.sheet;
    if (!sheet) return;
    if (event.target.matches("[data-when-native]") && sheet.draft) {
      if (sched.isValidTime(event.target.value)) {
        sheet.draft.time = event.target.value;
        sheet.draft.allDay = false;
        const display = $("sheetBody").querySelector(".time-display");
        if (display) display.textContent = cal.koreanTime(...sheet.draft.time.split(":").map(Number));
        renderSticky();
      }
    }
    if (event.target.matches("[data-slot-native]") && sheet.draft) {
      const index = Number(event.target.dataset.slotNative);
      if (sched.isValidTime(event.target.value)) sheet.draft.med.slots[index].time = event.target.value;
    }
    if (event.target.matches("[data-detail-native]")) {
      if (sched.isValidTime(event.target.value)) sheet.editTime = event.target.value;
    }
  });

  $("sheetBody").addEventListener("click", (event) => {
    const sheet = state.sheet;
    if (!sheet) return;
    const target = event.target.closest("button");
    if (!target) return;

    // home 모드
    if (target.dataset.template) {
      sheet.mode = "add";
      sheet.draft = newDraft(target.dataset.template);
      renderSheet();
      return;
    }
    if (target.dataset.recent !== undefined) {
      const recent = state.data.recents[Number(target.dataset.recent)];
      if (recent) {
        sheet.mode = "add";
        sheet.draft = draftFromSnapshot(recent.snapshot);
        renderSheet();
      }
      return;
    }
    if (target.dataset.detail) {
      sheet.mode = "detail";
      sheet.detail = { seriesId: target.dataset.detail, occDate: target.dataset.occDate || sheet.date };
      renderSheet();
      return;
    }
    if (target.dataset.doseDone || target.dataset.doseSnooze || target.dataset.doseSkip || target.dataset.doseReset) {
      handleDose(target);
      return;
    }
    if (target.hasAttribute("data-detail-adjust")) {
      if (sheet.editTime) {
        sheet.editTime = adjustTime(sheet.editTime, Number(target.dataset.delta));
        renderSheet();
      }
      return;
    }
    if (target.dataset.act) {
      handleDetailAction(target.dataset.act);
      return;
    }

    const draft = sheet.draft;
    if (sheet.mode !== "add" || !draft) return;

    if (target.dataset.back !== undefined) {
      if (target.dataset.back === "template") {
        sheet.mode = "home";
        sheet.draft = null;
      } else {
        draft.stepIndex = Number(target.dataset.back.replace("step-", ""));
        draft.prefilled = false;
      }
      renderSheet();
      return;
    }
    if (target.hasAttribute("data-step-ok")) { advanceStep(); return; }
    if (target.dataset.medCount) {
      draft.med.perDay = Number(target.dataset.medCount);
      draft.med.slots = MED_DEFAULT_SLOTS[draft.med.perDay].map((slot) => ({ ...slot }));
      advanceStep();
      return;
    }
    if (target.dataset.slotEdit !== undefined) {
      draft.editSlot = draft.editSlot === Number(target.dataset.slotEdit) ? null : Number(target.dataset.slotEdit);
      renderSheet();
      return;
    }
    if (target.hasAttribute("data-slot-adjust")) {
      const index = Number(target.getAttribute("data-slot-adjust"));
      draft.med.slots[index].time = adjustTime(draft.med.slots[index].time, Number(target.dataset.delta));
      renderSheet();
      return;
    }
    if (target.dataset.addPerson) {
      draft.addingPerson = target.dataset.addPerson;
      renderSheet();
      if ($("personNameInput")) $("personNameInput").focus();
      return;
    }
    if (target.dataset.personSave) {
      const name = ($("personNameInput") && $("personNameInput").value.trim()) || "";
      if (!name) return;
      snapshotUndo("person");
      const person = sched.normalizePerson({ name, createdAt: Date.now() });
      if (!state.data.people.some((p) => p.id === person.id)) state.data.people.push(person);
      persist();
      const field = target.dataset.personSave;
      draft.addingPerson = null;
      if (field === "with") { draft.withPersonId = person.id; advanceStep(); }
      else if (field === "ann") { draft.ann.personId = person.id; advanceStep(); }
      else { draft.personId = person.id; renderSheet(); }
      showToast("다음에도 빠르게 쓰도록 저장했어요.", 2600);
      return;
    }
    if (target.dataset.with !== undefined) { draft.withPersonId = target.dataset.with; advanceStep(); return; }
    if (target.dataset.annType) {
      draft.ann.type = target.dataset.annType;
      const type = ANN_TYPES.find((t) => t.key === draft.ann.type);
      if (type.repeat !== "picks") advanceStep();
      else renderSheet();
      return;
    }
    if (target.dataset.ann !== undefined) { draft.ann.personId = target.dataset.ann; advanceStep(); return; }
    if (target.dataset.annPick) {
      const pick = JSON.parse(target.dataset.annPick);
      const exists = draft.ann.picks.some((p) => p.label === pick.label);
      draft.ann.picks = exists ? draft.ann.picks.filter((p) => p.label !== pick.label) : [...draft.ann.picks, pick];
      renderSheet();
      return;
    }
    if (target.hasAttribute("data-ann-more")) { draft.annMore = !draft.annMore; renderSheet(); return; }
    if (target.dataset.annCustom) {
      draft.customN = { open: true, ruleType: target.dataset.annCustom };
      renderSheet();
      if ($("annCustomN")) $("annCustomN").focus();
      return;
    }
    if (target.hasAttribute("data-ann-custom-ok")) {
      const n = Number($("annCustomN") && $("annCustomN").value);
      if (Number.isInteger(n) && n >= 1) {
        const unit = { days: "일", months: "개월", years: "주년" }[draft.customN.ruleType];
        draft.ann.picks.push({ ruleType: draft.customN.ruleType, n, label: `${n}${unit}` });
        draft.customN.open = false;
        renderSheet();
      }
      return;
    }
    if (target.dataset.titlePick) { draft.title = target.dataset.titlePick; advanceStep(); return; }
    if (target.hasAttribute("data-title-custom")) {
      draft.customOpen = !draft.customOpen;
      renderSheet();
      if ($("customTitleInput")) $("customTitleInput").focus();
      return;
    }
    if (target.hasAttribute("data-title-save")) {
      const value = ($("customTitleInput") && $("customTitleInput").value.trim()) || "";
      if (!value) return;
      draft.title = value;
      draft.customOpen = false;
      if (currentStep(draft) === "todoWhat" || currentStep(draft) === "customTitle") advanceStep();
      else { draft.med.alias = null; renderSheet(); }
      return;
    }
    if (target.dataset.quickTime) {
      draft.time = target.dataset.quickTime;
      draft.allDay = false;
      advanceStep();
      return;
    }
    if (target.hasAttribute("data-all-day")) {
      draft.allDay = true;
      advanceStep();
      return;
    }
    if (target.hasAttribute("data-time-panel")) { draft.timePanel = !draft.timePanel; renderSheet(); return; }
    if (target.hasAttribute("data-when-adjust")) {
      draft.time = adjustTime(draft.time, Number(target.dataset.delta));
      draft.allDay = false;
      renderSheet();
      return;
    }
    if (target.dataset.expand) {
      draft.expanded = draft.expanded === target.dataset.expand ? null : target.dataset.expand;
      renderSheet();
      return;
    }
    if (target.dataset.person !== undefined) { draft.personId = target.dataset.person || null; renderSheet(); return; }
    if (target.dataset.medAlias) { draft.med.alias = target.dataset.medAlias; draft.title = null; renderSheet(); return; }
    if (target.dataset.repeat) {
      draft.repeat = target.dataset.repeat;
      if (draft.repeat !== "weekly") draft.weekdays = [];
      renderSheet();
      return;
    }
    if (target.dataset.weekday !== undefined) {
      const weekday = Number(target.dataset.weekday);
      draft.weekdays = draft.weekdays.includes(weekday) ? draft.weekdays.filter((w) => w !== weekday) : [...draft.weekdays, weekday].sort();
      renderSheet();
      return;
    }
    if (target.dataset.adr !== undefined) {
      const value = target.dataset.adr === "none" ? null : { daysBefore: Number(target.dataset.adr), time: "09:00" };
      if (draft.template === "anniversary") draft.ann.reminder = value;
      else draft.allDayReminder = value;
      renderSheet();
      return;
    }
    if (target.dataset.reminder !== undefined) {
      if (target.dataset.reminder === "none") draft.reminders = [];
      else {
        const offset = Number(target.dataset.reminder);
        draft.reminders = draft.reminders.includes(offset) ? draft.reminders.filter((v) => v !== offset) : [...draft.reminders, offset].sort((a, b) => a - b);
      }
      renderSheet();
      return;
    }
  });

  $("sheetSaveButton").addEventListener("click", saveDraft);

  // ── 상세 모드 ──
  function findSeries(seriesId) {
    return state.data.series.find((series) => series.id === seriesId);
  }

  function renderDetailMode() {
    const { seriesId, occDate } = state.sheet.detail;
    const series = findSeries(seriesId);
    if (!series) return `<div class="empty-note">일정을 찾지 못했어요.</div>`;
    const time = (series.overrides[occDate] && series.overrides[occDate].time) || series.slots[0].time;
    const isRepeat = series.repeat.freq !== "once";
    const status = state.data.statuses[sched.occurrenceId(series.id, occDate, 0)];
    const isDone = (status && status.state === "done") || (!isRepeat && series.done);
    let html = `<div class="step-panel"><h3 class="step-title">${esc(series.title)}</h3>` +
      `<p class="detail-meta"><b>${cal.koreanDateTime(occDate, time)}</b>` +
      `${isRepeat ? ` · ${sched.repeatLabel(series)}` : ""}` +
      `${series.personId ? ` · ${esc(personLabel(series.personId))}` : ""}` +
      `${series.withPersonId ? ` · ${esc(personLabel(series.withPersonId, ""))}와 함께` : ""}` +
      `${isDone ? " · 완료" : ""}</p>`;
    if (series.anniversary) {
      html += `<p class="ann-explain">${sched.anniversaryExplain(series.anniversary.baseDate, series.anniversary.ruleType, series.anniversary.n)}</p>`;
    }
    html += `<div class="action-grid" style="margin-top:12px">`;
    if (series.kind !== "medication") {
      html += `<button class="action-btn" type="button" data-act="toggle-done">${isDone ? "완료 취소" : "완료"}</button>`;
    }
    html += `<button class="action-btn" type="button" data-act="edit-time">시간 바꾸기</button>` +
      `<button class="action-btn" type="button" data-act="copy">복사</button>` +
      (series.kind === "hospital" ? `<button class="action-btn primary" type="button" data-act="next">다음 일정 만들기</button>` : "") +
      `<button class="action-btn" type="button" data-act="share">공유</button>` +
      `<button class="action-btn danger wide" type="button" data-act="delete">삭제</button>` +
      `</div>`;
    if (state.sheet.editTime) {
      html += `<div class="default-expand" style="margin-top:6px">` + timeAdjust(state.sheet.editTime, "data-detail-adjust", "data-detail-native") +
        `<div class="modal-actions" style="margin-top:8px"><button class="action-btn primary" type="button" data-act="edit-time-save">이 시간으로 바꾸기</button></div></div>`;
    }
    html += `</div>`;
    return html;
  }

  function handleDetailAction(action) {
    const sheet = state.sheet;
    if (sheet.mode === "scope") { handleScopeChoice(action); return; }
    if (sheet.mode === "share") { handleShareAction(action); return; }
    const series = sheet.detail && findSeries(sheet.detail.seriesId);
    if (!series) return;
    const isRepeat = series.repeat.freq !== "once";
    if (action === "toggle-done") {
      snapshotUndo("done");
      if (isRepeat) {
        const occId = sched.occurrenceId(series.id, sheet.detail.occDate, 0);
        if (state.data.statuses[occId] && state.data.statuses[occId].state === "done") delete state.data.statuses[occId];
        else state.data.statuses[occId] = { state: "done", at: Date.now() };
      } else {
        series.done = !series.done;
      }
      persist();
      renderSheet();
      renderCalendar();
      rearmAlarms();
      return;
    }
    if (action === "edit-time") {
      sheet.editTime = sheet.editTime
        ? null
        : ((series.overrides[sheet.detail.occDate] && series.overrides[sheet.detail.occDate].time) || series.slots[0].time || "09:00");
      renderSheet();
      return;
    }
    if (action === "edit-time-save") {
      if (isRepeat) {
        sheet.scope = { action: "edit-time", time: sheet.editTime };
        sheet.mode = "scope";
        renderSheet();
      } else {
        snapshotUndo("edit");
        series.slots[0].time = sheet.editTime;
        series.allDay = series.slots.every((slot) => !slot.time);
        series.updatedAt = Date.now();
        persist();
        sheet.editTime = null;
        renderSheet();
        renderCalendar();
        rearmAlarms();
        showToast("시간을 바꿨어요.", 6000, true);
      }
      return;
    }
    if (action === "copy") {
      sheet.mode = "add";
      sheet.draft = draftFromSnapshot(snapshotOfSeries(series));
      renderSheet();
      return;
    }
    if (action === "next") {
      state.pendingCopy = snapshotOfSeries(series);
      closeDaySheet(true);
      showToast("달력에서 다음 병원 갈 날짜를 눌러주세요.", 6000);
      return;
    }
    if (action === "share") {
      sheet.mode = "share";
      sheet.share = { seriesId: series.id, occDate: sheet.detail.occDate };
      renderSheet();
      return;
    }
    if (action === "delete") {
      if (isRepeat) {
        sheet.scope = { action: "delete" };
        sheet.mode = "scope";
        renderSheet();
      } else {
        snapshotUndo("delete");
        state.data.series = state.data.series.filter((s) => s.id !== series.id);
        persist();
        closeDaySheet(true);
        renderCalendar();
        renderAlerts();
        rearmAlarms();
        showToast(`"${series.title}" 일정을 삭제했어요.`, 8000, true);
      }
    }
  }

  // ── 반복 수정 범위 ──
  function renderScopeMode() {
    const action = state.sheet.scope.action === "delete" ? "삭제" : "시간 변경";
    return `<div class="step-panel"><h3 class="step-title">반복 일정이에요. 어디까지 ${action}할까요?</h3>` +
      `<div class="modal-actions">` +
      `<button class="action-btn" type="button" data-act="scope-one">오늘 일정만</button>` +
      `<button class="action-btn" type="button" data-act="scope-forward">오늘부터 앞으로</button>` +
      `<button class="action-btn" type="button" data-act="scope-all">반복 전체</button>` +
      `<button class="action-btn" type="button" data-act="scope-cancel">그만두기</button>` +
      `</div></div>`;
  }

  function handleScopeChoice(action) {
    const sheet = state.sheet;
    const series = findSeries(sheet.detail.seriesId);
    if (!series || action === "scope-cancel") {
      sheet.mode = "detail";
      sheet.scope = null;
      renderSheet();
      return;
    }
    const date = sheet.detail.occDate;
    const isDelete = sheet.scope.action === "delete";
    snapshotUndo(isDelete ? "delete" : "edit");
    if (action === "scope-one") {
      if (isDelete) series.overrides[date] = { skip: true };
      else series.overrides[date] = { ...(series.overrides[date] || {}), time: sheet.scope.time };
    } else if (action === "scope-forward") {
      const before = sched.addDays(date, -1);
      if (isDelete) {
        series.repeat = { ...series.repeat, until: before };
      } else {
        const clone = JSON.parse(JSON.stringify(series));
        clone.id = `${series.id}-f${date.replace(/-/g, "")}`;
        clone.date = date;
        clone.slots[0].time = sheet.scope.time;
        clone.overrides = {};
        series.repeat = { ...series.repeat, until: before };
        const normalized = sched.normalizeSeries(clone);
        if (normalized) state.data.series.push(normalized);
      }
    } else if (action === "scope-all") {
      if (isDelete) {
        state.data.series = state.data.series.filter((s) => s.id !== series.id);
      } else {
        series.slots[0].time = sheet.scope.time;
      }
    }
    series.updatedAt = Date.now();
    persist();
    closeDaySheet(true);
    renderCalendar();
    renderAlerts();
    rearmAlarms();
    showToast(isDelete ? "반복 일정을 정리했어요." : "시간을 바꿨어요.", 8000, true);
  }

  // ── 공유(한 건) ──
  function shareText(series, occDate) {
    const time = (series.overrides[occDate] && series.overrides[occDate].time) || series.slots[0].time;
    const lines = [series.title, cal.koreanDateTime(occDate, time)];
    if (series.place) lines.push(series.place);
    lines.push("", "— 캘린더봄에서 보냄");
    return lines.join("\n");
  }

  function renderShareMode() {
    const { seriesId, occDate } = state.sheet.share;
    const series = findSeries(seriesId);
    if (!series) return "";
    let html = `<div class="step-panel"><h3 class="step-title">이 내용만 보낼게요</h3>`;
    if (series.kind === "medication") {
      html += `<p class="share-warn">약 이름이 들어 있어요. 보낼 사람을 한 번 더 확인해 주세요.</p>`;
    }
    html += `<div class="share-preview">${esc(shareText(series, occDate))}</div>` +
      `<p class="share-note">공유하지 않는 것: 내 다른 일정, 전체 달력, 개인 메모.</p>` +
      `<div class="modal-actions">` +
      `<button class="action-btn primary" type="button" data-act="share-text">문자·메신저로 보내기</button>` +
      `<button class="action-btn" type="button" data-act="share-ics">달력 파일로 저장 (ICS)</button>` +
      `<button class="action-btn" type="button" data-act="share-back">뒤로</button>` +
      `</div></div>`;
    return html;
  }

  async function handleShareAction(action) {
    const sheet = state.sheet;
    const series = findSeries(sheet.share.seriesId);
    if (!series) return;
    if (action === "share-back") {
      sheet.mode = "detail";
      renderSheet();
      return;
    }
    if (action === "share-text") {
      const text = shareText(series, sheet.share.occDate);
      if (navigator.share) {
        try { await navigator.share({ text }); } catch { /* 사용자가 닫음 */ }
      } else {
        try {
          await navigator.clipboard.writeText(text);
          showToast("내용을 복사했어요. 문자나 메신저에 붙여넣어 주세요.");
        } catch {
          showToast("복사하지 못했어요. 화면의 내용을 직접 전달해 주세요.");
        }
      }
      return;
    }
    if (action === "share-ics") {
      const time = (series.overrides[sheet.share.occDate] && series.overrides[sheet.share.occDate].time) || series.slots[0].time;
      download(`calendarbom-share-${sheet.share.occDate}.ics`, ics.exportICS([{ id: series.id, title: series.title, date: sheet.share.occDate, time }]), "text/calendar");
      showToast("달력 파일을 저장했어요.");
    }
  }

  // ── 복용 상태 ──
  function handleDose(target) {
    const occId = target.dataset.doseDone || target.dataset.doseSnooze || target.dataset.doseSkip || target.dataset.doseReset;
    if (target.dataset.doseSnooze && !target.dataset.snoozeMin) {
      // 조금 있다가: 분 선택 칩으로 교체(같은 자리, 화면 이동 없음)
      const wrap = target.closest(".dose-actions");
      if (wrap) {
        wrap.innerHTML = [5, 10, 30, 60].map((minutes) =>
          `<button class="chip" type="button" data-dose-snooze="${occId}" data-snooze-min="${minutes}">${minutes}분 뒤</button>`).join("");
      }
      return;
    }
    snapshotUndo("dose");
    if (target.dataset.doseDone) state.data.statuses[occId] = { state: "done", at: Date.now() };
    else if (target.dataset.doseSkip) state.data.statuses[occId] = { state: "skipped", at: Date.now() };
    else if (target.dataset.doseReset) delete state.data.statuses[occId];
    else if (target.dataset.snoozeMin) state.data.statuses[occId] = { snoozeUntil: Date.now() + Number(target.dataset.snoozeMin) * 60000 };
    persist();
    rearmAlarms();
    if (state.sheet) renderSheet();
    renderAlerts();
    renderCalendar();
    if (target.dataset.doseDone) showToast("먹었어요라고 기록했어요.", 5000, true);
    if (target.dataset.snoozeMin) showToast(`${target.dataset.snoozeMin}분 뒤에 다시 알려드릴게요.`, 5000);
  }

  $("view-alerts").addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.doseDone || target.dataset.doseSnooze || target.dataset.doseSkip || target.dataset.doseReset) {
      handleDose(target);
      return;
    }
    if (target.dataset.openDate) {
      const parsed = cal.parseKey(target.dataset.openDate);
      if (parsed) {
        state.cursor = { year: parsed.year, month: parsed.month };
        switchView("calendar");
        renderCalendar();
        openDaySheet(target.dataset.openDate);
      }
    }
  });

  // ── 알림 탭 ──
  function alertCard(occ) {
    const dday = ddayLabel(occ.date);
    const series = occ.series;
    const isMedToday = series.kind === "medication" && occ.date === todayKey();
    const status = state.data.statuses[occ.id];
    let doseActions = "";
    if (isMedToday && !(status && (status.state === "done" || status.state === "skipped"))) {
      doseActions = `<div class="dose-actions" style="margin-top:8px">` +
        `<button class="chip" type="button" data-dose-done="${occ.id}">먹었어요</button>` +
        `<button class="chip" type="button" data-dose-snooze="${occ.id}">조금 있다가</button>` +
        `<button class="chip" type="button" data-dose-skip="${occ.id}">건너뛰었어요</button></div>`;
    }
    return `<article class="alert-card">` +
      `<div class="alert-card-top"><span class="dday${dday === "오늘" ? " dday-today" : ""}">${dday}</span>` +
      `<span class="alert-when">${cal.koreanDateTime(occ.date, null)} · ${occurrenceLine(occ)}</span></div>` +
      `<h3>${esc(series.title)}</h3>` +
      doseActions +
      `<div class="alert-card-actions" style="margin-top:8px"><button type="button" class="act-open" data-open-date="${occ.date}">달력에서 보기</button></div>` +
      `</article>`;
  }

  function renderAlerts() {
    const now = Date.now();
    const today = todayKey();
    const all = upcomingOccurrences(30);
    const next = all[0];
    const todayOccs = all.filter((occ) => occ.date === today);
    const later = all.filter((occ) => occ.date !== today).slice(0, 10);

    let html = "";
    if (next) {
      html += `<div class="next-up"><span class="next-kicker">지금 다음 일정</span><h3>${esc(next.series.title)}</h3>` +
        `<p>${cal.koreanDateTime(next.date, null)} · ${occurrenceLine(next)}</p></div>`;
      if (todayOccs.length > 0) html += `<h2 class="alert-group-title">오늘 남은 일정</h2>` + todayOccs.map(alertCard).join("");
      if (later.length > 0) html += `<h2 class="alert-group-title">곧 다가오는 일정</h2>` + later.map(alertCard).join("");
    } else {
      html = `<div class="empty-note">다가오는 일정이 없어요.<br />달력에서 날짜를 눌러 일정을 추가해 보세요.</div>`;
    }
    $("alertList").innerHTML = html;

    // 지난 일정: 최근 30일
    const pastStart = sched.addDays(today, -30);
    const past = sched.occurrencesInRange(state.data.series, pastStart, today)
      .filter((occ) => {
        const status = state.data.statuses[occ.id];
        if (occ.date === today) {
          const passed = occ.time && sched.occurrenceAtMs(occ) < now - 3600000;
          return (status && (status.state === "done" || status.state === "skipped")) || passed;
        }
        return true;
      })
      .reverse()
      .slice(0, 20);
    $("pastDisclosure").hidden = past.length === 0;
    $("pastCountText").textContent = past.length > 0 ? `${past.length}개` : "";
    $("pastList").innerHTML = past.map((occ) =>
      `<article class="alert-card done"><div class="alert-card-top"><span class="alert-when">${cal.koreanDateTime(occ.date, null)} · ${occurrenceLine(occ)}</span></div>` +
      `<h3>${esc(occ.series.title)}</h3></article>`).join("");
  }

  // ── 알람 엔진: 페이지가 열려 있는 동안 setTimeout 으로 발화 ──
  function rearmAlarms() {
    state.alarmTimers.forEach(clearTimeout);
    state.alarmTimers = [];
    const now = Date.now();
    const notified = state.data.settings.notifiedIds || [];
    const fires = sched.upcomingFires(state.data, now, 2)
      .filter((fire) => fire.at <= now + 24 * 3600000 && !notified.includes(fire.id))
      .slice(0, 30);
    for (const fire of fires) {
      state.alarmTimers.push(setTimeout(() => fireAlarm(fire), Math.max(0, fire.at - Date.now())));
    }
    state.alarmTimers.push(setTimeout(rearmAlarms, 6 * 3600000));
  }

  function fireAlarm(fire) {
    const notified = state.data.settings.notifiedIds || [];
    if (notified.includes(fire.id)) return;
    state.data.settings.notifiedIds = [...notified, fire.id].slice(-MAX_NOTIFIED_IDS);
    persist();
    const series = fire.occ.series;
    const body = `${cal.koreanDateTime(fire.occ.date, fire.occ.time)}${fire.offset > 0 ? ` · ${offsetLabel(fire.offset)} 알람` : ""}`;
    if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(`캘린더봄: ${series.title}`, {
          body,
          tag: fire.id,
          icon: "./icon-192-v2.png",
          badge: "./icon-192-v2.png",
          data: { url: "./" },
        }))
        .catch(() => undefined);
    }
    showToast(`⏰ ${series.title} — ${body}`, 9000);
    renderAlerts();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) rearmAlarms();
  });

  // ── 설정 ──
  function applyFontScale() {
    const scale = state.data.settings.fontScale || "normal";
    if (scale === "large" || scale === "xl") document.documentElement.dataset.font = scale;
    else delete document.documentElement.dataset.font;
    document.querySelectorAll(".font-scale-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.font === scale);
    });
  }

  $("fontScaleGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-font]");
    if (!button) return;
    state.data.settings.fontScale = button.dataset.font;
    persist();
    applyFontScale();
    showToast("글자 크기를 바꿨어요.");
  });

  function renderSettings() {
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    $("permissionText").textContent = {
      granted: "알림이 켜져 있어요. 페이지가 열려 있으면 알람이 울립니다.",
      denied: "알림이 차단되어 있어요. 브라우저 주소창 옆 자물쇠에서 알림을 허용해 주세요.",
      default: "알림을 켜면 저장한 시간에 맞춰 알려드려요.",
      unsupported: "이 브라우저는 알림을 지원하지 않아요. 화면 안내로만 알려드립니다.",
    }[permission];
    $("requestPermissionButton").hidden = permission !== "default";
    $("backupCountText").textContent = `현재 저장된 일정: ${state.data.series.length}개 · 사람: ${state.data.people.length}명`;
    applyFontScale();
  }

  $("requestPermissionButton").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    try { await Notification.requestPermission(); } catch { /* 무시 */ }
    renderSettings();
    if (Notification.permission === "granted") showToast("알림을 켰어요. 시간에 맞춰 알려드릴게요.");
  });

  // ── 보관·이동 ──
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
    download(`calendarbom-${todayKey()}.json`, sched.exportJSON(state.data, new Date().toISOString(), APP_VERSION), "application/json");
    showToast("보관용 파일을 저장했어요. 일정과 사람 이름이 들어 있으니 전달할 사람을 확인해 주세요.", 6000);
  });

  $("exportIcsButton").addEventListener("click", () => {
    // 반복 일정은 앞으로 1년 치 발생을 낱개로 내보낸다(RRULE 미사용 — 단순하고 확실한 호환).
    const today = todayKey();
    const events = [];
    for (const series of state.data.series) {
      if (series.repeat.freq === "once") {
        events.push({ id: series.id, title: series.title, date: series.date, time: series.slots[0].time });
      } else {
        for (const occ of sched.occurrencesInRange([series], today, sched.addDays(today, 365)).slice(0, 400)) {
          events.push({ id: occ.id, title: series.title, date: occ.date, time: occ.time });
        }
      }
    }
    download(`calendarbom-${today}.ics`, ics.exportICS(events), "text/calendar");
    showToast("달력 파일을 저장했어요.");
  });

  $("importButton").addEventListener("click", () => $("importFileInput").click());
  $("importFileInput").addEventListener("change", async () => {
    const file = $("importFileInput").files && $("importFileInput").files[0];
    $("importFileInput").value = "";
    if (!file) return;
    const text = await file.text();
    let incomingSeries = [];
    let incomingPeople = [];
    try {
      if (/BEGIN:VCALENDAR/i.test(text)) {
        incomingSeries = ics.parseICS(text)
          .map((item) => sched.normalizeSeries({
            title: item.title,
            date: item.date,
            slots: [{ time: item.time, reminders: item.time ? [0] : [] }],
            repeat: { freq: "once" },
            createdAt: Date.now(),
          }))
          .filter(Boolean);
      } else {
        const result = sched.importParsed(JSON.parse(text), Date.now());
        incomingSeries = result.series;
        incomingPeople = result.people;
      }
    } catch {
      showToast("파일을 읽지 못했어요. 캘린더봄에서 저장한 파일인지 확인해 주세요.");
      return;
    }
    if (incomingSeries.length === 0 && incomingPeople.length === 0) {
      showToast("가져올 일정을 찾지 못했어요.");
      return;
    }
    snapshotUndo("import");
    const knownSeries = new Set(state.data.series.map((series) => `${series.date}|${series.slots[0].time}|${series.title}`));
    const freshSeries = incomingSeries.filter((series) => !knownSeries.has(`${series.date}|${series.slots[0].time}|${series.title}`));
    state.data.series.push(...freshSeries);
    const knownPeople = new Set(state.data.people.map((person) => person.id));
    state.data.people.push(...incomingPeople.filter((person) => !knownPeople.has(person.id)));
    persist();
    renderSettings();
    renderCalendar();
    rearmAlarms();
    const dupes = incomingSeries.length - freshSeries.length;
    showToast(`일정 ${freshSeries.length}개를 가져왔어요.${dupes > 0 ? ` (중복 ${dupes}개 제외)` : ""}`, 8000, true);
  });

  // ── 토스트(+되돌리기) ──
  let toastTimer = null;
  function showToast(message, duration = 3200, withUndo = false) {
    const toast = $("toast");
    toast.innerHTML = esc(message) + (withUndo && state.undo ? `<button class="undo-btn" type="button" id="undoButton">되돌리기</button>` : "");
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
    const undoButton = $("undoButton");
    if (undoButton) {
      undoButton.addEventListener("click", () => {
        toast.classList.remove("show");
        undoLast();
      });
    }
  }

  // ── 서비스워커·버전 ──
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
  if (state.data.settings.migratedFromV1 && !state.data.settings.migrationNoticeShown) {
    state.data.settings.migrationNoticeShown = true;
    persist();
    showToast("기존 일정을 새 버전으로 안전하게 옮겼어요.", 6000);
  }
})();
