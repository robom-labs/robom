// 로봄 본부 렌더러 — AGENT HQ 감성. 실데이터(/snapshot.json)만. 증거 없는 데스크는 '대기'.
const STATUS = {
  waiting: ["대기", "s-wait"], assigned: ["배정", "s-run"], investigating: ["조사", "s-run"],
  implementing: ["구현", "s-run"], verifying: ["검증", "s-verify"], fixing: ["수정", "s-verify"],
  deploying: ["배포", "s-run"], approval_pending: ["승인대기", "s-approve"], external_wait: ["외부대기", "s-approve"],
  blocked: ["막힘", "s-block"], completed: ["완료", "s-ok"], failed: ["실패", "s-fail"],
  needs_check: ["상태확인", "s-block"], working: ["가동", "s-run"],
};
const HEALTH = { ok: ["정상", "ok"], warn: ["주의", "warn"], down: ["장애", "bad"], unknown: ["확인중", "warn"], running: ["배포중", "warn"], planned: ["준비중", "warn"] };
const ACTIVE_ST = new Set(["assigned", "investigating", "implementing", "deploying", "working"]);
// 부서 네온 색
const DC = {
  exec: "#35e39b", chief: "#3ba7ff", portfolio: "#a879ff",
  "hq-web": "#35e39b", outbom: "#3ba7ff", homebom: "#35e39b", runningbom: "#ff5d6c", calendarbom: "#2fe0c4", certbom: "#a879ff",
  "pm-ux": "#ffcf4d", design: "#ff9d42", "web-pwa": "#3ba7ff", "mobile-store": "#a879ff",
  "data-automation": "#2fe0c4", dev: "#3ba7ff", qa: "#35e39b", "release-ci": "#ffcf4d",
  security: "#ff5d6c", growth: "#ff9d42", support: "#2fe0c4", "red-team": "#a879ff",
};
const CODE = {
  exec: "UNIT EXO", chief: "UNIT CMD", portfolio: "UNIT PMO", "hq-web": "UNIT HQ",
  outbom: "PROJ OUT", homebom: "PROJ HOME", runningbom: "PROJ RUN", calendarbom: "PROJ CAL", certbom: "PROJ CERT",
  "pm-ux": "UNIT UX", design: "UNIT DSN", "web-pwa": "UNIT WEB", "mobile-store": "UNIT MOB",
  "data-automation": "UNIT DATA", dev: "UNIT DEV", qa: "UNIT QA", "release-ci": "UNIT REL",
  security: "UNIT SEC", growth: "UNIT GRW", support: "UNIT SUP", "red-team": "UNIT RED",
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = (st) => { const [l, c] = STATUS[st] || [st, "s-wait"]; return `<span class="badge ${c}">${esc(l)}</span>`; };
const fmt = (iso) => { if (!iso) return "—"; try { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch { return iso; } };
const ago = (iso) => { if (!iso) return "—"; const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return "방금"; if (s < 3600) return `${Math.floor(s/60)}분 전`; if (s < 86400) return `${Math.floor(s/3600)}시간 전`; return `${Math.floor(s/86400)}일 전`; };

let SNAP = null, CURRENT = "command";

function runsByAgent() { const m = {}; (SNAP.runs || []).forEach((r) => { if (r.agentId) (m[r.agentId] ||= []).push(r); }); return m; }
function activeRun(list) { return (list || []).find((r) => !["completed", "failed"].includes(r.status)) || null; }

async function load() {
  try { SNAP = await (await fetch("./snapshot.json", { cache: "no-store" })).json(); }
  catch { document.getElementById("screen").innerHTML = `<div class="empty">스냅샷 없음 — <code>node scripts/control-center/build-snapshot.mjs</code> 실행</div>`; return; }
  renderKpis();
  const badgeEl = document.getElementById("modeBadge");
  const live = (SNAP.connections?.github || "").startsWith("connected");
  badgeEl.textContent = live ? "LIVE" : "OFFLINE"; badgeEl.classList.toggle("demo", !live);
  document.getElementById("hqSub").textContent = `로봄 본부 · 앱 ${SNAP.company.apps.total} · 직원 ${SNAP.company.employees.registered}`;
  render(CURRENT);
}

function renderKpis() {
  const c = SNAP.company, rb = runsByAgent();
  const agents = SNAP.agents || [];
  const activeAgents = agents.filter((a) => { const r = activeRun(rb[a.id]); return r && ACTIVE_ST.has(r.status); }).length;
  const verify = (SNAP.runs || []).filter((r) => r.status === "verifying" || r.status === "fixing").length;
  const block = c.tasks.blocked + c.tasks.needsCheck;
  const standby = Math.max(0, agents.length - activeAgents - verify);
  const pr = (SNAP.apps || []).reduce((n, a) => n + (a.openPrs?.length || 0), 0);
  const kpis = [
    ["ACTIVE", c.employees.working, "active"],
    ["STANDBY", standby, "standby"],
    ["VERIFY", verify, "verify"],
    ["BLOCK", block, "block"],
    ["APPROVAL", c.tasks.approvalPending, "approve"],
    ["OPEN PR", pr, "links"],
    ["APPS", `${c.apps.ok}/${c.apps.live}`, "apps"],
  ];
  document.getElementById("kpis").innerHTML = kpis.map(([l, v, cls]) => `<div class="kpi ${cls}"><span class="lab">${l}</span><span class="val">${String(v).padStart ? esc(String(v)) : v}</span></div>`).join("");
}

function setScreen(name) { CURRENT = name; document.querySelectorAll("[data-screen]").forEach((b) => b.classList.toggle("active", b.dataset.screen === name)); render(name); }
function render(name) { const s = document.getElementById("screen"); if (!SNAP) return; s.innerHTML = ({ command: renderCommand, today: renderToday, staff: renderStaff, apps: renderApps, approvals: renderApprovals, log: renderLog }[name] || renderCommand)(); s.scrollTop = 0; }

// ── 조직 관제: 부서(팀) 그리드 ──
function renderCommand() {
  const deps = SNAP.departments || [], agents = SNAP.agents || [], rb = runsByAgent();
  const appById = {}; (SNAP.apps || []).forEach((a) => appById[a.id] = a);
  const total = SNAP.company.employees.registered, working = SNAP.company.employees.working;
  const groupHtml = (g, title) => {
    const items = deps.filter((d) => d.group === g);
    if (!items.length) return "";
    return `<div class="section-title">${title}</div><div class="dept-grid">${items.map((d) => deptCard(d, agents, rb, appById[d.id])).join("")}</div>`;
  };
  return `
    <div class="cmd-head">
      <div><h1>ORGANIZATION COMMAND</h1><div class="sub">${deps.length}개 부서 · 직원 ${total}명 · 실가동 ${working}명</div></div>
      <span class="link-stable">CONTROL LINK ${SNAP.connections?.github?.startsWith("connected") ? "STABLE" : "OFFLINE"}</span>
    </div>
    ${groupHtml("exec", "사장실·비서실")}
    ${groupHtml("product", "제품 부문 (프로젝트)")}
    ${groupHtml("common", "공통 전문 부서")}
    ${sysNote()}`;
}

function deptCard(d, agents, rb, app) {
  const color = DC[d.id] || "#3ba7ff";
  let desks = [], roster = 0, on = 0, verify = 0, block = 0;
  if (d.group === "product" && app) {
    // 제품팀 데스크 = 그 앱의 실제 라이브 작업(PR·작업 브랜치·해당 앱 run)
    const runs = (SNAP.runs || []).filter((r) => r.appId === app.id && !["completed", "failed"].includes(r.status));
    runs.forEach((r) => { const st = r.status === "verifying" ? "verify" : r.status === "blocked" || r.status === "needs_check" ? "block" : "on"; desks.push({ who: r.agentId || "agent", what: r.task || "", cls: st }); if (st === "on") on++; else if (st === "verify") verify++; else block++; });
    (app.openPrs || []).slice(0, 4).forEach((p) => { desks.push({ who: (p.branch || `#${p.number}`), what: (p.draft ? "Draft PR" : "PR") + " 검토 대기", cls: "verify" }); verify++; });
    (app.git?.workBranches || []).slice(0, 3).forEach((b) => { if (!desks.some((x) => x.who === b.name)) desks.push({ who: b.name, what: "작업 브랜치", cls: "idle" }); });
    roster = Math.max(desks.length, 1);
    if (!desks.length) desks.push({ who: app.id, what: app.health === "planned" ? "저장소 준비 중" : "대기", cls: "idle" });
  } else {
    const roster0 = agents.filter((a) => a.department === d.id);
    roster = roster0.length;
    desks = roster0.map((a) => {
      const r = activeRun(rb[a.id]);
      let cls = "idle";
      if (r) { if (r.status === "verifying" || r.status === "fixing") { cls = "verify"; verify++; } else if (r.status === "blocked" || r.status === "needs_check") { cls = "block"; block++; } else if (ACTIVE_ST.has(r.status)) { cls = "on"; on++; } }
      return { who: a.id, what: r ? (r.task || STATUS[r.status]?.[0]) : "대기", cls };
    });
    if (!desks.length) desks.push({ who: "미배치", what: "playbook 대기", cls: "idle" });
  }
  const active = on + verify + block;
  const util = roster ? Math.round((active / roster) * 100) : 0;
  const focus = d.group === "product" && app ? `${esc(app.name)} 관제 →` : (d.lead ? `${esc(d.lead)} →` : "관제 →");
  return `<div class="dept" style="--dc:${color}">
    <div class="dept-top">
      <div class="dept-name"><b>${esc(d.name)}</b><small>${CODE[d.id] || "UNIT"}</small></div>
      <div class="dept-count">${roster}<small>배치</small></div>
    </div>
    <div class="dept-stats">
      <div class="${active ? "on" : ""}"><b>${active}</b><small>가동</small></div>
      <div><b>${verify}</b><small>검증</small></div>
      <div><b>${roster - active}</b><small>대기</small></div>
    </div>
    <div class="util"><div class="util-bar"><i style="width:${util}%"></i></div><div class="util-row"><span>가동률</span><span>${util}%</span></div></div>
    <div class="desks-label">LIVE DESKS · ${active}/${roster} 가동</div>
    <div class="desks">${desks.slice(0, 5).map((k) => `<div class="desk ${k.cls}"><span class="dot"></span><span class="who">${esc(k.who)}</span><span class="what">${esc(k.what)}</span></div>`).join("")}</div>
    <div class="dept-focus">${focus}</div>
  </div>`;
}

function renderToday() {
  const c = SNAP.company;
  const tiles = [
    [`${c.apps.ok}/${c.apps.live}`, "앱 정상", c.apps.down ? "bad" : c.apps.warn ? "warn" : "good"],
    [`${c.employees.working}/${c.employees.registered}`, "직원 가동", ""],
    [`${c.tasks.verifying}`, "검증 중", ""],
    [`${c.tasks.approvalPending}`, "승인 대기", c.tasks.approvalPending ? "warn" : ""],
    [`${c.tasks.blocked + c.tasks.needsCheck}`, "막힘·확인", (c.tasks.blocked + c.tasks.needsCheck) ? "warn" : ""],
    [`${c.todayDeploys}`, "오늘 배포", ""],
    [`${c.todayFailures}`, "오늘 실패", c.todayFailures ? "bad" : ""],
    [`${c.apps.planned}`, "준비 앱", ""],
  ];
  const working = (SNAP.runs || []).filter((r) => !["completed", "failed"].includes(r.status)).slice(0, 8);
  return `<div class="cmd-head"><div><h1>TODAY · 오늘의 로봄</h1><div class="sub">${esc(fmt(SNAP.generatedAt))} 기준</div></div><span class="link-stable">${c.trafficLight === "green" ? "ALL GREEN" : c.trafficLight === "yellow" ? "ATTENTION" : "ALERT"}</span></div>
    <div class="tiles">${tiles.map(([b, s, cls]) => `<div class="tile ${cls}"><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join("")}</div>
    <div class="section-title">지금 진행 중</div>
    ${working.length ? `<div class="list">${working.map(empCard).join("")}</div>` : `<div class="card empty">실제 작업 이벤트가 없습니다. 등록 직원은 대기 상태입니다.</div>`}
    ${sysNote()}`;
}

function renderStaff() {
  const agents = SNAP.agents || [], rb = runsByAgent();
  return `<div class="cmd-head"><div><h1>STAFF · 직원 상황실</h1><div class="sub">등록 ${agents.length} · 가동 ${SNAP.company.employees.working}</div></div></div>
    <div class="list">${agents.map((a) => { const r = activeRun(rb[a.id]); if (!r) return `<div class="card emp"><div class="emp-head"><strong>${esc(a.name)}</strong><span class="badge s-wait">대기</span></div><div class="emp-meta dim">${esc(a.department || "")} · ${esc(a.cadence || "")}${a.kind === "room" ? " · 작업실" : ""}</div></div>`; return empCard(r, a.name); }).join("")}</div>${sysNote()}`;
}

function empCard(r, name) {
  const checks = (r.checks || []).map((c) => `<span class="pill ${c.result === "PASS" ? "ok" : "bad"}">${esc(c.name)} ${c.result}</span>`).join("");
  const tl = (r.timeline || []).slice(-6).map((t) => `<div class="t"><time>${esc(fmt(t.at))}</time><span>${esc(t.type)}${t.message ? " · " + esc(t.message) : ""}</span></div>`).join("");
  return `<div class="card emp">
    <div class="emp-head"><strong>${esc(name || r.agentId || "직원")}</strong>${badge(r.status)}</div>
    <div class="emp-meta">${esc(r.task || "작업 미기재")}</div>
    <div class="emp-row">${r.appId ? `<span>앱 <b>${esc(r.appId)}</b></span>` : ""}${r.branch ? `<span><code>${esc(r.branch)}</code></span>` : ""}${r.pr ? `<span>PR #${esc(r.pr)}</span>` : ""}<span class="dim">시작 ${esc(fmt(r.startedAt))}</span><span class="dim">${esc(ago(r.lastActivity))}</span></div>
    ${checks ? `<div class="pill-row">${checks}</div>` : ""}
    ${r.blockedReason ? `<div class="emp-meta" style="color:var(--block)">막힘: ${esc(r.blockedReason)}</div>` : ""}
    ${tl ? `<details><summary>로그 보기</summary><div class="timeline">${tl}</div></details>` : ""}
  </div>`;
}

function renderApps() {
  const apps = SNAP.apps || [];
  return `<div class="cmd-head"><div><h1>PROJECTS · 프로젝트(앱)</h1><div class="sub">${apps.length}개 앱</div></div></div>
    <div class="list apps-list">${apps.map((a) => {
      const [hl, hc] = HEALTH[a.health] || ["확인중", "warn"]; const ci = (a.ci || [])[0]; const work = a.git?.workBranches || [];
      return `<div class="card app-card" style="--ac:${esc(a.accent || "#3ba7ff")}">
        <div class="app-top"><strong>${esc(a.name)}</strong><span class="ver">v${esc(a.version || "—")}</span></div>
        <div class="pill-row"><span class="pill ${hc}">${esc(hl)}</span>${a.registered ? "" : `<span class="pill warn">registry 미등록</span>`}${a.github === "connected" ? `<span class="pill">PR ${a.openPrs.length}</span>` : `<span class="pill warn">GitHub ${esc(a.github)}</span>`}${ci ? `<span class="pill ${ci.conclusion === "success" ? "ok" : ci.conclusion === "failure" ? "bad" : ""}">${esc((ci.name||"").slice(0,14))} ${esc(ci.conclusion || ci.status)}</span>` : ""}</div>
        <dl class="kv">
          <dt>REPO</dt><dd>${esc(a.repo || "미생성")}</dd>
          <dt>URL</dt><dd>${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url)}</a>` : "—"}</dd>
          ${a.git?.available ? `<dt>GIT</dt><dd><code>${esc(a.git.branch)}</code> @ ${esc(a.git.sha)} · ${esc(ago(a.git.lastDate))}</dd>` : ""}
          ${work.length ? `<dt>BRANCH</dt><dd>${work.map((b) => `<code>${esc(b.name)}</code>`).join(" ")}</dd>` : ""}
        </dl>
        ${a.nextActions?.length ? `<ul class="next-list">${a.nextActions.slice(0,2).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      </div>`;
    }).join("")}</div>${sysNote()}`;
}

function renderApprovals() {
  const ap = SNAP.approvals || [];
  if (!ap.length) return `<div class="cmd-head"><div><h1>APPROVALS · 승인함</h1></div></div><div class="card empty">사장 결정이 필요한 항목이 없습니다.<br><span class="dim">일상 수정·테스트·기존 배포는 승인함을 채우지 않습니다.</span></div>${sysNote()}`;
  return `<div class="cmd-head"><div><h1>APPROVALS · 승인함</h1><div class="sub">사장 결정 ${ap.length}건</div></div></div>
    <div class="list">${ap.map((a) => `<div class="card appr"><h4>${esc(a.decision || a.title || "결정 필요")}</h4>${a.why ? `<div class="emp-meta">이유: ${esc(a.why)}</div>` : ""}${a.recommendation ? `<div class="emp-row"><span>추천 <b>${esc(a.recommendation)}</b></span></div>` : ""}${a.app ? `<span class="pill">${esc(a.app)}</span>` : ""}</div>`).join("")}</div>${sysNote()}`;
}

function renderLog() {
  const ev = SNAP.events || [];
  return `<div class="cmd-head"><div><h1>ACTIVITY · 활동 로그</h1><div class="sub">최근 ${ev.length}건</div></div></div>
    ${ev.length ? `<div class="card">${ev.map((e) => `<div class="log-item"><time>${esc(fmt(e.createdAt))}</time><div><b>${esc(e.type)}</b> · ${esc(e.agentId || "-")} ${e.appId ? "· " + esc(e.appId) : ""}${e.message ? "<br><span class='dim'>" + esc(e.message) + "</span>" : ""}</div></div>`).join("")}</div>` : `<div class="card empty">아직 작업 이벤트가 없습니다.</div>`}${sysNote()}`;
}

function sysNote() {
  const c = SNAP.connections || {};
  return `<div class="card" style="margin-top:14px"><div class="section-title" style="margin-top:0">CONNECTIONS · 연결 상태</div>
    <div class="conn">
      <span class="pill ${c.github?.startsWith("connected") ? "ok" : "warn"}">GitHub ${esc(c.github || "?")}</span>
      <span class="pill ${(c.localGit||[]).length ? "ok" : "warn"}">local git ${(c.localGit||[]).length}</span>
      <span class="pill ${c.events === "connected" ? "ok" : "warn"}">events ${esc(c.events || "?")}</span>
      <span class="pill warn">Claude Code ${esc(c.claudeCode || "?")}</span><span class="pill warn">Codex ${esc(c.codex || "?")}</span>
    </div>
    <p class="foot-note">로봄 본부는 실제 저장소·git·GitHub·작업 이벤트만 읽는 <b>읽기 전용(Phase 1)</b> 내부 도구입니다. 증거 없는 데스크는 ‘대기’로 둡니다(연출 금지). 공개 robom.kr에 노출하지 않습니다.</p></div>`;
}

// 실시간 시계(KST)
function tickClock() { try { document.getElementById("clock").textContent = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); } catch {} }
setInterval(tickClock, 1000); tickClock();

document.addEventListener("click", (e) => { const b = e.target.closest("[data-screen]"); if (b) setScreen(b.dataset.screen); if (e.target.closest("#refreshBtn")) load(); });
load();
