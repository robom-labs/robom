// ROBOM HQ 클라이언트 v1.4 — 임원 관제탑(Executive Control Tower).
// 해시 라우터(딥링크·뒤로가기), 라벨 사이드바, ⌘K 팔레트, 폴링 시 표적 갱신(스크롤·포커스 보존),
// 다열 미션 컨트롤 '오늘', 포트폴리오 매트릭스, 정식 결재 문서(decree)+도장, 그룹형 기록 서브내비.
// 원칙: 연출 금지(실제 스냅샷·이벤트 근거만), 본사·계열사 분리, 비전문가 회장 기준 문장, 시맨틱 버튼만.
"use strict";

/* ── 커스텀 라인 아이콘 ── */
const SVG = (d, o = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${o}>${d}</svg>`;
const ICON = {
  today: SVG('<path d="M3 12h4l2.5 7 4-15 2.5 8H21"/>'),
  apps: SVG('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>'),
  tasks: SVG('<path d="M9 5h11M9 12h11M9 19h11"/><path d="M4 5l1.2 1.2L7.4 4"/><path d="M4 12l1.2 1.2L7.4 10.8"/><circle cx="5" cy="19" r="1.2"/>'),
  bolt: SVG('<path d="M13 2L4.5 13.5h5.6L10 22l8.5-11.5h-5.6L13 2Z"/>'),
  archive: SVG('<path d="M3 8l9-4 9 4-9 4-9-4Z"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4"/>'),
  office: SVG('<path d="M4 21V6l8-3 8 3v15"/><path d="M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M16 13h.01"/>'),
  refresh: SVG('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'),
  alert: SVG('<path d="M12 3l9 16H3l9-16Z"/><path d="M12 10v4M12 17h.01"/>'),
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
  bulb: SVG('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3Z"/>'),
  gavel: SVG('<path d="M14 4l6 6-3 3-6-6 3-3Z"/><path d="M11 7L4 14l3 3 7-7M3 21h9"/>'),
  chat: SVG('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12Z"/>'),
  ship: SVG('<path d="M12 3v10M8 7l4-4 4 4"/><path d="M4 13l8 4 8-4M4 17l8 4 8-4"/>'),
  db: SVG('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
  save: SVG('<path d="M5 3h11l3 3v15H5V3Z"/><path d="M8 3v6h7M8 21v-6h8v6"/>'),
  link: SVG('<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>'),
  shield: SVG('<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/>'),
  cog: SVG('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  clock: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
};
const icon = (k) => ICON[k] || "";

/* ── 내비게이션·라우트 ── */
const NAV = [
  { id: "today", name: "오늘", icon: "today", hash: "#/today" },
  { id: "apps", name: "앱", icon: "apps", hash: "#/apps" },
  { id: "tasks", name: "업무", icon: "tasks", hash: "#/tasks" },
  { id: "automation", name: "자동화", icon: "bolt", hash: "#/automation" },
  { id: "records", name: "기록", icon: "archive", hash: "#/records/approvals" },
];
const REC_SECTIONS = [
  { group: "업무 흐름", items: [["approvals", "결재", "gavel"], ["ideas", "아이디어", "bulb"], ["memory", "기억", "search"]] },
  { group: "운영 기록", items: [["incidents", "장애", "alert"]] },
  { group: "시스템", items: [["delivery", "배포", "ship"], ["data", "데이터", "db"], ["backup", "백업", "save"], ["connections", "연결", "link"], ["security", "보안", "shield"], ["settings", "설정", "cog"]] },
];
const REC_IDS = REC_SECTIONS.flatMap((g) => g.items.map(([id]) => id));

const SIMPLE_STATUS = {queued:"대기",received:"대기",pending:"대기",open:"대기",assigned:"작업 중",in_progress:"작업 중",implementing:"작업 중",working:"작업 중",investigating:"작업 중",verifying:"검토 중",in_review:"검토 중",fixing:"작업 중",approval_pending:"승인 필요",deploying:"배포 중",completed:"완료",done:"완료",resolved:"완료",approved:"승인",blocked:"막힘",needs_check:"막힘",failed:"실패",cancelled:"취소",dismissed:"취소",held:"보류",on_hold:"보류",rejected:"반려",external_wait:"막힘",scheduled:"대기",active:"대기",proposed:"대기",draft:"대기",decided:"완료",closed:"완료",archived:"완료"};
const STATUS_TONE = {대기:"neutral","작업 중":"accent","검토 중":"warn","승인 필요":"gold","배포 중":"accent",완료:"good",승인:"good",막힘:"bad",실패:"bad",취소:"neutral",보류:"neutral",반려:"bad"};
const HEALTH = {ok:["정상","good"],warn:["확인 필요","warn"],down:["막힘","bad"],unknown:["확인 중","neutral"],running:["작업 중","accent"],planned:["준비 중","neutral"]};
const COLLECTION_LABEL = {meetings:"회의",decisions:"결정",approvals:"결재",requests:"요청",reviews:"검수",tasks:"업무",notes:"아이디어",incidents:"장애",feedback:"사용자 의견"};
const AUTONOMY_LABEL = {research_only:"조사만 하고 보고",implement_and_review:"고친 뒤 내 확인 대기",implement_test_wait_for_deploy:"고치고 테스트까지, 배포는 대기",guarded_auto_deploy:"안전장치 걸고 배포까지 자동"};
const OPEN_DONE = ["approved","rejected","closed","completed","cancelled","dismissed","done","resolved","archived"];
const esc = (s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const attr = esc;
const fmt = (iso,detail=true)=>{if(!iso)return "—";try{return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:detail?"2-digit":undefined,minute:detail?"2-digit":undefined}).format(new Date(iso));}catch{return String(iso)}};
const ago = (iso)=>{if(!iso)return "—";const d=(Date.now()-Date.parse(iso))/1000;if(!Number.isFinite(d))return "—";if(d<60)return "방금";if(d<3600)return `${Math.floor(d/60)}분 전`;if(d<86400)return `${Math.floor(d/3600)}시간 전`;return `${Math.floor(d/86400)}일 전`;};
const simpleStatus=(s)=>SIMPLE_STATUS[s]||"대기";
const statusPill=(s)=>{const l=simpleStatus(s);return `<span class="status ${STATUS_TONE[l]||"neutral"}">${esc(l)}</span>`;};
const tonePill=(t,l)=>`<span class="status ${t}">${esc(l)}</span>`;
const appAccent={robom:"#35e39b",outbom:"#42a9ff",homebom:"#3fd28a",runningbom:"#ff7a4d",calendarbom:"#2fd0bd",certbom:"#7f8cff",notebom:"#ff6fa8"};
const accent=(id)=>appAccent[id]||"#64748b";
// 스냅샷에 role이 비어 있을 때의 사실 기반 한 줄 소개(제품 목적 — 수치·성과 주장 없음)
const APP_ROLE={robom:"로봄 지주회사 허브 — 계열사 소개·설치 진입",outbom:"날씨·대기질 기반 야외활동 추천",homebom:"청약 공고 탐색·접수 시작/마감 알림",runningbom:"러닝 대회 탐색·접수 알림",calendarbom:"계열사 일정 통합 캘린더",certbom:"자격증 시험 탐색·접수/시험 일정",notebom:"빠른 메모·기록 정리"};
const roleOf=(a)=>a.role||a.note||APP_ROLE[a.id]||"";

const HQ_VERSION="1.9.0"; // 빌드 시 version.json이 실제 앱 버전으로 덮어씀(=다운로드한 버전)
let APP_VERSION=HQ_VERSION;
let SNAP=null, LOCAL={records:{},audit:[],mode:"portable"}, HQ=null;
let CURRENT="today", SELECTED_APP=null, REC_TAB="approvals", MEMORY_Q="";
let ATTACH=[]; // 첨부 이미지 [{tmpId,id,thumb,uploading}]
let RENDER_SIG=""; // 폴링 표적 갱신용 상태 서명
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
  updateChrome();route();
}
function loadPortable(){try{return JSON.parse(localStorage.getItem("robom-hq-portable-records")||"{}");}catch{return {};}}
function savePortable(){localStorage.setItem("robom-hq-portable-records",JSON.stringify(LOCAL.records||{}));}
function familyApps(){return (SNAP?.apps||[]).filter(a=>a.id!=="robom");}
function hqSystems(){return (SNAP?.apps||[]).filter(a=>a.id==="robom");}
function appById(id){return (SNAP?.apps||[]).find(a=>a.id===id);}
function appName(id){return appById(id)?.name||id||"회사 전체";}
function records(name){return LOCAL.records?.[name]||[];}
function openCount(name){return records(name).filter(r=>!OPEN_DONE.includes(r.status)).length;}
function appRunning(id){return (SNAP?.runs||[]).some(r=>r.appId===id&&!["completed","failed"].includes(r.status));}
function openTasksFor(id){return records("tasks").filter(t=>t.appId===id&&!["completed","cancelled","dismissed","done"].includes(t.status)).length;}
function allApprovals(){return [...(SNAP?.approvals||[]),...records("approvals")];}
function pendingApprovals(){return allApprovals().filter(r=>!r.status||r.status==="pending");}

/* ── 라우터 ── */
function parseHash(){
  const h=(location.hash||"").replace(/^#\/?/,"");
  const [a,b]=h.split("/");
  if(a==="apps"&&b)return {screen:"app",param:decodeURIComponent(b)};
  if(a==="records")return {screen:"records",param:REC_IDS.includes(b)?b:"approvals"};
  if(["today","apps","tasks","automation"].includes(a))return {screen:a};
  return {screen:"today"};
}
function go(hash){if(location.hash===hash)route();else location.hash=hash;}
function route(){
  const {screen,param}=parseHash();
  CURRENT=screen;
  if(screen==="app")SELECTED_APP=param;
  if(screen==="records")REC_TAB=param;
  renderScreen({fresh:true});
}
window.addEventListener("hashchange",route);

/* ── 상단 커맨드바 (표적 갱신) ── */
function codexState(){
  if(!HQ)return {cls:"",label:"연결 안 됨",detail:LOCAL.mode==="live"?"HQ 상태를 읽지 못했습니다.":"휴대용 보기 — Codex 상태 없음"};
  const r=HQ.runner||{};
  if(HQ.control?.paused)return {cls:"warn",label:"일시정지",detail:"모든 자동작업이 멈춰 있습니다."};
  if(r.state==="running")return {cls:"busy",label:"작업 중",detail:`${appName(HQ.runningTask?.app)} · ${HQ.runningTask?.title||""}`};
  if(r.state==="not_running")return {cls:"warn",label:"실행기 꺼짐",detail:r.managed?"HQ가 자동으로 다시 켜는 중입니다.":"터미널에서 codex-runner를 켜세요."};
  if(r.codex==="not_connected")return {cls:"warn",label:"Codex 미연결",detail:r.managed?"맥에서 codex login 한 번만 하면 이후 자동 실행됩니다.":(r.codexDetail||"codex login이 필요합니다.")};
  return {cls:"on",label:"대기 중",detail:`대기 ${HQ.pending||0}건 · 준비 완료 · ${ago(r.at)}`};
}
function healthSummary(){
  const f=familyApps();
  const down=f.filter(a=>a.health==="down").length, warn=f.filter(a=>a.health==="warn").length;
  if(down)return {cls:"bad",text:`장애 ${down}건 — 즉시 확인`};
  if(warn)return {cls:"warn",text:`주의 ${warn}건`};
  const known=f.filter(a=>a.health==="ok").length;
  if(known===0)return {cls:"",text:"상태 확인 중"};
  return {cls:"ok",text:`${f.length}개 앱 정상 운영`};
}
function updateChrome(){
  const cx=codexState(),pill=$("#codexPill");
  pill.className="codex-pill "+cx.cls;$("#cxState").textContent=cx.label;$("#cxDetail").textContent=cx.detail;
  const h=healthSummary(),hb=$("#cbHealth");
  hb.className="cb-health "+h.cls;$("#cbHealthText").textContent=h.text;
  $("#appSignals").innerHTML=familyApps().map(a=>{const c=appRunning(a.id)?"busy":({ok:"ok",warn:"warn",down:"bad"}[a.health]||"");return `<a class="sig ${c}" href="#/apps/${attr(a.id)}" title="${attr(a.name)} · ${esc((HEALTH[a.health]||HEALTH.unknown)[0])}"><i></i><b>${esc(a.name.replace(/봄$/,""))}</b></a>`;}).join("");
  const live=LOCAL.mode==="live"&&!preview,bd=$("#modeBadge");
  bd.textContent=preview?"PREVIEW":(live?"LIVE":"휴대용");bd.className="mode-badge "+(live?"live":"warn");
  buildNav();
}
function buildNav(){
  const attn=attentionItems().length;
  const pend=HQ?(HQ.pending||0)+(HQ.running||0):openCount("tasks");
  const appr=pendingApprovals().length;
  const badge={today:attn,tasks:pend,records:appr};
  const active=(id)=>(CURRENT===id||(id==="apps"&&CURRENT==="app")||(id==="records"&&CURRENT==="records"))?"active":"";
  $("#sidenav").innerHTML=NAV.map(n=>`<a class="nav-item ${active(n.id)}" href="${n.hash}" aria-current="${active(n.id)?"page":"false"}">${icon(n.icon)}<span>${esc(n.name)}</span>${badge[n.id]?`<span class="nav-badge">${badge[n.id]}</span>`:""}</a>`).join("")
    +`<div class="nav-sep"></div>`
    +`<a class="nav-item nav-foot" href="./office.html">${icon("office")}<span>오피스</span></a>`;
  $("#tabbar").innerHTML=NAV.map(n=>`<a class="tab ${active(n.id)}" href="${n.hash}">${icon(n.icon)}${esc(n.name)}</a>`).join("");
}

/* ── 화면 렌더 (스크롤·포커스 보존) ── */
function renderScreen(opts={}){
  const s=$("#screen");
  const keepScroll=!opts.fresh?s.scrollTop:0;
  s.innerHTML=(RENDER[CURRENT]||renderNotReady)();
  s.scrollTop=keepScroll;
  if(opts.fresh)s.focus({preventScroll:true});
  bindScreen();buildNav();
}
function safeToRerender(){
  if($("#taskDialog")?.open||$("#recordDialog")?.open||$("#paletteDialog")?.open)return false;
  const a=document.activeElement;
  if(a&&$("#screen").contains(a)&&["INPUT","TEXTAREA","SELECT"].includes(a.tagName))return false;
  return true;
}
function stateSignature(){
  const hq=HQ?{p:HQ.pending,r:HQ.running,d:HQ.done,f:HQ.failed,ps:HQ.control?.paused,ic:HQ.control?.intakeClosed,rs:HQ.runner?.state,cx:HQ.runner?.codex,rt:HQ.runningTask?.id||HQ.runningTask?.title||""}:null;
  return JSON.stringify({hq,rec:LOCAL.records});
}
function title(k,t,d,a=""){return `<header class="page-head"><div><small>${esc(k)}</small><h1>${esc(t)}</h1>${d?`<p>${esc(d)}</p>`:""}</div>${a?`<div class="head-actions">${a}</div>`:""}</header>`;}
function kpi(v,l,tone="",note="",go=""){const inner=`<b>${esc(v)}</b><span>${esc(l)}</span>${note?`<small>${esc(note)}</small>`:`<small class="kpi-go">${go?"눌러서 보기 →":""}</small>`}`;return go?`<a class="kpi ${tone} clickable" href="${attr(go)}" aria-label="${attr(l)} 자세히">${inner}</a>`:`<div class="kpi ${tone}">${inner}</div>`;}
function reviewMinutesLabel(m){if(m===undefined||m===null)return "자동 점검";if(m<=0)return "자동 점검 꺼짐";if(m<60)return `${m}분마다`;if(m%60===0)return `${m/60}시간마다`;return `${Math.round(m/6)/10}시간마다`;}
function reviewLabel(){return reviewMinutesLabel(HQ?.reviewEveryMinutes);}
function reviewIntervalSelect(){
  const min=HQ?.reviewMinMinutes||10;
  const presets=[[10,"가장 자주 · 10분마다"],[30,"30분마다"],[60,"1시간마다"],[120,"2시간마다"],[240,"4시간마다"],[720,"12시간마다 (하루 2번)"],[1440,"하루 1번"],[0,"자동 점검 끔"]].filter(([v])=>v===0||v>=min);
  const cur=HQ?.reviewEveryMinutes??120;
  let opts=presets.map(([v,l])=>`<option value="${v}" ${v===cur?"selected":""}>${esc(l)}</option>`).join("");
  if(cur>0&&!presets.some(([v])=>v===cur))opts=`<option value="${cur}" selected>현재: ${esc(reviewMinutesLabel(cur))}</option>`+opts;
  return `<select id="reviewInterval" aria-label="자동 점검 주기">${opts}</select>`;
}
async function saveReviewSchedule(){
  if(preview){showToast("본부(앱) 실행 중일 때만 조절할 수 있어요.","warn");return;}
  const v=Number($("#reviewInterval")?.value??120);
  const data=await fetchJson("/api/review-schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({everyMinutes:v})});
  try{HQ=await fetchJson("/api/hq-status");}catch{}
  showToast(data.everyMinutes>0?`점검 주기를 ${reviewMinutesLabel(data.everyMinutes)}로 바꿨습니다 — 바로 적용됩니다.`:"자동 점검을 껐습니다.","good");
  updateChrome();renderScreen();
}
function panel(l,body,extra="",cls=""){return `<section class="panel ${cls}"><div class="panel-title"><span>${esc(l)}</span>${extra}</div>${body}</section>`;}
function empty(main,sub=""){return `<div class="empty-state">${icon("spark")}<b>${esc(main)}</b>${sub?`<p>${esc(sub)}</p>`:""}</div>`;}
function button(label,action,kind="ghost",extra="",ic=""){return `<button class="button ${kind}" type="button" data-action="${action}" ${extra}>${ic?icon(ic):""}${label}</button>`;}

/* ── 확인할 일 ── */
function attentionItems(){
  if(!SNAP)return [];
  const items=[];
  pendingApprovals().forEach(r=>items.push({label:`결재 대기: ${r.title||r.decision||"결정 필요"}`,go:"#/records/approvals",kind:"review"}));
  records("tasks").filter(r=>["blocked","approval_pending","in_review"].includes(r.status)).forEach(r=>items.push({label:`${simpleStatus(r.status)} 업무: ${r.title}`,go:"#/tasks",kind:r.status==="blocked"?"bad":"review"}));
  familyApps().filter(a=>a.health&&a.health!=="ok"&&a.health!=="unknown").forEach(a=>items.push({label:`${a.name} ${(HEALTH[a.health]||HEALTH.unknown)[0]}`,go:`#/apps/${a.id}`,kind:a.health==="down"?"bad":"warn"}));
  (SNAP.operations?.humanTasks||[]).slice(0,3).forEach(t=>items.push({label:t,go:"#/records/settings",kind:"warn"}));
  return items;
}
function recentActivity(limit=8){
  const all=Object.entries(LOCAL.records||{}).flatMap(([c,l])=>(l||[]).map(r=>({...r,collection:c})));
  return all.filter(r=>r.updatedAt||r.createdAt).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt))).slice(0,limit);
}

/* ── 오늘: 다열 미션 컨트롤 ── */
function renderToday(){
  const attn=attentionItems(),autos=pendingApprovals().filter(a=>a.requestedBy==="auto-review"&&a.id);
  const cx=codexState(),acts=recentActivity();
  const blocked=records("tasks").filter(t=>t.status==="blocked").length+familyApps().filter(a=>a.health==="down").length;
  const review=records("tasks").filter(t=>["in_review","approval_pending"].includes(t.status)).length+pendingApprovals().length;
  const dateLine=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"full"}).format(new Date());
  return `${title("MISSION CONTROL","오늘",dateLine,`${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary","","play"):button("모든 자동작업 일시정지","pause-all","danger","","pause")}`)}
  <div class="kpi-row">
    ${kpi(HQ?HQ.pending??0:openCount("tasks"),"대기 중 요청",HQ?.pending?"accent":"","","#/tasks")}
    ${kpi(HQ?.running??0,"Codex 작업 중",HQ?.running?"accent":"","","#/automation")}
    ${kpi(review,"회장 확인 필요",review?"warn":"","","#/records/approvals")}
    ${kpi(blocked,"막힘·장애",blocked?"bad":"good",blocked?"먼저 확인하세요":undefined,"#/apps")}
  </div>
  <div class="grid main-side">
    <div>
      ${panel("내가 확인할 일",attn.length?`<div class="attn-list">${attn.slice(0,7).map(it=>`<button class="attn-item ${it.kind||""}" type="button" data-go="${attr(it.go)}"><span class="ai-ic">${icon(it.kind==="review"?"gavel":"alert")}</span><b>${esc(it.label)}</b><span class="ai-go">${icon("chev")}</span></button>`).join("")}</div>`:empty("지금 확인할 일이 없습니다.","막힘·결재·경고가 생기면 여기에 먼저 나타나요."),attn.length?`<span class="pt-count">${attn.length}</span>`:"")}
      ${autos.length?panel("결재 상신 — 시스템 개선 제안",`<div class="approval-list">${autos.slice(0,3).map(r=>decreeCard(r)).join("")}</div>`,`<span class="pt-count">${autos.length}</span>`):""}
      ${panel("포트폴리오 현황 — 6개 앱",matrixTable(),`<a class="status neutral" href="#/apps">전체 보기</a>`,"flush")}
    </div>
    <div>
      ${panel("Codex 실행기",`<div class="codex-line"><span class="status ${cx.cls==="on"?"good":cx.cls==="busy"?"accent":cx.cls==="warn"?"warn":"neutral"}">${esc(cx.label)}</span><p>${esc(cx.detail)}</p></div>
        ${HQ?.runningTask?`<p class="fine">진행: ${esc(appName(HQ.runningTask.app))} · ${esc(HQ.runningTask.title||"")} (${ago(HQ.runningTask.lease?.heartbeatAt)} 신호)</p>`:""}
        ${HQ?.nextTask?`<p class="fine">다음: ${esc(appName(HQ.nextTask.app))} · ${esc(HQ.nextTask.title||"")}</p>`:""}
        <div class="today-actions" style="margin-top:12px"><a class="button ghost" href="#/automation">${icon("chev")}자동화 현황판</a></div>`)}
      ${panel("자동 운영",`<div class="simple-list">
        <div><b>${reviewLabel()} 종합 점검 → 결재 상신</b>${tonePill(autos.length?"gold":"good",autos.length?`상신 ${autos.length}건`:"이상 없음")}</div>
        <div><b>10분 간격 앱 감시(워치독)</b>${tonePill(LOCAL.mode==="live"?"good":"neutral",LOCAL.mode==="live"?"가동":"본부 꺼짐")}</div>
        <div><b>Codex 실행기 자동 관리</b>${tonePill(HQ?.runner?.managed?(HQ?.runner?.codex==="connected"?"good":"warn"):"neutral",HQ?.runner?.managed?(HQ?.runner?.codex==="connected"?"자동 실행 중":"로그인 대기"):"수동")}</div>
      </div>`)}
      ${panel("최근 활동",acts.length?`<div class="timeline">${acts.map(r=>`<div><time>${fmt(r.updatedAt||r.createdAt)}</time><div><b>${esc(COLLECTION_LABEL[r.collection]||r.collection)} · ${esc(r.title||"기록")}</b><p>${esc(simpleStatus(r.status||"open"))}${r.appId?` · ${esc(appName(r.appId))}`:""}</p></div></div>`).join("")}</div>`:empty("아직 기록된 활동이 없습니다."))}
    </div>
  </div>`;
}
function matrixTable(){
  const apps=familyApps();
  if(!apps.length)return empty("등록된 앱이 없습니다.");
  return `<div style="overflow-x:auto"><table class="matrix"><thead><tr><th>앱</th><th>상태</th><th>버전</th><th>요청</th><th>다음 행동</th></tr></thead><tbody>
  ${apps.map(a=>{const[hl,tone]=HEALTH[a.health]||HEALTH.unknown;const run=appRunning(a.id);const ot=openTasksFor(a.id);
    return `<tr data-go="#/apps/${attr(a.id)}" tabindex="0" role="link" aria-label="${attr(a.name)} 상세">
    <td><span class="mx-app"><span class="mx-mark" style="--app:${accent(a.id)}">${esc(a.name[0])}</span><span><b>${esc(a.name)}</b><small>${esc(a.id)}</small></span></span></td>
    <td>${tonePill(run?"accent":tone,run?"작업 중":hl)}</td>
    <td class="mx-num">v${esc(a.version||"—")}</td>
    <td class="mx-num">${ot||"·"}</td>
    <td class="mx-next">${esc(a.nextActions?.[0]||"안정 운영")}</td></tr>`;}).join("")}
  </tbody></table></div>`;
}

/* ── 결재 문서 (decree) ── */
function decreeSerial(r){const d=String(r.id||"").replace(/\D/g,"").slice(-4);return d?`제 ${d} 호`:"—";}
function decreeCard(r){
  const auto=r.requestedBy==="auto-review";
  const st=r.status||"pending";
  const decided=["approved","held","rejected"].includes(st);
  const sign=st==="approved"?'<div class="seal" aria-label="승인 도장">승인</div>'
    :st==="held"?'<div class="seal hold" aria-label="보류 도장">보류</div>'
    :st==="rejected"?'<div class="seal reject" aria-label="반려 도장">반려</div>'
    :'<div class="sign-slot" aria-label="결재 대기"><span>결재<br/>대기</span></div>';
  const actions=!decided&&r.id?`
    ${auto?button("재가 — 승인하고 맡기기","approve-proposal","gold",`data-id="${attr(r.id)}"`,"check"):button("재가 — 승인","patch-record","gold",`data-collection="approvals" data-id="${attr(r.id)}" data-status="approved"`,"check")}
    ${button("보류","patch-record","ghost",`data-collection="approvals" data-id="${attr(r.id)}" data-status="held"`)}
    ${button("반려","patch-record","danger",`data-collection="approvals" data-id="${attr(r.id)}" data-status="rejected"`)}`
    :(!decided?'<small class="fine">스냅샷 안건 — 근거 화면에서 처리합니다.</small>':`<small class="fine">${esc(simpleStatus(st))} 처리 · ${fmt(r.updatedAt||r.createdAt)}</small>`);
  return `<article class="decree ${decided?"decided":""}">
  <div class="decree-head">
    <span class="decree-kind">${icon("gavel")}결재 상신서</span>
    <span class="decree-meta"><span>문서 <b>${esc(decreeSerial(r))}</b></span><span>상신일 <b>${fmt(r.createdAt,false)}</b></span><span>상신 <b>${auto?"자동 점검 시스템":"운영 기록"}</b></span></span>
  </div>
  <div class="decree-body">
    <span class="dc-app"><i style="--app:${accent(r.appId||r.app)}"></i>${esc(appName(r.appId||r.app))}</span>
    <h2>${esc(r.title||r.decision||"결정 필요")}</h2>
    ${r.body?`<div class="decree-sec"><b>안건 내용</b><p>${esc(r.body)}</p></div>`:""}
    ${r.recommendation?`<div class="decree-sec reco"><b>실무 권고</b><p>${esc(r.recommendation)}</p></div>`:""}
  </div>
  <div class="decree-foot">
    <div class="decree-actions">${actions}</div>
    <div class="decree-sign"><span class="fine">회장 재가</span>${sign}</div>
  </div></article>`;
}

/* ── 앱: 포트폴리오 운영 보드 ── */
function renderApps(){
  const apps=familyApps();
  return `${title("PORTFOLIO",`운영 앱 ${apps.length}개`,"registry 기준 자동 생성 — 앱이 늘면 이 화면도 자동으로 늘어납니다.")}
  <div class="portfolio-grid">${apps.map(appCard).join("")}</div>
  ${panel("본사 시스템",`<div class="simple-list">${hqSystems().map(a=>`<a href="#/apps/${attr(a.id)}"><b>${esc(a.name)} · robom.kr</b>${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}</a>`).join("")}<div><b>ROBOM HQ (이 프로그램)</b>${tonePill("good",`v${APP_VERSION} 실행 중`)}</div></div>`)}`;
}
function appCard(a){
  const[hl,tone]=HEALTH[a.health]||HEALTH.unknown;const run=appRunning(a.id);const ot=openTasksFor(a.id);
  return `<article class="product-card" style="--app:${accent(a.id)}">
  <header><span class="pc-id"><span class="pc-mark" style="--app:${accent(a.id)}">${esc(a.name[0])}</span><span><h2>${esc(a.name)}</h2><small>${esc(a.id)} · v${esc(a.version||"—")}</small></span></span>${tonePill(run?"accent":tone,run?"작업 중":hl)}</header>
  <p class="pc-value">${esc(roleOf(a))}</p>
  <dl class="pc-stats">
    <div><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd></div>
    <div><dt>열린 요청</dt><dd>${ot?`${ot}건`:"없음"}</dd></div>
    <div><dt>열린 PR</dt><dd>${a.openPrs?.length||0}</dd></div>
    <div><dt>다음 행동</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></div>
  </dl>
  <footer><a class="button ghost" href="#/apps/${attr(a.id)}">자세히</a>${a.url?`<a class="button secondary" href="${attr(a.url)}" target="_blank" rel="noopener">앱 사용</a>`:""}${button("수정 요청","new-task-for","primary",`data-app-id="${attr(a.id)}"`,"plus")}</footer></article>`;
}
function renderAppDetail(){
  const a=appById(SELECTED_APP)||familyApps()[0];if(!a)return renderApps();
  const[hl,tone]=HEALTH[a.health]||HEALTH.unknown;const ci=a.ci?.[0];
  const tasks=records("tasks").filter(t=>t.appId===a.id);
  return `${title("APP",a.name,"사용자 영향부터, 기술 정보는 아래.",`${a.url?`<a class="button primary" href="${attr(a.url)}" target="_blank" rel="noopener">운영 앱 열기</a>`:""}${button("수정 요청","new-task-for","secondary",`data-app-id="${attr(a.id)}"`,"plus")}`)}
  <div class="product-hero" style="--app:${accent(a.id)}"><div><span class="ph-k">현재 운영 버전</span><h2>v${esc(a.version||"—")}</h2>${tonePill(tone,hl)}</div>
  <dl class="data-list"><dt>사용자 가치</dt><dd>${esc(roleOf(a))}</dd><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd><dt>다음 개선</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></dl></div>
  <div class="detail-grid">
  ${panel("진행 중 업무",tasks.length?`<div class="record-list">${tasks.slice(0,6).map(taskRow).join("")}</div>`:empty("이 앱에 등록된 업무가 없습니다."))}
  ${panel("기술 정보 (근거)",`<dl class="data-list"><dt>저장소</dt><dd>${esc(a.repo||"—")}</dd><dt>브랜치·SHA</dt><dd>${esc(a.git?.branch||"main")} · ${esc(a.git?.sha||a.production?.deployedSha?.slice(0,7)||"—")}</dd><dt>배포</dt><dd>${esc(a.deployTarget||"—")}</dd><dt>CI</dt><dd>${esc(ci?`${ci.name} · ${ci.conclusion||ci.status}`:"GitHub 연결 시 표시")}</dd><dt>열린 PR</dt><dd>${a.openPrs?.length||0}</dd></dl>`)}</div>`;
}

/* ── 업무 ── */
function taskRow(r){
  const thumbs=(r.attachments||[]).length&&LOCAL.mode==="live"?`<div class="record-thumbs">${r.attachments.slice(0,4).map(id=>`<img src="/api/attachments/${encodeURIComponent(id)}" alt="첨부" loading="lazy" />`).join("")}</div>`:"";
  return `<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title)}</h3>${r.autonomy?`<small>${esc(AUTONOMY_LABEL[r.autonomy]||r.autonomy)}</small>`:""}</div>${statusPill(r.status)}</header>${r.problem||r.body?`<p>${esc(r.problem||r.body)}</p>`:""}${r.desiredOutcome?`<p class="outcome">→ ${esc(r.desiredOutcome)}</p>`:""}${thumbs}<footer>${["in_review","approval_pending"].includes(r.status)?button("확인 완료","patch-record","primary",`data-collection="tasks" data-id="${attr(r.id)}" data-status="completed"`,"check"):""}${["queued","blocked"].includes(r.status)?button("취소","patch-record","ghost",`data-collection="tasks" data-id="${attr(r.id)}" data-status="cancelled"`):""}${button("작업 패킷","download-bundle","ghost",`data-id="${attr(r.id)}"`)}</footer></article>`;
}
function renderTasks(){
  const list=records("tasks");
  return `${title("WORK","업무","말하듯 요청하면 Codex 대기열에 자동 등록됩니다.",button("새 수정 요청","new-task","primary","","plus"))}
  <div class="kpi-row">${kpi(HQ?HQ.pending??0:openCount("tasks"),"대기",HQ?.pending?"accent":"")}${kpi(HQ?.running??"—","작업 중",HQ?.running?"accent":"")}${kpi(list.filter(t=>["in_review","approval_pending"].includes(t.status)).length,"확인 필요","warn")}${kpi(list.filter(t=>t.status==="blocked").length,"막힘",list.some(t=>t.status==="blocked")?"bad":"")}</div>
  ${list.length?`<div class="record-list">${list.map(taskRow).join("")}</div>`:empty("등록된 업무가 없습니다.","'새 수정 요청'을 눌러 어떤 앱의 무엇이 불편한지 말하듯 적어 주세요. 사진도 붙일 수 있어요.")}`;
}

/* ── 자동화 (구 Codex) ── */
function renderAutomation(){
  const cx=codexState();
  const autos=pendingApprovals().filter(a=>a.requestedBy==="auto-review").length;
  return `${title("AUTOMATION","자동화 현황판","Codex 실행기와 자동 점검이 지금 무엇을 하는지 보는 화면입니다.")}
  <div class="kpi-row">${kpi(HQ?.pending??"—","다음 대기")}${kpi(HQ?.running??"—","실행 중",HQ?.running?"accent":"")}${kpi(HQ?.done??"—","완료","good")}${kpi(HQ?.failed??"—","실패·막힘",HQ?.failed?"bad":"")}</div>
  ${panel("현재 상태",`<div class="codex-line"><span class="status ${cx.cls==="on"?"good":cx.cls==="busy"?"accent":cx.cls==="warn"?"warn":"neutral"}">${esc(cx.label)}</span><p>${esc(cx.detail)}</p></div>`)}
  ${HQ?.runningTask?panel("실행 중 작업",`<div class="record-list"><article><header><div><span>${esc(appName(HQ.runningTask.app))}</span><h3>${esc(HQ.runningTask.title)}</h3></div>${tonePill("accent","작업 중")}</header><p>시작 ${fmt(HQ.runningTask.lease?.claimedAt)} · 마지막 신호 ${ago(HQ.runningTask.lease?.heartbeatAt)}</p></article></div>`):""}
  ${HQ?.nextTask?panel("다음 대기",`<div class="simple-list"><div><b>${esc(appName(HQ.nextTask.app))} · ${esc(HQ.nextTask.title)}</b>${tonePill("neutral","대기")}</div></div>`):""}
  ${panel("자동 점검 → 결재",`<div class="simple-list">
    <div><b>${reviewLabel()} 6개 앱 종합 점검 후 개선 제안을 결재로 상신</b>${tonePill(autos?"gold":"good",autos?`상신 ${autos}건 대기`:"이상 없음")}</div>
    <a href="#/records/approvals"><b>결재함 열기</b><span class="status neutral">이동</span></a>
  </div>`)}
  ${HQ?.health?panel("결정론적 점검 결과 (AI 없이 자동)",`<div class="kpi-row" style="margin-bottom:0">${kpi(HQ.health.pass??0,"정상","good")}${kpi(HQ.health.degraded??0,"확인 필요",HQ.health.degraded?"warn":"")}${kpi(HQ.health.fail??0,"장애",HQ.health.fail?"bad":"")}${kpi(HQ.health.openIncidents??0,"열린 사건",HQ.health.openIncidents?"warn":"")}${kpi(HQ.health.unavailable??0,"점검 불가")}</div><p class="fine">실제 신호(운영 응답·버전·CI·데이터 신선도·PR)를 규칙으로 판정합니다. 같은 문제는 반복 상신하지 않고, 회복되면 자동으로 닫힙니다.</p>`):""}
  ${panel("제어",`<div class="today-actions">${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary","","play"):button("모든 자동작업 일시정지","pause-all","danger","","pause")}${HQ?.control?.intakeClosed?button("새 작업 접수 재개","open-intake","secondary"):button("새 작업 접수 중지","close-intake","ghost")}</div>`)}
  ${panel("연결 방법 (맥에서 딱 한 번)",`<ol class="number-list"><li>맥 터미널에서 한 번만: <code>codex login</code> — 구독 계정 로그인 (API 키 금지)</li><li>끝. ROBOM HQ가 실행기를 자동으로 켜고 감시합니다 — 이 앱을 켜 두기만 하면 승인한 작업이 자동 처리됩니다.</li></ol><p class="fine">${HQ?.runner?.managed?"실행기 자동 관리가 켜져 있습니다. ":""}로그인 전에는 미연결로 정직하게 표시하며, 요청은 대기열에 안전 보관됩니다. 실제 코드 수정에는 맥에 로봄 저장소 클론이 필요하며, HQ가 <code>~/robom-labs/robom</code> 등을 자동으로 찾습니다.</p>`)}`;
}

/* ── 기록: 그룹형 서브내비 ── */
function renderRecords(){
  const appr=pendingApprovals().length;
  return `${title("RECORDS","기록·설정","결재·기억·운영 기록·시스템을 한곳에서.")}
  <div class="records-wrap">
    <nav class="rec-nav" aria-label="기록 메뉴">
      ${REC_SECTIONS.map(g=>`<div class="rec-group"><b>${esc(g.group)}</b>${g.items.map(([id,label,ic])=>`<a class="rec-link ${REC_TAB===id?"active":""}" href="#/records/${id}">${icon(ic)}${esc(label)}${id==="approvals"&&appr?`<span class="nav-badge">${appr}</span>`:""}</a>`).join("")}</div>`).join("")}
      <div class="rec-group"><b>부가기능</b><a class="rec-link" href="./office.html">${icon("office")}로봄 오피스</a></div>
    </nav>
    <div class="rec-body">${recBody()}</div>
  </div>`;
}
function recBody(){
  switch(REC_TAB){
    case "approvals":{
      const items=allApprovals();
      const open=items.filter(r=>!r.status||r.status==="pending");
      const done=items.filter(r=>r.status&&r.status!=="pending");
      return `<div class="panel-actions">${button("안건 상신","new-record","gold",'data-collection="approvals"',"plus")}</div>
      ${open.length?`<div class="approval-list">${open.map(r=>decreeCard(r)).join("")}</div>`:empty("회장 재가가 필요한 안건이 없습니다.","비용·계정·복구 불가능한 결정, 그리고 시스템 개선 제안이 여기로 올라와요.")}
      ${done.length?`<section class="panel" style="margin-top:16px"><div class="panel-title"><span>처리 완료</span><span class="pt-count">${done.length}</span></div><div class="approval-list">${done.slice(0,6).map(r=>decreeCard(r)).join("")}</div></section>`:""}`;
    }
    case "ideas":return ideasBody();
    case "memory":return `<div class="memory-search"><input id="memoryInput" type="search" placeholder="예: 청약봄 가격 비교를 왜 보류했지" value="${attr(MEMORY_Q)}" />${button("검색","search-memory","primary","","search")}</div><div id="memoryResults">${memoryResults(MEMORY_Q)}</div>`;
    case "incidents":{
      const down=familyApps().filter(a=>a.health==="down");
      return `<div class="panel-actions">${button("장애 기록","new-record","primary",'data-collection="incidents"',"plus")}</div>${down.length?`<div class="incident-banner">${icon("alert")}<b>운영 장애 ${down.length}건</b><span>${esc(down.map(a=>a.name).join(", "))}</span></div>`:""}${recordList("incidents",{emptyTitle:"기록된 장애가 없습니다."})}`;
    }
    case "delivery":return `<div class="delivery-list">${(SNAP.apps||[]).map(a=>`<article><div><h3>${esc(a.name)}</h3><p>${esc(a.deployTarget||"배포 방식 확인 중")}</p></div>${tonePill((HEALTH[a.health]||HEALTH.unknown)[1],(HEALTH[a.health]||HEALTH.unknown)[0])}<code>${esc(a.production?.deployedSha?.slice(0,12)||a.git?.sha||"—")}</code></article>`).join("")}</div>`;
    case "data":return `<div class="data-grid">${familyApps().map(a=>`<article><header><h2>${esc(a.name)}</h2>${tonePill(a.production?.status==="PASS"?"good":"warn",a.production?.status||"확인")}</header><dl class="data-list"><dt>운영 확인</dt><dd>${esc(a.production?.version?`v${a.production.version}`:"확인 중")}</dd><dt>신선도</dt><dd>${esc(a.production?.warnings?.[0]||"운영 기준 통과")}</dd></dl></article>`).join("")}</div>`;
    case "backup":return `<div class="panel-actions">${button("지금 백업","backup","primary","","save")}${button("JSON 내보내기","export","ghost")}</div><dl class="data-list"><dt>저장 위치</dt><dd>${LOCAL.mode==="live"?"이 컴퓨터의 비공개 runtime 폴더":"브라우저 휴대용 저장"}</dd><dt>마지막 백업</dt><dd>${esc(LOCAL.meta?.lastBackupAt?fmt(LOCAL.meta.lastBackupAt):"아직 없음")}</dd><dt>백업 대상</dt><dd>회의·결재·업무·장애 기록과 감사 로그</dd></dl>`;
    case "connections":return connectionMarkup();
    case "security":return `<div class="security-grid">${(SNAP.operations?.security||[]).map(c=>`<article>${tonePill(c.ok?"good":"warn",c.ok?"통과":"확인")}<h3>${esc(c.name)}</h3><p>${esc(c.note||"")}</p></article>`).join("")||empty("보안 점검 항목을 불러오지 못했습니다.")}</div>`;
    case "settings":return `<div class="settings-list">
      <article><div><h3>현재 모드</h3><p>${LOCAL.mode==="live"?"실시간 로컬 본부":"휴대용 보기"}</p></div>${tonePill(LOCAL.mode==="live"?"good":"neutral",LOCAL.mode==="live"?"연결됨":"제한됨")}</article>
      <article><div><h3>프로그램 버전</h3><p>ROBOM HQ v${esc(APP_VERSION)} — 상단 금색 버전 칩과 동일하면 최신 설치본입니다.</p></div>${tonePill("gold",`v${APP_VERSION}`)}</article>
      <article><div><h3>휴대폰 연결</h3><p>${HQ?.remote==="token"?"토큰 인증으로 사설망 접속 허용됨":"이 컴퓨터 전용(127.0.0.1) — docs/hq/REMOTE-ACCESS.md"}</p></div>${tonePill(HQ?.remote==="token"?"accent":"good",HQ?.remote==="token"?"원격 허용":"비공개")}</article>
      <article><div><h3>추가 운영비</h3><p>유료 API·상시 유료 서버 없이 로컬 Node.js와 GitHub 무료 범위만 사용.</p></div>${tonePill("good","0원")}</article>
      <article class="col"><div style="width:100%"><h3>자동 점검 주기</h3><p>얼마나 자주 6개 앱을 점검할지 정합니다. 점검은 무료라 자주 해도 부담 없어요(최소 ${HQ?.reviewMinMinutes||10}분).</p>
        <div class="sched-row">${reviewIntervalSelect()}${button("적용","apply-review-schedule","gold")}<span class="sched-now">${tonePill(HQ?.reviewEveryMinutes>0?"accent":"neutral",reviewMinutesLabel(HQ?.reviewEveryMinutes))}</span></div>
      </div></article>
      <article><div><h3>회장이 직접 할 일</h3><p>${(SNAP.operations?.humanTasks||[]).slice(0,3).map(esc).join(" · ")||"현재 없음"}</p></div></article>
      <article><div><h3>부가기능 · 로봄 오피스</h3><p>살아있는 6층 오피스(실제 이벤트 연동)</p></div><a class="button ghost" href="./office.html">오피스 보기</a></article>
    </div>`;
    default:return empty("준비되지 않은 탭입니다.");
  }
}
function memoryResults(q){const all=Object.entries(LOCAL.records||{}).flatMap(([c,l])=>(l||[]).map(r=>({...r,collection:c}))).filter(r=>r.status!=="archived");const n=q.trim().toLowerCase(),found=n?all.filter(r=>JSON.stringify(r).toLowerCase().includes(n)):all.slice(0,12);return found.length?`<div class="memory-list">${found.map(r=>`<article><span>${esc(COLLECTION_LABEL[r.collection]||r.collection)} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||"기록")}</h3><p>${esc(r.body||r.problem||"")}</p>${r.appId?`<small class="fine">${esc(appName(r.appId))}</small>`:""}</article>`).join("")}</div>`:empty(n?"검색 결과가 없습니다.":"아직 회사 기억이 없습니다.","결재·업무·아이디어가 쌓이면 여기서 검색할 수 있어요.")}

/* ── 아이디어 메모장 (앱 선택 + 자유 메모, 결재로 올릴 필요 없는 가벼운 기록) ── */
function ideasBody(){
  const notes=records("notes").filter(r=>r.status!=="archived");
  const opts=`<option value="">회사 전체</option>`+familyApps().map(a=>`<option value="${attr(a.id)}">${esc(a.name)}</option>`).join("")+`<option value="robom">로봄 본사</option>`;
  return `<div class="memo-compose">
    <div class="memo-row"><label>어느 앱 아이디어인가요?</label><select id="memoApp">${opts}</select></div>
    <textarea id="memoText" placeholder="떠오른 아이디어·개선점을 자유롭게 적어 두세요. 결재로 올릴 것 없이 그냥 메모입니다."></textarea>
    <div class="memo-foot">${button("메모 저장","save-memo","gold","","plus")}</div>
  </div>
  ${notes.length?`<div class="memo-list">${notes.map(memoCard).join("")}</div>`:empty("아직 저장한 아이디어가 없습니다.","위에서 앱을 고르고 떠오른 생각을 적어 저장해 보세요.")}`;
}
function memoCard(r){
  return `<article class="memo-card" ${r.appId?`style="--app:${accent(r.appId)}"`:""}><div class="mc-top"><span class="mc-app">${esc(r.appId?appName(r.appId):"회사 전체")}</span><time>${fmt(r.createdAt)}</time></div><p>${esc(r.body||r.title||"")}</p><button class="mc-del" type="button" data-action="delete-memo" data-id="${attr(r.id)}">삭제</button></article>`;
}
async function saveMemo(){
  const text=($("#memoText")?.value||"").trim();
  if(!text){showToast("내용을 적어 주세요.","warn");return;}
  const appId=$("#memoApp")?.value||"";
  const payload={title:text.slice(0,40).replace(/\s+/g," ")||"메모",body:text,appId,priority:"normal"};
  if(!preview){const data=await fetchJson("/api/records/notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});applyState(data.state);}
  else{const l=LOCAL.records.notes||=[];l.unshift({...payload,id:`local-${Date.now()}`,status:"active",createdAt:new Date().toISOString()});savePortable();}
  showToast("아이디어를 저장했습니다.","good");renderScreen();
}
async function deleteMemo(id){
  if(!id)return;
  if(!preview){const data=await fetchJson(`/api/records/notes/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"archived"})});applyState(data.state);}
  else{const r=(LOCAL.records.notes||[]).find(x=>x.id===id);if(r)r.status="archived";savePortable();}
  showToast("메모를 정리했습니다.","good");renderScreen();
}
function connectionMarkup(){const c=SNAP.connections||{};return `<div class="connection-list">${[["로컬 본부",LOCAL.mode==="live","실시간 기록·백업"],["GitHub",String(c.github).startsWith("connected"),c.github],["작업 이벤트",c.events==="connected",c.events],["Claude Code",!String(c.claudeCode).includes("pending"),c.claudeCode],["Codex 실행기",HQ?.runner?.codex==="connected","codex-runner"],["휴대폰 원격",HQ?.remote==="token","토큰 인증 사설망"]].map(([nm,ok,d])=>`<div>${tonePill(ok?"good":"neutral",ok?"연결":"대기")}<b>${esc(nm)}</b><span>${esc(d===true||d===false?"":(d||""))}</span></div>`).join("")}</div>`;}
function recordList(collection,opt={}){const items=opt.items||records(collection);return items.length?`<div class="record-list">${items.map(r=>`<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||COLLECTION_LABEL[collection]||"기록")}</h3></div>${statusPill(r.status||"open")}</header>${r.body?`<p>${esc(r.body)}</p>`:""}</article>`).join("")}</div>`:empty(opt.emptyTitle||`저장된 ${COLLECTION_LABEL[collection]||"기록"}이 없습니다.`);}
function renderNotReady(){return `${title("ROBOM HQ","로봄 본부","실제 연결 상태를 기준으로 표시합니다.")}${empty("표시할 정보가 없습니다.")}`;}

const RENDER={today:renderToday,apps:renderApps,app:renderAppDetail,tasks:renderTasks,automation:renderAutomation,records:renderRecords};

/* ── 토스트 ── */
function showToast(m,tone=""){const t=$("#toast");t.textContent=m;t.className=`toast show ${tone}`;clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove("show"),2600);}

/* ── 이미지 첨부 ── */
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

/* ── 다이얼로그·쓰기 ── */
function openTaskDialog(appId=""){ATTACH=[];renderThumbs();const d=$("#taskDialog");$("#taskApp").innerHTML=familyApps().map(a=>`<option value="${attr(a.id)}" ${a.id===appId?"selected":""}>${esc(a.name)}</option>`).join("")+`<option value="robom" ${appId==="robom"?"selected":""}>로봄 웹(robom.kr)</option>`;$("#taskTitle").value="";$("#taskProblem").value="";$("#taskOutcome").value="";$("#taskPreserve").value="";$("#taskFile").value="";d.showModal();setTimeout(()=>$("#taskTitle").focus(),30);}
async function saveTask(form){const fd=new FormData(form);
  const payload={title:String(fd.get("title")||"").trim(),appId:String(fd.get("appId")||""),problem:String(fd.get("problem")||"").trim(),desiredOutcome:String(fd.get("desiredOutcome")||"").trim(),priority:String(fd.get("priority")||"normal"),autonomy:String(fd.get("autonomy")||"implement_and_review"),status:"queued"};
  const pre=String(fd.get("mustPreserve")||"").trim();if(pre)payload.mustPreserve=pre;
  const ids=ATTACH.filter(a=>a.id).map(a=>a.id);if(ids.length)payload.attachments=ids;
  if(!payload.title)return;
  if(!preview){const data=await fetchJson("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});applyState(data.state);showToast("요청을 Codex 대기열에 넣었습니다.","good");try{HQ=await fetchJson("/api/hq-status");}catch{}}
  else{const l=LOCAL.records.tasks||=[];l.unshift({...payload,id:`local-${Date.now()}`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});savePortable();showToast("미리보기 모드: 임시 저장. 본부에서 다시 등록해 주세요.","warn");}
  $("#taskDialog").close();updateChrome();renderScreen();
}
function openRecord(collection,titleText=""){const d=$("#recordDialog");$("#recordCollection").value=collection;$("#dialogEyebrow").textContent=COLLECTION_LABEL[collection]||"기록";$("#dialogTitle").textContent=collection==="approvals"?"새 결재 상신":`새 ${COLLECTION_LABEL[collection]||"기록"}`;$("#recordTitle").value=titleText;$("#recordBody").value="";$("#recordApp").innerHTML=`<option value="">회사 전체</option>`+(SNAP.apps||[]).map(a=>`<option value="${attr(a.id)}">${esc(a.name)}</option>`).join("");d.showModal();setTimeout(()=>$("#recordTitle").focus(),30);}
async function saveRecord(form){const fd=new FormData(form),c=fd.get("collection"),payload={title:String(fd.get("title")||"").trim(),body:String(fd.get("body")||"").trim(),appId:String(fd.get("appId")||""),priority:String(fd.get("priority")||"normal")};if(!payload.title)return;
  if(!preview){const data=await fetchJson(`/api/records/${encodeURIComponent(c)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});applyState(data.state);}
  else{const l=LOCAL.records[c]||=[];l.unshift({...payload,id:`local-${Date.now()}`,status:"open",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});savePortable();}
  $("#recordDialog").close();showToast(`${COLLECTION_LABEL[c]||"기록"}을 저장했습니다.`,"good");updateChrome();renderScreen();
}
async function patchRecord(collection,id,status){if(!id){showToast("스냅샷 안건은 근거 화면에서 처리합니다.");return;}
  if(!preview){const data=await fetchJson(`/api/records/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});applyState(data.state);}
  else{const r=(LOCAL.records[collection]||[]).find(x=>x.id===id);if(r)Object.assign(r,{status,updatedAt:new Date().toISOString()});savePortable();}
  showToast(collection==="approvals"?({approved:"재가했습니다 — 도장이 찍혔습니다.",held:"보류 처리했습니다.",rejected:"반려 처리했습니다."}[status]||"반영했습니다."):"반영했습니다.","good");
  updateChrome();renderScreen();}
async function approveProposal(id){if(preview){showToast("본부(앱)에서만 승인할 수 있어요.","warn");return;}
  const data=await fetchJson(`/api/approve-proposal/${encodeURIComponent(id)}`,{method:"POST"});applyState(data.state);try{HQ=await fetchJson("/api/hq-status");}catch{}showToast("재가 완료 — 업무로 등록해 Codex에 맡겼습니다.","good");updateChrome();renderScreen();}
async function setControl(ch,msg){if(preview){showToast("미리보기 모드에서는 제어할 수 없어요.","warn");return;}await fetchJson("/api/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(ch)});try{HQ=await fetchJson("/api/hq-status");}catch{}showToast(msg,"good");updateChrome();renderScreen();}
function download(name,text,type="text/markdown"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function bundleFor(r){const a=appById(r.appId);return `# 로봄 작업 패킷 ${r.id}\n\n- 대상: ${appName(r.appId)} (${a?.repo||"robom-labs/robom"})\n- 기준 SHA: ${a?.git?.sha||a?.production?.deployedSha||"최신 main"}\n- 요청: ${r.title}\n- 문제: ${r.problem||r.body||"기록 없음"}\n- 원하는 결과: ${r.desiredOutcome||"기록 없음"}\n- 유지: ${r.mustPreserve||"기존 사용자 데이터·저장 키·배포 경로"}\n- 자율 범위: ${AUTONOMY_LABEL[r.autonomy]||r.autonomy||"고친 뒤 확인 대기"}\n- 첨부: ${(r.attachments||[]).length}개\n\n실행 전에는 작업 중으로 표시하지 않는다. 완료 기준: 구현·테스트·실제 화면 확인.\n`;}
async function doBackup(){if(preview){download(`robom-hq-backup-${Date.now()}.json`,JSON.stringify({exportedAt:new Date().toISOString(),records:LOCAL.records},null,2),"application/json");showToast("미리보기 기록을 내보냈습니다.","good");return;}const data=await fetchJson("/api/backup",{method:"POST"});applyState(data.state);showToast(`백업 완료 · ${data.file||"로컬 저장"}`,"good");}
async function doExport(){if(preview){download(`robom-company-${Date.now()}.json`,JSON.stringify({snapshot:SNAP,records:LOCAL.records},null,2),"application/json");return;}const data=await fetchJson("/api/export",{method:"POST"});download(data.name||"robom-company-export.json",JSON.stringify(data.payload,null,2),"application/json");}

/* ── ⌘K 팔레트 ── */
let PAL_ITEMS=[],PAL_SEL=0;
function paletteItems(){
  const items=[];
  NAV.forEach(n=>items.push({label:`${n.name} 화면`,hint:"이동",icon:n.icon,go:n.hash}));
  familyApps().forEach(a=>items.push({label:a.name,hint:"앱 상세",icon:"apps",go:`#/apps/${a.id}`}));
  REC_SECTIONS.forEach(g=>g.items.forEach(([id,label,ic])=>items.push({label:`기록 · ${label}`,hint:"이동",icon:ic,go:`#/records/${id}`})));
  items.push({label:"새 수정 요청",hint:"명령",icon:"plus",act:()=>openTaskDialog(SELECTED_APP||"")});
  items.push({label:"안건 상신 (결재)",hint:"명령",icon:"gavel",act:()=>openRecord("approvals")});
  items.push({label:"새로고침",hint:"명령",icon:"refresh",act:load});
  items.push(HQ?.control?.paused?{label:"자동작업 다시 시작",hint:"명령",icon:"play",act:()=>setControl({paused:false},"자동작업을 다시 시작했습니다.")}:{label:"모든 자동작업 일시정지",hint:"명령",icon:"pause",act:()=>setControl({paused:true},"모든 자동작업을 일시정지했습니다.")});
  items.push({label:"지금 백업",hint:"명령",icon:"save",act:doBackup});
  items.push({label:"로봄 오피스",hint:"이동",icon:"office",act:()=>{location.href="./office.html";}});
  return items;
}
function renderPalette(q){
  const n=q.trim().toLowerCase();
  PAL_ITEMS=paletteItems().filter(it=>!n||it.label.toLowerCase().includes(n));
  PAL_SEL=Math.min(PAL_SEL,Math.max(0,PAL_ITEMS.length-1));
  $("#paletteList").innerHTML=PAL_ITEMS.length?PAL_ITEMS.map((it,i)=>`<button class="palette-item ${i===PAL_SEL?"sel":""}" type="button" data-pi="${i}" role="option" aria-selected="${i===PAL_SEL}">${icon(it.icon)}${esc(it.label)}<small>${esc(it.hint)}</small></button>`).join(""):`<div class="palette-empty">일치하는 항목이 없습니다.</div>`;
}
function openPalette(){const d=$("#paletteDialog");PAL_SEL=0;$("#paletteInput").value="";renderPalette("");d.showModal();setTimeout(()=>$("#paletteInput").focus(),20);}
function runPalette(i){const it=PAL_ITEMS[i];if(!it)return;$("#paletteDialog").close();if(it.go)go(it.go);else if(it.act)Promise.resolve(it.act()).catch(err=>showToast(err.message,"bad"));}
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#paletteDialog").open?$("#paletteDialog").close():openPalette();return;}
  if($("#paletteDialog")?.open){
    if(e.key==="ArrowDown"){e.preventDefault();PAL_SEL=Math.min(PAL_SEL+1,PAL_ITEMS.length-1);renderPalette($("#paletteInput").value);}
    else if(e.key==="ArrowUp"){e.preventDefault();PAL_SEL=Math.max(PAL_SEL-1,0);renderPalette($("#paletteInput").value);}
    else if(e.key==="Enter"){e.preventDefault();runPalette(PAL_SEL);}
  }
});

/* ── 이벤트 위임 ── */
function bindScreen(){
  $("#memoryInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){MEMORY_Q=e.target.value;$("#memoryResults").innerHTML=memoryResults(MEMORY_Q);}});
}
document.addEventListener("click",async e=>{
  const goEl=e.target.closest("[data-go]");if(goEl){go(goEl.dataset.go);return;}
  const pi=e.target.closest("[data-pi]");if(pi){runPalette(Number(pi.dataset.pi));return;}
  const rm=e.target.closest("[data-rm]");if(rm){ATTACH=ATTACH.filter(a=>a.tmpId!==rm.dataset.rm);renderThumbs();return;}
  const action=e.target.closest("[data-action]");if(!action)return;
  const a=action.dataset.action;
  try{
    if(a==="new-task")openTaskDialog(SELECTED_APP||"");
    else if(a==="new-task-for")openTaskDialog(action.dataset.appId||"");
    else if(a==="new-record")openRecord(action.dataset.collection);
    else if(a==="save-memo")await saveMemo();
    else if(a==="delete-memo")await deleteMemo(action.dataset.id);
    else if(a==="apply-review-schedule")await saveReviewSchedule();
    else if(a==="patch-record")await patchRecord(action.dataset.collection,action.dataset.id,action.dataset.status);
    else if(a==="approve-proposal")await approveProposal(action.dataset.id);
    else if(a==="pause-all")await setControl({paused:true},"모든 자동작업을 일시정지했습니다.");
    else if(a==="resume-all")await setControl({paused:false},"자동작업을 다시 시작했습니다.");
    else if(a==="close-intake")await setControl({intakeClosed:true},"새 작업 접수를 중지했습니다.");
    else if(a==="open-intake")await setControl({intakeClosed:false},"새 작업 접수를 재개했습니다.");
    else if(a==="download-bundle"){const r=records("tasks").find(x=>x.id===action.dataset.id);if(r)download(`robom-task-${r.id}.md`,bundleFor(r));}
    else if(a==="backup")await doBackup();
    else if(a==="export")await doExport();
    else if(a==="search-memory"){MEMORY_Q=$("#memoryInput")?.value||"";$("#memoryResults").innerHTML=memoryResults(MEMORY_Q);}
  }catch(err){showToast("처리하지 못했습니다. "+err.message,"bad");}
});
// 키보드: 행 링크(role=link)에서 Enter/Space로 이동
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target instanceof HTMLElement&&e.target.dataset.go&&e.target.tagName!=="BUTTON"){e.preventDefault();go(e.target.dataset.go);}
});

// 이미지: 드롭존 클릭·드래그·붙여넣기
document.addEventListener("click",e=>{if(e.target.closest("#taskDrop"))$("#taskFile").click();});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target instanceof HTMLElement&&e.target.id==="taskDrop")$("#taskFile").click();});
document.addEventListener("change",e=>{if(e.target.id==="taskFile"&&e.target.files?.length)addImages([...e.target.files]);});
document.addEventListener("dragover",e=>{const d=e.target.closest("#taskDrop");if(d){e.preventDefault();d.classList.add("drag");}});
document.addEventListener("dragleave",e=>{const d=e.target.closest("#taskDrop");if(d)d.classList.remove("drag");});
document.addEventListener("drop",e=>{const d=e.target.closest("#taskDrop");if(d){e.preventDefault();d.classList.remove("drag");if(e.dataTransfer?.files?.length)addImages([...e.dataTransfer.files]);}});
document.addEventListener("paste",e=>{if(!$("#taskDialog")?.open)return;const imgs=[...(e.clipboardData?.items||[])].filter(i=>i.type.startsWith("image/")).map(i=>i.getAsFile()).filter(Boolean);if(imgs.length){e.preventDefault();addImages(imgs);}});

/* ── 고정 크롬 이벤트 ── */
$("#refreshBtn").addEventListener("click",load);
$("#newTaskBtn").addEventListener("click",()=>openTaskDialog(SELECTED_APP||""));
$("#paletteBtn").addEventListener("click",openPalette);
$("#cbHealth").addEventListener("click",()=>go("#/apps"));
$("#codexPill").addEventListener("click",()=>go("#/automation"));
$("#paletteInput").addEventListener("input",e=>{PAL_SEL=0;renderPalette(e.target.value);});
$$('[data-dialog-close]').forEach(b=>b.addEventListener("click",()=>{const d=document.getElementById(b.dataset.dialogClose);if(d?.open)d.close("cancel");}));
$("#recordForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveRecord(e.currentTarget).catch(err=>showToast(err.message,"bad"));});
$("#taskForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveTask(e.currentTarget).catch(err=>showToast(err.message,"bad"));});

async function loadVersion(){
  try{ APP_VERSION=(window.__VER__||await fetchJson("./version.json")).version||HQ_VERSION; }catch{ APP_VERSION=HQ_VERSION; }
  const a=$("#appVersion");if(a)a.textContent="v"+APP_VERSION;
}
$("#appVersion")?.addEventListener("click",()=>showToast(`ROBOM HQ v${APP_VERSION} · 이 화면이 최신인지 확인하려면 릴리스 페이지를 보세요.`));
function tick(){try{$("#clock").textContent=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());}catch{}}
setInterval(tick,1000);tick();

/* ── 폴링: 표적 갱신 (스크롤·포커스 보존, 상태 서명 비교) ── */
setInterval(async()=>{
  if(LOCAL.mode!=="live"||preview)return;
  try{
    HQ=await fetchJson("/api/hq-status");
    try{const st=await fetchJson("/api/company-state");applyState(st);}catch{}
    updateChrome();
    const sig=stateSignature();
    if(sig!==RENDER_SIG&&safeToRerender()){RENDER_SIG=sig;renderScreen();}
  }catch{}
},20000);

if("serviceWorker" in navigator&&!preview&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
if(!location.hash)history.replaceState(null,"","#/today");
buildNav();loadVersion();load().then(()=>{RENDER_SIG=stateSignature();});
