// ROBOM HQ 클라이언트 — 다크 관제탑 UI. 상단 Codex LIVE 상태바 + 6앱 신호등, 얇은 아이콘 레일,
// 넓은 본문. 5화면(오늘·앱·업무·Codex·기록). 이미지 첨부(붙여넣기·드래그), 자동 점검 개선 제안 결재.
// 원칙: 연출 금지(실제 이벤트·스냅샷 근거만), 본사와 계열사 앱 분리, 비전문가 회장 기준 문장.
"use strict";

/* ── 커스텀 라인 아이콘 (이모지 제거) ── */
const SVG = (d, o = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${o}>${d}</svg>`;
const ICON = {
  today: SVG('<path d="M3 12h4l2.5 7 4-15 2.5 8H21"/>'),
  apps: SVG('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>'),
  tasks: SVG('<path d="M9 5h11M9 12h11M9 19h11"/><path d="M4 5l1.2 1.2L7.4 4"/><path d="M4 12l1.2 1.2L7.4 10.8"/><circle cx="5" cy="19" r="1.2"/>'),
  codex: SVG('<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M9 3v4M15 3v4M9 12h.01M15 12h.01M9.5 16h5"/><path d="M2 11v3M22 11v3"/>'),
  archive: SVG('<path d="M3 8l9-4 9 4-9 4-9-4Z"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4"/>'),
  office: SVG('<path d="M4 21V6l8-3 8 3v15"/><path d="M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M16 13h.01"/>'),
  menu: SVG('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  refresh: SVG('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'),
  alert: SVG('<path d="M12 3l9 16H3l9-16Z"/><path d="M12 10v4M12 17h.01"/>'),
  eye: SVG('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.6"/>'),
  robot: SVG('<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M8 13h.01M16 13h.01M9 16.5h6"/><circle cx="12" cy="3" r="1.4"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  x: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  chev: SVG('<path d="M9 6l6 6-6 6"/>'),
  check: SVG('<path d="M20 6L9 17l-5-5"/>'),
  pause: SVG('<path d="M8 5v14M16 5v14"/>'),
  play: SVG('<path d="M7 4l13 8-13 8V4Z"/>'),
  spark: SVG('<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z"/>'),
  search: SVG('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'),
  book: SVG('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M8 3v14"/>'),
  gavel: SVG('<path d="M14 4l6 6-3 3-6-6 3-3Z"/><path d="M11 7L4 14l3 3 7-7M3 21h9"/>'),
  chat: SVG('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12Z"/>'),
  ship: SVG('<path d="M12 3v10M8 7l4-4 4 4"/><path d="M4 13l8 4 8-4M4 17l8 4 8-4"/>'),
  db: SVG('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
  save: SVG('<path d="M5 3h11l3 3v15H5V3Z"/><path d="M8 3v6h7M8 21v-6h8v6"/>'),
  link: SVG('<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>'),
  shield: SVG('<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/>'),
  cog: SVG('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
};
const icon = (k) => ICON[k] || "";

/* ── 화면·상태 ── */
const NAV = [
  { id: "today", name: "오늘", icon: "today" },
  { id: "apps", name: "앱", icon: "apps" },
  { id: "tasks", name: "업무", icon: "tasks" },
  { id: "codex", name: "Codex", icon: "codex" },
  { id: "archive", name: "기록", icon: "archive" },
];
const SIMPLE_STATUS = {queued:"대기",received:"대기",pending:"대기",open:"대기",assigned:"작업 중",in_progress:"작업 중",implementing:"작업 중",working:"작업 중",investigating:"작업 중",verifying:"검토 중",in_review:"검토 중",fixing:"작업 중",approval_pending:"승인 필요",deploying:"배포 중",completed:"완료",done:"완료",resolved:"완료",approved:"승인",blocked:"막힘",needs_check:"막힘",failed:"실패",cancelled:"취소",dismissed:"취소",held:"보류",on_hold:"보류",rejected:"반려",external_wait:"막힘",scheduled:"대기",active:"대기",proposed:"대기",draft:"대기",decided:"완료",closed:"완료",archived:"완료"};
const STATUS_TONE = {대기:"neutral","작업 중":"accent","검토 중":"warn","승인 필요":"warn","배포 중":"accent",완료:"good",승인:"good",막힘:"bad",실패:"bad",취소:"neutral",보류:"neutral",반려:"bad"};
const HEALTH = {ok:["정상","good"],warn:["확인 필요","warn"],down:["막힘","bad"],unknown:["확인 중","neutral"],running:["작업 중","accent"],planned:["준비 중","neutral"]};
const COLLECTION_LABEL = {meetings:"회의",decisions:"결정",approvals:"결재",requests:"요청",reviews:"검수",tasks:"업무",notes:"메모",incidents:"장애",feedback:"사용자 의견"};
const AUTONOMY_LABEL = {research_only:"조사만 하고 보고",implement_and_review:"고친 뒤 내 확인 대기",implement_test_wait_for_deploy:"고치고 테스트까지, 배포는 대기",guarded_auto_deploy:"안전장치 걸고 배포까지 자동"};
const esc = (s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const attr = esc;
const fmt = (iso,detail=true)=>{if(!iso)return "—";try{return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:detail?"2-digit":undefined,minute:detail?"2-digit":undefined}).format(new Date(iso));}catch{return String(iso)}};
const ago = (iso)=>{if(!iso)return "—";const d=(Date.now()-Date.parse(iso))/1000;if(!Number.isFinite(d))return "—";if(d<60)return "방금";if(d<3600)return `${Math.floor(d/60)}분 전`;if(d<86400)return `${Math.floor(d/3600)}시간 전`;return `${Math.floor(d/86400)}일 전`;};
const simpleStatus=(s)=>SIMPLE_STATUS[s]||"대기";
const statusPill=(s)=>{const l=simpleStatus(s);return `<span class="status ${STATUS_TONE[l]||"neutral"}">${esc(l)}</span>`;};
const tonePill=(t,l)=>`<span class="status ${t}">${esc(l)}</span>`;
const appAccent={robom:"#35e39b",outbom:"#42a9ff",homebom:"#3fd28a",runningbom:"#ff7a4d",calendarbom:"#2fd0bd",certbom:"#7f8cff",notebom:"#ff6fa8"};

const HQ_VERSION="1.3.2"; // 빌드 시 version.json이 실제 앱 버전으로 덮어씀(=다운로드한 버전)
let APP_VERSION=HQ_VERSION;
let SNAP=null, LOCAL={records:{},audit:[],mode:"portable"}, HQ=null, CURRENT="today", SELECTED_APP=null, ARCHIVE_TAB="approvals";
let ATTACH=[]; // 첨부 이미지 [{tmpId,id,thumb,uploading}]
const preview=Boolean(window.__PREVIEW__);
const $=(q)=>document.querySelector(q), $$=(q)=>[...document.querySelectorAll(q)];

async function fetchJson(url,options){const res=await fetch(url,{cache:"no-store",...options});if(!res.ok){let m="";try{m=(await res.json()).message||"";}catch{}throw new Error(m||`${res.status} ${url}`);}return res.json();}
// 서버 응답 state에는 mode가 없다 → 실앱(비-미리보기)에서는 항상 live로 유지(쓰기 후 대기로 오판 방지).
function applyState(state){LOCAL=state||LOCAL;if(!preview)LOCAL.mode="live";}
async function load(){
  try{SNAP=window.__SNAP__||await fetchJson("./snapshot.json");}catch(e){$("#screen").innerHTML=empty("회사 스냅샷을 불러오지 못했습니다.","로컬 본부를 다시 실행해 주세요.");return;}
  if(!preview){try{LOCAL=await fetchJson("/api/company-state");LOCAL.mode="live";}catch{LOCAL={records:loadPortable(),audit:[],mode:"portable"};}}
  else LOCAL={records:loadPortable(),audit:[],mode:"portable"};
  if(!preview){try{HQ=await fetchJson("/api/hq-status");}catch{HQ=null;}}else HQ=null;
  SELECTED_APP=SELECTED_APP||familyApps()[0]?.id;
  updateStatusbar();render(CURRENT);
}
function loadPortable(){try{return JSON.parse(localStorage.getItem("robom-hq-portable-records")||"{}");}catch{return {};}}
function savePortable(){localStorage.setItem("robom-hq-portable-records",JSON.stringify(LOCAL.records||{}));}
function familyApps(){return (SNAP.apps||[]).filter(a=>a.id!=="robom");}
function hqSystems(){return (SNAP.apps||[]).filter(a=>a.id==="robom");}
function appById(id){return (SNAP.apps||[]).find(a=>a.id===id);}
function appName(id){return appById(id)?.name||id||"회사 전체";}
function records(name){return LOCAL.records?.[name]||[];}
function openCount(name){return records(name).filter(r=>!["approved","rejected","closed","completed","cancelled","dismissed","done","resolved","archived"].includes(r.status)).length;}
function appRunning(id){return (SNAP.runs||[]).some(r=>r.appId===id&&!["completed","failed"].includes(r.status));}
function pendingApprovals(){if(!SNAP)return records("approvals").filter(r=>r.status==="pending");return [...(SNAP.approvals||[]),...records("approvals").filter(r=>r.status==="pending")];}

/* ── 상단 상태바 ── */
function codexState(){
  if(!HQ)return {cls:"",label:"연결 안 됨",detail:LOCAL.mode==="live"?"HQ 상태를 읽지 못했습니다.":"휴대용 보기 — Codex 상태 없음"};
  const r=HQ.runner||{};
  if(HQ.control?.paused)return {cls:"warn",label:"일시정지",detail:"모든 자동작업이 멈춰 있습니다."};
  if(r.state==="running")return {cls:"busy",label:"작업 중",detail:`${appName(HQ.runningTask?.app)} · ${HQ.runningTask?.title||""}`};
  if(r.state==="not_running")return {cls:"warn",label:"실행기 꺼짐",detail:"터미널에서 codex-runner를 켜세요."};
  if(r.codex==="not_connected")return {cls:"warn",label:"Codex 미연결",detail:r.codexDetail||"codex login이 필요합니다."};
  return {cls:"on",label:"대기 중",detail:`대기 ${HQ.pending||0}건 · 준비 완료 · ${ago(r.at)}`};
}
function updateStatusbar(){
  const cx=codexState(),pill=$("#codexPill");
  pill.className="codex-pill "+cx.cls;$("#cxState").textContent=cx.label;$("#cxDetail").textContent=cx.detail;
  const sig=$("#appSignals");
  sig.innerHTML=familyApps().map(a=>{let c=appRunning(a.id)?"busy":({ok:"ok",warn:"warn",down:"bad"}[a.health]||"");return `<span class="sig ${c}" title="${attr(a.name)} · ${esc((HEALTH[a.health]||HEALTH.unknown)[0])}" data-app="${attr(a.id)}"><i></i><b>${esc(a.name.replace(/봄$/,""))}</b></span>`;}).join("");
  const live=LOCAL.mode==="live"&&!preview,bd=$("#modeBadge");
  bd.textContent=preview?"PREVIEW":(live?"LIVE":"휴대용");bd.className="mode-badge "+(live?"live":"warn");
  // 레일 배지(확인할 일 수)
  buildRail();
}
function buildRail(){
  const attn=attentionItems().length;const pend=HQ?HQ.pending:openCount("tasks");
  const badge={today:attn,tasks:pend};
  $("#rail").innerHTML=NAV.map(n=>`<button class="rail-item ${CURRENT===n.id?"active":""}" data-screen="${n.id}" aria-label="${esc(n.name)}">${icon(n.icon)}${badge[n.id]?`<span class="rail-badge">${badge[n.id]}</span>`:""}<span class="tip">${esc(n.name)}</span></button>`).join("")
    +`<div class="rail-sep"></div>`
    +`<a class="rail-item rail-foot" href="./office.html" aria-label="로봄 오피스">${icon("office")}<span class="tip">로봄 오피스</span></a>`;
  $("#tabbar").innerHTML=NAV.map(n=>`<button class="tab ${CURRENT===n.id?"active":""}" data-screen="${n.id}">${icon(n.icon)}${esc(n.name)}</button>`).join("");
}

function render(name){CURRENT=name;const s=$("#screen");s.innerHTML=(RENDER[name]||renderNotReady)();s.scrollTop=0;s.focus({preventScroll:true});buildRail();bindScreen();}
function title(k,t,d,a=""){return `<header class="page-head"><div><small>${esc(k)}</small><h1>${esc(t)}</h1>${d?`<p>${esc(d)}</p>`:""}</div>${a?`<div class="head-actions">${a}</div>`:""}</header>`;}
function metric(v,l,tone="neutral",note=""){return `<div class="metric ${tone}"><b>${esc(v)}</b><span>${esc(l)}</span>${note?`<small>${esc(note)}</small>`:""}</div>`;}
function panel(l,body,extra=""){return `<section class="panel"><div class="panel-title"><span>${esc(l)}</span>${extra}</div>${body}</section>`;}
function empty(main,sub=""){return `<div class="empty-state">${icon("spark")}<b>${esc(main)}</b>${sub?`<p>${esc(sub)}</p>`:""}</div>`;}
function button(label,action,kind="ghost",extra="",ic=""){return `<button class="button ${kind}" type="button" data-action="${action}" ${extra}>${ic?icon(ic):""}${label}</button>`;}

/* ── 확인할 일 ── */
function attentionItems(){
  if(!SNAP)return [];
  const items=[];
  pendingApprovals().forEach(r=>items.push({label:`결재: ${r.title||r.decision||"결정 필요"}`,screen:"archive",tab:"approvals",kind:"review"}));
  records("tasks").filter(r=>["blocked","approval_pending","in_review"].includes(r.status)).forEach(r=>items.push({label:`${simpleStatus(r.status)} 업무: ${r.title}`,screen:"tasks",kind:r.status==="blocked"?"bad":"review"}));
  familyApps().filter(a=>a.health&&a.health!=="ok").forEach(a=>items.push({label:`${a.name} ${(HEALTH[a.health]||HEALTH.unknown)[0]}`,screen:"apps",app:a.id,kind:a.health==="down"?"bad":"warn"}));
  (SNAP.operations?.humanTasks||[]).slice(0,3).forEach(t=>items.push({label:t,screen:"archive",tab:"settings",kind:"warn"}));
  return items;
}

/* ── 오늘 ── */
function renderToday(){
  const attn=attentionItems(),apps=familyApps(),autos=pendingApprovals().filter(a=>a.requestedBy==="auto-review"),cx=codexState();
  return `${title("MISSION CONTROL","오늘","지금 확인할 일과 회사 상태를 한눈에.")}
  ${panel(`내가 확인할 일`,attn.length?`<div class="attn-list">${attn.slice(0,7).map(it=>`<button class="attn-item ${it.kind||""}" data-action="goto-item" data-target="${it.screen}" ${it.tab?`data-tab="${it.tab}"`:""} ${it.app?`data-app-id="${it.app}"`:""}><span class="ai-icon">${icon(it.kind==="review"?"gavel":"alert")}</span><b>${esc(it.label)}</b><span class="ai-go">${icon("chev")}</span></button>`).join("")}</div>`:empty("지금 확인할 일이 없습니다.","막힘·결재·경고가 생기면 여기에 먼저 나타나요."),attn.length?`<span class="pt-count">${attn.length}</span>`:"")}
  ${autos.length?panel(`시스템이 올린 개선 제안`,`<div class="approval-list">${autos.slice(0,4).map(autoCard).join("")}</div>`,`<span class="pt-count">${autos.length}</span>`):""}
  ${panel(`Codex 상태`,`<div class="codex-line"><span class="status ${cx.cls==="on"?"good":cx.cls==="busy"?"accent":cx.cls==="warn"?"warn":"neutral"}">${esc(cx.label)}</span><p>${esc(cx.detail)}</p>${button("자세히","goto","ghost",'data-target="codex"',"chev")}</div>`)}
  ${panel(`${apps.length}개 앱`,`<div class="today-apps">${apps.map(a=>{const[hl,tone]=HEALTH[a.health]||HEALTH.unknown;const run=appRunning(a.id);const ot=records("tasks").filter(t=>t.appId===a.id&&!["completed","cancelled","dismissed","done"].includes(t.status)).length;
    return `<button class="today-app" data-app="${attr(a.id)}" style="--app:${appAccent[a.id]||"#64748b"}"><span class="ta-mark">${esc(a.name[0])}</span><span class="ta-body"><b>${esc(a.name)}</b><small>${run?"작업 중":hl}${ot?` · 요청 ${ot}`:""}</small></span>${tonePill(run?"accent":tone,run?"작업 중":hl)}</button>`;}).join("")}</div>
    ${hqSystems().length?`<div class="sys-line">${hqSystems().map(a=>`<span>본사 · ${esc(a.name)} ${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}</span>`).join("")}<span>ROBOM HQ ${tonePill("good","실행 중")}</span></div>`:""}`)}
  <div class="today-actions">${button("새 수정 요청","new-task","primary","","plus")}${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary","","play"):button("모든 자동작업 일시정지","pause-all","danger","","pause")}</div>`;
}
function autoCard(r){
  return `<article class="approval-card auto"><header><div><span class="ac-tag">${icon("spark")} 시스템 제안 · ${esc(appName(r.appId))}</span><h2>${esc(r.title)}</h2></div>${statusPill(r.status||"pending")}</header>${r.body?`<p>${esc(r.body)}</p>`:""}${r.recommendation?`<div class="ac-reco"><b>제안</b>${esc(r.recommendation)}</div>`:""}<footer>${r.id?`${button("승인하고 맡기기","approve-proposal","primary",`data-id="${attr(r.id)}"`,"check")}${button("보류","patch-record","ghost",`data-collection="approvals" data-id="${attr(r.id)}" data-status="held"`)}${button("반려","patch-record","danger",`data-collection="approvals" data-id="${attr(r.id)}" data-status="rejected"`)}`:`<small class="fine">스냅샷 제안 — 근거 화면에서 처리</small>`}</footer></article>`;
}

/* ── 앱 ── */
function renderApps(){
  const apps=familyApps();
  return `${title("PORTFOLIO",`운영 앱 ${apps.length}개`,"registry 기준 자동 생성. 본사 시스템은 아래 별도 표시.")}
  <div class="portfolio-grid">${apps.map(appCard).join("")}</div>
  ${panel("본사 시스템",`<div class="simple-list">${hqSystems().map(a=>`<button data-app="${attr(a.id)}"><b>${esc(a.name)} · robom.kr</b>${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}</button>`).join("")}<div><b>ROBOM HQ (이 프로그램)</b>${tonePill("good","실행 중")}</div></div>`)}`;
}
function appCard(a){const[hl,tone]=HEALTH[a.health]||HEALTH.unknown;const ot=records("tasks").filter(t=>t.appId===a.id&&!["completed","cancelled","done","dismissed"].includes(t.status)).length;
  return `<article class="product-card" style="--app:${appAccent[a.id]||"#64748b"}"><header><div><span class="app-kicker">계열사 앱</span><h2>${esc(a.name)}</h2></div>${tonePill(tone,hl)}</header>
  <div class="product-version"><b>v${esc(a.version||"—")}</b><span>${esc(a.git?.sha?.slice(0,7)||a.production?.deployedSha?.slice(0,7)||"")}</span></div>
  <dl><dt>사용자 가치</dt><dd>${esc(a.role||a.note||"")}</dd><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd><dt>현재 작업</dt><dd>${esc((SNAP.runs||[]).find(r=>r.appId===a.id&&!["completed","failed"].includes(r.status))?.task||(ot?`요청 ${ot}건 대기`:"없음"))}</dd><dt>다음 행동</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></dl>
  <footer>${button("자세히","select-app","ghost",`data-app="${a.id}"`)}${a.url?`<a class="button secondary" href="${attr(a.url)}" target="_blank" rel="noopener">앱 사용</a>`:""}${button("수정 요청","new-task-for","primary",`data-app-id="${a.id}"`,"plus")}</footer></article>`;}
function renderAppDetail(){const a=appById(SELECTED_APP)||familyApps()[0];if(!a)return renderApps();const[hl,tone]=HEALTH[a.health]||HEALTH.unknown;const ci=a.ci?.[0];
  return `${title("APP",a.name,"사용자 영향부터, 기술 정보는 아래.",`${a.url?`<a class="button primary" href="${attr(a.url)}" target="_blank" rel="noopener">운영 앱 열기</a>`:""}${button("수정 요청","new-task-for","secondary",`data-app-id="${a.id}"`,"plus")}`)}
  <div class="product-hero" style="--app:${appAccent[a.id]||"#64748b"}"><div><span>현재 운영</span><h2>v${esc(a.version||"—")}</h2>${tonePill(tone,hl)}</div>
  <dl class="data-list"><dt>사용자 가치</dt><dd>${esc(a.role||a.note||"")}</dd><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd><dt>다음 개선</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></dl></div>
  <div class="detail-grid">${panel("진행 중 업무",records("tasks").filter(t=>t.appId===a.id).length?`<div class="record-list">${records("tasks").filter(t=>t.appId===a.id).slice(0,6).map(taskRow).join("")}</div>`:empty("이 앱에 등록된 업무가 없습니다."))}
  ${panel("기술 정보 (근거)",`<dl class="data-list"><dt>저장소</dt><dd>${esc(a.repo||"—")}</dd><dt>브랜치·SHA</dt><dd>${esc(a.git?.branch||"main")} · ${esc(a.git?.sha||a.production?.deployedSha?.slice(0,7)||"—")}</dd><dt>배포</dt><dd>${esc(a.deployTarget||"—")}</dd><dt>CI</dt><dd>${esc(ci?`${ci.name} · ${ci.conclusion||ci.status}`:"GitHub 연결 시 표시")}</dd><dt>열린 PR</dt><dd>${a.openPrs?.length||0}</dd></dl>`)}</div>`;}

/* ── 업무 ── */
function taskRow(r){
  const thumbs=(r.attachments||[]).length&&LOCAL.mode==="live"?`<div class="record-thumbs">${r.attachments.slice(0,4).map(id=>`<img src="/api/attachments/${encodeURIComponent(id)}" alt="첨부" loading="lazy" />`).join("")}</div>`:"";
  return `<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title)}</h3>${r.autonomy?`<small>${esc(AUTONOMY_LABEL[r.autonomy]||r.autonomy)}</small>`:""}</div>${statusPill(r.status)}</header>${r.problem||r.body?`<p>${esc(r.problem||r.body)}</p>`:""}${r.desiredOutcome?`<p class="outcome">→ ${esc(r.desiredOutcome)}</p>`:""}${thumbs}<footer>${["in_review","approval_pending"].includes(r.status)?button("확인 완료","patch-record","primary",`data-collection="tasks" data-id="${r.id}" data-status="completed"`,"check"):""}${["queued","blocked"].includes(r.status)?button("취소","patch-record","ghost",`data-collection="tasks" data-id="${r.id}" data-status="cancelled"`):""}${button("작업 패킷","download-bundle","ghost",`data-id="${r.id}"`)}</footer></article>`;
}
function renderTasks(){
  const list=records("tasks");
  return `${title("WORK","업무","말하듯 요청하면 Codex 대기열에 자동 등록됩니다.",button("새 수정 요청","new-task","primary","","plus"))}
  <div class="metrics-grid">${metric(HQ?HQ.pending:openCount("tasks"),"대기",HQ?.pending?"accent":"neutral")}${metric(HQ?.running??"—","작업 중",HQ?.running?"accent":"neutral")}${metric(list.filter(t=>["in_review","approval_pending"].includes(t.status)).length,"확인 필요","warn")}${metric(list.filter(t=>t.status==="blocked").length,"막힘",list.some(t=>t.status==="blocked")?"bad":"neutral")}</div>
  ${list.length?`<div class="record-list">${list.map(taskRow).join("")}</div>`:empty("등록된 업무가 없습니다.","'새 수정 요청'을 눌러 어떤 앱의 무엇이 불편한지 말하듯 적어 주세요. 사진도 붙일 수 있어요.")}`;
}

/* ── Codex ── */
function renderCodex(){
  const cx=codexState(),r=HQ?.runner||{};
  return `${title("CODEX","Codex 작업 현황판","기술 콘솔이 아니라 지금 무엇을 하는지 보는 화면입니다.")}
  ${panel("현재 상태",`<div class="codex-line"><span class="status ${cx.cls==="on"?"good":cx.cls==="busy"?"accent":cx.cls==="warn"?"warn":"neutral"}">${esc(cx.label)}</span><p>${esc(cx.detail)}</p></div>
  <div class="metrics-grid" style="margin-top:14px">${metric(HQ?.pending??"—","다음 대기")}${metric(HQ?.running??"—","실행 중",HQ?.running?"accent":"neutral")}${metric(HQ?.done??"—","완료","good")}${metric(HQ?.failed??"—","실패·막힘",HQ?.failed?"bad":"neutral")}</div>`)}
  ${HQ?.runningTask?panel("실행 중 작업",`<div class="record-list"><article><header><div><span>${esc(appName(HQ.runningTask.app))}</span><h3>${esc(HQ.runningTask.title)}</h3></div>${tonePill("accent","작업 중")}</header><p>시작 ${fmt(HQ.runningTask.lease?.claimedAt)} · 마지막 신호 ${ago(HQ.runningTask.lease?.heartbeatAt)}</p></article></div>`):""}
  ${HQ?.nextTask?panel("다음 대기",`<div class="simple-list"><div><b>${esc(appName(HQ.nextTask.app))} · ${esc(HQ.nextTask.title)}</b>${tonePill("neutral","대기")}</div></div>`):""}
  ${panel("제어",`<div class="today-actions">${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary","","play"):button("모든 자동작업 일시정지","pause-all","danger","","pause")}${HQ?.control?.intakeClosed?button("새 작업 접수 재개","open-intake","secondary"):button("새 작업 접수 중지","close-intake","ghost")}</div>`)}
  ${panel("연결 방법 (맥북에서 1회)",`<ol class="number-list"><li>터미널: <code>codex login</code> — 구독 계정 로그인 (API 키 금지)</li><li><code>node scripts/control-center/codex-runner.mjs</code> 실행 — 대기열 자동 처리</li><li>이 화면 상태가 '대기 중'으로 바뀌면 연결 완료</li></ol><p class="fine">연결 전에는 미연결로 정직하게 표시하며, 요청은 대기열에 안전 보관됩니다.</p>`)}`;
}

/* ── 기록·설정 ── */
const ARCHIVE_TABS=[["approvals","결재","gavel"],["memory","기억","search"],["meetings","회의","chat"],["decisions","결정","book"],["incidents","장애","alert"],["delivery","배포","ship"],["data","데이터","db"],["backup","백업","save"],["connections","연결","link"],["security","보안","shield"],["settings","설정","cog"]];
function renderArchive(){
  return `${title("RECORDS","기록·설정","회의·결정·장애·배포·백업·보안을 한곳에서.")}
  <div class="seg">${ARCHIVE_TABS.map(([id,label,ic])=>`<button class="${ARCHIVE_TAB===id?"active":""}" data-archive-tab="${id}">${icon(ic)}${esc(label)}</button>`).join("")}</div>
  <div id="archiveBody">${archiveBody()}</div>`;
}
function archiveBody(){
  switch(ARCHIVE_TAB){
    case "approvals":return approvalsBody();
    case "memory":return `<label class="memory-search">${button("","",'ghost')}<input id="memoryInput" type="search" placeholder="예: 청약봄 가격 비교를 왜 보류했지" />${button("검색","search-memory","primary")}</label><div id="memoryResults">${memoryResults("")}</div>`;
    case "meetings":return `<div class="panel-actions">${button("회의 기록","new-record","primary",'data-collection="meetings"',"plus")}</div>${recordList("meetings",{emptyTitle:"저장된 회의가 없습니다."})}`;
    case "decisions":return `<div class="panel-actions">${button("결정 기록","new-record","primary",'data-collection="decisions"',"plus")}</div>${recordList("decisions",{emptyTitle:"저장된 결정이 없습니다."})}`;
    case "incidents":return `<div class="panel-actions">${button("장애 기록","new-record","primary",'data-collection="incidents"',"plus")}</div>${(familyApps().filter(a=>a.health==="down").length?`<div class="incident-banner">${icon("alert")}<b>운영 장애 ${familyApps().filter(a=>a.health==="down").length}건</b><span>${familyApps().filter(a=>a.health==="down").map(a=>a.name).join(", ")}</span></div>`:"")}${recordList("incidents",{emptyTitle:"기록된 장애가 없습니다."})}`;
    case "delivery":return `<div class="delivery-list">${(SNAP.apps||[]).map(a=>{const ci=a.ci?.[0];return `<article><div><h3>${esc(a.name)}</h3><p>${esc(a.deployTarget||"배포 방식 확인 중")}</p></div>${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}<code>${esc(a.production?.deployedSha?.slice(0,12)||a.git?.sha||"—")}</code></article>`;}).join("")}</div>`;
    case "data":return `<div class="data-grid">${familyApps().map(a=>`<article><header><h2>${esc(a.name)}</h2>${tonePill(a.production?.status==="PASS"?"good":"warn",a.production?.status||"확인")}</header><dl class="data-list"><dt>운영 확인</dt><dd>${esc(a.production?.version?`v${a.production.version}`:"확인 중")}</dd><dt>신선도</dt><dd>${esc(a.production?.warnings?.[0]||"운영 기준 통과")}</dd></dl></article>`).join("")}</div>`;
    case "backup":return `<div class="panel-actions">${button("지금 백업","backup","primary","","save")}${button("JSON 내보내기","export","ghost")}</div><dl class="data-list"><dt>저장 위치</dt><dd>${LOCAL.mode==="live"?"이 컴퓨터의 비공개 runtime 폴더":"브라우저 휴대용 저장"}</dd><dt>마지막 백업</dt><dd>${esc(LOCAL.meta?.lastBackupAt?fmt(LOCAL.meta.lastBackupAt):"아직 없음")}</dd><dt>백업 대상</dt><dd>회의·결재·업무·장애 기록과 감사 로그</dd></dl>`;
    case "connections":return connectionMarkup();
    case "security":return `<div class="security-grid">${(SNAP.operations?.security||[]).map(c=>`<article>${tonePill(c.ok?"good":"warn",c.ok?"통과":"확인")}<h3>${esc(c.name)}</h3><p>${esc(c.note||"")}</p></article>`).join("")||empty("보안 점검 항목을 불러오지 못했습니다.")}</div>`;
    case "settings":return `<div class="settings-list"><article><div><h3>현재 모드</h3><p>${LOCAL.mode==="live"?"실시간 로컬 본부":"휴대용 보기"}</p></div>${tonePill(LOCAL.mode==="live"?"good":"neutral",LOCAL.mode==="live"?"연결됨":"제한됨")}</article><article><div><h3>휴대폰 연결</h3><p>${HQ?.remote==="token"?"토큰 인증으로 사설망 접속 허용됨":"이 컴퓨터 전용(127.0.0.1) — docs/hq/REMOTE-ACCESS.md"}</p></div>${tonePill(HQ?.remote==="token"?"accent":"good",HQ?.remote==="token"?"원격 허용":"비공개")}</article><article><div><h3>추가 운영비</h3><p>유료 API·상시 유료 서버 없이 로컬 Node.js와 GitHub 무료 범위만 사용.</p></div>${tonePill("good","0원")}</article><article><div><h3>자동 점검</h3><p>매일 아침 6개 앱을 점검해 개선 제안을 '오늘' 화면 결재로 올립니다.</p></div>${tonePill("accent","매일")}</article><article><div><h3>회장이 직접 할 일</h3><p>${(SNAP.operations?.humanTasks||[]).slice(0,3).map(esc).join(" · ")||"현재 없음"}</p></div></article><article><div><h3>부가기능 · 로봄 오피스</h3><p>살아있는 6층 오피스 게임(실제 이벤트 연동)</p></div><a class="button ghost" href="./office.html">오피스 보기</a></article></div>`;
    default:return empty("준비되지 않은 탭입니다.");
  }
}
function approvalsBody(){const items=[...(SNAP.approvals||[]),...records("approvals")];
  return `<div class="panel-actions">${button("안건 상신","new-record","primary",'data-collection="approvals"',"plus")}</div>${items.length?`<div class="approval-list">${items.map(r=>{const auto=r.requestedBy==="auto-review";return `<article class="approval-card ${auto?"auto":""}"><header><div><span class="ac-tag">${auto?icon("spark")+" 시스템 제안 · ":""}${esc(appName(r.appId||r.app))}</span><h2>${esc(r.title||r.decision||"결정 필요")}</h2></div>${statusPill(r.status||"pending")}</header>${r.body?`<p>${esc(r.body)}</p>`:""}${r.recommendation?`<div class="ac-reco"><b>제안</b>${esc(r.recommendation)}</div>`:""}<footer>${r.id?`${auto?button("승인하고 맡기기","approve-proposal","primary",`data-id="${attr(r.id)}"`,"check"):button("승인","patch-record","primary",`data-collection="approvals" data-id="${attr(r.id)}" data-status="approved"`,"check")}${button("보류","patch-record","ghost",`data-collection="approvals" data-id="${attr(r.id)}" data-status="held"`)}${button("반려","patch-record","danger",`data-collection="approvals" data-id="${attr(r.id)}" data-status="rejected"`)}`:`<small class="fine">스냅샷 안건 — 근거 화면에서 처리</small>`}</footer></article>`;}).join("")}</div>`:empty("회장 결정이 필요한 안건이 없습니다.","비용·계정·복구 불가능한 결정, 그리고 시스템 개선 제안이 여기로 올라와요.")}`;}
function memoryResults(q){const all=Object.entries(LOCAL.records||{}).flatMap(([c,l])=>l.map(r=>({...r,collection:c})));const n=q.trim().toLowerCase(),found=n?all.filter(r=>JSON.stringify(r).toLowerCase().includes(n)):all.slice(0,12);return found.length?`<div class="memory-list">${found.map(r=>`<article><span>${esc(COLLECTION_LABEL[r.collection]||r.collection)} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||"기록")}</h3><p>${esc(r.body||r.problem||"")}</p>${r.appId?`<small class="fine">${esc(appName(r.appId))}</small>`:""}</article>`).join("")}</div>`:empty(n?"검색 결과가 없습니다.":"아직 회사 기억이 없습니다.","회의·결정·업무가 쌓이면 여기서 검색할 수 있어요.")}
function connectionMarkup(){const c=SNAP.connections||{};return `<div class="connection-list">${[["로컬 본부",LOCAL.mode==="live","실시간 기록·백업"],["GitHub",String(c.github).startsWith("connected"),c.github],["작업 이벤트",c.events==="connected",c.events],["Claude Code",!String(c.claudeCode).includes("pending"),c.claudeCode],["Codex 실행기",HQ?.runner?.codex==="connected","codex-runner"],["휴대폰 원격",HQ?.remote==="token","토큰 인증 사설망"]].map(([nm,ok,d])=>`<div>${tonePill(ok?"good":"neutral",ok?"연결":"대기")}<b>${esc(nm)}</b><span>${esc(d===true||d===false?"":(d||""))}</span></div>`).join("")}</div>`;}
function recordList(collection,opt={}){const items=opt.items||records(collection);return items.length?`<div class="record-list">${items.map(r=>`<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||COLLECTION_LABEL[collection]||"기록")}</h3></div>${statusPill(r.status||"open")}</header>${r.body?`<p>${esc(r.body)}</p>`:""}<footer>${opt.actions?opt.actions(r):""}</footer></article>`).join("")}</div>`:empty(opt.emptyTitle||`저장된 ${COLLECTION_LABEL[collection]||"기록"}이 없습니다.`);}
function renderNotReady(){return `${title("ROBOM HQ","로봄 본부","실제 연결 상태를 기준으로 표시합니다.")}${empty("표시할 정보가 없습니다.")}`;}

const RENDER={today:renderToday,apps:renderApps,app:renderAppDetail,tasks:renderTasks,codex:renderCodex,archive:renderArchive};

/* ── 토스트·다이얼로그 ── */
function showToast(m,tone=""){const t=$("#toast");t.textContent=m;t.className=`toast show ${tone}`;clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove("show"),2600);}

/* 이미지 첨부 */
function loadImage(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file);const im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im);};im.onerror=rej;im.src=u;});}
async function stripAndResize(file){const im=await loadImage(file);const max=1600;let w=im.width,h=im.height;if(w>max||h>max){const r=Math.min(max/w,max/h);w=Math.round(w*r);h=Math.round(h*r);}const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);const dataUrl=c.toDataURL("image/jpeg",.85);const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));return {dataUrl,blob};}
function blobToBase64(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(",")[1]);fr.onerror=rej;fr.readAsDataURL(blob);});}
function renderThumbs(){const el=$("#taskThumbs");if(!el)return;el.innerHTML=ATTACH.map(a=>a.uploading?`<div class="thumb up" data-tmp="${a.tmpId}"></div>`:`<div class="thumb"><img src="${a.thumb}" alt="첨부"/><button type="button" data-rm="${a.tmpId}" aria-label="삭제">×</button></div>`).join("");}
async function addImages(files){
  if(preview){showToast("이미지 첨부는 본부(앱) 실행 중일 때만 돼요.","warn");return;}
  for(const file of files){
    if(!file.type||!file.type.startsWith("image/"))continue;
    const tmpId="t"+Math.random().toString(36).slice(2,9);
    try{
      const {dataUrl,blob}=await stripAndResize(file);
      ATTACH.push({tmpId,thumb:dataUrl,uploading:true});renderThumbs();
      const b64=await blobToBase64(blob);
      const res=await fetchJson("/api/attachments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name||"image.jpg",mime:"image/jpeg",dataBase64:b64})});
      const it=ATTACH.find(a=>a.tmpId===tmpId);if(it){it.id=res.id;it.uploading=false;}
    }catch(e){ATTACH=ATTACH.filter(a=>a.tmpId!==tmpId);showToast("이미지 첨부 실패: "+e.message,"bad");}
    renderThumbs();
  }
}
function openTaskDialog(appId=""){ATTACH=[];renderThumbs();const d=$("#taskDialog");$("#taskApp").innerHTML=familyApps().map(a=>`<option value="${attr(a.id)}" ${a.id===appId?"selected":""}>${esc(a.name)}</option>`).join("")+`<option value="robom" ${appId==="robom"?"selected":""}>로봄 웹(robom.kr)</option>`;$("#taskTitle").value="";$("#taskProblem").value="";$("#taskOutcome").value="";$("#taskPreserve").value="";$("#taskFile").value="";d.showModal();setTimeout(()=>$("#taskTitle").focus(),30);}
async function saveTask(form){const fd=new FormData(form);
  const payload={title:String(fd.get("title")||"").trim(),appId:String(fd.get("appId")||""),problem:String(fd.get("problem")||"").trim(),desiredOutcome:String(fd.get("desiredOutcome")||"").trim(),priority:String(fd.get("priority")||"normal"),autonomy:String(fd.get("autonomy")||"implement_and_review"),status:"queued"};
  const pre=String(fd.get("mustPreserve")||"").trim();if(pre)payload.mustPreserve=pre;
  const ids=ATTACH.filter(a=>a.id).map(a=>a.id);if(ids.length)payload.attachments=ids;
  if(!payload.title)return;
  if(!preview){const data=await fetchJson("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});applyState(data.state);showToast("요청을 Codex 대기열에 넣었습니다.","good");try{HQ=await fetchJson("/api/hq-status");}catch{}}
  else{const l=LOCAL.records.tasks||=[];l.unshift({...payload,id:`local-${Date.now()}`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});savePortable();showToast("미리보기 모드: 임시 저장. 본부에서 다시 등록해 주세요.","warn");}
  $("#taskDialog").close();render(CURRENT);
}
function openRecord(collection,titleText=""){const d=$("#recordDialog");$("#recordCollection").value=collection;$("#dialogEyebrow").textContent=COLLECTION_LABEL[collection]||"기록";$("#dialogTitle").textContent=`새 ${COLLECTION_LABEL[collection]||"기록"}`;$("#recordTitle").value=titleText;$("#recordBody").value="";$("#recordApp").innerHTML=`<option value="">회사 전체</option>`+(SNAP.apps||[]).map(a=>`<option value="${attr(a.id)}">${esc(a.name)}</option>`).join("");d.showModal();setTimeout(()=>$("#recordTitle").focus(),30);}
async function saveRecord(form){const fd=new FormData(form),c=fd.get("collection"),payload={title:String(fd.get("title")||"").trim(),body:String(fd.get("body")||"").trim(),appId:String(fd.get("appId")||""),priority:String(fd.get("priority")||"normal")};if(!payload.title)return;
  if(!preview){const data=await fetchJson(`/api/records/${encodeURIComponent(c)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});applyState(data.state);}
  else{const l=LOCAL.records[c]||=[];l.unshift({...payload,id:`local-${Date.now()}`,status:"open",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});savePortable();}
  $("#recordDialog").close();showToast(`${COLLECTION_LABEL[c]||"기록"}을 저장했습니다.`,"good");render(CURRENT);
}
async function patchRecord(collection,id,status){if(!id){showToast("스냅샷 안건은 근거 화면에서 처리합니다.");return;}
  if(!preview){const data=await fetchJson(`/api/records/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});applyState(data.state);}
  else{const r=(LOCAL.records[collection]||[]).find(x=>x.id===id);if(r)Object.assign(r,{status,updatedAt:new Date().toISOString()});savePortable();}
  showToast("반영했습니다.","good");render(CURRENT);}
async function approveProposal(id){if(preview){showToast("본부(앱)에서만 승인할 수 있어요.","warn");return;}
  const data=await fetchJson(`/api/approve-proposal/${encodeURIComponent(id)}`,{method:"POST"});applyState(data.state);try{HQ=await fetchJson("/api/hq-status");}catch{}showToast("승인 완료 — 업무로 등록해 Codex에 맡겼습니다.","good");render(CURRENT);}
async function setControl(ch,msg){if(preview){showToast("미리보기 모드에서는 제어할 수 없어요.","warn");return;}await fetchJson("/api/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(ch)});try{HQ=await fetchJson("/api/hq-status");}catch{}showToast(msg,"good");render(CURRENT);}
function download(name,text,type="text/markdown"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function bundleFor(r){const a=appById(r.appId);return `# 로봄 작업 패킷 ${r.id}\n\n- 대상: ${appName(r.appId)} (${a?.repo||"robom-labs/robom"})\n- 기준 SHA: ${a?.git?.sha||a?.production?.deployedSha||"최신 main"}\n- 요청: ${r.title}\n- 문제: ${r.problem||r.body||"기록 없음"}\n- 원하는 결과: ${r.desiredOutcome||"기록 없음"}\n- 유지: ${r.mustPreserve||"기존 사용자 데이터·저장 키·배포 경로"}\n- 자율 범위: ${AUTONOMY_LABEL[r.autonomy]||r.autonomy||"고친 뒤 확인 대기"}\n- 첨부: ${(r.attachments||[]).length}개\n\n실행 전에는 작업 중으로 표시하지 않는다. 완료 기준: 구현·테스트·실제 화면 확인.\n`;}
async function doBackup(){if(preview){download(`robom-hq-backup-${Date.now()}.json`,JSON.stringify({exportedAt:new Date().toISOString(),records:LOCAL.records},null,2),"application/json");showToast("미리보기 기록을 내보냈습니다.","good");return;}const data=await fetchJson("/api/backup",{method:"POST"});applyState(data.state);showToast(`백업 완료 · ${data.file||"로컬 저장"}`,"good");}
async function doExport(){if(preview){download(`robom-company-${Date.now()}.json`,JSON.stringify({snapshot:SNAP,records:LOCAL.records},null,2),"application/json");return;}const data=await fetchJson("/api/export",{method:"POST"});download(data.name||"robom-company-export.json",JSON.stringify(data.payload,null,2),"application/json");}

function bindScreen(){
  $("#memoryInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")$("#memoryResults").innerHTML=memoryResults(e.target.value);});
  $$('[data-archive-tab]').forEach(c=>c.addEventListener("click",()=>{ARCHIVE_TAB=c.dataset.archiveTab;render("archive");}));
}

document.addEventListener("click",async e=>{
  const nav=e.target.closest("[data-screen]");if(nav){e.preventDefault();render(nav.dataset.screen);return;}
  const sig=e.target.closest(".sig[data-app]");if(sig){SELECTED_APP=sig.dataset.app;render("app");return;}
  const app=e.target.closest("[data-app]");if(app&&!app.dataset.action){SELECTED_APP=app.dataset.app;render("app");return;}
  const rm=e.target.closest("[data-rm]");if(rm){ATTACH=ATTACH.filter(a=>a.tmpId!==rm.dataset.rm);renderThumbs();return;}
  const action=e.target.closest("[data-action]");if(!action)return;
  const a=action.dataset.action;
  try{
    if(a==="goto")render(action.dataset.target);
    else if(a==="goto-item"){if(action.dataset.tab)ARCHIVE_TAB=action.dataset.tab;if(action.dataset.appId)SELECTED_APP=action.dataset.appId;render(action.dataset.appId?"app":action.dataset.target);}
    else if(a==="select-app"){SELECTED_APP=action.dataset.app;render("app");}
    else if(a==="new-task")openTaskDialog(SELECTED_APP||"");
    else if(a==="new-task-for")openTaskDialog(action.dataset.appId||"");
    else if(a==="new-record")openRecord(action.dataset.collection);
    else if(a==="patch-record")await patchRecord(action.dataset.collection,action.dataset.id,action.dataset.status);
    else if(a==="approve-proposal")await approveProposal(action.dataset.id);
    else if(a==="pause-all")await setControl({paused:true},"모든 자동작업을 일시정지했습니다.");
    else if(a==="resume-all")await setControl({paused:false},"자동작업을 다시 시작했습니다.");
    else if(a==="close-intake")await setControl({intakeClosed:true},"새 작업 접수를 중지했습니다.");
    else if(a==="open-intake")await setControl({intakeClosed:false},"새 작업 접수를 재개했습니다.");
    else if(a==="download-bundle"){const r=records("tasks").find(x=>x.id===action.dataset.id);if(r)download(`robom-task-${r.id}.md`,bundleFor(r));}
    else if(a==="backup")await doBackup();
    else if(a==="export")await doExport();
    else if(a==="search-memory")$("#memoryResults").innerHTML=memoryResults($("#memoryInput")?.value||"");
  }catch(err){showToast("처리하지 못했습니다. "+err.message,"bad");}
});

// 이미지: 드롭존 클릭·드래그·붙여넣기
document.addEventListener("click",e=>{if(e.target.closest("#taskDrop"))$("#taskFile").click();});
document.addEventListener("change",e=>{if(e.target.id==="taskFile"&&e.target.files?.length)addImages([...e.target.files]);});
document.addEventListener("dragover",e=>{const d=e.target.closest("#taskDrop");if(d){e.preventDefault();d.classList.add("drag");}});
document.addEventListener("dragleave",e=>{const d=e.target.closest("#taskDrop");if(d)d.classList.remove("drag");});
document.addEventListener("drop",e=>{const d=e.target.closest("#taskDrop");if(d){e.preventDefault();d.classList.remove("drag");if(e.dataTransfer?.files?.length)addImages([...e.dataTransfer.files]);}});
document.addEventListener("paste",e=>{if(!$("#taskDialog")?.open)return;const imgs=[...(e.clipboardData?.items||[])].filter(i=>i.type.startsWith("image/")).map(i=>i.getAsFile()).filter(Boolean);if(imgs.length){e.preventDefault();addImages(imgs);}});

$("#refreshBtn").innerHTML=icon("refresh");$("#menuBtn").innerHTML=icon("menu");
$("#refreshBtn").addEventListener("click",load);
$("#menuBtn").addEventListener("click",()=>{ARCHIVE_TAB="approvals";render("archive");});
$("#codexPill").addEventListener("click",()=>render("codex"));
$$('[data-dialog-close]').forEach(b=>b.addEventListener("click",()=>{const d=document.getElementById(b.dataset.dialogClose);if(d?.open)d.close("cancel");}));
$$(".icon-close").forEach(b=>{if(!b.innerHTML.trim())b.innerHTML=icon("x");});
$("#recordForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveRecord(e.currentTarget).catch(err=>showToast(err.message,"bad"));});
$("#taskForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveTask(e.currentTarget).catch(err=>showToast(err.message,"bad"));});

async function loadVersion(){
  try{ APP_VERSION=(window.__VER__||await fetchJson("./version.json")).version||HQ_VERSION; }catch{ APP_VERSION=HQ_VERSION; }
  const t="v"+APP_VERSION;const a=$("#appVersion"),b=$("#brandVer");if(a)a.textContent=t;if(b)b.textContent=t;
}
$("#appVersion")?.addEventListener("click",()=>showToast(`ROBOM HQ v${APP_VERSION} · 이 화면이 최신인지 확인하려면 릴리스 페이지를 보세요.`));
function tick(){try{$("#clock").textContent=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());}catch{}}
setInterval(tick,1000);tick();
setInterval(async()=>{if(LOCAL.mode==="live"&&!preview){try{HQ=await fetchJson("/api/hq-status");updateStatusbar();if(["today","codex"].includes(CURRENT))render(CURRENT);}catch{}}},20000);
if("serviceWorker" in navigator&&!preview&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
buildRail();loadVersion();load();
