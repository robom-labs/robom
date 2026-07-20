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
  { id: "company", name: "회사", icon: "office", hash: "#/company" },
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

const HQ_VERSION="3.3.18"; // 빌드 시 version.json이 실제 앱 버전으로 덮어씀(=다운로드한 버전)
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
// '열린 요청'은 openCount과 같은 종료 집합(OPEN_DONE)을 써야 한다. 예전엔 4개 상태만 제외해
// resolved·closed·approved·rejected·archived 업무가 열린 것으로 잘못 집계돼 배지가 실제보다 부풀었다.
function openTasksFor(id){return records("tasks").filter(t=>t.appId===id&&!OPEN_DONE.includes(t.status)).length;}
function allApprovals(){return [...(SNAP?.approvals||[]),...records("approvals")];}
function pendingApprovals(){return allApprovals().filter(r=>!r.status||r.status==="pending");}

/* ── 라우터 ── */
function parseHash(){
  const h=(location.hash||"").replace(/^#\/?/,"");
  const [a,b]=h.split("/");
  if(a==="apps"&&b)return {screen:"app",param:decodeURIComponent(b)};
  if(a==="records")return {screen:"records",param:REC_IDS.includes(b)?b:"approvals"};
  if(["today","apps","tasks","automation","company"].includes(a))return {screen:a};
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
  if(r.state==="starting")return {cls:"busy",label:"실행기 재시작 중",detail:"HQ가 실행기를 자동으로 다시 켜고 있습니다."};
  if(r.state==="not_running")return {cls:"warn",label:"실행기 꺼짐",detail:r.managed?"HQ가 자동으로 다시 켜는 중입니다.":"터미널에서 codex-runner를 켜세요."};
  if(r.codex==="quota_exhausted")return {cls:"warn",label:"용량 소진 · 지금 불가",detail:r.codexDetail||"Codex 사용량(토큰)이 소진됐습니다. 한도가 회복되면 자동으로 다시 시도합니다."};
  if(r.codex==="not_connected")return {cls:"warn",label:"Codex 미연결",detail:r.managed?"맥에서 codex login 한 번만 하면 이후 자동 실행됩니다.":(r.codexDetail||"codex login이 필요합니다.")};
  return {cls:"on",label:"대기 중",detail:`대기 ${HQ.pending||0}건 · 준비 완료 · ${ago(r.at)}`};
}
function snapFreshness(){return SNAP?._freshness||null;}
function freshnessBanner(){
  const fr=snapFreshness();if(!fr||(!fr.example&&!fr.stale))return "";
  const head=fr.example?"예시(offline) 데이터를 보고 있습니다":"회사 상태 갱신이 지연되고 있습니다";
  const sub=fr.example
    ?"실제 운영 상태가 아닙니다. 본부 서버가 실제 스냅샷을 만들면 자동으로 교체됩니다."
    :`마지막 갱신 ${freshAgeLabel(fr)}. 아래 숫자는 그 시점 기준이라 지금과 다를 수 있습니다. 감시기·네트워크를 확인하세요.`;
  return `<div class="run-banner off" style="margin:0 0 12px"><span class="dot"></span><b>${esc(head)}</b><span class="rb-sub">${esc(sub)}</span></div>`;
}
function freshAgeLabel(fr){if(!fr)return "";const ms=fr.ageMs;if(!Number.isFinite(ms))return "시각 미상";const m=Math.floor(ms/60000);if(m<60)return `${m}분 전`;const h=Math.floor(m/60);if(h<24)return `${h}시간 전`;return `${Math.floor(h/24)}일 전`;}
function healthSummary(){
  // 거짓 성과 금지: 데이터가 예시(offline)거나 갱신이 지연되면 '정상 운영'으로 위장하지 않고 미확인으로 낮춘다.
  const fr=snapFreshness();
  if(fr&&fr.example)return {cls:"warn",text:"예시 데이터 — 실제 상태 아님"};
  if(fr&&fr.stale)return {cls:"warn",text:`갱신 지연 — ${freshAgeLabel(fr)} 데이터`};
  const f=familyApps();
  const down=f.filter(a=>a.health==="down").length, warn=f.filter(a=>a.health==="warn").length;
  if(down)return {cls:"bad",text:`장애 ${down}건 — 즉시 확인`};
  if(warn)return {cls:"warn",text:`주의 ${warn}건`};
  // 거짓 PASS 금지: '정상 운영'은 전 앱이 실제 ok로 확인됐을 때만. 미확인(unknown)을 정상으로 포장하지 않는다.
  const ok=f.filter(a=>a.health==="ok").length;
  if(ok===0)return {cls:"",text:"상태 확인 중"};
  if(ok<f.length)return {cls:"warn",text:`정상 ${ok} · 확인 중 ${f.length-ok}`};
  return {cls:"ok",text:`${f.length}개 앱 정상 운영`};
}
function updateChrome(){
  const cx=codexState(),pill=$("#codexPill");
  pill.className="codex-pill "+cx.cls;$("#cxState").textContent=cx.label;$("#cxDetail").textContent=cx.detail;
  const h=healthSummary(),hb=$("#cbHealth");
  hb.className="cb-health "+h.cls;$("#cbHealthText").textContent=h.text;
  $("#appSignals").innerHTML=familyApps().map(a=>{const c=appRunning(a.id)?"busy":({ok:"ok",warn:"warn",down:"bad"}[a.health]||"");return `<a class="sig ${c}" href="#/apps/${attr(a.id)}" title="${attr(a.name)} · ${esc((HEALTH[a.health]||HEALTH.unknown)[0])}"><i></i><b>${esc(a.name.replace(/봄$/,""))}</b></a>`;}).join("");
  const live=LOCAL.mode==="live"&&!preview,bd=$("#modeBadge");
  const cm=HQ?.company;
  const badgeText=preview?"PREVIEW":!live?"휴대용":cm?.approvalMode==="VICE_CHAIR_DELEGATED"?"전결":cm?.mode==="PAUSED"?"정지":cm?.mode==="MONITOR_ONLY"?"관제":"LIVE";
  bd.textContent=badgeText;bd.className="mode-badge "+(live?(cm?.mode==="PAUSED"?"warn":"live"):"warn");
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
  // 거짓 all-clear 금지: 앱 상태가 하나도 확인 안 됐으면(전부 unknown·예시·지연) 0을 초록으로 포장하지 않는다.
  const healthKnown=!snapFreshness()?.stale&&familyApps().some(a=>["ok","down","warn"].includes(a.health));
  const review=records("tasks").filter(t=>["in_review","approval_pending"].includes(t.status)).length+pendingApprovals().length;
  const dateLine=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"full"}).format(new Date());
  return `${title("MISSION CONTROL","오늘",dateLine,`${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary","","play"):button("모든 자동작업 일시정지","pause-all","danger","","pause")}`)}
  ${freshnessBanner()}
  <div class="kpi-row">
    ${kpi(HQ?HQ.pending??0:openCount("tasks"),"대기 중 요청",HQ?.pending?"accent":"","","#/tasks")}
    ${kpi(HQ?.running??0,"Codex 작업 중",HQ?.running?"accent":"","","#/automation")}
    ${kpi(review,"회장 확인 필요",review?"warn":"","","#/records/approvals")}
    ${kpi(blocked,"막힘·장애",blocked?"bad":healthKnown?"good":"",blocked?"먼저 확인하세요":healthKnown?undefined:"상태 확인 중","#/automation")}
  </div>
  <div class="grid main-side">
    <div>
      ${panel("내가 확인할 일",attn.length?`<div class="attn-list">${attn.slice(0,7).map(it=>`<button class="attn-item ${it.kind||""}" type="button" data-go="${attr(it.go)}"><span class="ai-ic">${icon(it.kind==="review"?"gavel":"alert")}</span><b>${esc(it.label)}</b><span class="ai-go">${icon("chev")}</span></button>`).join("")}</div>`:empty("지금 확인할 일이 없습니다.","막힘·결재·경고가 생기면 여기에 먼저 나타나요."),attn.length?`<span class="pt-count">${attn.length}</span>`:"")}
      ${incidentBoardPanel()}
      ${HQ?.loops?.active?loopBoardPanel():""}
      ${autos.length?panel("결재 상신 — 시스템 개선 제안",`<div class="approval-list">${autos.slice(0,3).map(r=>decreeCard(r)).join("")}</div>`,`<span class="pt-count">${autos.length}</span>`):""}
      ${panel("포트폴리오 현황 — 6개 앱",matrixTable(),`<a class="status neutral" href="#/apps">전체 보기</a>`,"flush")}
    </div>
    <div>
      ${panel("Codex 실행기",`<div class="codex-line"><span class="status ${cx.cls==="on"?"good":cx.cls==="busy"?"accent":cx.cls==="warn"?"warn":"neutral"}">${esc(cx.label)}</span><p>${esc(cx.detail)}</p></div>
        ${HQ?.runningTask?`<p class="fine">진행: ${esc(appName(HQ.runningTask.app))} · ${esc(HQ.runningTask.title||"")} (${ago(HQ.runningTask.lease?.heartbeatAt)} 신호)</p>`:""}
        ${HQ?.nextTask?`<p class="fine">다음: ${esc(appName(HQ.nextTask.app))} · ${esc(HQ.nextTask.title||"")}</p>`:""}
        <div class="today-actions" style="margin-top:12px"><a class="button ghost" href="#/automation">${icon("chev")}자동화 현황판</a></div>`)}
      ${panel("자동 운영",`<div class="simple-list">
        <div><b>${reviewLabel()} 종합 점검 → 결재 상신</b>${tonePill(autos.length?"gold":"neutral",autos.length?`상신 ${autos.length}건`:"대기 중 제안 없음")}</div>
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
    <td>${a.health==="down"?tonePill("bad",hl):run?tonePill("accent","작업 중"):tonePill(tone,hl)}</td>
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
  const sign=st==="approved"?(r.approvedBy==="executive-vice-chair"?'<div class="seal" aria-label="전결 도장">전결</div>':'<div class="seal" aria-label="승인 도장">승인</div>')
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
    <span class="decree-meta"><span>문서 <b>${esc(decreeSerial(r))}</b></span><span>상신일 <b>${fmt(r.createdAt,false)}</b></span>${r.detectedAt?`<span>감지 <b>${ago(r.detectedAt)}</b></span>`:""}<span>상신 <b>${auto?"자동 점검 시스템":"운영 기록"}</b></span></span>
  </div>
  <div class="decree-body">
    <span class="dc-app"><i style="--app:${accent(r.appId||r.app)}"></i>${esc(appName(r.appId||r.app))}</span>${r.fixClass==="human"?tonePill("bad","회장 확인 필수"):r.fixClass==="codex"?tonePill("warn","Codex로 수정"):""}
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
  ${freshnessBanner()}
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
  // '진행 중 업무' 패널이므로 종료된 업무(OPEN_DONE)는 제외해 제목과 내용을 일치시킨다.
  const tasks=records("tasks").filter(t=>t.appId===a.id&&!OPEN_DONE.includes(t.status));
  return `${title("APP",a.name,"사용자 영향부터, 기술 정보는 아래.",`${a.url?`<a class="button primary" href="${attr(a.url)}" target="_blank" rel="noopener">운영 앱 열기</a>`:""}${button("수정 요청","new-task-for","secondary",`data-app-id="${attr(a.id)}"`,"plus")}`)}
  ${freshnessBanner()}
  <div class="product-hero" style="--app:${accent(a.id)}"><div><span class="ph-k">현재 운영 버전</span><h2>v${esc(a.version||"—")}</h2>${tonePill(tone,hl)}</div>
  <dl class="data-list"><dt>사용자 가치</dt><dd>${esc(roleOf(a))}</dd><dt>상태 이유</dt><dd>${esc(a.health==="ok"?"운영 확인 통과":(a.production?.warnings?.[0]||a.blocked||"확인 필요"))}</dd><dt>다음 개선</dt><dd>${esc(a.nextActions?.[0]||"안정 운영")}</dd></dl></div>
  <div class="detail-grid">
  ${panel("진행 중 업무",tasks.length?`<div class="record-list">${tasks.slice(0,6).map(taskRow).join("")}</div>`:empty("이 앱에 등록된 업무가 없습니다."))}
  ${panel("기술 정보 (근거)",`<dl class="data-list"><dt>저장소</dt><dd>${esc(a.repo||"—")}</dd><dt>브랜치·SHA</dt><dd>${esc(a.git?.branch||"main")} · ${esc(a.git?.sha||a.production?.deployedSha?.slice(0,7)||"—")}</dd><dt>배포</dt><dd>${esc(a.deployTarget||"—")}</dd><dt>CI</dt><dd>${esc(ci?`${ci.name} · ${ci.conclusion||ci.status}`:"GitHub 연결 시 표시")}</dd><dt>열린 PR</dt><dd>${a.openPrs?.length||0}</dd></dl>`)}</div>`;
}

/* ── 업무 ── */
function taskRow(r){
  const thumbs=(r.attachments||[]).length&&LOCAL.mode==="live"?`<div class="record-thumbs">${r.attachments.slice(0,4).map(id=>`<img src="/api/attachments/${encodeURIComponent(id)}" alt="첨부" loading="lazy" />`).join("")}</div>`:"";
  return `<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title)}</h3>${r.autonomy?`<small>${esc(AUTONOMY_LABEL[r.autonomy]||r.autonomy)}</small>`:""}</div>${statusPill(r.status)}</header>${r.problem||r.body?`<p>${esc(r.problem||r.body)}</p>`:""}${r.desiredOutcome?`<p class="outcome">→ ${esc(r.desiredOutcome)}</p>`:""}${thumbs}<footer>${["in_review","approval_pending"].includes(r.status)?button("확인 완료","patch-record","primary",`data-collection="tasks" data-id="${attr(r.id)}" data-status="completed"`,"check"):""}${["blocked","failed"].includes(r.status)?button("다시 시도","retry-task","secondary",`data-id="${attr(r.id)}"`,"refresh"):""}${["queued","blocked"].includes(r.status)?button("취소","patch-record","ghost",`data-collection="tasks" data-id="${attr(r.id)}" data-status="cancelled"`):""}${button("명세 파일 저장","download-bundle","ghost",`data-id="${attr(r.id)}" title="이 업무를 .md 파일로 저장 — 사람이 수동으로 전달할 때만 씁니다"`)}</footer></article>`;
}
function renderTasks(){
  const list=records("tasks");
  return `${title("WORK","업무","말하듯 요청하면 Codex 대기열에 자동 등록됩니다.",button("새 수정 요청","new-task","primary","","plus"))}
  <div class="kpi-row">${kpi(HQ?HQ.pending??0:openCount("tasks"),"대기",HQ?.pending?"accent":"")}${kpi(HQ?.running??"—","작업 중",HQ?.running?"accent":"")}${kpi(list.filter(t=>["in_review","approval_pending"].includes(t.status)).length,"확인 필요","warn")}${kpi(list.filter(t=>t.status==="blocked").length,"막힘",list.some(t=>t.status==="blocked")?"bad":"")}</div>
  ${list.some(t=>t.status==="blocked")?`<div class="run-banner off" style="margin-top:4px"><span class="dot"></span><b>‘막힘’ 업무는 이렇게 처리됩니다</b><span class="rb-sub">코덱스 실행기가 연결되면 다음 점검에서 <b>자동으로 다시 시도</b>합니다 — 회장님이 누를 것 없음. 지금 바로 다시 시도하려면 카드의 <b>‘다시 시도’</b>를 누르세요.<br>비밀키·권한·결제 같은 건만 회장 확인이 필요하고, 그건 <a href="#/today">‘오늘 → 문제 처리 현황’</a>에 뜹니다.</span></div>`:""}
  ${list.length?`<div class="record-list">${list.map(taskRow).join("")}</div>`:empty("등록된 업무가 없습니다.","'새 수정 요청'을 눌러 어떤 앱의 무엇이 불편한지 말하듯 적어 주세요. 사진도 붙일 수 있어요.")}`;
}

/* ── 문제 처리 현황 보드: 누가(컴퓨터 자동 / Codex / 회장) 어떻게 고치나 (v2.5.0) ── */
function incidentRow(it,key){
  const act=key==="codex"?button("승인하고 맡기기","approve-proposal","gold",`data-id="${attr(it.id)}"`,"check")
    :key==="human"?`<a class="button ghost" href="#/records/approvals">결재함에서 처리</a>`:"";
  const st=key==="self_heal"?"working":key==="codex"?"approval_pending":"blocked";
  return `<article><header><div><span>${it.target?esc(appName(it.target)||it.target):"회사 전체"} · ${it.detectedAt?esc(ago(it.detectedAt))+" 감지":"감지 시각 미상"}</span><h3>${esc(it.title)}</h3></div>${statusPill(st)}</header>${it.resolution?`<p>${esc(it.resolution)}</p>`:""}${act?`<footer>${act}</footer>`:""}</article>`;
}
function incidentBoardPanel(){
  const b=HQ?.incidentBoard; if(!b)return "";
  const c=b.counts||{selfHeal:(b.selfHeal||[]).length,codex:(b.codex||[]).length,human:(b.human||[]).length};
  const lane=(t,tone,sub,items,key)=>items.length?`<div class="lane-block" style="margin-top:12px"><div class="simple-list"><div><b>${t}</b>${tonePill(tone,items.length+"건")}</div></div><p class="fine">${esc(sub)}</p><div class="record-list">${items.slice(0,6).map(it=>incidentRow(it,key)).join("")}</div>${items.length>6?`<p class="fine">…그 외 ${items.length-6}건 더 (숨기지 않고 모두 처리 중)</p>`:""}</div>`:"";
  const none=!(c.selfHeal||c.codex||c.human);
  // 종합 점검이 실제로 돌았는지(health/latest.json 존재 → HQ.health 요약 있음). 점검 전엔 '문제 없음'으로 위장하지 않는다.
  const scanned=Boolean(HQ?.health);
  const body=`
    <div class="kpi-row" style="margin-bottom:8px">${kpi(c.selfHeal,"컴퓨터 자동",c.selfHeal?"accent":"","","#/automation")}${kpi(c.codex,"Codex로 수정",c.codex?"warn":"","","#/records/approvals")}${kpi(c.human,"회장 확인 필수",c.human?"bad":"","","#/records/approvals")}</div>
    <p class="fine">숫자만이 아니라 ‘누가·어떻게 고치는지’까지 보여드립니다. 컴퓨터가 AI 없이 스스로 고칠 수 있는 건 직접 재점검·자동 종료하고, 코드 수정이 필요한 것만 Codex(회장 승인)로, 비밀키·권한·결제는 회장님만 처리합니다.</p>
    ${none?(scanned?empty("지금 처리할 문제가 없습니다.","새 사건이 생기면 여기에 해결방안과 함께 나타납니다."):empty("아직 종합 점검 전입니다.","첫 자동 점검이 끝나면 발견된 문제와 해결 경로가 여기에 나타납니다. ‘문제 없음’이 아니라 ‘아직 확인 전’입니다.")):""}
    ${lane("컴퓨터가 자동 처리 중 (AI 없이)","good","재점검하며 신호가 회복되면 자동으로 닫습니다 — 회장님이 누를 것 없음.",b.selfHeal||[],"self_heal")}
    ${lane("Codex(AI)로 고칠 일","warn","‘승인하고 맡기기’를 누르면 실행기가 코드로 고칩니다.",b.codex||[],"codex")}
    ${lane("회장 확인 필수","bad","비밀키·권한·결제·법률 — 회장님만 처리할 수 있습니다.",b.human||[],"human")}`;
  return panel("문제 처리 현황 — 누가·어떻게 고치나",body);
}

/* ── 자율 개선 Loop 보드 (v2.6.0) — 목표·합격기준·상태·원래 계약 재검증 ── */
const LOOP_AUTH_LABEL={self_heal:"컴퓨터 자동",codex:"Codex 수정",human:"회장 확인"};
// 상태 칩 색은 '누가 맡았나(authorityClass)'가 아니라 '지금 어떤 상태인가'를 따라야 한다.
// 예전엔 self_heal이면 무조건 초록이라, 외부 대기·안전 중단으로 멈춘 Loop도 건강한 초록으로 위장됐다.
// (담당 구분은 헤더 small의 LOOP_AUTH_LABEL로 그대로 보여 정보 손실 없음.)
const LOOP_STATE_TONE={RECOVERED:"good",CLOSED:"good",FAILED_SAFE:"bad",BLOCKED_EXTERNAL:"warn",BLOCKED_HUMAN:"gold",RETRY_WAIT:"warn",AWAITING_APPROVAL:"gold",QUEUED:"neutral",TRIAGED:"neutral",DISCOVERED:"neutral"};
const loopStateTone=(s)=>LOOP_STATE_TONE[s]||"accent"; // 그 외 조사·수정·검증·배포 등은 진행 중(accent)
function loopBoardPanel(){
  const L=HQ?.loops; if(!L)return "";
  const rows=(L.activeLoops||[]).slice(0,12).map(lp=>{
    const retry=lp.taskId&&["QUEUED","RETRY_WAIT","TRIAGED","BLOCKED_EXTERNAL"].includes(lp.state)?button("다시 시도","retry-task","secondary",`data-id="${attr(lp.taskId)}"`,"refresh"):"";
    const evid=Object.keys(lp.evidence||{}).length?button("증거 보기","show-loop-evidence","ghost",`data-id="${attr(lp.loopId)}"`):"";
    const appUrl=lp.targetApp&&appById(lp.targetApp)?.url;
    const openApp=appUrl?`<a class="button ghost" href="${attr(appUrl)}" target="_blank" rel="noopener">앱 열기</a>`:"";
    const foot=[retry,evid,openApp].filter(Boolean).join("");
    return `<article><header><div><span>${lp.targetApp?esc(appName(lp.targetApp)||lp.targetApp):"회사 전체"} · ${lp.iteration>1?`${lp.iteration}번째 시도 · `:""}${esc(ago(lp.updatedAt))}</span><h3>${esc(lp.objective)}</h3><small>${esc(lp.loopType)} · ${esc(LOOP_AUTH_LABEL[lp.authorityClass]||lp.authorityClass)}</small></div>${tonePill(loopStateTone(lp.state),esc(lp.stateLabel||lp.state))}</header>${lp.nextAction?`<p>다음: ${esc(lp.nextAction)}</p>`:""}${(lp.acceptanceCriteria||[]).length?`<p class="fine">합격 기준: ${lp.acceptanceCriteria.map(c=>esc(c.id)).join(" · ")}${lp.evidence?.origin_recheck?` · 원래 계약: ${esc(lp.evidence.origin_recheck)}`:""}</p>`:""}${foot?`<footer>${foot}</footer>`:""}</article>`;
  }).join("");
  const meta=L.meta;
  const metaLine=meta&&meta.issueCount?`<div class="run-banner off" style="margin:4px 0 10px"><span class="dot"></span><b>자기 점검(Meta) — 손볼 Loop ${meta.issueCount}건</b><span class="rb-sub">${esc(meta.issues.slice(0,3).map(i=>`${({missing_role:"담당 누락",missing_criteria:"기준 누락",broken_wiring:"작업 연결 끊김",retry_storm:"재시도 폭주",stuck:"멈춤"}[i.kind]||i.kind)}: ${i.objective||i.loopId}`).join(" · "))}</span></div>`:(meta?`<p class="fine">자기 점검(Meta): 활성 ${meta.activeCount}개 Loop 모두 정상 진행 중 — 멈춤·재시도 폭주·담당 누락 없음.</p>`:"");
  return panel("자율 개선 Loop — 목표·기준·검증까지",`
    ${metaLine}
    <div class="kpi-row" style="margin-bottom:8px">${kpi(L.active,"진행 중 Loop",L.active?"accent":"good")}${kpi(L.closed,"완료","good")}${kpi(L.failedSafe,"안전 중단",L.failedSafe?"bad":"")}</div>
    <p class="fine">각 문제·개선을 ‘목표 → 합격 기준 → 담당 → 수정 → <b>원래 계약 재검증</b> → 종료’의 닫힌 Loop로 관리합니다. Codex가 끝났다고 바로 완료가 아니라, <b>원래 실패했던 계약이 다시 통과해야</b> Loop를 닫습니다. 실패하면 같은 수정 반복 대신 새 시도(iteration)로 접근을 바꿉니다.</p>
    ${rows?`<div class="record-list">${rows}</div>${L.active>12?`<p class="fine">…그 외 ${L.active-12}개 Loop 더 진행 중 (전부 관리 중, 숨기지 않음)</p>`:""}`:empty("진행 중인 Loop가 없습니다.","문제·개선이 확정되면 여기에 목표·기준과 함께 Loop로 나타납니다.")}`);
}

/* ── 실행기 설정: 회장이 Codex 모델·추론 강도를 고른다 (v2.5.0) ── */
// 회장님 Codex 구독에서 고를 수 있는 대표 모델(클릭 선택 — 타이핑 불필요). 안 되는 모델이면 실행기가 정직하게 미연결로 표시.
const CODEX_MODELS=[["","기본값 (추천)"],["gpt-5-codex","gpt-5-codex"],["gpt-5","gpt-5"],["o4-mini","o4-mini · 빠름"],["o3","o3 · 정밀"]];
function executorConfigPanel(){
  const c=HQ?.control||{};const eff=c.codexEffort||"";const model=c.codexModel||"";
  const seg=(v,l)=>`<button class="button ${eff===v?"primary":"ghost"}" type="button" data-action="set-effort" data-effort="${attr(v)}">${l}</button>`;
  const mdl=(v,l)=>`<button class="button ${model===v?"primary":"ghost"}" type="button" data-action="pick-model" data-model="${attr(v)}">${l}</button>`;
  return panel("실행기 설정 — Codex 모델·추론 강도 (클릭 선택)",`
    <div class="simple-list"><div><b>추론 강도</b><span class="today-actions" style="gap:6px;flex-wrap:wrap">${seg("low","낮음·빠름")}${seg("medium","보통")}${seg("high","높음·정밀")}${seg("","기본값")}</span></div></div>
    <div class="simple-list" style="margin-top:8px"><div><b>모델</b><span class="today-actions" style="gap:6px;flex-wrap:wrap">${CODEX_MODELS.map(([v,l])=>mdl(v,l)).join("")}</span></div></div>
    <details style="margin-top:8px"><summary class="fine">목록에 없는 모델을 직접 입력 (고급)</summary><div class="today-actions" style="margin-top:6px"><input id="cxModel" type="text" value="${attr(model)}" placeholder="예: gpt-5-codex" maxlength="80" style="flex:1;min-height:44px;padding:0 14px;border:1px solid var(--line,#e2d8c8);border-radius:12px;background:var(--surface,#fff);color:inherit;font-size:15px" />${button("저장","save-model","secondary","","save")}</div></details>
    <p class="fine">고른 값은 <b>다음 작업부터</b> 적용됩니다 (지금: 강도 <b>${eff?esc(eff):"기본값"}</b> · 모델 <b>${model?esc(model):"기본값"}</b>). 강도가 높을수록 더 꼼꼼하지만 사용량(토큰)을 더 씁니다.</p>`);
}

/* ── 심층 계약 진단(진단률 100%) — 자동화·회사 화면이 공유 ── */
let CONTRACTS=null,CONTRACTS_LOADING=false;
function loadContracts(){ // 1회 로드 후 도착 시 한 번만 재렌더(무한 재렌더 금지)
  if(CONTRACTS||CONTRACTS_LOADING||preview)return;
  CONTRACTS_LOADING=true;
  fetchJson("/api/health-contracts").then(v=>{CONTRACTS=v;if(["automation","company"].includes(CURRENT))renderScreen();}).catch(()=>{CONTRACTS={ok:false};});
}
const TARGET_NAMES={company:"회사 전역",robom:"robom.kr",["robom-hq"]:"ROBOM HQ",outbom:"야외봄",homebom:"청약봄",runningbom:"러닝봄",calendarbom:"캘린더봄",certbom:"자격증봄",notebom:"노트봄"};
function contractsPanel(){
  const d=CONTRACTS?.defined,r=CONTRACTS?.report;
  if(!CONTRACTS)return panel("심층 진단 — 진단률",empty("진단 결과를 불러오는 중입니다."));
  if(!d)return panel("심층 진단 — 진단률",empty("계약 카탈로그를 읽지 못했습니다."));
  const bt=r?.coverage?.byTarget||{};
  const row=(t)=>{const v=bt[t]||{total:0,pass:0,degraded:0,fail:0,unavailable:0};
    const tone=v.fail?"bad":v.degraded?"warn":v.pass?"good":"neutral";
    const label=v.total?`${v.pass}/${v.total} 정상${v.fail?` · 장애 ${v.fail}`:""}${v.degraded?` · 확인 ${v.degraded}`:""}${v.unavailable?` · 불가 ${v.unavailable}`:""}`:"실행 대기";
    return `<div><b>${esc(TARGET_NAMES[t]||t)}</b>${tonePill(tone,label)}</div>`;};
  const targets=Object.keys(TARGET_NAMES).filter(t=>(d.byTarget||{})[t]);
  return panel("심층 진단 — 프롬프트 계약 진단률 100%",`
    <div class="kpi-row" style="margin-bottom:10px">${kpi(d.total,"정의된 계약","gold")}${kpi(r?.coverage?.pass??"—","정상","good")}${kpi((r?.coverage?.fail??0)||0,"장애",r?.coverage?.fail?"bad":"")}${kpi((r?.coverage?.degraded??0)||0,"확인 필요",r?.coverage?.degraded?"warn":"")}${kpi(d.needNewSource,"새 신호 필요")}</div>
    <div class="simple-list">${targets.map(row).join("")}</div>
    <p class="fine">업로드 지침의 계약 전부(${d.total}건)를 프로그램 안에서 정의·실행합니다. ‘새 신호 필요’ ${d.needNewSource}건은 앱 쪽 진단 신호가 생기면 자동으로 실측으로 전환됩니다(숨기지 않고 정직 표기). 마지막 실행 ${r?ago(r.runAt):"—"} · 실행기: 코덱스 단일.</p>
    <div class="today-actions">${button("지금 전체 재점검(심층 포함)","run-health","secondary","","search")}</div>`);
}

/* ── 자동화 (구 Codex) ── */
function renderAutomation(){
  const cx=codexState();
  const autos=pendingApprovals().filter(a=>a.requestedBy==="auto-review").length;
  loadContracts();
  return `${title("AUTOMATION","자동화 현황판","Codex 실행기와 자동 점검이 지금 무엇을 하는지 보는 화면입니다.")}
  <div class="kpi-row">${kpi(HQ?.pending??"—","다음 대기")}${kpi(HQ?.running??"—","실행 중",HQ?.running?"accent":"")}${kpi(HQ?.done??"—","완료","good")}${kpi(HQ?.failed??"—","실패·막힘",HQ?.failed?"bad":"")}</div>
  ${panel("현재 상태",`<div class="codex-line"><span class="status ${cx.cls==="on"?"good":cx.cls==="busy"?"accent":cx.cls==="warn"?"warn":"neutral"}">${esc(cx.label)}</span><p>${esc(cx.detail)}</p></div><p class="fine" style="margin-top:8px">Codex 모델·추론 강도·점검 주기는 <a href="#/records/settings"><b>설정</b></a>에서 클릭으로 바꿉니다.</p>`)}
  ${HQ?.runningTask?panel("실행 중 작업",`<div class="record-list"><article><header><div><span>${esc(appName(HQ.runningTask.app))}</span><h3>${esc(HQ.runningTask.title)}</h3></div>${tonePill("accent","작업 중")}</header><p>시작 ${fmt(HQ.runningTask.lease?.claimedAt)} · 마지막 신호 ${ago(HQ.runningTask.lease?.heartbeatAt)}</p></article></div>`):""}
  ${HQ?.nextTask?panel("다음 대기",`<div class="simple-list"><div><b>${esc(appName(HQ.nextTask.app))} · ${esc(HQ.nextTask.title)}</b>${tonePill("neutral","대기")}</div></div>`):""}
  ${panel("자동 점검 → 결재",`<div class="simple-list">
    <div><b>${reviewLabel()} 6개 앱 종합 점검 후 개선 제안을 결재로 상신</b>${tonePill(autos?"gold":"neutral",autos?`상신 ${autos}건 대기`:"대기 중 제안 없음")}</div>
    <a href="#/records/approvals"><b>결재함 열기</b><span class="status neutral">이동</span></a>
  </div>`)}
  ${incidentBoardPanel()}
  ${loopBoardPanel()}
  ${HQ?.health?panel("결정론적 점검 결과 (AI 없이 자동)",`<div class="kpi-row" style="margin-bottom:0">${kpi(HQ.health.pass??0,"정상","good")}${kpi(HQ.health.degraded??0,"확인 필요",HQ.health.degraded?"warn":"")}${kpi(HQ.health.fail??0,"장애",HQ.health.fail?"bad":"")}${kpi(HQ.health.openIncidents??0,"열린 사건",HQ.health.openIncidents?"warn":"")}${kpi(HQ.health.unavailable??0,"점검 불가")}</div><p class="fine">실제 신호(운영 응답·버전·CI·데이터 신선도·PR)를 규칙으로 판정합니다. 위 ‘문제 처리 현황’이 각 사건을 누가 어떻게 고치는지 보여줍니다. 같은 문제는 반복 상신하지 않고, 신호가 회복되면 결재도 자동으로 닫힙니다.${HQ.health.selfHealed?` 이번 점검에서 ${HQ.health.selfHealed}건은 컴퓨터가 자동 처리, ${HQ.health.autoClosed||0}건은 회복으로 자동 종료했습니다.`:""}${HQ.health.reverified?` 원래 계약 재검증 통과 ${HQ.health.reverified}건 자동 완료.`:""}${HQ.health.reiterated?` 아직 실패 ${HQ.health.reiterated}건은 새 시도로 재개했습니다.`:""}${HQ.health.regressionHeld?` 회귀 감사에서 ${HQ.health.regressionHeld}건은 '다른 곳을 깨뜨림'이 확인돼 종료를 보류하고 재검토로 돌렸습니다.`:""}${HQ.health.autoBackedUp?` 백업이 오래돼 컴퓨터가 자동으로 백업했습니다.`:HQ.health.backupAgeHours!=null?` 마지막 백업 ${HQ.health.backupAgeHours<1?"방금":`${HQ.health.backupAgeHours}시간 전`}.`:""}</p>`):""}
  ${contractsPanel()}
  ${panel("제어",`<div class="today-actions">${HQ?.control?.paused?button("자동작업 다시 시작","resume-all","secondary","","play"):button("모든 자동작업 일시정지","pause-all","danger","","pause")}${HQ?.control?.intakeClosed?button("새 작업 접수 재개","open-intake","secondary"):button("새 작업 접수 중지","close-intake","ghost")}</div>`)}
  ${panel("연결 방법 (맥에서 딱 한 번)",`<ol class="number-list"><li>맥 터미널에서 한 번만: <code>codex login</code> — 구독 계정 로그인 (API 키 금지)</li><li>끝. ROBOM HQ가 실행기를 자동으로 켜고 감시합니다 — 이 앱을 켜 두기만 하면 승인한 작업이 자동 처리됩니다.</li></ol><p class="fine">${HQ?.runner?.managed?"실행기 자동 관리가 켜져 있습니다. ":""}로그인 전에는 미연결로 정직하게 표시하며, 요청은 대기열에 안전 보관됩니다. 실제 코드 수정에는 맥에 로봄 저장소 클론이 필요하며, HQ가 <code>~/robom-labs/robom</code> 등을 자동으로 찾습니다.</p>`)}`;
}

/* ── 회사: 가동·전결·조직도·팀 현황·시설 (v2.0.0) ── */
let ORG=null,ORG_LOADING=false;
function loadOrg(){ // 1회만 불러오고, 도착했을 때 회사 화면이면 한 번만 다시 그린다(무한 재렌더 금지)
  if(ORG||ORG_LOADING||preview)return;
  ORG_LOADING=true;
  fetchJson("/api/organization").then(o=>{ORG=o;if(CURRENT==="company")renderScreen();}).catch(()=>{ORG={ok:false};});
}
function renderCompany(){
  const c=HQ?.company||{};
  const running=c.mode==="RUNNING",monitor=c.mode==="MONITOR_ONLY";
  const delegated=c.approvalMode==="VICE_CHAIR_DELEGATED";
  const shift=c.shift?.label||"";
  const health=HQ?.health;
  const wf=HQ?.workforce;
  const divisions=ORG?.divisions||[];
  const cellName=(id)=>({production:"운영 응답",network:"네트워크",self:"HQ 자체",ci:"자동 검사",github:"코드 흐름",roadmap:"다음 개선"})[id]||id;
  const divStatus=(d)=>{ if(d.standby)return tonePill("neutral","STANDBY · 업무 대기");
    if(!health)return tonePill("neutral","확인 중");
    return tonePill(running?"good":monitor?"accent":"neutral",running?"상시 관제 중":monitor?"관제만":"정지"); };
  loadOrg();
  return `${title("COMPANY","회사","24시간 살아있는 로봄 본사 — 80명 인력·계약 소유·가동·전결·시설을 한곳에서.",`<a class="button ghost" href="./office.html">${icon("office")}오피스 관람</a>`)}
  ${(()=>{const st=running?"on":monitor?"mon":"off";const head=running?"회사 가동 중 — 전 직원 24시간 근무":monitor?"관제만 모드 — 점검·기안만":c.mode==="EMERGENCY_STOP"?"긴급 정지 — 읽기 전용":"회사 일시정지";const sub=wf?`근무 <b>${wf.summary.onDuty}</b>명 · 점검 <b>${wf.summary.checking}</b> · 막힘 <b>${wf.summary.blocked}</b><br>계약 ${wf.contractsAssigned??"—"}개 배정 · 실행기 ${wf.executorConnected?"연결됨":"미연결(수정은 대기)"}`:"버튼을 누르면 전 직원이 담당 계약을 점검하기 시작합니다.";return `<div class="run-banner ${st}"><span class="dot"></span><b>${head}</b><span class="rb-sub">${sub}</span></div>`;})()}
  <div class="grid main-side">
    <div>
      ${panel("회사 가동",`<div class="simple-list">
        <div><b>현재 상태</b>${tonePill(running?"good":monitor?"accent":"warn",c.modeLabel?`${c.modeLabel}${running?" (상시 관제·자동 복구·전결)":monitor?" (점검·기안만)":""}`:(running?"가동 중":monitor?"관제만":"일시정지"))}</div>
        <div><b>현재 교대조</b>${tonePill("accent",shift||"—")}</div>
        ${wf?`<div><b>지금 근무 중</b>${tonePill(wf.summary.blocked?"warn":"good",`${wf.summary.onDuty}명 / 전체 ${wf.summary.total}명`)}</div>`:""}
      </div>
      <div class="today-actions" style="margin-top:12px">
        ${button("회사 가동","set-company-mode","primary",'data-mode="RUNNING"',"play")}
        ${button("관제만","set-company-mode","secondary",'data-mode="MONITOR_ONLY"',"search")}
        ${button("안전하게 일시정지","set-company-mode","danger",'data-mode="PAUSED"',"pause")}
      </div>
      <details style="margin-top:10px"><summary class="fine" style="cursor:pointer">고급 가동 제어 (안전 복구·긴급 정지)</summary>
      <div class="today-actions" style="margin-top:9px">
        ${button("안전 복구 모드","set-company-mode","ghost",'data-mode="SAFE_MODE"',"shield")}
        ${button("안전 마무리","set-company-mode","ghost",'data-mode="DRAINING"')}
        ${button("긴급 정지","set-company-mode","danger",'data-mode="EMERGENCY_STOP"',"pause")}
      </div></details>`)}
      ${wf?panel(`인력 현황 · 80명 (계약 ${wf.contractsAssigned??"—"}개 배정)`,`
        <div class="kpi-row" style="margin-bottom:9px">${kpi(wf.summary.onDuty,"근무 중","good")}${kpi(wf.summary.checking,"점검 중",wf.summary.checking?"accent":"")}${kpi(wf.summary.repairing+wf.summary.deploying,"수정 중",wf.summary.repairing?"accent":"")}${kpi(wf.summary.verifying,"검증 중")}${kpi(wf.summary.blocked,"막힘",wf.summary.blocked?"bad":"")}</div>
        ${(wf.contractsFailing||wf.contractsAutoFixing||wf.contractsNeedHuman)?`<div class="fix-lanes">
          <div class="fix-lane auto"><div class="fl-n">${wf.contractsAutoFixing??0}</div><div class="fl-t">🤖 자동 수정 진행/대기<br>${wf.executorConnected?"코덱스가 대기열에서 순차로 처리(1건씩)":"코덱스 연결되면 자동 시작 — 회장님 조치 불필요"}</div></div>
          <div class="fix-lane human"><div class="fl-n">${wf.contractsNeedHuman??0}</div><div class="fl-t">✋ 사람 확인 필요<br>${(wf.contractsNeedHuman??0)?"'오늘' 화면 → 내가 확인할 일에서 처리":"지금은 없음"}</div></div>
        </div><p class="fine" style="margin:2px 0 8px">막힌 계약은 자동으로 <b>코덱스 수정 대기열</b>에 올라갑니다. 비밀키·개인정보 같은 건만 회장님 확인을 기다립니다 — 나머지는 알아서 고쳐집니다.</p>`:`<p class="fine" style="margin-top:0">막힌 계약이 없습니다 — 전 계약 정상.</p>`}
        <div class="simple-list">${(wf.byDivision||[]).filter(d=>d.total).slice(0,14).map(d=>`<div><b>${esc(d.divisionName||d.division)}</b>${tonePill(d.blocked?"bad":d.checking?"accent":"good",`${d.onDuty}/${d.total}명 근무 · 계약 ${d.ownedContracts}${d.blocked?` · 막힘 ${d.blocked}`:""}`)}</div>`).join("")}</div>
        <p class="fine">각 직원이 맡은 계약을 점검·검증하는 모습은 <a href="./office.html">오피스 관람</a>에서 캐릭터를 눌러 확인합니다. 인원 수는 실제 실행기(코덱스) 수와 다릅니다 — '수정 중'은 실제 실행기 작업만 집계합니다.</p>`):""}
      ${panel("수석부회장 전결 — 위임하면 스스로 성장",`<p class="fine" style="margin:0 0 11px">위임하면 회장님 부재 중에도 <b>시스템이 올린 위임 가능 안건만</b> 수석부회장 리리가 자동 재가해 <b>Codex 실행기가 바로 고치고 새 기능·개선까지 이어서 만듭니다</b> — 유지보수만이 아니라 계속 성장합니다. 결제·계약·홍보·개인정보·비밀값·권한·삭제 같은 안건은 위임돼도 <b>회장 전용</b>으로 남습니다. (Codex는 맥에서 <code>codex login</code> 연결 시 작동, 모델·강도는 <a href="#/records/settings"><b>설정</b></a>에서 클릭 선택.)</p>
      <div class="simple-list"><div><b>결재 모드</b>${tonePill(delegated?"gold":"good",delegated?"수석부회장 전결 위임 중":"회장 직접결재")}</div></div>
      <div class="today-actions" style="margin-top:12px">${delegated?button("전결 즉시 해제","set-delegation","danger",'data-approval="CHAIRMAN_DIRECT"'):button("수석부회장 전결 위임","set-delegation","gold",'data-approval="VICE_CHAIR_DELEGATED"',"check")}</div>`)}
      ${panel("조직도 — 회장부터 아래로",ORG?(()=>{
        const exec=ORG.executives||[];
        const chair=exec.find(e=>e.reportsTo===null)||{displayName:"황준필",title:"회장"};
        const directs=exec.filter(e=>e.reportsTo==="chairman");
        const ocard=(cls,name,title,extra="")=>`<div class="oc-card ${cls}"><b>${esc(name)}</b><small>${esc(title)}</small>${extra}</div>`;
        return `<div class="org-chart">
          <div class="org-tier">${ocard("chair",chair.displayName,chair.title)}</div>
          <div class="oc-link"></div>
          <div class="org-tier">${directs.map(e=>ocard(e.id==="executive-vice-chair"?"vc":"",e.displayName,e.title,e.id==="executive-vice-chair"&&delegated?tonePill("gold","전결 중"):"")).join("")||ocard("vc","리리","수석부회장")}</div>
          <div class="oc-link"></div>
          <div class="oc-caption">↓ 수석부회장 리리 산하 ${divisions.length}개 본부</div>
          <div class="org-tier wrap">${divisions.map(d=>`<div class="oc-card div ${d.standby?"standby":""}"><b>${esc(d.name)}</b><small>${esc(d.duty||"")}</small>${divStatus(d)}</div>`).join("")}</div>
        </div>
        <p class="fine" style="margin-top:9px">회장(황준필) 바로 아래 2인자는 <b>수석부회장 리리</b> — 회장 부재 시 위임 안건을 전결합니다. 그 아래 ${divisions.length}개 본부가 나란히 운영됩니다. 제품셀 ${(ORG.productCells||[]).length}개 · 복지 ${(ORG.welfareStaff||[]).length}명(생활 연출).</p>`;
      })():empty("조직 정본을 불러오는 중입니다."))}
    </div>
    <div>
      ${panel("팀 현황 — 실제 점검 근거",health?`<div class="simple-list">
        <div><b>운영관제본부 · 운영 응답/네트워크</b>${tonePill(health.fail?"bad":"good",health.fail?`장애 ${health.fail}`:"이상 없음")}</div>
        <div><b>기술개발·품질본부 · CI/코드 흐름</b>${tonePill(health.degraded?"warn":"good",health.degraded?`확인 ${health.degraded}`:"통과")}</div>
        <div><b>전사 열린 사건</b>${tonePill(health.openIncidents?"warn":"good",String(health.openIncidents??0))}</div>
        <div><b>점검 불가(신호 부족)</b>${tonePill("neutral",String(health.unavailable??0))}</div>
        ${health.contracts?(()=>{const c=health.contracts;const defined=c.totalContracts??c.executed??0;const notVerified=(c.unavailable??0)+(c.blocked??0)+Math.max(0,defined-(c.executed??defined));const cls=c.fail?"bad":(c.degraded||notVerified)?"warn":"good";const txt=c.fail?`장애 ${c.fail}`:c.degraded?`확인 ${c.degraded}`:notVerified?`정상(점검 불가 ${notVerified})`:"전 계약 정상";return `<div><b>심층 계약 진단(정의 ${defined}건)</b>${tonePill(cls,txt)}</div>`;})():""}
      </div><p class="fine">마지막 점검 ${ago(health.runAt)} · 같은 문제는 반복 상신하지 않고, 회복되면 자동으로 닫힙니다. <a href="#/automation">진단 상세 보기</a></p>`:empty("아직 점검 결과가 없습니다."))}
      ${panel("복지시설 (생활 연출)",ORG?`<div class="simple-list">${(ORG.facilities||[]).map(f=>`<div><b>${esc(f.name)}</b><span class="status neutral">${esc(f.floor)}</span></div>`).join("")}</div><p class="fine">시설과 생활 모습은 회사 세계관 연출이며 실제 업무 성과와 분리 집계됩니다.</p>`:"")}
    </div>
  </div>`;
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
    case "data":return `<div class="data-grid">${familyApps().map(a=>{
      const ps=a.production?.status;
      // 데이터 없음(production null)을 '통과'로 위장하지 않는다. FAIL은 amber가 아니라 red로 정직하게.
      const dtone=ps==="PASS"?"good":ps==="FAIL"?"bad":ps==="STALE"?"warn":"neutral";
      const dlabel=ps||"미확인";
      const fresh=a.production?.warnings?.[0]||(a.production?"운영 기준 통과":"운영 데이터 미확인");
      return `<article><header><h2>${esc(a.name)}</h2>${tonePill(dtone,dlabel)}</header><dl class="data-list"><dt>운영 확인</dt><dd>${esc(a.production?.version?`v${a.production.version}`:"확인 중")}</dd><dt>신선도</dt><dd>${esc(fresh)}</dd></dl></article>`;}).join("")}</div>`;
    case "backup":return `<div class="panel-actions">${button("지금 백업","backup","primary","","save")}${button("JSON 내보내기","export","ghost")}</div><dl class="data-list"><dt>저장 위치</dt><dd>${LOCAL.mode==="live"?"이 컴퓨터의 비공개 runtime 폴더":"브라우저 휴대용 저장"}</dd><dt>마지막 백업</dt><dd>${esc(LOCAL.meta?.lastBackupAt?fmt(LOCAL.meta.lastBackupAt):"아직 없음")}</dd><dt>백업 대상</dt><dd>회의·결재·업무·장애 기록과 감사 로그</dd></dl>`;
    case "connections":loadMobile();return mobilePanel()+connectionMarkup();
    case "security":return `<div class="security-grid">${(SNAP.operations?.security||[]).map(c=>`<article>${tonePill(c.ok?"good":"bad",c.ok?"통과":"실패")}<h3>${esc(c.name)}</h3><p>${esc(c.note||"")}</p></article>`).join("")||empty("보안 점검 항목을 불러오지 못했습니다.")}</div>`;
    case "settings":return `
      ${executorConfigPanel()}
      ${panel("자동 점검 주기",`<div class="today-actions" style="gap:8px;align-items:center;flex-wrap:wrap"><label class="fine" for="reviewInterval">점검 주기</label>${reviewIntervalSelect()}${button("적용","apply-review-schedule","secondary","","check")}</div><p class="fine">${reviewLabel()} 종합 점검 후 개선 제안을 결재로 상신합니다. 짧을수록 자주 점검하지만 사용량이 늘 수 있어요.</p>`)}
      <div class="settings-list">
      <article><div><h3>현재 모드</h3><p>${LOCAL.mode==="live"?"실시간 로컬 본부":"휴대용 보기"}</p></div>${tonePill(LOCAL.mode==="live"?"good":"neutral",LOCAL.mode==="live"?"연결됨":"제한됨")}</article>
      <article><div><h3>프로그램 버전</h3><p>ROBOM HQ v${esc(APP_VERSION)} — 상단 금색 버전 칩과 동일하면 최신 설치본입니다.</p></div>${tonePill("gold",`v${APP_VERSION}`)}</article>
      <article><div><h3>휴대폰 연결</h3><p>${HQ?.remote==="token"?"토큰 인증으로 사설망 접속 허용됨":"이 컴퓨터 전용(127.0.0.1) — docs/hq/REMOTE-ACCESS.md"}</p></div>${tonePill(HQ?.remote==="token"?"accent":"good",HQ?.remote==="token"?"원격 허용":"비공개")}</article>
      <article><div><h3>추가 운영비</h3><p>유료 API·상시 유료 서버 없이 로컬 Node.js와 GitHub 무료 범위만 사용.</p></div>${tonePill("good","0원")}</article>
      <article><div><h3>회사 가동 (24시간 상시 관제)</h3><p>정해진 시각·횟수 대신, 회사가 켜져 있는 동안 계속 신호를 읽고 점검합니다. 가동·관제만·일시정지와 수석부회장 전결은 '회사' 화면에서 조절합니다.</p></div><a class="button gold" href="#/company">회사 화면</a></article>
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
/* ── 휴대폰 연결(연동): 버튼 하나로 켜고, QR 스캔 → 폰 홈 화면에 앱으로 설치 ── */
let MOBILE=null,MOBILE_LOADING=false;
function loadMobile(){ if(MOBILE||MOBILE_LOADING||preview)return; MOBILE_LOADING=true;
  fetchJson("/api/mobile-access").then(v=>{MOBILE=v;if(CURRENT==="records")renderScreen();}).catch(()=>{MOBILE={ok:false};}); }
function qrSvgFor(text){
  try{ if(typeof qrcode!=="function")return "";
    const qr=qrcode(0,"M");qr.addData(text);qr.make();
    return qr.createSvgTag({cellSize:5,margin:4,scalable:true});
  }catch{return "";}
}
function mobilePanel(){
  if(preview)return panel("휴대폰 연결",`<p class="fine">휴대용 보기에서는 설정할 수 없습니다. 맥의 ROBOM HQ에서 켜세요.</p>`);
  if(!MOBILE)return panel("휴대폰 연결",empty("연결 상태를 확인하는 중입니다."));
  if(MOBILE.connectedRemotely)return panel("휴대폰 연결",`<div class="simple-list"><div><b>지금 휴대폰으로 접속 중</b>${tonePill("good","연결됨")}</div></div><p class="fine">연결 설정 변경은 맥의 ROBOM HQ에서만 할 수 있습니다.</p>`);
  if(!MOBILE.enabled){
    return panel("휴대폰 연결",`<p class="fine" style="margin:0 0 11px">켜면 <b>같은 와이파이</b>에 있는 회장님 휴대폰에서 이 본부 화면을 그대로 볼 수 있습니다. 접속 주소는 QR로 표시되고, 폰에서 <b>홈 화면에 추가</b>하면 앱처럼 설치됩니다. 토큰 인증이라 다른 사람은 접속할 수 없습니다.</p>
    <div class="today-actions">${button("휴대폰 연결 켜기","mobile-on","gold","","link")}</div>`);
  }
  const wifi=(MOBILE.urls||[]).find(u=>u.kind==="wifi")||MOBILE.urls?.[0];
  const qr=wifi?qrSvgFor(wifi.url):"";
  return panel("휴대폰 연결 — 켜짐",`
    <div class="mobile-pair">
      ${qr?`<div class="mp-qr">${qr}</div>`:""}
      <div class="mp-steps">
        <ol class="number-list">
          <li>휴대폰이 <b>이 컴퓨터와 같은 와이파이</b>에 있는지 확인</li>
          <li>휴대폰 <b>카메라</b>로 왼쪽 QR을 비추고 링크 열기</li>
          <li>화면이 뜨면 공유 버튼 → <b>홈 화면에 추가</b> — 폰에 ROBOM HQ 앱이 설치됩니다</li>
        </ol>
        ${wifi?`<p class="fine">직접 입력 시: <code>${esc(wifi.url)}</code></p>`:`<p class="fine">네트워크 주소를 찾지 못했습니다. 와이파이 연결을 확인하세요.</p>`}
        <p class="fine">맥이 켜져 있고 ROBOM HQ 창이 열려 있을 때 접속됩니다. 집 밖에서도 보려면 맥·폰에 Tailscale을 설치하면 같은 방식으로 연결됩니다.</p>
        <div class="today-actions">${button("연결 끄기","mobile-off","danger")}${button("다른 기기 연결 끊기(재발급)","mobile-regen","ghost","","refresh")}</div>
        <p class="fine">폰을 잃어버렸거나 남에게 보였다면 <b>재발급</b>을 누르세요 — 새 QR이 나오고 기존 연결은 즉시 끊깁니다.</p>
      </div>
    </div>`);
}
function connectionMarkup(){const c=SNAP.connections||{};return `<div class="connection-list">${[["로컬 본부",LOCAL.mode==="live","실시간 기록·백업"],["GitHub",String(c.github).startsWith("connected"),c.github],["작업 이벤트",c.events==="connected",c.events],["코덱스 실행기 (단일 실행기)",HQ?.runner?.codex==="connected","codex-runner — 모든 자동 수정은 코덱스가 수행"],["휴대폰 원격",HQ?.remote==="token","토큰 인증 사설망"]].map(([nm,ok,d])=>`<div>${tonePill(ok?"good":"neutral",ok?"연결":"대기")}<b>${esc(nm)}</b><span>${esc(d===true||d===false?"":(d||""))}</span></div>`).join("")}</div>`;}
function recordList(collection,opt={}){const items=opt.items||records(collection);return items.length?`<div class="record-list">${items.map(r=>`<article><header><div><span>${esc(appName(r.appId))} · ${fmt(r.createdAt)}</span><h3>${esc(r.title||COLLECTION_LABEL[collection]||"기록")}</h3></div>${statusPill(r.status||"open")}</header>${r.body?`<p>${esc(r.body)}</p>`:""}</article>`).join("")}</div>`:empty(opt.emptyTitle||`저장된 ${COLLECTION_LABEL[collection]||"기록"}이 없습니다.`);}
function renderNotReady(){return `${title("ROBOM HQ","로봄 본부","실제 연결 상태를 기준으로 표시합니다.")}${empty("표시할 정보가 없습니다.")}`;}

const RENDER={today:renderToday,apps:renderApps,app:renderAppDetail,tasks:renderTasks,company:renderCompany,automation:renderAutomation,records:renderRecords};

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
async function retryTask(id){if(preview){showToast("본부(앱)에서만 다시 시도할 수 있어요.","warn");return;}if(!id)return;const data=await fetchJson(`/api/retry-task/${encodeURIComponent(id)}`,{method:"POST"});if(data.task)applyState({records:{...LOCAL.records,tasks:(LOCAL.records.tasks||[]).map(t=>t.id===id?{...t,status:data.task.status}:t)}});try{HQ=await fetchJson("/api/hq-status");}catch{}showToast("다시 대기열에 넣었습니다 — 실행기가 연결돼 있으면 곧 처리합니다.","good");updateChrome();renderScreen();}
async function setExecutorConfig(cfg){if(preview){showToast("본부(앱)에서만 실행기 설정을 바꿀 수 있어요.","warn");return;}const data=await fetchJson("/api/executor-config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg)});try{HQ=await fetchJson("/api/hq-status");}catch{}const eff=data.control?.codexEffort;showToast(cfg.model!==undefined?(cfg.model?`실행기 모델을 ‘${cfg.model}’로 저장했습니다.`:"모델을 코덱스 기본값으로 되돌렸습니다."):`추론 강도를 ${({low:"낮음",medium:"보통",high:"높음"}[eff]||"기본값")}로 바꿨습니다.`,"good");updateChrome();renderScreen();}
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
    else if(a==="mobile-on"||a==="mobile-off"){
      MOBILE=await fetchJson("/api/mobile-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:a==="mobile-on"})});
      showToast(a==="mobile-on"?"휴대폰 연결을 켰습니다 — QR을 폰 카메라로 비추세요.":"휴대폰 연결을 껐습니다.","good");renderScreen();}
    else if(a==="mobile-regen"){
      MOBILE=await fetchJson("/api/mobile-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({regenerate:true})});
      showToast("새 연결 코드를 발급했습니다 — 기존 기기는 끊겼습니다. 새 QR을 폰으로 다시 비추세요.","good");renderScreen();}
    else if(a==="run-health"){await fetchJson("/api/health-run",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});showToast("전체 재점검을 시작했습니다(심층 포함). 결과는 1~3분 안에 이 화면에 반영됩니다.","good");CONTRACTS=null;CONTRACTS_LOADING=false;setTimeout(()=>{CONTRACTS=null;CONTRACTS_LOADING=false;loadContracts();},90_000);}
    else if(a==="set-company-mode"){const data=await fetchJson("/api/company-mode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:action.dataset.mode})});try{HQ=await fetchJson("/api/hq-status");}catch{}showToast({RUNNING:"회사를 가동했습니다 — 상시 관제·자동 복구·전결이 켜집니다.",MONITOR_ONLY:"관제만 모드 — 점검·기안만 하고 수정은 하지 않습니다.",PAUSED:"회사를 안전하게 일시정지했습니다."}[data.mode]||"반영했습니다.","good");updateChrome();renderScreen();}
    else if(a==="set-delegation"){const data=await fetchJson("/api/delegation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({approvalMode:action.dataset.approval})});try{HQ=await fetchJson("/api/hq-status");}catch{}showToast(data.approvalMode==="VICE_CHAIR_DELEGATED"?"수석부회장 전결을 위임했습니다 — 위임 가능 안건은 자동 재가됩니다.":"전결을 해제했습니다 — 새 안건은 회장 직접결재입니다.","good");updateChrome();renderScreen();}
    else if(a==="patch-record")await patchRecord(action.dataset.collection,action.dataset.id,action.dataset.status);
    else if(a==="approve-proposal")await approveProposal(action.dataset.id);
    else if(a==="pause-all")await setControl({paused:true},"모든 자동작업을 일시정지했습니다.");
    else if(a==="resume-all")await setControl({paused:false},"자동작업을 다시 시작했습니다.");
    else if(a==="close-intake")await setControl({intakeClosed:true},"새 작업 접수를 중지했습니다.");
    else if(a==="open-intake")await setControl({intakeClosed:false},"새 작업 접수를 재개했습니다.");
    else if(a==="download-bundle"){const r=records("tasks").find(x=>x.id===action.dataset.id);if(r)download(`robom-task-${r.id}.md`,bundleFor(r));}
    else if(a==="retry-task")await retryTask(action.dataset.id);
    else if(a==="show-loop-evidence"){const lp=(HQ?.loops?.activeLoops||[]).find(x=>x.loopId===action.dataset.id);if(lp){const ev=Object.entries(lp.evidence||{}).map(([k,v])=>`${k}=${v}`).join(" · ")||"아직 수집된 증거 없음";const cr=(lp.acceptanceCriteria||[]).map(c=>c.id).join(", ");showToast(`${lp.objective} · 상태 ${lp.stateLabel||lp.state} · ${lp.iteration}번째 시도 · 기준[${cr}] · 증거: ${ev}`,"good");}}
    else if(a==="set-effort")await setExecutorConfig({effort:action.dataset.effort});
    else if(a==="pick-model")await setExecutorConfig({model:action.dataset.model||""});
    else if(a==="save-model")await setExecutorConfig({model:($("#cxModel")?.value||"").trim()});
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
  // 창 제목(맥 타이틀바·브라우저 탭)에도 버전을 항상 표시 — 다운로드한 버전을 한눈에 확인
  document.title=`ROBOM HQ v${APP_VERSION} · 로봄 본부`;
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
