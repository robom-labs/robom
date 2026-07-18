// 로봄 HQ 클라이언트 — v1.2 정보구조(오늘·앱·업무·Codex·기록설정)로 회사를 관리한다.
// 원칙: 연출 금지(실제 이벤트·스냅샷 근거만 표시), 본사와 계열사 앱 분리, 비전문가 회장 기준 문장.
"use strict";

const MENU = [
  ["회장 메뉴", [["today","오늘","⌂"],["apps","앱","▦"],["tasks","업무","☷"],["codex","Codex","🤖"],["archive","기록·설정","⋯"]]],
];
const SCREEN_NAMES = Object.fromEntries(MENU.flatMap(([,items])=>items.map(([id,name])=>[id,name])));
// 사용자용 단순 상태(v1.2 §5.3) — 세부 내부 상태는 로그에만 둔다.
const SIMPLE_STATUS = {queued:"대기",received:"대기",pending:"대기",open:"대기",assigned:"작업 중",in_progress:"작업 중",implementing:"작업 중",working:"작업 중",investigating:"작업 중",verifying:"검토 중",in_review:"검토 중",fixing:"작업 중",approval_pending:"승인 필요",deploying:"배포 중",completed:"완료",done:"완료",resolved:"완료",approved:"승인",blocked:"막힘",needs_check:"막힘",failed:"실패",cancelled:"취소",dismissed:"취소",held:"보류",on_hold:"보류",rejected:"반려",external_wait:"막힘",scheduled:"대기",active:"대기",proposed:"대기",draft:"대기",decided:"완료",closed:"완료",archived:"완료"};
const STATUS_TONE = {대기:"neutral","작업 중":"accent","검토 중":"warn","승인 필요":"warn","배포 중":"accent",완료:"good",승인:"good",막힘:"bad",실패:"bad",취소:"neutral",보류:"neutral",반려:"bad"};
const HEALTH = {ok:["정상","good"],warn:["확인 필요","warn"],down:["막힘","bad"],unknown:["확인 중","neutral"],running:["작업 중","accent"],planned:["준비 중","neutral"]};
const COLLECTION_LABEL = {meetings:"회의",decisions:"결정",approvals:"결재",requests:"요청",reviews:"검수",tasks:"업무",notes:"메모",incidents:"장애",feedback:"사용자 의견"};
const AUTONOMY_LABEL = {research_only:"조사만 하고 보고",implement_and_review:"고친 뒤 내 확인 대기",implement_test_wait_for_deploy:"고치고 테스트까지, 배포는 대기",guarded_auto_deploy:"안전장치 걸고 배포까지 자동"};
const esc = (s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const attr = esc;
const fmt = (iso,detail=true)=>{if(!iso)return "—";try{return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:detail?"2-digit":undefined,minute:detail?"2-digit":undefined}).format(new Date(iso));}catch{return String(iso)}};
const ago = (iso)=>{if(!iso)return "—";const d=(Date.now()-Date.parse(iso))/1000;if(!Number.isFinite(d))return "—";if(d<60)return "방금";if(d<3600)return `${Math.floor(d/60)}분 전`;if(d<86400)return `${Math.floor(d/3600)}시간 전`;return `${Math.floor(d/86400)}일 전`;};
const simpleStatus=(status)=>SIMPLE_STATUS[status]||"대기";
const statusPill=(status)=>{const label=simpleStatus(status);return `<span class="status ${STATUS_TONE[label]||"neutral"}">${esc(label)}</span>`;};
const tonePill=(tone,label)=>`<span class="status ${tone}">${esc(label)}</span>`;
const appAccent = {robom:"#3b7a57",outbom:"#3b8fc2",homebom:"#48a565",runningbom:"#e97142",calendarbom:"#24a69a",certbom:"#6f75d8",notebom:"#b33768"};

let SNAP=null, LOCAL={records:{},audit:[],mode:"portable"}, HQ=null, CURRENT="today", SELECTED_APP=null, ARCHIVE_TAB="memory";
const preview = Boolean(window.__PREVIEW__);
const $=(q)=>document.querySelector(q), $$=(q)=>[...document.querySelectorAll(q)];

function navMarkup(){return MENU.map(([group,items])=>`<section class="nav-group"><button class="nav-group-title" type="button" data-nav-toggle><span>${esc(group)}</span><span>⌄</span></button><div>${items.map(([id,name,icon])=>`<button class="nav-item" type="button" data-screen="${id}" data-search="${esc(name)}"><span aria-hidden="true">${icon}</span><b>${esc(name)}</b></button>`).join("")}</div></section>`).join("")+`<section class="nav-group"><button class="nav-group-title" type="button" data-nav-toggle><span>부가기능</span><span>⌄</span></button><div><a class="nav-item" href="./office.html" data-search="오피스"><span aria-hidden="true">🏢</span><b>로봄 오피스 보기</b></a></div></section>`;}

async function fetchJson(url,options){const res=await fetch(url,{cache:"no-store",...options});if(!res.ok){let detail="";try{detail=(await res.json()).message||"";}catch{}throw new Error(detail||`${res.status} ${url}`);}return res.json();}
async function load(){
  try{SNAP=window.__SNAP__||await fetchJson("./snapshot.json");}catch(e){$("#screen").innerHTML=empty("회사 스냅샷을 불러오지 못했습니다.","로컬 본부를 다시 실행해 주세요.");return;}
  if(!preview){try{LOCAL=await fetchJson("/api/company-state");LOCAL.mode="live";}catch{LOCAL={records:loadPortable(),audit:[],mode:"portable"};}}
  else LOCAL={records:loadPortable(),audit:[],mode:"portable"};
  if(LOCAL.mode==="live"){try{HQ=await fetchJson("/api/hq-status");}catch{HQ=null;}}else HQ=null;
  SELECTED_APP=SELECTED_APP||familyApps()[0]?.id;
  updateShell();render(CURRENT);
}
function loadPortable(){try{return JSON.parse(localStorage.getItem("robom-hq-portable-records")||"{}");}catch{return {};}}
function savePortable(){localStorage.setItem("robom-hq-portable-records",JSON.stringify(LOCAL.records||{}));}
function familyApps(){return (SNAP.apps||[]).filter(a=>a.id!=="robom");}
function hqSystems(){return (SNAP.apps||[]).filter(a=>a.id==="robom");}
function appById(id){return (SNAP.apps||[]).find(a=>a.id===id);}
function appName(id){return appById(id)?.name||id||"회사 전체";}
function records(name){return LOCAL.records?.[name]||[];}
function openCount(name){return records(name).filter(r=>!["approved","rejected","closed","completed","cancelled","dismissed","done","resolved","archived"].includes(r.status)).length;}
function updateShell(){
  const live=LOCAL.mode==="live"&&!preview, badge=$("#modeBadge");
  badge.textContent=live?"실시간 회사 모드":"휴대용 보기 모드";badge.className=`mode-badge ${live?"live":"portable"}`;
  $("#syncNote").textContent=`마지막 동기화 ${ago(SNAP.generatedAt)} · ${live?"기록 저장 가능":"읽기 중심"}`;
  $$('[data-screen]').forEach(b=>b.classList.toggle("active",b.dataset.screen===CURRENT));
}
function render(name){CURRENT=name;updateShell();const screen=$("#screen");screen.innerHTML=(RENDER[name]||renderNotReady)();screen.scrollTop=0;screen.focus({preventScroll:true});closeMenu();bindScreen();}
function title(kicker,titleText,desc,actions=""){return `<header class="page-head"><div><small>${esc(kicker)}</small><h1>${esc(titleText)}</h1>${desc?`<p>${esc(desc)}</p>`:""}</div>${actions?`<div class="head-actions">${actions}</div>`:""}</header>`;}
function metric(value,label,tone="neutral",note=""){return `<div class="metric ${tone}"><b>${esc(value)}</b><span>${esc(label)}</span>${note?`<small>${esc(note)}</small>`:""}</div>`;}
function panel(label,body,cls=""){return `<section class="panel ${cls}"><div class="panel-title">${esc(label)}</div>${body}</section>`;}
function empty(main,sub=""){return `<div class="empty-state"><span aria-hidden="true">○</span><b>${esc(main)}</b>${sub?`<p>${esc(sub)}</p>`:""}</div>`;}
function button(label,action,kind="ghost",extra=""){return `<button class="button ${kind}" type="button" data-action="${action}" ${extra}>${label}</button>`;}

// ── 내가 확인할 일: 실제 근거(결재 대기·막힌 업무·앱 경고·사람 작업)만 모은다 ──
function attentionItems(){
  const items=[];
  records("approvals").filter(r=>r.status==="pending").forEach(r=>items.push({label:`결재: ${r.title}`,screen:"archive",tab:"approvals"}));
  [...(SNAP.approvals||[])].forEach(r=>items.push({label:`결재: ${r.title||r.decision}`,screen:"archive",tab:"approvals"}));
  records("tasks").filter(r=>["blocked","approval_pending","in_review"].includes(r.status)).forEach(r=>items.push({label:`${simpleStatus(r.status)} 업무: ${r.title}`,screen:"tasks"}));
  familyApps().filter(a=>a.health&&a.health!=="ok").forEach(a=>items.push({label:`${a.name} 상태 확인 필요`,screen:"apps",app:a.id}));
  (SNAP.operations?.humanTasks||[]).slice(0,3).forEach(t=>items.push({label:t,screen:"archive",tab:"settings"}));
  return items;
}
function codexStateLine(){
  if(!HQ)return {label:"연결 안 됨",tone:"neutral",detail:LOCAL.mode==="live"?"HQ 상태 API를 읽지 못했습니다.":"휴대용 보기에서는 Codex 상태를 읽지 않습니다."};
  const runner=HQ.runner||{};
  if(HQ.control?.paused)return {label:"일시정지됨",tone:"warn",detail:"모든 자동작업이 회장 지시로 멈춰 있습니다."};
  if(runner.state==="running")return {label:"작업 중",tone:"accent",detail:`${appName(HQ.runningTask?.app)} · ${HQ.runningTask?.title||""} · ${ago(runner.at)}`};
  if(runner.state==="not_running")return {label:"실행기 꺼짐",tone:"neutral",detail:"codex-runner가 실행되어 있지 않습니다."};
  if(runner.codex==="not_connected")return {label:"Codex 미연결",tone:"warn",detail:runner.codexDetail||"codex CLI 로그인이 필요합니다."};
  return {label:"대기",tone:"good",detail:`대기 ${HQ.pending}건 · 최근 확인 ${ago(runner.at)}`};
}

// ── 오늘 (§5.1: 확인할 일 → Codex → 앱 전체 → 새 수정 요청) ──
function renderToday(){
  const attention=attentionItems(), codex=codexStateLine(), apps=familyApps();
  return `${title("TODAY","오늘","지금 확인할 일과 회사 상태를 30초 안에 봅니다.")}
  ${panel(`내가 확인할 일 ${attention.length?attention.length+"건":""}`,attention.length?`<div class="simple-list">${attention.slice(0,6).map(item=>`<button type="button" data-action="goto-item" data-target="${item.screen}" ${item.tab?`data-tab="${item.tab}"`:""} ${item.app?`data-app-id="${item.app}"`:""}><b>${esc(item.label)}</b><span>›</span></button>`).join("")}</div>`:empty("지금 확인할 일이 없습니다.","막힘·결재·경고가 생기면 여기에 먼저 나타납니다."))}
  ${panel("Codex 현재 상태",`<div class="codex-line">${tonePill(codex.tone,codex.label)}<p>${esc(codex.detail)}</p>${button("자세히","goto","ghost",'data-target="codex"')}</div>`)}
  ${panel(`${apps.length}개 앱`,`<div class="today-apps">${apps.map(a=>{const [label,tone]=HEALTH[a.health]||HEALTH.unknown;const working=(SNAP.runs||[]).some(r=>r.appId===a.id&&!["completed","failed"].includes(r.status));const openTasks=records("tasks").filter(t=>t.appId===a.id&&!["completed","cancelled","dismissed","done"].includes(t.status)).length;
    return `<button type="button" class="today-app" data-app="${attr(a.id)}" style="--app:${appAccent[a.id]||"#64748b"}"><span class="app-dot"></span><b>${esc(a.name)}</b><small>${working?"작업 중":label}${openTasks?` · 요청 ${openTasks}건`:""}</small>${tonePill(working?"accent":tone,working?"작업 중":label)}</button>`;}).join("")}</div>
    <div class="sys-line">${hqSystems().map(a=>`<span>본사 시스템 · ${esc(a.name)} ${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}</span>`).join("")||""}</div>`)}
  <div class="today-actions">${button("새 수정 요청","new-task","primary")}${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary"):button("모든 자동작업 일시정지","pause-all","danger")}</div>`;
}

// ── 앱 (§5.2: 계열사와 본사 분리, registry 동적) ──
function renderApps(){
  const apps=familyApps();
  return `${title("APPS",`운영 앱 ${apps.length}개`,"registry 기준으로 자동 생성됩니다. 본사 시스템은 아래에 따로 표시합니다.")}
  <div class="portfolio-grid">${apps.map(appCard).join("")}</div>
  ${panel("본사 시스템",`<div class="simple-list">${hqSystems().map(a=>`<button type="button" data-app="${attr(a.id)}"><b>${esc(a.name)} · robom.kr</b>${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}</button>`).join("")}<div><b>ROBOM HQ (이 프로그램)</b>${tonePill("good","실행 중")}</div></div>`)}`;
}
function appCard(a){const [label,tone]=HEALTH[a.health]||HEALTH.unknown;const openTasks=records("tasks").filter(t=>t.appId===a.id&&!["completed","cancelled","done","dismissed"].includes(t.status)).length;
  return `<article class="product-card" style="--app:${appAccent[a.id]||"#3b7a57"}"><header><div><span class="app-kicker">계열사 앱</span><h2>${esc(a.name)}</h2></div>${tonePill(tone,label)}</header>
  <div class="product-version"><b>v${esc(a.version||"—")}</b><span>${esc(a.git?.sha?.slice(0,7)||a.production?.deployedSha?.slice(0,7)||"")}</span></div>
  <dl><dt>사용자 가치</dt><dd>${esc(a.role||a.note||"")}</dd><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd><dt>현재 작업</dt><dd>${esc((SNAP.runs||[]).find(r=>r.appId===a.id&&!["completed","failed"].includes(r.status))?.task||(openTasks?`요청 ${openTasks}건 대기`:"없음"))}</dd><dt>다음 행동</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></dl>
  <footer>${button("자세히","select-app","ghost",`data-app="${a.id}"`)}${a.url?`<a class="button secondary" href="${attr(a.url)}" target="_blank" rel="noopener">앱 사용</a>`:""}${button("수정 요청","new-task-for","primary",`data-app-id="${a.id}"`)}</footer></article>`;}
function renderAppDetail(){const a=appById(SELECTED_APP)||familyApps()[0];if(!a)return renderApps();const [label,tone]=HEALTH[a.health]||HEALTH.unknown;const ci=a.ci?.[0];
  return `${title("APP",a.name,"사용자 영향부터 보고 기술 정보는 아래에 접습니다.",`${a.url?`<a class="button primary" href="${attr(a.url)}" target="_blank" rel="noopener">운영 앱 열기</a>`:""}${button("수정 요청","new-task-for","secondary",`data-app-id="${a.id}"`)}`)}
  <div class="product-hero" style="--app:${appAccent[a.id]||"#3b7a57"}"><div><span>현재 운영</span><h2>v${esc(a.version||"—")}</h2>${tonePill(tone,label)}</div>
  <dl><dt>사용자 가치</dt><dd>${esc(a.role||a.note||"")}</dd><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd><dt>다음 개선</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></dl></div>
  <div class="detail-grid">${panel("진행 중 업무",records("tasks").filter(t=>t.appId===a.id).length?`<div class="simple-list">${records("tasks").filter(t=>t.appId===a.id).slice(0,6).map(t=>`<div><b>${esc(t.title)}</b>${statusPill(t.status)}</div>`).join("")}</div>`:empty("이 앱에 등록된 업무가 없습니다."))}
  ${panel("기술 정보 (근거)",`<dl class="data-list"><dt>저장소</dt><dd>${esc(a.repo||"—")}</dd><dt>브랜치·SHA</dt><dd>${esc(a.git?.branch||"main")} · ${esc(a.git?.sha||a.production?.deployedSha?.slice(0,7)||"—")}</dd><dt>배포</dt><dd>${esc(a.deployTarget||"—")}</dd><dt>CI</dt><dd>${esc(ci?`${ci.name} · ${ci.conclusion||ci.status}`:"GitHub 연결 시 표시")}</dd><dt>열린 PR</dt><dd>${a.openPrs?.length||0}</dd><dt>데이터</dt><dd>${esc(a.production?.version?`운영 v${a.production.version}`:"확인 중")}</dd></dl>`)}</div>`;}

// ── 업무 (§5.3: 말하듯 등록 → 패킷 → queue) ──
function renderTasks(){
  const list=records("tasks");
  return `${title("WORK","업무","말하듯 등록하면 Codex 작업 패킷으로 바뀌어 대기열에 들어갑니다.",button("새 수정 요청","new-task","primary"))}
  <div class="metrics-grid">${metric(HQ?HQ.pending:openCount("tasks"),"대기",HQ?.pending?"accent":"neutral")}${metric(HQ?.running??"—","작업 중",HQ?.running?"accent":"neutral")}${metric(list.filter(t=>["in_review","approval_pending"].includes(t.status)).length,"검토·승인 필요","warn")}${metric(list.filter(t=>t.status==="blocked").length,"막힘",list.some(t=>t.status==="blocked")?"bad":"neutral")}</div>
  ${list.length?`<div class="record-list">${list.map(r=>`<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title)}</h3>${r.autonomy?`<small>${esc(AUTONOMY_LABEL[r.autonomy]||r.autonomy)}</small>`:""}</div>${statusPill(r.status)}</header>${r.problem||r.body?`<p>${esc(r.problem||r.body)}</p>`:""}${r.desiredOutcome?`<p class="outcome">→ ${esc(r.desiredOutcome)}</p>`:""}<footer>${["in_review","approval_pending"].includes(r.status)?button("확인 완료","patch-record","primary",`data-collection="tasks" data-id="${r.id}" data-status="completed"`):""}${["queued","blocked"].includes(r.status)?button("취소","patch-record","ghost",`data-collection="tasks" data-id="${r.id}" data-status="cancelled"`):""}${button("작업 패킷","download-bundle","ghost",`data-id="${r.id}"`)}</footer></article>`).join("")}</div>`:empty("등록된 업무가 없습니다.","새 수정 요청을 누르고 어떤 앱의 무엇이 불편한지 말하듯 적어 주세요.")}`;
}

// ── Codex (§5.4: 회장용 작업 현황판) ──
function renderCodex(){
  const codex=codexStateLine();const runner=HQ?.runner||{};
  return `${title("CODEX","Codex 작업 현황판","기술 콘솔이 아니라 지금 무엇을 하는지 보는 화면입니다.")}
  ${panel("현재 상태",`<div class="codex-line big">${tonePill(codex.tone,codex.label)}<p>${esc(codex.detail)}</p></div>
  <div class="metrics-grid">${metric(HQ?.pending??"—","다음 대기")}${metric(HQ?.running??"—","실행 중",HQ?.running?"accent":"neutral")}${metric(HQ?.done??"—","완료","good")}${metric(HQ?.failed??"—","실패·막힘",HQ?.failed?"bad":"neutral")}</div>`)}
  ${HQ?.runningTask?panel("실행 중 작업",`<div class="record-list"><article><header><div><span>${esc(appName(HQ.runningTask.app))}</span><h3>${esc(HQ.runningTask.title)}</h3></div>${tonePill("accent","작업 중")}</header><p>시작 ${fmt(HQ.runningTask.lease?.claimedAt)} · 마지막 신호 ${ago(HQ.runningTask.lease?.heartbeatAt)}</p></article></div>`):""}
  ${HQ?.nextTask?panel("다음 대기",`<div class="simple-list"><div><b>${esc(appName(HQ.nextTask.app))} · ${esc(HQ.nextTask.title)}</b>${tonePill("neutral","대기")}</div></div>`):""}
  ${panel("제어",`<div class="today-actions">${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary"):button("모든 자동작업 일시정지","pause-all","danger")}${HQ?.control?.intakeClosed?button("새 작업 접수 재개","open-intake","secondary"):button("새 작업 접수 중지","close-intake","ghost")}</div>`)}
  ${panel("연결 방법 (맥북에서 1회)",`<ol class="number-list"><li>터미널에서 <code>codex login</code> — 구독 계정으로 로그인 (API 키 금지)</li><li><code>node scripts/control-center/codex-runner.mjs</code> 실행 — 대기열을 자동 처리</li><li>이 화면에서 상태가 '대기'로 바뀌면 연결 완료</li></ol><p class="fine">연결 전에는 미연결로 정직하게 표시하며, 요청은 대기열에 안전하게 보관됩니다.</p>`)}`;
}

// ── 기록·설정 (§5.5: 통합) ──
const ARCHIVE_TABS=[["memory","기억 검색"],["approvals","결재"],["meetings","회의"],["decisions","결정"],["incidents","장애"],["delivery","배포"],["data","데이터"],["backup","백업"],["connections","연결"],["security","보안"],["settings","설정"]];
function renderArchive(){
  return `${title("RECORDS","기록·설정","회의·결정·장애·배포·백업·보안을 한곳에서 관리합니다.")}
  <div class="filter-row">${ARCHIVE_TABS.map(([id,label])=>`<button class="chip ${ARCHIVE_TAB===id?"active":""}" data-archive-tab="${id}">${esc(label)}</button>`).join("")}<a class="chip" href="./office.html">🏢 오피스</a></div>
  <div id="archiveBody">${archiveBody()}</div>`;
}
function archiveBody(){
  switch(ARCHIVE_TAB){
    case "memory":return `<label class="memory-search"><span>⌕</span><input id="memoryInput" type="search" placeholder="예: 청약봄 가격 비교를 왜 보류했지" /><button class="button primary" data-action="search-memory">검색</button></label><div id="memoryResults">${memoryResults("")}</div>`;
    case "approvals":return approvalsBody();
    case "meetings":return `<div class="panel-actions">${button("회의 기록","new-record","primary",'data-collection="meetings"')}</div>${recordList("meetings",{emptyTitle:"저장된 회의가 없습니다."})}`;
    case "decisions":return `<div class="panel-actions">${button("결정 기록","new-record","primary",'data-collection="decisions"')}</div>${recordList("decisions",{emptyTitle:"저장된 결정이 없습니다."})}`;
    case "incidents":return `<div class="panel-actions">${button("장애 기록","new-record","primary",'data-collection="incidents"')}</div>${(familyApps().filter(a=>a.health==="down").length?`<div class="incident-banner"><b>운영 장애 ${familyApps().filter(a=>a.health==="down").length}건</b><span>${familyApps().filter(a=>a.health==="down").map(a=>a.name).join(", ")}</span></div>`:"")}${recordList("incidents",{emptyTitle:"기록된 장애가 없습니다."})}`;
    case "delivery":return `<div class="delivery-list">${(SNAP.apps||[]).map(a=>{const ci=a.ci?.[0];return `<article><div><span class="app-dot" style="background:${appAccent[a.id]||"#64748b"}"></span><h3>${esc(a.name)}</h3><p>${esc(a.deployTarget||"배포 방식 확인 중")}</p></div><div>${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}<small>${ci?`${esc(ci.name)} · ${ago(ci.createdAt)}`:"운영 smoke 기준"}</small></div><code>${esc(a.production?.deployedSha?.slice(0,12)||a.git?.sha||"—")}</code></article>`;}).join("")}</div>`;
    case "data":return `<div class="data-grid">${familyApps().map(a=>`<article><header><h2>${esc(a.name)}</h2>${tonePill(a.production?.status==="PASS"?"good":"warn",a.production?.status||"확인")}</header><dl><dt>마지막 운영 확인</dt><dd>${esc(a.production?.version?`v${a.production.version}`:"확인 중")}</dd><dt>신선도</dt><dd>${esc(a.production?.warnings?.[0]||"운영 기준 통과")}</dd></dl></article>`).join("")}</div>`;
    case "backup":return `<div class="panel-actions">${button("지금 백업","backup","primary")}${button("JSON 내보내기","export","ghost")}</div><dl class="data-list"><dt>저장 위치</dt><dd>${LOCAL.mode==="live"?"이 컴퓨터의 비공개 runtime 폴더":"브라우저 휴대용 저장"}</dd><dt>마지막 백업</dt><dd>${esc(LOCAL.meta?.lastBackupAt?fmt(LOCAL.meta.lastBackupAt):"아직 없음")}</dd><dt>백업 대상</dt><dd>회의·결재·업무·장애 기록과 감사 로그</dd></dl>`;
    case "connections":return connectionMarkup();
    case "security":return `<div class="security-grid">${(SNAP.operations?.security||[]).map(c=>`<article>${tonePill(c.ok?"good":"warn",c.ok?"통과":"확인")}<h3>${esc(c.name)}</h3><p>${esc(c.note||"")}</p></article>`).join("")||""}</div>`;
    case "settings":return `<div class="settings-list"><article><div><h3>현재 모드</h3><p>${LOCAL.mode==="live"?"실시간 로컬 본부":"휴대용 보기"}</p></div>${tonePill(LOCAL.mode==="live"?"good":"neutral",LOCAL.mode==="live"?"연결됨":"제한됨")}</article><article><div><h3>휴대폰 연결</h3><p>${HQ?.remote==="token"?"토큰 인증으로 같은 사설망 접속 허용됨":"현재 이 컴퓨터 전용(127.0.0.1) — docs/hq/REMOTE-ACCESS.md 참고"}</p></div>${tonePill(HQ?.remote==="token"?"accent":"good",HQ?.remote==="token"?"원격 허용":"비공개")}</article><article><div><h3>추가 운영비</h3><p>유료 API·상시 유료 서버 없이 로컬 Node.js와 GitHub 무료 범위를 사용합니다.</p></div>${tonePill("good","0원")}</article><article><div><h3>회장이 직접 할 일</h3><p>${(SNAP.operations?.humanTasks||[]).slice(0,3).map(esc).join(" · ")||"현재 없음"}</p></div></article><article><div><h3>부가기능</h3><p>살아있는 6층 오피스 게임(실제 이벤트 연동)</p></div><a class="button ghost" href="./office.html">오피스 보기</a></article></div>`;
    default:return empty("준비되지 않은 탭입니다.");
  }
}
function approvalsBody(){const items=[...(SNAP.approvals||[]),...records("approvals")];
  return `<div class="panel-actions">${button("안건 상신","new-record","primary",'data-collection="approvals"')}</div>${items.length?`<div class="approval-list">${items.map(r=>`<article class="approval-card"><header><div><span>${esc(appName(r.appId||r.app))}</span><h2>${esc(r.title||r.decision||"결정 필요")}</h2></div>${statusPill(r.status||"pending")}</header><p>${esc(r.body||r.why||"")}</p><footer>${r.id?`${button("승인","patch-record","primary",`data-collection="approvals" data-id="${attr(r.id)}" data-status="approved"`)}${button("보류","patch-record","ghost",`data-collection="approvals" data-id="${attr(r.id)}" data-status="held"`)}${button("반려","patch-record","danger",`data-collection="approvals" data-id="${attr(r.id)}" data-status="rejected"`)}`:`<small>스냅샷 안건 — 근거 화면에서 처리</small>`}</footer></article>`).join("")}</div>`:empty("회장 결정이 필요한 안건이 없습니다.","비용·계정·복구 불가능한 결정만 여기로 올라옵니다.")}`;}
function memoryResults(q){const all=Object.entries(LOCAL.records||{}).flatMap(([collection,list])=>list.map(r=>({...r,collection})));const needle=q.trim().toLowerCase(),found=needle?all.filter(r=>JSON.stringify(r).toLowerCase().includes(needle)):all.slice(0,12);return found.length?`<div class="memory-list">${found.map(r=>`<article><span>${esc(COLLECTION_LABEL[r.collection]||r.collection)} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||"기록")}</h3><p>${esc(r.body||r.problem||"")}</p>${r.appId?`<small>${esc(appName(r.appId))}</small>`:""}</article>`).join("")}</div>`:empty(needle?"검색 결과가 없습니다.":"아직 회사 기억이 없습니다.","회의·결정·업무 기록이 쌓이면 여기서 검색할 수 있습니다.")}
function connectionMarkup(){const c=SNAP.connections||{};return `<div class="connection-list">${[["로컬 본부",LOCAL.mode==="live","실시간 기록·백업"],["GitHub",String(c.github).startsWith("connected"),c.github],["작업 이벤트",c.events==="connected",c.events],["Claude Code",!String(c.claudeCode).includes("pending"),c.claudeCode],["Codex 실행기",HQ?.runner?.codex==="connected","이 컴퓨터의 codex-runner"],["휴대폰 원격",HQ?.remote==="token","토큰 인증 사설망"]].map(([n,ok,d])=>`<div>${tonePill(ok?"good":"neutral",ok?"연결":"대기")}<b>${esc(n)}</b><span>${esc(d===true||d===false?"":(d||""))}</span></div>`).join("")}</div>`;}
function recordList(collection,opt={}){const items=opt.items||records(collection);return items.length?`<div class="record-list">${items.map(r=>`<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||COLLECTION_LABEL[collection]||"기록")}</h3></div>${statusPill(r.status||"open")}</header>${r.body?`<p>${esc(r.body)}</p>`:""}<footer>${opt.actions?opt.actions(r):""}</footer></article>`).join("")}</div>`:empty(opt.emptyTitle||`저장된 ${COLLECTION_LABEL[collection]||"기록"}이 없습니다.`);}
function renderNotReady(){return `${title("ROBOM HQ",SCREEN_NAMES[CURRENT]||"로봄 본부","실제 연결 상태를 기준으로 표시합니다.")}${empty("표시할 정보가 없습니다.")}`;}

const RENDER={today:renderToday,apps:renderApps,app:renderAppDetail,tasks:renderTasks,codex:renderCodex,archive:renderArchive};

function openMenu(){$("#sidebar").classList.add("open");$("#drawerScrim").hidden=false;document.body.classList.add("drawer-open");}
function closeMenu(){$("#sidebar").classList.remove("open");$("#drawerScrim").hidden=true;document.body.classList.remove("drawer-open");}
function showToast(message,tone="") {const t=$("#toast");t.textContent=message;t.className=`toast show ${tone}`;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("show"),2600);}

// ── 새 수정 요청 (§5.3의 질문 흐름) ──
function openTaskDialog(appId=""){const d=$("#taskDialog");$("#taskApp").innerHTML=familyApps().map(a=>`<option value="${attr(a.id)}" ${a.id===appId?"selected":""}>${esc(a.name)}</option>`).join("")+`<option value="robom" ${appId==="robom"?"selected":""}>로봄 웹(robom.kr)</option>`;$("#taskTitle").value="";$("#taskProblem").value="";$("#taskOutcome").value="";$("#taskPreserve").value="";d.showModal();setTimeout(()=>$("#taskTitle").focus(),30);}
async function saveTask(form){const fd=new FormData(form);
  const payload={title:String(fd.get("title")||"").trim(),appId:String(fd.get("appId")||""),problem:String(fd.get("problem")||"").trim(),desiredOutcome:String(fd.get("desiredOutcome")||"").trim(),priority:String(fd.get("priority")||"normal"),autonomy:String(fd.get("autonomy")||"implement_and_review"),status:"queued"};
  const preserve=String(fd.get("mustPreserve")||"").trim();if(preserve)payload.mustPreserve=preserve;
  if(!payload.title)return;
  if(LOCAL.mode==="live"){const data=await fetchJson("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});LOCAL=data.state;showToast("요청을 저장하고 Codex 대기열에 넣었습니다.","good");try{HQ=await fetchJson("/api/hq-status");}catch{}}
  else{const list=LOCAL.records.tasks||=[];list.unshift({...payload,id:`local-${Date.now()}`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});savePortable();showToast("휴대용 모드: 요청을 임시 저장했습니다. 본부 연결 시 다시 등록해 주세요.","warn");}
  $("#taskDialog").close();render(CURRENT);
}
function openRecord(collection,titleText=""){const d=$("#recordDialog");$("#recordCollection").value=collection;$("#dialogEyebrow").textContent=COLLECTION_LABEL[collection]||"기록";$("#dialogTitle").textContent=`새 ${COLLECTION_LABEL[collection]||"기록"}`;$("#recordTitle").value=titleText;$("#recordBody").value="";$("#recordApp").innerHTML=`<option value="">회사 전체</option>`+(SNAP.apps||[]).map(a=>`<option value="${attr(a.id)}">${esc(a.name)}</option>`).join("");d.showModal();setTimeout(()=>$("#recordTitle").focus(),30);}
async function saveRecord(form){const fd=new FormData(form),collection=fd.get("collection"),payload={title:String(fd.get("title")||"").trim(),body:String(fd.get("body")||"").trim(),appId:String(fd.get("appId")||""),priority:String(fd.get("priority")||"normal")};if(!payload.title)return;
  if(LOCAL.mode==="live"){const data=await fetchJson(`/api/records/${encodeURIComponent(collection)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});LOCAL=data.state;}
  else{const list=LOCAL.records[collection]||=[];list.unshift({...payload,id:`local-${Date.now()}`,status:"open",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});savePortable();}
  $("#recordDialog").close();showToast(`${COLLECTION_LABEL[collection]||"기록"}을 저장했습니다.`,"good");render(CURRENT);
}
async function patchRecord(collection,id,status){if(!id){showToast("스냅샷 안건은 근거 화면에서 처리합니다.");return;}
  if(LOCAL.mode==="live"){const data=await fetchJson(`/api/records/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});LOCAL=data.state;}
  else{const r=(LOCAL.records[collection]||[]).find(x=>x.id===id);if(r)Object.assign(r,{status,updatedAt:new Date().toISOString()});savePortable();}
  showToast("상태를 반영했습니다.","good");render(CURRENT);}
async function setControl(changes,message){if(LOCAL.mode!=="live"){showToast("휴대용 보기에서는 제어할 수 없습니다.");return;}await fetchJson("/api/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(changes)});try{HQ=await fetchJson("/api/hq-status");}catch{}showToast(message,"good");render(CURRENT);}
function download(name,text,type="text/markdown"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function bundleFor(r){const a=appById(r.appId);return `# 로봄 작업 패킷 ${r.id}\n\n- 대상: ${appName(r.appId)} (${a?.repo||"robom-labs/robom"})\n- 기준 SHA: ${a?.git?.sha||a?.production?.deployedSha||"최신 main"}\n- 요청: ${r.title}\n- 문제: ${r.problem||r.body||"기록 없음"}\n- 원하는 결과: ${r.desiredOutcome||"기록 없음"}\n- 유지: ${r.mustPreserve||"기존 사용자 데이터·저장 키·배포 경로"}\n- 자율 범위: ${AUTONOMY_LABEL[r.autonomy]||r.autonomy||"고친 뒤 확인 대기"}\n\n실행 전에는 작업 중으로 표시하지 않는다. 완료 기준: 구현·테스트·실제 화면 확인.\n`;}
async function doBackup(){if(LOCAL.mode!=="live"){download(`robom-hq-backup-${Date.now()}.json`,JSON.stringify({exportedAt:new Date().toISOString(),records:LOCAL.records},null,2),"application/json");showToast("휴대용 기록을 내보냈습니다.","good");return;}const data=await fetchJson("/api/backup",{method:"POST"});LOCAL=data.state||LOCAL;showToast(`백업 완료 · ${data.file||"로컬 저장"}`,"good");}
async function doExport(){if(LOCAL.mode!=="live"){download(`robom-company-${Date.now()}.json`,JSON.stringify({snapshot:SNAP,records:LOCAL.records},null,2),"application/json");return;}const data=await fetchJson("/api/export",{method:"POST"});download(data.name||"robom-company-export.json",JSON.stringify(data.payload,null,2),"application/json");}

function bindScreen(){
  $("#memoryInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){$("#memoryResults").innerHTML=memoryResults(e.target.value);}});
  $$('[data-archive-tab]').forEach(chip=>chip.addEventListener("click",()=>{ARCHIVE_TAB=chip.dataset.archiveTab;render("archive");}));
}

document.addEventListener("click",async e=>{
  const nav=e.target.closest("[data-screen]");if(nav){e.preventDefault();render(nav.dataset.screen);return;}
  const group=e.target.closest("[data-nav-toggle]");if(group){group.parentElement.classList.toggle("collapsed");return;}
  const action=e.target.closest("[data-action]");
  if(!action){const app=e.target.closest("[data-app]");if(app){SELECTED_APP=app.dataset.app;render("app");}return;}
  const a=action.dataset.action;
  try{
    if(a==="goto")render(action.dataset.target);
    else if(a==="goto-item"){if(action.dataset.tab)ARCHIVE_TAB=action.dataset.tab;if(action.dataset.appId)SELECTED_APP=action.dataset.appId;render(action.dataset.appId?"app":action.dataset.target);}
    else if(a==="select-app"){SELECTED_APP=action.dataset.app;render("app");}
    else if(a==="new-task")openTaskDialog(SELECTED_APP||"");
    else if(a==="new-task-for")openTaskDialog(action.dataset.appId||"");
    else if(a==="new-record")openRecord(action.dataset.collection);
    else if(a==="patch-record")await patchRecord(action.dataset.collection,action.dataset.id,action.dataset.status);
    else if(a==="pause-all")await setControl({paused:true},"모든 자동작업을 일시정지했습니다.");
    else if(a==="resume-all")await setControl({paused:false},"자동작업을 다시 시작했습니다.");
    else if(a==="close-intake")await setControl({intakeClosed:true},"새 작업 접수를 중지했습니다.");
    else if(a==="open-intake")await setControl({intakeClosed:false},"새 작업 접수를 재개했습니다.");
    else if(a==="download-bundle"){const r=records("tasks").find(x=>x.id===action.dataset.id);if(r)download(`robom-task-${r.id}.md`,bundleFor(r));}
    else if(a==="backup")await doBackup();
    else if(a==="export")await doExport();
    else if(a==="refresh")await load();
    else if(a==="search-memory")$("#memoryResults").innerHTML=memoryResults($("#memoryInput")?.value||"");
  }catch(err){showToast(`처리하지 못했습니다. ${err.message}`,"bad");}
});

$("#sideNav").innerHTML=navMarkup();
$("#menuBtn").addEventListener("click",openMenu);$("#moreBtn").addEventListener("click",()=>{ARCHIVE_TAB="memory";render("archive");});$("#menuCloseBtn").addEventListener("click",closeMenu);$("#drawerScrim").addEventListener("click",closeMenu);
$("#refreshBtn").addEventListener("click",load);
$("#navSearch").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$$('[data-search]').forEach(x=>x.hidden=q&&!x.dataset.search.toLowerCase().includes(q));$$('.nav-group').forEach(g=>g.hidden=q&&![...g.querySelectorAll('[data-search]')].some(x=>!x.hidden));});
$$('[data-dialog-close]').forEach(button=>button.addEventListener("click",()=>{const dialog=document.getElementById(button.dataset.dialogClose);if(dialog?.open)dialog.close("cancel");}));
$("#recordForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveRecord(e.currentTarget).catch(err=>showToast(err.message,"bad"));});
$("#taskForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveTask(e.currentTarget).catch(err=>showToast(err.message,"bad"));});

function tick(){try{$("#clock").textContent=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());}catch{}}
setInterval(tick,1000);tick();
// 라이브 모드에서는 30초마다 HQ 상태를 조용히 갱신(오늘·Codex 화면 최신 유지)
setInterval(async()=>{if(LOCAL.mode==="live"&&!preview){try{HQ=await fetchJson("/api/hq-status");if(["today","codex"].includes(CURRENT))render(CURRENT);}catch{}}},30_000);
if("serviceWorker" in navigator&&!preview&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
load();
