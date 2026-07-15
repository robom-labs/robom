// 캘린더봄 v0.2.0 — 화면에는 지금 필요한 질문만, 안쪽에서는 사람·반복·약·기념일이 자동 준비되는 생활 달력.
// 데이터는 이 기기의 localStorage 에만 저장한다(서버 전송 없음).
(function () {
  "use strict";

  const cal = window.CalendarBomCalendarCore;
  const ics = window.CalendarBomIcsCore;
  const sched = window.CalendarBomScheduleCore;

  const APP_VERSION = "0.3.0";
  const BUILD_SHA = "__BUILD_SHA__";
  const V1_KEY = "calendarbom:events:v1"; // 절대 삭제하지 않는다(회귀·복구용 원본)
  const V1_SETTINGS_KEY = "calendarbom:settings:v1";
  const V2_KEY = "calendarbom:data:v2"; // 저장 키는 유지하되 내부 version 필드는 3 (AGENTS: 저장 키 불변)
  const RECOVERY_KEY = "calendarbom:recovery:v2"; // 손상 원본 보존 (A-03)
  const LKG_KEY = "calendarbom:lkg"; // last-known-good snapshot
  const MIGRATED_FLAG = "calendarbom:migrated"; // v1 자동 부활 방지
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
      return false;
    }
  }

  // 반환: {data, recoveryPending} — recoveryPending 이면 저장하지 않고 사용자 선택을 기다린다 (A-03)
  function loadData() {
    const raw = localStorage.getItem(V2_KEY);
    if (raw) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch { /* 손상 */ }
      const data = parsed && sched.normalizeData(parsed);
      if (data) {
        localStorage.setItem(MIGRATED_FLAG, "1");
        try { localStorage.setItem(LKG_KEY, raw); } catch { /* 공간 부족 시 LKG 생략 */ }
        return { data, recoveryPending: false };
      }
      // 손상: 원본을 recovery 키에 보존(이미 있으면 덮지 않음)하고 빈 데이터로 덮어쓰지 않는다.
      if (!localStorage.getItem(RECOVERY_KEY)) {
        try { localStorage.setItem(RECOVERY_KEY, raw); } catch { /* 보존 실패 시에도 원본 키는 그대로 둔다 */ }
      }
      const lkg = sched.normalizeData(readJSON(LKG_KEY));
      if (lkg) return { data: lkg, recoveryPending: "lkg" };
      return { data: sched.emptyData(), recoveryPending: "corrupt" };
    }
    // v2 없음: 이미 v2 시대를 지난 기기라면 v1을 다시 살리지 않는다 (v1 부활 방지)
    if (localStorage.getItem(MIGRATED_FLAG) === "1") {
      const data = sched.emptyData();
      writeJSON(V2_KEY, data);
      return { data, recoveryPending: false };
    }
    const v1 = readJSON(V1_KEY);
    const data = v1 ? sched.migrateV1(v1, Date.now()).data : sched.emptyData();
    const oldSettings = readJSON(V1_SETTINGS_KEY);
    if (oldSettings && typeof oldSettings === "object") {
      data.settings.fontScale = oldSettings.fontScale || "normal";
    }
    data.settings.migratedFromV1 = Boolean(v1);
    if (writeJSON(V2_KEY, data)) localStorage.setItem(MIGRATED_FLAG, "1");
    return { data, recoveryPending: false };
  }

  const loaded = loadData();
  const state = {
    data: loaded.data,
    recoveryPending: loaded.recoveryPending,
    cursor: null,
    sheet: null, // {date, mode, draft, detail, share, scope}
    alarmTimers: [],
    undo: null, // {snapshot, label}
    pendingCopy: null, // 다음 일정 만들기: 날짜만 고르면 되는 준비된 초안
  };

  /**
   * 트랜잭션 저장 (A-02): 변경 → 저장 성공 시 undo 준비, 실패 시 메모리 rollback.
   * 실패하면 false 를 반환하므로 호출자는 시트를 닫거나 성공 문구를 내면 안 된다.
   */
  function commit(label, mutate) {
    const before = JSON.stringify(state.data);
    mutate();
    if (writeJSON(V2_KEY, state.data)) {
      state.undo = { snapshot: JSON.parse(before), label };
      return true;
    }
    state.data = sched.normalizeData(JSON.parse(before)) || state.data;
    showToast("저장 공간이 부족해 저장하지 못했어요. 입력한 내용은 그대로 있어요.", 7000);
    return false;
  }

  function persist() {
    return writeJSON(V2_KEY, state.data);
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

  // 빈 입력 등 오류를 조용히 삼키지 않는다 (C-04)
  function showFieldError(inputId, message) {
    const input = $(inputId);
    const error = $(`${inputId.replace("Input", "")}Error`) || $("personNameError");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    announce(message);
    if (input) input.focus();
  }

  // 시트 전체를 다시 읽지 않고 현재 질문만 낭독한다 (C-03)
  function announce(text) {
    const announcer = $("announcer");
    if (!announcer) return;
    announcer.textContent = "";
    setTimeout(() => { announcer.textContent = text; }, 30);
  }

  function announceStep() {
    const title = document.querySelector("#sheetBody .step-title");
    if (title) announce(title.textContent);
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
  const TODO_PRESETS = ["장보기", "은행", "공과금", "전화하기"];
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
  // 관계가 있으면 어울리는 날을 먼저 추천하되, 모든 종류는 [다른 종류]에서 항상 선택 가능 (B-03)
  const ANN_TYPES_EXTRA = [
    { key: "firstmet", label: "처음 만난 날", repeat: "picks", tone: "celebrate" },
    { key: "familyday", label: "가족이 된 날", repeat: "yearly", tone: "celebrate" },
  ];
  const ANN_ALL_TYPES = null; // annTypesFor 에서 계산
  function allAnnTypes() {
    return [...ANN_TYPES, ...ANN_TYPES_EXTRA];
  }
  function annTypeOf(draft) {
    return allAnnTypes().find((t) => t.key === draft.ann.type) || null;
  }
  function annTypesFor(draft) {
    if (draft.annAllTypes) return allAnnTypes();
    const person = state.data.people.find((p) => p.id === draft.ann.personId);
    const relation = draft.ann.personIsMe ? null : person && person.relation;
    let keys;
    if (relation === "연인·배우자") keys = ["birthday", "firstmet", "couple", "wedding"];
    else if (relation === "가족") keys = ["birthday", "wedding", "familyday", "memory"];
    else if (relation === "친구") keys = ["birthday", "firstmet", "couple", "memory"];
    else if (relation === "반려동물") keys = ["birthday", "familyday", "firstmet", "memory"];
    else keys = ["birthday", "wedding", "couple", "memory"];
    const picked = allAnnTypes().filter((t) => keys.includes(t.key));
    return [...picked, { key: "__more", label: "다른 종류", repeat: "none", tone: "neutral" }];
  }

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
      allDayReminders: [{ daysBefore: 1, time: "09:00" }],
      until: null,
      repeat: templateKey === "medication" ? "daily" : "once",
      weekdays: [],
      med: { perDay: 2, slots: MED_DEFAULT_SLOTS[2].map((slot) => ({ ...slot })), alias: null },
      ann: { personId: null, personIsMe: false, type: null, base: null, picks: [], reminders: [{ daysBefore: 1, time: "09:00" }] },
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
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
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
        const ariaExtra = (cell.key === today ? ' aria-current="date"' : "") +
          (state.sheet && state.sheet.date === cell.key ? ' aria-pressed="true"' : "");
        return `<button type="button" class="${classes.join(" ")}" data-date="${cell.key}" aria-label="${label}"${ariaExtra}>` +
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
      if (saved && saved.schema === 2 && saved.date === dateKey && saved.draft && Date.now() - (saved.at || 0) < 86400000) {
        draft = saved.draft;
        mode = "add";
        showToast("입력하던 일정을 이어서 보여드려요.", 7000, false, { label: "새로 시작", onClick: () => {
          localStorage.removeItem(DRAFT_KEY);
          if (state.sheet) { state.sheet.mode = "home"; state.sheet.draft = null; renderSheet(); }
        } });
      }
    }
    state.sheet = { date: dateKey, mode, draft, detail: null, share: null, scope: null, saved: false, editTime: null };
    state.sheetInvoker = document.activeElement && document.activeElement.matches("[data-date], [data-open-date]") ? document.activeElement : null;
    $("daySheet").hidden = false;
    document.body.style.overflow = "hidden";
    document.querySelectorAll("#calendarGrid .day-cell").forEach((cell) => cell.classList.toggle("selected", cell.dataset.date === dateKey));
    renderSheet();
    $("sheetCloseButton").focus({ preventScroll: true });
    announce(`${cal.koreanDateTime(dateKey, null)} 일정 창이 열렸어요.`);
  }

  function closeDaySheet(keepDraft = false) {
    // 템플릿을 고른 순간부터 초안을 보존한다 (B-11). 24시간 지난 초안은 열 때 버린다.
    if (!keepDraft && state.sheet && state.sheet.mode === "add" && state.sheet.draft && !state.sheet.saved) {
      writeJSON(DRAFT_KEY, { schema: 2, date: state.sheet.date, draft: state.sheet.draft, at: Date.now() });
    } else if (state.sheet && state.sheet.saved) {
      localStorage.removeItem(DRAFT_KEY);
    }
    state.sheet = null;
    $("daySheet").hidden = true;
    document.body.style.overflow = "";
    // 닫은 뒤 실행했던 날짜로 포커스를 돌려준다 (C-03)
    const invoker = state.sheetInvoker;
    state.sheetInvoker = null;
    if (invoker && document.contains(invoker)) invoker.focus({ preventScroll: true });
    else {
      const selected = document.querySelector("#calendarGrid .day-cell.selected");
      if (selected) selected.focus({ preventScroll: true });
    }
  }

  $("sheetCloseButton").addEventListener("click", () => closeDaySheet());
  $("daySheet").addEventListener("click", (event) => {
    if (event.target === $("daySheet")) closeDaySheet();
  });
  document.addEventListener("keydown", (event) => {
    if (!state.sheet) return;
    if (event.key === "Escape") { closeDaySheet(); return; }
    if (event.key === "Tab") {
      // 시트 안에서 Tab 이 순환하게 한다 (C-03)
      const focusables = [...$("daySheet").querySelectorAll("button, input, [href], select, textarea")].filter((el) => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
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
    if (recents.length > 0 && !sheet.moreOpen) {
      // 최근이 있으면 화면의 큰 선택은 최근(최대 3) + 대표 2 + [다른 일정] = 6개 이하 (B-01)
      html += `<div class="chip-grid" style="margin-bottom:8px"><button class="chip" type="button" data-recent="0">지난번과 같게: ${esc(recents[0].label)}</button></div>`;
      const more = recents.slice(1, 3);
      if (more.length > 0) {
        html += `<p class="med-note" style="margin:0 0 6px">최근 사용</p><div class="chip-grid" style="margin-bottom:10px">` +
          more.map((recent, index) => `<button class="chip" type="button" data-recent="${index + 1}">${esc(recent.label)}</button>`).join("") + `</div>`;
      }
      html += `<p class="med-note" style="margin:0 0 6px">자주 쓰는 일정</p>`;
      const featured = ["medication", "hospital"].slice(0, Math.max(0, 5 - Math.min(recents.length, 3)));
      html += `<div class="chip-grid">` +
        featured.map((key) => `<button class="chip" type="button" data-template="${key}">${TEMPLATES[key].label}</button>`).join("") +
        `<button class="chip" type="button" data-more-templates>다른 일정</button></div>`;
    } else {
      if (recents.length > 0) {
        html += `<div class="chip-grid" style="margin-bottom:8px"><button class="chip" type="button" data-recent="0">지난번과 같게: ${esc(recents[0].label)}</button></div>`;
      }
      html += `<div class="chip-grid">` +
        Object.entries(TEMPLATES).map(([key, template]) => `<button class="chip" type="button" data-template="${key}">${template.label}</button>`).join("") +
        `</div>`;
    }
    html += `</div>`;
    return html;
  }

  function medDayRow(series, occs) {
    const today = todayKey();
    const rows = occs.map((occ) => {
      const status = state.data.statuses[occ.id];
      const isFuture = occ.date > today; // 미래 복용은 기록할 수 없다 (B-07)
      const stateText = isFuture ? `<span class="dose-state skipped">예정</span>`
        : status && status.state === "done" ? `<span class="dose-state">✓ 먹었어요</span>`
        : status && status.state === "skipped" ? `<span class="dose-state skipped">건너뛰었어요</span>`
        : status && status.snoozeUntil ? `<span class="dose-state">조금 있다가 (${cal.koreanTime(new Date(status.snoozeUntil).getHours(), new Date(status.snoozeUntil).getMinutes())})</span>`
        : "";
      let actions = "";
      if (!isFuture) {
        actions = status && (status.state === "done" || status.state === "skipped")
          ? `<button class="chip" type="button" data-dose-reset="${occ.id}">되돌리기</button>`
          : `<button class="chip" type="button" data-dose-done="${occ.id}">먹었어요</button>` +
            `<button class="chip" type="button" data-dose-snooze="${occ.id}">조금 있다가</button>` +
            `<button class="chip" type="button" data-dose-skip="${occ.id}">건너뛰었어요</button>`;
      }
      return `<div class="dose-row"><span class="dose-when">${occurrenceLine(occ)}${stateText}</span>${actions ? `<div class="dose-actions">${actions}</div>` : ""}</div>`;
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
    if (step === "annWho") return { title: "누구의 날", value: draft.ann.personIsMe ? "나" : personLabel(draft.ann.personId, "") };
    if (step === "annWhich") return { title: "어떤 날", value: annSummary(draft) };
    if (step === "todoWhat" || step === "customTitle") return { title: "일정", value: draft.title || "" };
    if (step === "when") return { title: "시간", value: draft.allDay ? "하루 종일" : cal.koreanTime(...draft.time.split(":").map(Number)) };
    return { title: step, value: "" };
  }

  function annSummary(draft) {
    const type = annTypeOf(draft);
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

  const RELATIONS = ["가족", "연인·배우자", "친구", "동료·모임", "반려동물"];

  /** 사람 피커: 화면에 보이는 선택은 6개 이내 — (나) + 최근 3명 + [다른 사람] + [사람 추가] (B-02) */
  function personChips(dataName, selectedId, options = {}) {
    const draft = state.sheet && state.sheet.draft;
    const chips = [];
    if (options.includeMe) chips.push(chip("나", `data-${dataName}-me`, options.meSelected === true));
    const people = [...state.data.people].sort((a, b) => b.createdAt - a.createdAt);
    const expanded = draft && draft.peopleExpanded;
    const visible = expanded ? people : people.slice(0, 3);
    for (const person of visible) chips.push(chip(esc(person.name), `data-${dataName}="${person.id}"`, selectedId === person.id));
    if (!expanded && people.length > 3) chips.push(chip("다른 사람", "data-people-more"));
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
        `<div class="defaults-box">${rows}</div><p class="med-note">예시 시간이에요. 처방받은 안내에 맞게 바꿔주세요.</p>` +
        `<div class="modal-actions" style="margin-top:10px"><button class="action-btn primary" type="button" data-step-ok>이대로 좋아요</button></div>`);
    }
    if (step === "annWho") {
      return stepPanel("누구의 어떤 날인가요?",
        `<div class="chip-grid">${personChips("ann", draft.ann.personId, { includeMe: true, meSelected: draft.ann.personIsMe })}</div>${draft.addingPerson === "ann" ? inlineNameRow("ann") : ""}`);
    }
    if (step === "annWhich") {
      const baseDate = draft.ann.base || state.sheet.date;
      const baseParsed = cal.parseKey(baseDate);
      let html = `<div class="defaults-box" style="margin:0 0 10px"><div class="default-row"><span class="default-label">기준일</span>` +
        `<span class="default-value">${baseParsed.year}년 ${baseParsed.month}월 ${baseParsed.day}일</span>` +
        `<button class="link-btn" type="button" data-ann-base-edit>바꾸기</button></div>` +
        (draft.annBaseEdit ? `<div class="default-expand"><div class="time-native-row"><input type="date" data-ann-base value="${baseDate}" aria-label="기준일 직접 선택" /></div></div>` : "") +
        `</div>`;
      html += `<div class="chip-grid">${annTypesFor(draft).map((type) => chip(type.label, `data-ann-type="${type.key}"`, draft.ann.type === type.key)).join("")}</div>`;
      const type = annTypeOf(draft);
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
        const explain = draft.ann.picks.map((pick) => `<p class="ann-explain">${sched.anniversaryExplain(draft.ann.base || state.sheet.date, pick.ruleType, pick.n)}</p>`).join("");
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
    const draft = state.sheet.draft;
    return `<div class="inline-name-row"><label class="visually-hidden" for="personNameInput">어떻게 부를까요?</label>` +
      `<input id="personNameInput" type="text" maxlength="20" placeholder="예: 엄마" autocomplete="off" />` +
      `<button class="chip" type="button" data-person-save="${target}">저장</button></div>` +
      `<p class="med-note" style="margin:8px 0 4px">관계는 골라두면 어울리는 날을 추천해드려요. (선택 사항)</p>` +
      `<div class="chip-grid">` +
      RELATIONS.map((relation) => chip(relation, `data-person-relation="${relation}"`, draft && draft.newPersonRelation === relation)).join("") +
      chip("선택 안 함", 'data-person-relation=""', Boolean(draft) && !draft.newPersonRelation) + `</div>` +
      `<p class="field-error" id="personNameError" role="alert" hidden></p>`;
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
    if (draft.editSeriesId || draft.prefilled) {
      const dateKey = draft.editDate || state.sheet.date;
      const parsed = cal.parseKey(dateKey);
      html += `<div class="default-row"><span class="default-label">날짜</span><span class="default-value">${parsed.month}월 ${parsed.day}일</span>` +
        `<button class="link-btn" type="button" data-expand="editDate" aria-expanded="${draft.expanded === "editDate"}">바꾸기</button></div>`;
      if (draft.expanded === "editDate") {
        html += `<div class="default-expand"><div class="time-native-row"><input type="date" data-edit-date value="${dateKey}" aria-label="날짜 직접 선택" /></div></div>`;
      }
      html += `<div class="default-row"><span class="default-label">제목</span><span class="default-value">${esc(draftTitle(draft))}</span>` +
        `<button class="link-btn" type="button" data-expand="editTitle" aria-expanded="${draft.expanded === "editTitle"}">바꾸기</button></div>`;
      if (draft.expanded === "editTitle") html += `<div class="default-expand">${inlineTitleRow()}</div>`;
      if (draft.template !== "medication" && !draft.allDay) {
        html += `<div class="default-row"><span class="default-label">시간</span><span class="default-value">${cal.koreanTime(...draft.time.split(":").map(Number))}</span>` +
          `<button class="link-btn" type="button" data-expand="editWhen" aria-expanded="${draft.expanded === "editWhen"}">바꾸기</button></div>`;
        if (draft.expanded === "editWhen") {
          html += `<div class="default-expand"><div class="time-adjust-grid">` +
            `<button class="chip" type="button" data-when-adjust data-delta="-10">−10분</button>` +
            `<button class="chip" type="button" data-when-adjust data-delta="10">＋10분</button>` +
            `<button class="chip" type="button" data-when-adjust data-delta="0">정각</button></div>` +
            `<div class="time-native-row"><input type="time" data-when-native value="${draft.time}" aria-label="시간 직접 선택" /></div></div>`;
        }
      }
    }
    if (draft.editSeriesId) {
      html += `<div class="default-row"><span class="default-label">장소</span><span class="default-value">${esc(draft.place || "없음")}</span>` +
        `<button class="link-btn" type="button" data-expand="editPlace" aria-expanded="${draft.expanded === "editPlace"}">바꾸기</button></div>`;
      if (draft.expanded === "editPlace") {
        html += `<div class="default-expand"><div class="inline-name-row"><input id="placeInput" type="text" maxlength="60" value="${esc(draft.place || "")}" placeholder="예: 서울정형외과" />` +
          `<button class="chip" type="button" data-place-save>확인</button></div></div>`;
      }
      html += `<div class="default-row"><span class="default-label">메모</span><span class="default-value">${esc(draft.note ? "있음" : "없음")}</span>` +
        `<button class="link-btn" type="button" data-expand="editNote" aria-expanded="${draft.expanded === "editNote"}">바꾸기</button></div>`;
      if (draft.expanded === "editNote") {
        html += `<div class="default-expand"><div class="inline-name-row"><input id="noteInput" type="text" maxlength="200" value="${esc(draft.note || "")}" placeholder="메모 (나만 보여요)" />` +
          `<button class="chip" type="button" data-note-save>확인</button></div></div>`;
      }
    }
    if (["hospital", "medication"].includes(draft.template)) {
      html += defaultRow("누가", personLabel(draft.personId), "person");
      if (draft.expanded === "person") html += `<div class="default-expand"><div class="chip-grid">${chip("나", 'data-person=""', !draft.personId)}${personChips("person", draft.personId)}</div>${draft.addingPerson === "person" ? inlineNameRow("person") : ""}</div>`;
    }
    if (draft.template === "medication") {
      const untilText = draft.repeat === "once" ? "이번만" : draft.until ? `${cal.koreanDateTime(draft.until, null)}까지` : "계속";
      html += defaultRow("기간", untilText, "medUntil");
      if (draft.expanded === "medUntil") {
        const untilOptions = [[null, "계속"], [7, "1주일"], [14, "2주일"], [30, "한 달"]];
        html += `<div class="default-expand"><div class="chip-grid">` +
          untilOptions.map(([days, label]) => chip(label, `data-med-until="${days === null ? "" : days}"`,
            days === null ? !draft.until && draft.repeat !== "once" : draft.until === sched.addDays(state.sheet.date, days - 1))).join("") +
          chip("이번만", 'data-med-until="once"', draft.repeat === "once") + `</div></div>`;
      }
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
      const reminders = draft.template === "anniversary" ? draft.ann.reminders : draft.allDayReminders;
      const text = reminders.length > 0 ? reminders.map(allDayReminderText).join(", ") : "알람 없음";
      html += defaultRow("알림", text, "allDayReminder");
      if (draft.expanded === "allDayReminder") {
        const options = [[7, "7일 전"], [1, "하루 전"], [0, "당일 오전"]];
        html += `<div class="default-expand"><div class="chip-grid">${options.map(([days, label]) => chip(label, `data-adr="${days}"`, reminders.some((r) => r.daysBefore === days))).join("")}${chip("알람 없음", 'data-adr="none"', reminders.length === 0)}</div><p class="med-note">여러 개를 함께 고를 수 있어요. (최대 3개)</p></div>`;
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

  const allDayReminderText = sched.allDayReminderText;

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
      id: draft.editSeriesId || undefined, // 전체 수정은 같은 ID 를 유지한다 (B-09)
      kind: draft.template === "todo" ? "todo" : draft.template === "custom" ? "general" : draft.template,
      personId: draft.personId,
      withPersonId: draft.withPersonId,
      date: draft.editDate || state.sheet.date,
      place: draft.place || null,
      note: draft.note || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (draft.template === "medication") {
      return [sched.normalizeSeries({
        ...base,
        title: medTitle(draft),
        slots: draft.med.slots.map((slot) => ({ label: slot.label, time: slot.time, reminders: [0] })),
        repeat: { freq: draft.repeat, weekdays: draft.weekdays, until: draft.until || null },
      })].filter(Boolean);
    }
    if (draft.template === "anniversary") {
      const type = annTypeOf(draft);
      const name = draft.ann.personIsMe ? "내" : personLabel(draft.ann.personId, "");
      if (!type) return [];
      const baseDate = draft.ann.base || state.sheet.date; // 기준일 변경 지원 (B-04)
      if (type.repeat === "picks") {
        return draft.ann.picks.map((pick) => sched.normalizeSeries({
          ...base,
          kind: "anniversary",
          personId: draft.ann.personId,
          title: `${name} ${pick.label}`,
          date: sched.anniversaryDate(baseDate, pick.ruleType, pick.n),
          slots: [{ time: null, reminders: [] }],
          allDayReminders: draft.ann.reminders,
          repeat: { freq: "once" },
          anniversary: { baseDate, ruleType: pick.ruleType, n: pick.n, label: pick.label },
          tone: type.tone,
        })).filter(Boolean);
      }
      return [sched.normalizeSeries({
        ...base,
        kind: "anniversary",
        personId: draft.ann.personId,
        title: `${name} ${type.label}`,
        date: baseDate,
        slots: [{ time: null, reminders: [] }],
        allDayReminders: draft.ann.reminders,
        repeat: { freq: "yearly" },
        tone: type.tone,
      })].filter(Boolean);
    }
    return [sched.normalizeSeries({
      ...base,
      title: draftTitle(draft),
      slots: [{ time: draft.allDay ? null : draft.time, reminders: draft.allDay ? [] : draft.reminders }],
      allDayReminders: draft.allDay ? draft.allDayReminders : [],
      repeat: { freq: draft.repeat, weekdays: draft.weekdays, until: draft.until || null },
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
    announceStep();
  }

  function saveDraft() {
    const draft = state.sheet.draft;
    // 반복 일정의 전체 수정은 범위를 먼저 확인한다 (B-09): 전체만 지원, 이후 확장은 문서화
    if (draft.editScopeNeeded && !draft.editScopeConfirmed) {
      draft.editScopeConfirmed = true;
      showToast("반복 일정 전체가 새 내용으로 바뀌어요. 저장을 한 번 더 누르면 적용돼요. 특정 날짜 하나만 바꾸려면 시간 바꾸기를 쓰세요.", 9000);
      return;
    }
    const built = buildSeriesList(draft);
    if (built.length === 0) return;
    // 같은 날짜로 계산된 기념일은 하나로 합친다 (B-05)
    const byDate = new Map();
    let mergedCount = 0;
    for (const series of built) {
      if (series.kind === "anniversary" && byDate.has(series.date)) {
        const kept = byDate.get(series.date);
        if (series.anniversary && kept.anniversary && series.anniversary.label !== kept.anniversary.label) {
          kept.title = `${kept.title}·${series.anniversary.label}`;
        }
        mergedCount += 1;
        continue;
      }
      byDate.set(series.date, series);
    }
    const list = [...byDate.values()];
    const editingId = draft.editSeriesId || null;
    const ok = commit("save", () => {
      if (editingId) state.data.series = state.data.series.filter((series) => series.id !== editingId);
      for (const series of list) state.data.series.push(series);
      if (!draft.allDay && draft.time) state.data.settings[`lastTime:${draft.template}`] = draft.time;
      if (draft.template === "medication") state.data.settings.lastMedSlots = draft.med.slots.map((slot) => ({ ...slot }));
      pushRecent(draft, list[0]);
    });
    if (!ok) return; // 시트 유지, 성공 문구 금지 (A-02)
    localStorage.removeItem(DRAFT_KEY);
    state.sheet.saved = true;
    const first = list[0];
    // 저장(데이터)과 휴대전화 알림(권한)을 구분해서 말한다 (A-09)
    const hasAlarm = first.allDay ? first.allDayReminders.length > 0 : first.slots.some((slot) => slot.reminders.length > 0);
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    let sentence;
    if (!hasAlarm) {
      sentence = `${cal.koreanDateTime(first.date, first.allDay ? null : first.slots[0].time)}, “${first.title}” 일정을 저장했어요.`;
    } else if (permission === "granted") {
      sentence = `${cal.koreanDateTime(first.date, first.allDay ? null : first.slots[0].time)}, “${first.title}” 알람을 저장했어요.`;
    } else {
      sentence = `${cal.koreanDateTime(first.date, first.allDay ? null : first.slots[0].time)}, “${first.title}” 일정은 저장했어요. 휴대전화 알림은 아직 꺼져 있어요.`;
    }
    const extra = (list.length > 1 ? ` 외 ${list.length - 1}개.` : "") + (mergedCount > 0 ? " 같은 날짜라 하나로 합쳤어요." : "");
    const isHospital = draft.template === "hospital";
    closeDaySheet();
    renderCalendar();
    rearmAlarms();
    if (hasAlarm && permission === "default" && !state.data.settings.alarmPermissionPrompted) {
      state.data.settings.alarmPermissionPrompted = true;
      persist();
      showToast(sentence + extra, 10000, false, { label: "알림 켜기", onClick: async () => {
        try { await Notification.requestPermission(); } catch { /* 무시 */ }
        renderSettings();
        showToast(Notification.permission === "granted" ? "알림을 켰어요. 시간에 맞춰 알려드릴게요." : "설정 탭에서 언제든 켤 수 있어요.");
      } });
    } else {
      showToast(sentence + extra, 8000, true);
    }
    if (isHospital) state.data.settings.lastHospitalId = first.id;
  }

  /** mode: "copy"(원본 반복 보존) | "next"(다음 한 건 once) | "recent"(마지막 설정 보존) (B-10) */
  function snapshotOfSeries(series, mode = "copy") {
    const keepRepeat = mode !== "next";
    return {
      template: series.kind in TEMPLATES ? series.kind : "custom",
      title: series.title,
      personId: series.personId,
      withPersonId: series.withPersonId,
      time: series.slots[0].time || "09:00",
      allDay: series.allDay,
      reminders: series.slots[0].reminders.length > 0 ? series.slots[0].reminders : [0],
      allDayReminders: series.allDayReminders && series.allDayReminders.length > 0 ? series.allDayReminders : [{ daysBefore: 1, time: "09:00" }],
      repeat: keepRepeat ? series.repeat.freq : "once",
      weekdays: keepRepeat ? (series.repeat.weekdays || []) : [],
      until: keepRepeat ? series.repeat.until : null,
      med: {
        perDay: series.slots.length,
        slots: series.slots.map((slot) => ({ label: slot.label || "시간", time: slot.time || "09:00" })),
        alias: null,
      },
      ann: { personId: series.personId, personIsMe: false, type: null, base: null, picks: [], reminders: series.allDayReminders || [{ daysBefore: 1, time: "09:00" }] },
      fingerprint: sched.fingerprint(series),
    };
  }

  function pushRecent(draft, series) {
    if (draft.template === "anniversary") return; // 계산된 특정 날짜는 재사용 의미가 없다
    const snapshot = snapshotOfSeries(series, "recent");
    snapshot.template = draft.template;
    // label 이 아니라 의미 지문으로 중복 판정 — 엄마 병원·아빠 병원이 같이 남는다 (B-10)
    const fp = snapshot.fingerprint;
    state.data.recents = [
      { label: series.title, snapshot, savedAt: Date.now() },
      ...state.data.recents.filter((recent) => (recent.snapshot && recent.snapshot.fingerprint) !== fp),
    ].slice(0, 5);
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
      if (sched.isValidTime(event.target.value)) {
        sheet.draft.med.slots[index].time = event.target.value;
        const suggested = sched.slotLabelForTime(event.target.value);
        if (suggested) sheet.draft.med.slots[index].label = suggested;
      }
    }
    if (event.target.matches("[data-detail-native]")) {
      if (sched.isValidTime(event.target.value)) sheet.editTime = event.target.value;
    }
    if (event.target.matches("[data-ann-base]") && sheet.draft) {
      if (cal.parseKey(event.target.value)) {
        sheet.draft.ann.base = event.target.value;
        renderSheet();
      }
    }
    if (event.target.matches("[data-edit-date]") && sheet.draft) {
      if (cal.parseKey(event.target.value)) {
        sheet.draft.editDate = event.target.value;
        renderSticky();
      }
    }
  });

  $("sheetBody").addEventListener("click", (event) => {
    const sheet = state.sheet;
    if (!sheet) return;
    const target = event.target.closest("button");
    if (!target) return;

    // home 모드
    if (target.hasAttribute("data-more-templates")) {
      sheet.moreOpen = true;
      renderSheet();
      return;
    }
    if (target.dataset.template) {
      sheet.mode = "add";
      sheet.draft = newDraft(target.dataset.template);
      renderSheet();
      announceStep();
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
    if (target.dataset.pickSlot !== undefined) {
      sheet.editSlotIndex = Number(target.dataset.pickSlot);
      sheet.pickSlot = false;
      const seriesForSlot = findSeries(sheet.detail.seriesId);
      sheet.editTime = sched.overrideTime(seriesForSlot, sheet.detail.occDate, sheet.editSlotIndex) || seriesForSlot.slots[sheet.editSlotIndex].time || "09:00";
      renderSheet();
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
      const last = state.data.settings.lastMedSlots;
      draft.med.slots = Array.isArray(last) && last.length === draft.med.perDay
        ? last.map((slot) => ({ label: slot.label, time: slot.time })) // 사용자 최근 약 시간 우선 (B-06)
        : MED_DEFAULT_SLOTS[draft.med.perDay].map((slot) => ({ ...slot }));
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
      const suggested = sched.slotLabelForTime(draft.med.slots[index].time); // 라벨-시간 모순 방지 (B-06)
      if (suggested) draft.med.slots[index].label = suggested;
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
      const input = $("personNameInput");
      const name = ((input && input.value.trim()) || draft.newPersonName || "").trim();
      if (!name) { showFieldError("personNameInput", "이름을 적어주세요."); return; }
      const person = sched.normalizePerson({ name, relation: draft.newPersonRelation || null, createdAt: Date.now() });
      if (!commit("person", () => { state.data.people.push(person); })) return;
      const field = target.dataset.personSave;
      draft.addingPerson = null;
      draft.newPersonRelation = null;
      if (field === "with") { draft.withPersonId = person.id; advanceStep(); }
      else if (field === "ann") { draft.ann.personId = person.id; draft.ann.personIsMe = false; advanceStep(); }
      else { draft.personId = person.id; renderSheet(); }
      showToast("다음에도 빠르게 쓰도록 저장했어요.", 2600);
      return;
    }
    if (target.dataset.personRelation !== undefined) {
      const currentInput = $("personNameInput");
      if (currentInput) draft.newPersonName = currentInput.value; // 재렌더로 입력이 사라지지 않게 보존
      draft.newPersonRelation = target.dataset.personRelation || null;
      renderSheet();
      const focusInput = $("personNameInput");
      if (focusInput) {
        focusInput.value = draft.newPersonName || "";
        focusInput.focus();
      }
      return;
    }
    if (target.dataset.with !== undefined) { draft.withPersonId = target.dataset.with; advanceStep(); return; }
    if (target.dataset.annType) {
      if (target.dataset.annType === "__more") { draft.annAllTypes = true; renderSheet(); return; }
      draft.ann.type = target.dataset.annType;
      const type = annTypeOf(draft);
      if (type.repeat !== "picks") advanceStep();
      else renderSheet();
      return;
    }
    if (target.hasAttribute("data-ann-me")) { draft.ann.personIsMe = true; draft.ann.personId = null; advanceStep(); return; }
    if (target.hasAttribute("data-ann-base-edit")) { draft.annBaseEdit = !draft.annBaseEdit; renderSheet(); return; }
    if (target.hasAttribute("data-people-more")) { draft.peopleExpanded = true; renderSheet(); return; }
    if (target.dataset.ann !== undefined) { draft.ann.personId = target.dataset.ann; draft.ann.personIsMe = false; advanceStep(); return; }
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
    if (target.dataset.titlePick) {
      draft.title = target.dataset.titlePick;
      if (draft.title === "공과금") draft.repeat = "monthly"; // 매월 기본 제안, 요약에서 [바꾸기] 가능 (B-13)
      advanceStep();
      return;
    }
    if (target.hasAttribute("data-title-custom")) {
      draft.customOpen = !draft.customOpen;
      renderSheet();
      if ($("customTitleInput")) $("customTitleInput").focus();
      return;
    }
    if (target.hasAttribute("data-place-save")) {
      draft.place = ($("placeInput") && $("placeInput").value.trim()) || null;
      draft.expanded = null;
      renderSheet();
      return;
    }
    if (target.hasAttribute("data-note-save")) {
      draft.note = ($("noteInput") && $("noteInput").value.trim()) || null;
      draft.expanded = null;
      renderSheet();
      return;
    }
    if (target.hasAttribute("data-title-save")) {
      const value = ($("customTitleInput") && $("customTitleInput").value.trim()) || "";
      if (!value) return;
      draft.title = value;
      draft.customOpen = false;
      if (currentStep(draft) === "todoWhat" || currentStep(draft) === "customTitle") advanceStep();
      else { draft.med.alias = null; draft.expanded = null; renderSheet(); }
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
    if (target.dataset.medUntil !== undefined) {
      if (target.dataset.medUntil === "once") { draft.repeat = "once"; draft.until = null; }
      else if (target.dataset.medUntil === "") { draft.repeat = draft.repeat === "once" ? "daily" : draft.repeat; draft.until = null; }
      else {
        draft.repeat = draft.repeat === "once" ? "daily" : draft.repeat;
        draft.until = sched.addDays(state.sheet.date, Number(target.dataset.medUntil) - 1);
      }
      renderSheet();
      return;
    }
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
      const list = draft.template === "anniversary" ? draft.ann.reminders : draft.allDayReminders;
      let next;
      if (target.dataset.adr === "none") next = [];
      else {
        const days = Number(target.dataset.adr);
        next = list.some((r) => r.daysBefore === days)
          ? list.filter((r) => r.daysBefore !== days)
          : [...list, { daysBefore: days, time: "09:00" }].slice(0, 3);
      }
      if (draft.template === "anniversary") draft.ann.reminders = next;
      else draft.allDayReminders = next;
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
    html += `<button class="action-btn" type="button" data-act="edit-full">수정</button>` +
      `<button class="action-btn" type="button" data-act="edit-time">시간 바꾸기</button>` +
      `<button class="action-btn" type="button" data-act="copy">복사</button>` +
      (isRepeat ? `<button class="action-btn" type="button" data-act="copy-once">이 날만 복사</button>` : "") +
      (series.kind === "hospital" ? `<button class="action-btn primary" type="button" data-act="next">다음 일정 만들기</button>` : "") +
      `<button class="action-btn" type="button" data-act="share">공유</button>` +
      `<button class="action-btn danger wide" type="button" data-act="delete">삭제</button>` +
      `</div>`;
    if (state.sheet.pickSlot && series.slots.length > 1) {
      html += `<div class="default-expand" style="margin-top:6px"><p class="med-note">어느 시간을 바꿀까요?</p><div class="chip-grid">` +
        series.slots.map((slot, index) => chip(`${slot.label || `${index + 1}번째`} ${slot.time ? cal.koreanTime(...slot.time.split(":").map(Number)) : ""}`, `data-pick-slot="${index}"`)).join("") +
        `</div></div>`;
    }
    if (state.sheet.editTime) {
      const editingSlot = series.slots[state.sheet.editSlotIndex || 0];
      html += `<div class="default-expand" style="margin-top:6px">` +
        (editingSlot && editingSlot.label ? `<p class="med-note">${esc(editingSlot.label)} 시간을 바꿔요.</p>` : "") +
        timeAdjust(state.sheet.editTime, "data-detail-adjust", "data-detail-native") +
        `<div class="modal-actions" style="margin-top:8px"><button class="action-btn primary" type="button" data-act="edit-time-save">이 시간으로 바꾸기</button></div></div>`;
    }
    html += `</div>`;
    return html;
  }

  function handleDetailAction(action) {
    const sheet = state.sheet;
    if (sheet.mode === "scope") { handleScopeChoice(action); return; }
    if (sheet.mode === "share") { handleShareAction(action); return; }
    if (sheet.mode === "import") { handleImportChoice(action); return; }
    const series = sheet.detail && findSeries(sheet.detail.seriesId);
    if (!series) return;
    const isRepeat = series.repeat.freq !== "once";
    if (action === "toggle-done") {
      const ok = commit("done", () => {
        if (isRepeat) {
          const occId = sched.occurrenceId(series.id, sheet.detail.occDate, 0);
          if (state.data.statuses[occId] && state.data.statuses[occId].state === "done") delete state.data.statuses[occId];
          else state.data.statuses[occId] = { state: "done", at: Date.now() };
        } else {
          series.done = !series.done;
        }
      });
      if (!ok) return;
      renderSheet();
      renderCalendar();
      rearmAlarms();
      return;
    }
    if (action === "edit-time") {
      if (series.slots.length > 1 && sheet.editSlotIndex === undefined) {
        sheet.pickSlot = !sheet.pickSlot; // 여러 시간 약: 어느 시간을 바꿀지 먼저 고른다 (A-07)
        renderSheet();
        return;
      }
      const index = sheet.editSlotIndex || 0;
      sheet.editTime = sheet.editTime
        ? null
        : (sched.overrideTime(series, sheet.detail.occDate, index) || series.slots[index].time || "09:00");
      renderSheet();
      return;
    }
    if (action === "edit-time-save") {
      if (isRepeat) {
        sheet.scope = { action: "edit-time", time: sheet.editTime, slotIndex: sheet.editSlotIndex || 0 };
        sheet.mode = "scope";
        renderSheet();
      } else {
        const ok = commit("edit", () => {
          series.slots[sheet.editSlotIndex || 0].time = sheet.editTime;
          series.allDay = series.slots.every((slot) => !slot.time);
          if (series.kind === "medication") {
            const slot = series.slots[sheet.editSlotIndex || 0];
            const suggested = sched.slotLabelForTime(slot.time);
            if (suggested && ["아침", "점심", "낮", "저녁", "자기 전", null].includes(slot.label)) slot.label = suggested;
          }
          series.updatedAt = Date.now();
        });
        if (!ok) return;
        sheet.editTime = null;
        renderSheet();
        renderCalendar();
        rearmAlarms();
        showToast("시간을 바꿨어요.", 6000, true);
      }
      return;
    }
    if (action === "edit-full") {
      // 기존 아코디언(확인 패널)을 재사용해 모든 주요 필드를 편집한다 (B-09)
      const draft = draftFromSnapshot(snapshotOfSeries(series, "copy"));
      draft.editSeriesId = series.id;
      draft.editDate = series.date;
      draft.title = series.title;
      draft.place = series.place;
      draft.note = series.note;
      if (series.kind === "anniversary") {
        // 기념일은 구조가 달라 전체 편집 대신 삭제 후 재생성을 안내한다 (문서화된 한계)
        showToast("기념일은 삭제 후 다시 만들어 주세요. 계산 날짜가 바뀔 수 있어서예요.", 6000);
        return;
      }
      if (series.repeat.freq !== "once") {
        draft.editScopeNeeded = true; // 저장 시 범위를 묻는다
      }
      sheet.mode = "add";
      sheet.draft = draft;
      renderSheet();
      return;
    }
    if (action === "copy") {
      sheet.mode = "add";
      sheet.draft = draftFromSnapshot(snapshotOfSeries(series, "copy"));
      renderSheet();
      return;
    }
    if (action === "copy-once") {
      // 반복 전체가 아니라 이 날짜의 한 건만 once 로 복사한다 (B-10 "이 날짜만 복사")
      const snapshot = snapshotOfSeries(series, "next");
      const overridden = sched.overrideTime(series, sheet.detail.occDate, 0);
      if (overridden) snapshot.time = overridden;
      state.pendingCopy = snapshot;
      closeDaySheet(true);
      showToast("달력에서 복사해 넣을 날짜를 눌러주세요.", 6000);
      return;
    }
    if (action === "next") {
      state.pendingCopy = snapshotOfSeries(series, "next");
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
        const ok = commit("delete", () => {
          state.data.series = state.data.series.filter((s) => s.id !== series.id);
          for (const key of Object.keys(state.data.statuses)) {
            if (key.startsWith(`${series.id}@`)) delete state.data.statuses[key]; // orphan 상태 정리 (A-07)
          }
        });
        if (!ok) return;
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
    const slotIndex = sheet.scope.slotIndex || 0;
    const ok = commit(isDelete ? "delete" : "edit", () => {
      if (action === "scope-one") {
        if (isDelete) series.overrides[date] = { skip: true };
        else {
          const entry = series.overrides[date] || {};
          entry.times = { ...(entry.times || {}), [slotIndex]: sheet.scope.time }; // 슬롯별 override (A-07)
          series.overrides[date] = entry;
        }
      } else if (action === "scope-forward") {
        const before = sched.addDays(date, -1);
        if (isDelete) {
          series.repeat = { ...series.repeat, until: before };
        } else {
          const clone = JSON.parse(JSON.stringify(series));
          clone.id = sched.newId("sr");
          clone.date = date;
          clone.slots[slotIndex].time = sheet.scope.time;
          if (clone.kind === "medication") {
            const suggested = sched.slotLabelForTime(sheet.scope.time);
            if (suggested) clone.slots[slotIndex].label = suggested;
          }
          clone.overrides = {};
          series.repeat = { ...series.repeat, until: before };
          const normalized = sched.normalizeSeries(clone);
          if (normalized) state.data.series.push(normalized);
        }
      } else if (action === "scope-all") {
        if (isDelete) {
          state.data.series = state.data.series.filter((s) => s.id !== series.id);
          for (const key of Object.keys(state.data.statuses)) {
            if (key.startsWith(`${series.id}@`)) delete state.data.statuses[key];
          }
        } else {
          series.slots[slotIndex].time = sheet.scope.time;
          if (series.kind === "medication") {
            const suggested = sched.slotLabelForTime(sheet.scope.time);
            if (suggested) series.slots[slotIndex].label = suggested;
          }
        }
      }
      series.updatedAt = Date.now();
    });
    if (!ok) return;
    closeDaySheet(true);
    renderCalendar();
    renderAlerts();
    rearmAlarms();
    showToast(isDelete ? "반복 일정을 정리했어요." : "시간을 바꿨어요.", 8000, true);
  }

  // ── 공유(한 건) ──
  function shareText(series, occDate) {
    const lines = [series.title];
    if (series.slots.filter((slot) => slot.time).length > 1) {
      lines.push(cal.koreanDateTime(occDate, null)); // 약 여러 시간은 모두 나열 (B-12)
      for (const [index, slot] of series.slots.entries()) {
        if (!slot.time) continue;
        const time = sched.overrideTime(series, occDate, index) || slot.time;
        lines.push(`${slot.label ? `${slot.label} ` : ""}${cal.koreanTime(...time.split(":").map(Number))}`);
      }
    } else {
      const time = sched.overrideTime(series, occDate, 0) || series.slots[0].time;
      lines.push(cal.koreanDateTime(occDate, time));
    }
    if (series.repeat.freq !== "once") lines.push(`(${sched.repeatLabel(series)} 반복)`);
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
      // 선택한 날짜의 슬롯별 VEVENT — 고유 UID·라벨 포함 (B-12)
      const events = series.slots.map((slot, index) => ({
        id: `${series.id}-${sheet.share.occDate}-${index}`,
        title: slot.label ? `${series.title} (${slot.label})` : series.title,
        date: sheet.share.occDate,
        time: slot.time ? (sched.overrideTime(series, sheet.share.occDate, index) || slot.time) : null,
      }));
      download(`calendarbom-share-${sheet.share.occDate}.ics`, ics.exportICS(events), "text/calendar");
      showToast("달력 파일을 저장했어요. 이 날짜의 일정만 담았어요.");
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
    const ok = commit("dose", () => {
      if (target.dataset.doseDone) state.data.statuses[occId] = { state: "done", at: Date.now() };
      else if (target.dataset.doseSkip) state.data.statuses[occId] = { state: "skipped", at: Date.now() };
      else if (target.dataset.doseReset) delete state.data.statuses[occId];
      else if (target.dataset.snoozeMin) state.data.statuses[occId] = { snoozeUntil: Date.now() + Number(target.dataset.snoozeMin) * 60000 };
    });
    if (!ok) return;
    rearmAlarms();
    if (state.sheet) renderSheet();
    renderAlerts();
    renderCalendar();
    if (target.dataset.doseDone) showToast("먹었어요라고 기록했어요.", 5000, true);
    if (target.dataset.doseSkip) showToast("이번 복용은 건너뛴 것으로 기록했어요. 복용 방법이 궁금하면 처방받은 병원이나 약국에 확인하세요.", 7000);
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
    const isMedToday = series.kind === "medication" && occ.date <= todayKey(); // 미래 약은 기록 버튼 없음 (B-07)
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
      const todayRest = todayOccs.filter((occ) => occ.id !== next.id); // 같은 발생을 두 번 보여주지 않는다 (B-08)
      if (todayRest.length > 0) html += `<h2 class="alert-group-title">오늘 남은 일정</h2>` + todayRest.map(alertCard).join("");
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

  // 상황별 쉬운 알림 문구 (C-05)
  function alarmCopy(fire) {
    const series = fire.occ.series;
    const slot = series.slots[fire.occ.slotIndex];
    const when = cal.koreanDateTime(fire.occ.date, fire.occ.time);
    if (series.kind === "medication") {
      return { title: `${slot && slot.label ? `${slot.label} ` : ""}약 드실 시간이에요.`, body: `${series.title} · ${when}` };
    }
    if (series.kind === "hospital") return { title: "병원 가는 날이에요.", body: `${series.title} · ${when}` };
    if (series.kind === "meeting") return { title: "약속 시간이 다가와요.", body: `${series.title} · ${when}` };
    if (series.kind === "anniversary") {
      const head = series.tone === "memorial" ? "잊지 않도록 알려드려요." : "챙길 날이 다가와요.";
      return { title: head, body: `${series.title} · ${when}` };
    }
    return { title: series.title, body: `${when}${fire.offset > 0 ? ` · ${offsetLabel(fire.offset)} 알람` : ""}` };
  }

  // 전달이 이뤄진 뒤에만 notified 로 기록한다 (A-10)
  async function fireAlarm(fire) {
    const notified = state.data.settings.notifiedIds || [];
    if (notified.includes(fire.id)) return;
    const copy = alarmCopy(fire);
    let delivered = false;
    if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(copy.title, {
          body: copy.body,
          tag: fire.id,
          icon: "./icon-192-v2.png",
          badge: "./icon-192-v2.png",
          data: { url: `./?open=${fire.occ.date}` }, // 알림 딥링크 (C-05)
        });
        delivered = true;
      } catch { /* 화면 fallback 으로 전달 */ }
    }
    showToast(`⏰ ${copy.title} ${copy.body}`, 9000);
    delivered = true; // 화면 안내(fallback)까지 실패하면 이 줄에 도달하지 않는다
    if (delivered) {
      state.data.settings.notifiedIds = [...notified, fire.id].slice(-MAX_NOTIFIED_IDS);
      // 울린 스누즈는 정리해 같은 알람이 반복되지 않게 한다 (A-10)
      if (fire.id.includes(":snooze:")) {
        const occId = fire.id.split(":snooze:")[0];
        const status = state.data.statuses[occId];
        if (status && status.snoozeUntil && status.snoozeUntil <= Date.now()) delete state.data.statuses[occId];
      }
      persist();
    }
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
    // 복용 확인 기록 보관 기간 (C-06)
    const retention = Number(state.data.settings.doseRetentionDays) || 0;
    document.querySelectorAll("#doseRetentionGrid [data-retention]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.retention) === retention);
    });
    renderPeopleManage();
  }

  function renderPeopleManage() {
    const list = $("peopleManageList");
    if (!list) return;
    if (state.data.people.length === 0) {
      list.innerHTML = `<p class="settings-note settings-note--muted">아직 저장된 사람이 없어요. 약속·기념일을 만들 때 추가돼요.</p>`;
      return;
    }
    list.innerHTML = state.data.people.map((person) => {
      const used = state.data.series.filter((series) => series.personId === person.id || series.withPersonId === person.id).length;
      return `<div class="default-row" style="padding:4px 18px"><span class="default-value">${esc(person.name)}</span>` +
        `<span class="default-label">${esc(person.relation || "관계 없음")}${used > 0 ? ` · 일정 ${used}개` : ""}</span>` +
        `<button class="link-btn" type="button" data-person-rename="${person.id}">이름 바꾸기</button>` +
        `<button class="link-btn" type="button" data-person-delete="${person.id}" style="color:var(--sun)">삭제</button></div>`;
    }).join("");
  }

  $("doseRetentionGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-retention]");
    if (!button) return;
    if (!commit("retention", () => { state.data.settings.doseRetentionDays = Number(button.dataset.retention); })) return;
    purgeOldDoseRecords();
    renderSettings();
    showToast(button.dataset.retention === "0" ? "복용 기록을 직접 삭제할 때까지 보관해요." : `복용 기록을 ${button.dataset.retention}일 동안만 보관해요.`);
  });

  $("deleteAllButton").addEventListener("click", () => {
    if (!state.deleteAllArmed) {
      state.deleteAllArmed = true;
      showToast("정말 모두 삭제할까요? 삭제 전에 보관용 파일을 내려받아요. 버튼을 한 번 더 누르면 진행돼요.", 9000);
      setTimeout(() => { state.deleteAllArmed = false; }, 10000);
      return;
    }
    state.deleteAllArmed = false;
    download(`calendarbom-before-delete-${todayKey()}.json`, sched.exportJSON(state.data, new Date().toISOString(), APP_VERSION), "application/json");
    const ok = commit("delete-all", () => {
      const keepSettings = { fontScale: state.data.settings.fontScale, doseRetentionDays: state.data.settings.doseRetentionDays };
      state.data = { ...sched.emptyData(), settings: keepSettings };
    });
    if (!ok) return;
    renderSettings();
    renderCalendar();
    renderAlerts();
    rearmAlarms();
    showToast("모든 일정·사람·복용 기록을 삭제했어요. 방금 내려받은 파일로 되살릴 수 있어요.", 9000, true);
  });

  $("peopleManageList").addEventListener("click", (event) => {
    const rename = event.target.closest("[data-person-rename]");
    const remove = event.target.closest("[data-person-delete]");
    if (rename) {
      const person = state.data.people.find((p) => p.id === rename.dataset.personRename);
      if (!person) return;
      const name = window.prompt("어떻게 부를까요?", person.name);
      if (!name || !name.trim()) return;
      if (!commit("person-rename", () => { person.name = name.trim().slice(0, 20); })) return;
      renderSettings();
      showToast("이름을 바꿨어요. 이미 만든 일정 제목은 그대로예요.", 6000);
    }
    if (remove) {
      const person = state.data.people.find((p) => p.id === remove.dataset.personDelete);
      if (!person) return;
      const used = state.data.series.filter((series) => series.personId === person.id || series.withPersonId === person.id).length;
      const ok = commit("person-delete", () => {
        state.data.people = state.data.people.filter((p) => p.id !== person.id);
      });
      if (!ok) return;
      renderSettings();
      showToast(used > 0 ? `${person.name}을(를) 목록에서 지웠어요. 연결됐던 일정 ${used}개는 그대로 있어요.` : "목록에서 지웠어요.", 7000, true);
    }
  });

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
        // 1년 치 전부 — 하루 3회 일정도 잘리지 않는다(최대 4슬롯 × 366일)
        for (const occ of sched.occurrencesInRange([series], today, sched.addDays(today, 365))) {
          const slot = series.slots[occ.slotIndex];
          events.push({ id: occ.id, title: slot && slot.label ? `${series.title} (${slot.label})` : series.title, date: occ.date, time: occ.time });
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
    let incomingFull = null;
    let incomingSeries = [];
    let incomingPeople = [];
    try {
      if (/BEGIN:VCALENDAR/i.test(text)) {
        if (/DTSTART[^\n]*T\d{6}Z/.test(text)) {
          showToast("세계표준시(Z)로 저장된 일정이 있어요. 시각이 한국 시간과 다를 수 있으니 가져온 뒤 확인해 주세요.", 8000);
        }
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
        incomingFull = result;
      }
    } catch {
      showToast("파일을 읽지 못했어요. 캘린더봄에서 저장한 파일인지 확인해 주세요.");
      return;
    }
    if (incomingSeries.length === 0 && incomingPeople.length === 0) {
      showToast("가져올 일정을 찾지 못했어요. 기존 데이터는 바꾸지 않았어요.");
      return;
    }
    // 전체 백업 파일이면 합치기/교체 선택을 제공한다 (A-08)
    state.pendingImport = { series: incomingSeries, people: incomingPeople, full: incomingFull };
    openImportChoice();
  });

  function openImportChoice() {
    const pending = state.pendingImport;
    const doseCount = pending.full ? Object.values(pending.full.statuses || {}).filter((v) => v.state).length : 0;
    state.sheet = { date: todayKey(), mode: "import", saved: false };
    $("daySheet").hidden = false;
    document.body.style.overflow = "hidden";
    $("sheetKicker").textContent = "가져오기";
    $("sheetDateTitle").textContent = "백업 파일을 확인했어요";
    $("sheetSticky").hidden = true;
    $("sheetBody").innerHTML = `<div class="step-panel">` +
      `<div class="share-preview">일정 ${pending.series.length}개\n사람 ${pending.people.length}명\n복용 확인 ${doseCount}개</div>` +
      `<p class="share-warn">이 파일에는 약 이름, 사람 이름과 관계, 복용 기록이 들어 있을 수 있어요.</p>` +
      `<div class="modal-actions">` +
      `<button class="action-btn primary" type="button" data-act="import-merge">기존 데이터에 합치기</button>` +
      `<button class="action-btn" type="button" data-act="import-replace">현재 데이터를 안전하게 백업하고 교체</button>` +
      `<button class="action-btn" type="button" data-act="import-cancel">그만두기</button>` +
      `</div></div>`;
  }

  function handleImportChoice(action) {
    const pending = state.pendingImport;
    if (!pending) return;
    if (action === "import-cancel") {
      state.pendingImport = null;
      closeDaySheet(true);
      return;
    }
    if (action === "import-replace") {
      // 교체 전 현재 데이터를 자동 복구본으로 남기고 내려받게 한다 (A-08)
      try { localStorage.setItem(`${RECOVERY_KEY}:before-replace`, JSON.stringify(state.data)); } catch { /* 공간 부족 */ }
      download(`calendarbom-before-replace-${todayKey()}.json`, sched.exportJSON(state.data, new Date().toISOString(), APP_VERSION), "application/json");
      const replaced = pending.full
        ? sched.normalizeData({ version: sched.SCHEMA_VERSION, people: pending.people, series: pending.series, statuses: pending.full.statuses, recents: pending.full.recents, settings: pending.full.settings || state.data.settings })
        : null;
      const ok = commit("import", () => {
        state.data = replaced || { ...sched.emptyData(), series: pending.series, people: pending.people, settings: state.data.settings };
      });
      if (!ok) return;
      state.pendingImport = null;
      closeDaySheet(true);
      renderSettings();
      renderCalendar();
      renderAlerts();
      rearmAlarms();
      showToast("백업 파일로 교체했어요. 이전 데이터는 방금 내려받은 파일에 있어요.", 9000, true);
      return;
    }
    if (action === "import-merge") {
      const known = new Set(state.data.series.map((series) => sched.importKey(series)));
      const freshSeries = pending.series.filter((series) => !known.has(sched.importKey(series)));
      const knownPeople = new Set(state.data.people.map((person) => person.id));
      const freshPeople = pending.people.filter((person) => !knownPeople.has(person.id));
      const ok = commit("import", () => {
        state.data.series.push(...freshSeries);
        state.data.people.push(...freshPeople);
        if (pending.full && pending.full.statuses) {
          for (const [key, value] of Object.entries(pending.full.statuses)) {
            if (!state.data.statuses[key]) state.data.statuses[key] = value;
          }
        }
      });
      if (!ok) return;
      state.pendingImport = null;
      closeDaySheet(true);
      renderSettings();
      renderCalendar();
      renderAlerts();
      rearmAlarms();
      const dupes = pending.series.length - freshSeries.length;
      showToast(`일정 ${freshSeries.length}개를 합쳤어요.${dupes > 0 ? ` (중복 ${dupes}개 제외)` : ""}`, 8000, true);
    }
  }

  // ── 토스트(+되돌리기) ──
  let toastTimer = null;
  function showToast(message, duration = 3200, withUndo = false, action = null) {
    const toast = $("toast");
    let button = "";
    if (action) button = `<button class="undo-btn" type="button" id="toastActionButton">${esc(action.label)}</button>`;
    else if (withUndo && state.undo) button = `<button class="undo-btn" type="button" id="undoButton">되돌리기</button>`;
    toast.innerHTML = esc(message) + button;
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
    const actionButton = $("toastActionButton");
    if (actionButton && action) {
      actionButton.addEventListener("click", () => {
        toast.classList.remove("show");
        action.onClick();
      });
    }
  }

  // 토스트 밖을 누르면 토스트를 바로 치워 아래 버튼을 가리지 않는다
  document.addEventListener("pointerdown", (event) => {
    const toast = $("toast");
    if (toast.classList.contains("show") && !toast.contains(event.target)) toast.classList.remove("show");
  }, true);

  // ── 서비스워커·버전 ──
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js");
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showToast("캘린더봄 새 버전이 준비됐어요.", 10000, false, { label: "새로고침", onClick: () => {
                worker.postMessage({ type: "SKIP_WAITING" });
                setTimeout(() => location.reload(), 300);
              } });
            }
          });
        });
      } catch { /* 오프라인 등 — 다음 방문에 다시 시도 */ }
    });
  }
  $("appVersionText").textContent = APP_VERSION;
  $("buildShaText").textContent = BUILD_SHA.startsWith("__") ? "로컬" : BUILD_SHA;
  $("cacheVersionText").textContent = `calendarbom-v${APP_VERSION}`;

  // ── 복구 흐름 (A-03) ──
  function renderRecoveryBanner() {
    if (!state.recoveryPending) return;
    const banner = document.createElement("div");
    banner.className = "recovery-banner";
    banner.setAttribute("role", "alert");
    const isLkg = state.recoveryPending === "lkg";
    banner.innerHTML = `<strong>${isLkg ? "저장된 데이터에 문제가 있어 마지막 정상 상태를 보여드려요." : "저장된 데이터를 읽지 못했어요."}</strong>` +
      `<p>손상되기 전 원본은 안전하게 보관해 두었어요. 원하는 방법을 골라주세요.</p>` +
      `<div class="modal-actions">` +
      `<button class="action-btn" type="button" id="recoveryDownloadButton">손상 전 데이터 내려받기</button>` +
      `<button class="action-btn" type="button" id="recoveryImportButton">백업 파일 가져오기</button>` +
      `<button class="action-btn primary" type="button" id="recoveryKeepButton">${isLkg ? "이 상태로 계속 쓰기" : "새로 시작"}</button>` +
      `</div>`;
    $("view-calendar").prepend(banner);
    $("recoveryDownloadButton").addEventListener("click", () => {
      const raw = localStorage.getItem(RECOVERY_KEY) || "{}";
      download(`calendarbom-recovery-${todayKey()}.json`, raw, "application/json");
    });
    $("recoveryImportButton").addEventListener("click", () => $("importFileInput").click());
    $("recoveryKeepButton").addEventListener("click", () => {
      if (persist()) {
        state.recoveryPending = false;
        banner.remove();
        showToast("이 상태로 계속 써요. 손상 전 원본은 계속 보관돼요.", 6000);
      }
    });
  }

  // 복용 기록 보관 기간 정리 (C-06)
  function purgeOldDoseRecords() {
    const days = Number(state.data.settings.doseRetentionDays);
    if (!Number.isFinite(days) || days <= 0) return; // 기본: 직접 삭제할 때까지
    const cutoff = Date.now() - days * 86400000;
    let removed = 0;
    for (const [key, value] of Object.entries(state.data.statuses)) {
      if (value.state && value.at && value.at < cutoff) {
        delete state.data.statuses[key];
        removed += 1;
      }
    }
    if (removed > 0) persist();
  }

  // 알림 딥링크: ./?open=YYYY-MM-DD (C-05)
  function handleDeepLink() {
    const open = new URLSearchParams(location.search).get("open");
    if (open && cal.parseKey(open)) {
      const parsed = cal.parseKey(open);
      state.cursor = { year: parsed.year, month: parsed.month };
      renderCalendar();
      openDaySheet(open);
      history.replaceState(null, "", location.pathname);
    }
  }

  // ── 시작 ──
  const now = new Date();
  state.cursor = { year: now.getFullYear(), month: now.getMonth() + 1 };
  applyFontScale();
  renderWeekdays();
  purgeOldDoseRecords();
  renderCalendar();
  renderSettings();
  rearmAlarms();
  renderRecoveryBanner();
  handleDeepLink();
  if (state.data.settings.migratedFromV1 && !state.data.settings.migrationNoticeShown) {
    state.data.settings.migrationNoticeShown = true;
    persist();
    showToast("기존 일정을 새 버전으로 안전하게 옮겼어요.", 6000);
  }
})();
