// 로봄 본부 렌더러 — /snapshot.json(실데이터)만 그린다. 증거 없는 상태는 만들지 않는다.
const STATUS = {
  waiting: ["대기", "s-wait"], assigned: ["배정됨", "s-run"], investigating: ["조사 중", "s-run"],
  implementing: ["구현 중", "s-run"], verifying: ["검증 중", "s-verify"], fixing: ["수정 중", "s-verify"],
  deploying: ["배포 중", "s-run"], approval_pending: ["승인 대기", "s-approve"], external_wait: ["외부 작업 대기", "s-approve"],
  blocked: ["막힘", "s-block"], completed: ["완료", "s-ok"], failed: ["실패", "s-fail"],
  needs_check: ["상태 확인 필요", "s-block"], working: ["작업 중", "s-run"],
};
const HEALTH = { ok: ["정상", "ok"], warn: ["주의", "warn"], down: ["장애", "bad"], unknown: ["확인 중", "warn"], running: ["배포 중", "warn"], planned: ["준비 중", "warn"] };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = (st) => { const [l, c] = STATUS[st] || [st, "s-wait"]; return `<span class="badge ${c}">${esc(l)}</span>`; };
const fmt = (iso) => { if (!iso) return "—"; try { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch { return iso; } };
const ago = (iso) => { if (!iso) return "—"; const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return "방금"; if (s < 3600) return `${Math.floor(s/60)}분 전`; if (s < 86400) return `${Math.floor(s/3600)}시간 전`; return `${Math.floor(s/86400)}일 전`; };

let SNAP = null;
let CURRENT = "today";

async function load() {
  try {
    const res = await fetch("./snapshot.json", { cache: "no-store" });
    SNAP = await res.json();
  } catch (e) {
    document.getElementById("screen").innerHTML = `<div class="empty">스냅샷을 불러오지 못했습니다.<br>먼저 <code>node scripts/control-center/build-snapshot.mjs</code>를 실행하세요.</div>`;
    return;
  }
  const lt = SNAP.company?.trafficLight || "wait";
  const el = document.getElementById("companyLight");
  el.className = `light ${lt}`;
  el.querySelector("b").textContent = lt === "green" ? "정상" : lt === "yellow" ? "주의" : lt === "red" ? "장애" : "—";
  render(CURRENT);
}

function setScreen(name) {
  CURRENT = name;
  document.querySelectorAll("[data-screen]").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  render(name);
}

function render(name) {
  const s = document.getElementById("screen");
  if (!SNAP) return;
  s.innerHTML = ({ today: renderToday, org: renderOrg, staff: renderStaff, apps: renderApps, approvals: renderApprovals, log: renderLog }[name] || renderToday)();
  s.scrollTop = 0;
}

function renderToday() {
  const c = SNAP.company, lt = c.trafficLight;
  const ltText = lt === "green" ? "전체 정상" : lt === "yellow" ? "주의 필요" : "장애 있음";
  const tiles = [
    [`정상 ${c.apps.ok} · 주의 ${c.apps.warn} · 장애 ${c.apps.down}`, `앱 ${c.apps.live}개 운영`, c.apps.down ? "bad" : c.apps.warn ? "warn" : "good"],
    [`${c.employees.working} / ${c.employees.registered}`, "실제 작업 중 / 등록 직원", ""],
    [`${c.tasks.verifying}`, "검증 중", ""],
    [`${c.tasks.approvalPending}`, "사장 승인 대기", c.tasks.approvalPending ? "warn" : ""],
    [`${c.tasks.blocked + c.tasks.needsCheck}`, "막힘·상태확인", (c.tasks.blocked + c.tasks.needsCheck) ? "warn" : ""],
    [`${c.todayDeploys}`, "오늘 배포", ""],
    [`${c.todayFailures}`, "오늘 실패", c.todayFailures ? "bad" : ""],
    [`${c.apps.planned}`, "준비 중 앱", ""],
  ];
  const working = (SNAP.runs || []).filter((r) => !["completed", "failed"].includes(r.status)).slice(0, 6);
  return `
    <div class="today-hero">
      <div class="hero-line ${lt}"><div><b>로봄 ${ltText}</b><br><small>${esc(fmt(SNAP.generatedAt))} 기준 · ${esc(SNAP.phase)}</small></div></div>
      <div class="tiles">${tiles.map(([b, s, cls]) => `<div class="tile ${cls}"><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join("")}</div>
    </div>
    <div class="section-title">지금 진행 중인 작업</div>
    ${working.length ? `<div class="list">${working.map(empCard).join("")}</div>` : `<div class="card empty">실제 작업 이벤트가 없습니다. (등록 직원은 대기 상태) — 작업이 시작되면 여기에 증거와 함께 표시됩니다.</div>`}
    ${sysNote()}`;
}

function renderOrg() {
  const deps = SNAP.departments || [];
  const runByDep = {};
  (SNAP.runs || []).forEach((r) => { if (r.departmentId) (runByDep[r.departmentId] ||= []).push(r); });
  const group = (g, title) => {
    const items = deps.filter((d) => d.group === g);
    if (!items.length) return "";
    return `<div class="section-title">${title}</div><div class="list">${items.map((d) => {
      const runs = runByDep[d.id] || [];
      const working = runs.filter((r) => !["completed", "failed"].includes(r.status)).length;
      return `<div class="card emp"><div class="emp-head"><strong>${esc(d.name)}</strong>${working ? badge("working") : `<span class="badge s-wait">대기</span>`}</div>
        <div class="emp-meta">${esc(d.duty || "")}</div>
        <div class="emp-row"><span>책임자 <b>${esc(d.lead || "미지정")}</b></span><span>작업 중 <b>${working}</b></span></div></div>`;
    }).join("")}</div>`;
  };
  return `${group("exec", "사장실·비서실")}${group("product", "제품 부문")}${group("common", "공통 전문 부서")}${sysNote()}`;
}

function renderStaff() {
  const agents = SNAP.agents || [];
  const runByAgent = {};
  (SNAP.runs || []).forEach((r) => { if (r.agentId) (runByAgent[r.agentId] ||= []).push(r); });
  return `<div class="section-title">직원 상황실 — 등록 ${agents.length}명 · 실제 작업 중 ${SNAP.company.employees.working}명</div>
    <p class="foot-note">‘등록됨’은 역할이 존재한다는 뜻이고, 실제 이벤트·세션 증거가 있을 때만 작업 중으로 표시합니다.</p>
    <div class="list">${agents.map((a) => {
      const runs = (runByAgent[a.id] || []).filter((r) => !["completed", "failed"].includes(r.status));
      if (!runs.length) return `<div class="card emp"><div class="emp-head"><strong>${esc(a.name)}</strong><span class="badge s-wait">대기</span></div><div class="emp-meta">${esc(a.department || "")} · ${esc(a.cadence || "")}${a.kind === "room" ? " · 작업실" : ""}</div></div>`;
      return runs.map(empCard).join("");
    }).join("")}</div>${sysNote()}`;
}

function empCard(r) {
  const checks = (r.checks || []).map((c) => `<span class="pill ${c.result === "PASS" ? "ok" : "bad"}">${esc(c.name)} ${c.result}</span>`).join("");
  const tl = (r.timeline || []).slice(-6).map((t) => `<div class="t"><time>${esc(fmt(t.at))}</time><span>${esc(t.type)}${t.message ? " · " + esc(t.message) : ""}</span></div>`).join("");
  return `<div class="card emp">
    <div class="emp-head"><strong>${esc(r.agentId || "직원")}</strong>${badge(r.status)}</div>
    <div class="emp-meta">${esc(r.task || "작업 미기재")}</div>
    <div class="emp-row">
      ${r.appId ? `<span>앱 <b>${esc(r.appId)}</b></span>` : ""}
      ${r.branch ? `<span>브랜치 <code>${esc(r.branch)}</code></span>` : ""}
      ${r.pr ? `<span>PR <b>#${esc(r.pr)}</b></span>` : ""}
      <span class="dim">시작 ${esc(fmt(r.startedAt))}</span>
      <span class="dim">마지막 ${esc(ago(r.lastActivity))}</span>
    </div>
    ${checks ? `<div class="pill-row">${checks}</div>` : ""}
    ${r.blockedReason ? `<div class="emp-meta" style="color:var(--st-block)">막힘: ${esc(r.blockedReason)}</div>` : ""}
    ${tl ? `<details><summary class="dim" style="font-size:12px;cursor:pointer">로그 보기</summary><div class="timeline">${tl}</div></details>` : ""}
  </div>`;
}

function renderApps() {
  const apps = SNAP.apps || [];
  return `<div class="section-title">제품 관제 — ${apps.length}개 앱</div>
    <div class="list apps-list">${apps.map((a) => {
      const [hl, hc] = HEALTH[a.health] || ["확인 중", "warn"];
      const ci = (a.ci || [])[0];
      const work = a.git?.workBranches || [];
      return `<div class="card app-card ${a.registered ? "" : "unreg"}">
        <div class="app-top"><span class="app-dot" style="background:${esc(a.accent || "#8a97a3")}"></span><strong>${esc(a.name)}</strong><span class="ver">v${esc(a.version || "—")}</span></div>
        <div class="pill-row">
          <span class="pill ${hc}">${esc(hl)}</span>
          ${a.registered ? "" : `<span class="pill warn">registry 미등록</span>`}
          ${a.github === "connected" ? `<span class="pill">PR ${a.openPrs.length}</span>` : `<span class="pill warn">GitHub ${a.github}</span>`}
          ${ci ? `<span class="pill ${ci.conclusion === "success" ? "ok" : ci.conclusion === "failure" ? "bad" : ""}">${esc(ci.name)} ${esc(ci.conclusion || ci.status)}</span>` : ""}
        </div>
        <dl class="kv">
          <dt>저장소</dt><dd>${esc(a.repo || "미생성")}</dd>
          <dt>운영 URL</dt><dd>${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url)}</a>` : "—"}</dd>
          ${a.git?.available ? `<dt>로컬 git</dt><dd><code>${esc(a.git.branch)}</code> @ ${esc(a.git.sha)} · ${esc(ago(a.git.lastDate))}</dd>` : ""}
          ${work.length ? `<dt>작업 브랜치</dt><dd>${work.map((b) => `<code>${esc(b.name)}</code>`).join(" ")}</dd>` : ""}
          ${a.role ? `<dt>가치</dt><dd>${esc(a.role)}</dd>` : ""}
          ${a.note ? `<dt>메모</dt><dd>${esc(a.note)}</dd>` : ""}
        </dl>
        ${a.nextActions?.length ? `<div><b style="font-size:12px;color:var(--muted)">다음 작업</b><ul class="next-list">${a.nextActions.slice(0,3).map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
        ${a.openPrs?.length ? `<div class="pill-row">${a.openPrs.slice(0,3).map((p) => `<span class="pill">${p.draft ? "Draft " : ""}#${p.number} ${esc(p.branch || "")}</span>`).join("")}</div>` : ""}
      </div>`;
    }).join("")}</div>${sysNote()}`;
}

function renderApprovals() {
  const apps = SNAP.approvals || [];
  if (!apps.length) return `<div class="section-title">승인함</div><div class="card empty">지금 사장 결정이 필요한 항목이 없습니다.<br><span class="dim">일상적인 수정·테스트·기존 배포는 승인함을 채우지 않습니다.</span></div>${sysNote()}`;
  return `<div class="section-title">승인함 — 사장 결정 ${apps.length}건</div>
    <div class="list">${apps.map((a) => `<div class="card appr">
      <h4>${esc(a.decision || a.title || "결정 필요")}</h4>
      ${a.why ? `<div class="emp-meta">이유: ${esc(a.why)}</div>` : ""}
      ${a.recommendation ? `<div class="emp-row"><span>추천안 <b>${esc(a.recommendation)}</b></span></div>` : ""}
      ${a.cost ? `<div class="emp-row"><span>비용 ${esc(a.cost)}</span>${a.reversible ? `<span>되돌림 ${esc(a.reversible)}</span>` : ""}</div>` : ""}
      ${a.app ? `<span class="pill">${esc(a.app)}</span>` : ""}
    </div>`).join("")}</div>${sysNote()}`;
}

function renderLog() {
  const ev = SNAP.events || [];
  return `<div class="section-title">활동 로그 — 최근 ${ev.length}건</div>
    ${ev.length ? `<div class="card">${ev.map((e) => `<div class="log-item"><time>${esc(fmt(e.createdAt))}</time><div><b>${esc(e.type)}</b> · ${esc(e.agentId || "-")} ${e.appId ? "· " + esc(e.appId) : ""}${e.message ? "<br><span class='dim'>" + esc(e.message) + "</span>" : ""}</div></div>`).join("")}</div>` : `<div class="card empty">아직 작업 이벤트가 없습니다.<br><span class="dim">Claude Code·Codex·Actions가 emit-event로 남기면 여기에 시간순으로 쌓입니다.</span></div>`}
    ${sysNote()}`;
}

function sysNote() {
  const c = SNAP.connections || {};
  return `<div class="card" style="margin-top:14px">
    <div class="section-title" style="margin-top:0">연결 상태</div>
    <div class="conn">
      <span class="pill ${c.github?.startsWith("connected") ? "ok" : "warn"}">GitHub ${esc(c.github || "?")}</span>
      <span class="pill ${(c.localGit||[]).length ? "ok" : "warn"}">로컬 git ${(c.localGit||[]).length}개</span>
      <span class="pill ${c.events === "connected" ? "ok" : "warn"}">이벤트 ${esc(c.events || "?")}</span>
      <span class="pill warn">Claude Code ${esc(c.claudeCode || "?")}</span>
      <span class="pill warn">Codex ${esc(c.codex || "?")}</span>
    </div>
    <p class="foot-note">로봄 본부는 실제 저장소·git·GitHub·작업 이벤트만 읽는 <b>읽기 전용(Phase 1)</b> 내부 도구입니다. 증거 없는 직원은 ‘대기’로 둡니다. 공개 robom.kr에는 노출하지 않습니다.</p>
  </div>`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-screen]");
  if (b) setScreen(b.dataset.screen);
  if (e.target.closest("#refreshBtn")) load();
});
load();
