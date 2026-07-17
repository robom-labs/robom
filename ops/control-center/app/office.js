// 로봄 본부 — 살아있는 아이소메트릭 오피스 게임(2.5D, 순수 canvas·무의존).
// 캐릭터가 길 따라 걷고·타이핑·휴식·식사·회의. 연결 안 돼도 자동(게임 AI)으로 움직이고,
// snapshot.json(실데이터) 연결 시 실제 로봄 작업 상태로 행동한다(연출 금지: 실제 이벤트 있을 때만 '일하는 중').
"use strict";
(() => {
const TW = 64, TH = 32;              // 아이소 타일 폭/높이
const GW = 30, GH = 24;              // 그리드
const cv = document.getElementById("game"), ctx = cv.getContext("2d");
let DPR = Math.min(2, window.devicePixelRatio || 1);
let cam = { s: 1, x: 0, y: 0, drag: null, fit: true };

// ── 색 팔레트 ──
const C = { floorA:"#0f1a2e", floorB:"#12203a", rug:"rgba(255,255,255,.03)",
  wall:"#1a2b47", ink:"#e9eef7", mut:"#8ea3c4",
  work:"#35e39b", verify:"#a879ff", block:"#ff5d6c", meet:"#c9a3ff", rest:"#ffcf4d", eat:"#2fe0c4", idle:"#6f86a8", walk:"#3ba7ff", appr:"#ffd15c" };

// ── 오피스 레이아웃 (한 층 오픈플랜) ──
const ZONES = [
  { x:21,y:1,w:8,h:6, c:"rgba(255,209,92,.10)", s:"#ffd15c", label:"👑 회장실", code:"CHAIRMAN" },
  { x:11,y:3,w:8,h:6, c:"rgba(168,121,255,.10)", s:"#a879ff", label:"💬 회의실", code:"MEETING" },
  { x:0,y:2,w:10,h:6, c:"rgba(59,167,255,.08)", s:"#3ba7ff", label:"🧭 본부·전략실", code:"COMMAND" },
  { x:0,y:9,w:10,h:6, c:"rgba(53,227,155,.08)", s:"#35e39b", label:"🛠️ 개발·QA실", code:"FLOOR ENG" },
  { x:10,y:11,w:9,h:5, c:"rgba(255,157,66,.08)", s:"#ff9d42", label:"📣 홍보·보안·릴리스실", code:"FLOOR OPS" },
  { x:20,y:9,w:9,h:6, c:"rgba(168,121,255,.08)", s:"#a879ff", label:"📦 프로젝트 룸 · 5 APPS", code:"PROJECTS" },
  { x:20,y:16,w:9,h:7, c:"rgba(47,224,196,.08)", s:"#2fe0c4", label:"☕ 휴게실", code:"LOUNGE" },
  { x:9,y:17,w:10,h:6, c:"rgba(255,209,92,.07)", s:"#ffd15c", label:"🍚 구내식당", code:"CAFETERIA" },
  { x:0,y:17,w:8,h:6, c:"rgba(59,167,255,.06)", s:"#3ba7ff", label:"🖥️ 서버·리셉션", code:"OPS ROOM" },
];

// 책상: {x,y = 책상 타일, owner}  (직원은 책상 앞 y+1에 착석)
const DESKS = [
  // 본부·전략
  ["ceo-orchestrator",2,4],["room-01",4,4],["room-02",6,4],["room-03",8,4],["strategist",3,6],["recorder",6,6],
  // 개발·QA
  ["builder",2,11],["planner",4,11],["inspector",6,11],["architect",3,13],["upgrader",6,13],
  // OPS
  ["growth-marketer",11,13],["release-manager",14,13],["supervisor",17,13],
  // 프로젝트(앱 아바타)
  ["out",22,10],["home",25,10],["run",28,10],["cert",23,13],["cal",26,13],
];
// 회장/비서
const CHAIR = { id:"chairman", name:"황준필 · 회장", x:24, y:3, body:"grad-gold", crown:true };
const SECS = [ ["sec-arin","비서 아린",27,4], ["sec-sein","비서 세인",27,6] ];

// 좌석(휴게실 소파 / 식당 / 회의실)
const LOUNGE = [[22,18.4],[23.2,18.4],[24.4,18.4],[26.5,17.6]];
const CAFE = [[11.4,18.6],[12.8,18.6],[15.4,18.6],[16.8,18.6],[11.4,21],[15.4,21]];
const MEET = [[14.5,4.6],[12.7,6],[16.3,6],[14.5,8.2],[12.9,7.3],[16.1,7.3]];
const MEET_TABLE = [14.5,6.6];

// 팀별 색
const TEAM = {
  cmd:"#3ba7ff", strat:"#a879ff", dev:"#35e39b", qa:"#8be0a0", ops:"#ff9d42",
  out:"#48a7d4", home:"#4da35e", run:"#ef6657", cert:"#5b6ee0", cal:"#2fe0c4", sec:"#ffd15c" };
const NAMES = { "ceo-orchestrator":"비서실장","room-01":"room-01","room-02":"room-02","room-03":"room-03",
  strategist:"전략팀",recorder:"기록팀",builder:"개발팀",planner:"기획팀",inspector:"검사팀",
  architect:"설계팀",upgrader:"R&D팀","growth-marketer":"홍보팀","release-manager":"릴리즈팀",supervisor:"감독팀",
  out:"야외봄",home:"청약봄",run:"러닝봄",cert:"자격증봄",cal:"캘린더봄" };
const BODY = { "ceo-orchestrator":TEAM.cmd,"room-01":TEAM.cmd,"room-02":TEAM.cmd,"room-03":TEAM.cmd,
  strategist:TEAM.strat,recorder:TEAM.strat,builder:TEAM.dev,planner:TEAM.dev,inspector:TEAM.qa,
  architect:TEAM.dev,upgrader:TEAM.qa,"growth-marketer":TEAM.ops,"release-manager":TEAM.ops,supervisor:TEAM.strat,
  out:TEAM.out,home:TEAM.home,run:TEAM.run,cert:TEAM.cert,cal:TEAM.cal };
const PRODUCT = new Set(["out","home","run","cert","cal"]);

// ── 투영 ──
const w2 = (c,r)=>({ x:(c-r)*TW/2, y:(c+r)*TH/2 });
const scr = (c,r,z=0)=>{ const p=w2(c,r); return { x:p.x*cam.s+cam.x, y:(p.y-z)*cam.s+cam.y }; };

// ── 막힌 타일 ──
const BLOCK = new Set();
const key=(c,r)=>c+","+r;
DESKS.forEach(([,x,y])=>BLOCK.add(key(x,y)));
BLOCK.add(key(CHAIR.x,CHAIR.y)); BLOCK.add(key(CHAIR.x+1,CHAIR.y));
[[Math.round(MEET_TABLE[0]),Math.round(MEET_TABLE[1])]].forEach(([x,y])=>{BLOCK.add(key(x,y));BLOCK.add(key(x-1,y));BLOCK.add(key(x+1,y));BLOCK.add(key(x,y-1));BLOCK.add(key(x,y+1));});
// 식당 테이블
const CAFE_T=[[12,19],[16,19]]; CAFE_T.forEach(([x,y])=>BLOCK.add(key(x,y)));
// 소파
for(let i=22;i<=25;i++) BLOCK.add(key(i,18));
const walk=(c,r)=> c>=0&&r>=0&&c<GW&&r<GH&&!BLOCK.has(key(c,r));

// ── A* ──
function astar(a,b){
  a={c:Math.round(a.c),r:Math.round(a.r)}; b={c:Math.round(b.c),r:Math.round(b.r)};
  if(!walk(b.c,b.r)){ // 가장 가까운 걷기 가능 타일
    let best=null,bd=1e9; for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const c=b.c+dc,r=b.r+dr;if(walk(c,r)){const d=dc*dc+dr*dr;if(d<bd){bd=d;best={c,r};}}} if(best)b=best; else return [];
  }
  const h=(n)=>Math.abs(n.c-b.c)+Math.abs(n.r-b.r);
  const open=[{...a,g:0,f:h(a),p:null}], seen=new Map([[key(a.c,a.r),0]]);
  const N=[[1,0],[-1,0],[0,1],[0,-1]];
  let guard=0;
  while(open.length&&guard++<4000){
    open.sort((x,y)=>x.f-y.f); const cur=open.shift();
    if(cur.c===b.c&&cur.r===b.r){ const path=[]; let n=cur; while(n){path.unshift({c:n.c,r:n.r});n=n.p;} return path; }
    for(const[dc,dr]of N){ const c=cur.c+dc,r=cur.r+dr; if(!walk(c,r))continue; const g=cur.g+1; const k=key(c,r);
      if(seen.has(k)&&seen.get(k)<=g)continue; seen.set(k,g); open.push({c,r,g,f:g+h({c,r}),p:cur}); } }
  return [];
}

// ── 캐릭터 ──
class Char {
  constructor(id,name,body,home,opts={}){
    this.id=id;this.name=name;this.body=body;this.home=home; // home={c,r} 착석 타일
    this.cx=home.c;this.cy=home.r; this.path=[]; this.dest=null;
    this.act="idle"; this.phase=Math.random()*6; this.think=Math.random()*4;
    this.crown=opts.crown; this.locked=false; this.emote=""; this.msg=""; this.face=1;
  }
  goto(c,r){ const p=astar({c:this.cx,r:this.cy},{c,r}); this.path=p.slice(1); this.dest={c,r}; }
  setAct(act, tile){ this.act=act; if(tile){ const t={c:tile[0],r:tile[1]}; if(Math.abs(t.c-this.cx)>.4||Math.abs(t.r-this.cy)>.4) this.goto(t.c,t.r); else this.dest={c:t.c,r:t.r}; } }
  update(dt){
    // 이동
    if(this.path.length){ const n=this.path[0]; const dx=n.c-this.cx,dy=n.r-this.cy; const d=Math.hypot(dx,dy); const sp=2.4*dt;
      if(d<=sp){ this.cx=n.c;this.cy=n.r;this.path.shift(); } else { this.cx+=dx/d*sp;this.cy+=dy/d*sp; this.face=dx>=0?1:-1; }
      this.phase+=dt*10; this.walking=true; return; }
    if(this.dest && (Math.abs(this.dest.c-this.cx)>.02||Math.abs(this.dest.r-this.cy)>.02)){ // 최종 미세 접근(소수 좌석)
      const dx=this.dest.c-this.cx,dy=this.dest.r-this.cy,d=Math.hypot(dx,dy),sp=2.4*dt;
      if(d<=sp){this.cx=this.dest.c;this.cy=this.dest.r;} else {this.cx+=dx/d*sp;this.cy+=dy/d*sp;} this.phase+=dt*10; this.walking=true; return; }
    this.walking=false; this.phase+=dt*(this.act==="work"||this.act==="verify"?9:2);
  }
}

// ── 로스터 생성 ──
const chars=[];
const homeOf={};
DESKS.forEach(([id,x,y])=>{ homeOf[id]={c:x,r:y+1}; const ch=new Char(id, NAMES[id]||id, BODY[id]||TEAM.cmd, {c:x,r:y+1}); chars.push(ch); });
const chairman=new Char(CHAIR.id, CHAIR.name, "gold", {c:CHAIR.x,r:CHAIR.y+1}, {crown:true}); chairman.locked=true; chairman.act="chair"; chars.push(chairman);
SECS.forEach(([id,nm,x,y])=>{ const ch=new Char(id,nm,TEAM.sec,{c:x,r:y}); ch.homeTile=[x,y]; chars.push(ch); });
const byId={}; chars.forEach(c=>byId[c.id]=c);

// ── 오토파일럿(연결 안 돼도 부지런히) ──
const rnd=(a,b)=>a+Math.random()*(b-a);
function autoPlan(ch){
  if(ch.locked){ return; }
  if(PRODUCT.has(ch.id)){ // 앱 아바타: 대부분 자리에서 대기/작업
    ch.setAct(Math.random()<.6?"work":"idle", [ch.home.c,ch.home.r]); ch.think=rnd(6,13); return; }
  const roll=Math.random();
  if(roll<.42){ ch.setAct("work",[ch.home.c,ch.home.r]); ch.think=rnd(7,16); }
  else if(roll<.62){ const s=CAFE[Math.floor(Math.random()*CAFE.length)]; ch.setAct("eat",s); ch.think=rnd(8,15); }
  else if(roll<.80){ const s=LOUNGE[Math.floor(Math.random()*LOUNGE.length)]; ch.setAct("rest",s); ch.think=rnd(8,15); }
  else { let c,r,g=0; do{c=Math.floor(rnd(1,GW-1));r=Math.floor(rnd(2,GH-2));}while(!walk(c,r)&&g++<20); ch.setAct("walk",[c,r]); ch.think=rnd(4,8); }
}

// ── 회의(스탠드업) — 자동 + 실데이터 ──
let meeting={active:false, until:0, topic:"", members:[]};
function startMeeting(members, topic, dur){
  meeting={active:true, until:performance.now()+dur, topic, members:members.map(c=>c.id)};
  members.forEach((c,i)=>{ if(c.locked)return; c.mstate=true; c.setAct("meet", MEET[i%MEET.length]); });
}
function endMeeting(){ meeting.active=false; meeting.members.forEach(id=>{const c=byId[id]; if(c){c.mstate=false; c.think=0;}}); meeting.members=[]; }
let nextMeet=performance.now()+rnd(20000,40000);

// ── 실데이터 연동 ──
let SNAP=null;
async function poll(){
  try{ const r= window.__SNAP__ ? window.__SNAP__ : await (await fetch("./snapshot.json",{cache:"no-store"})).json(); SNAP=r; applySnap(); }catch(e){ /* 오토파일럿만 */ }
}
function applySnap(){
  if(!SNAP) return;
  const runs=(SNAP.runs||[]).filter(x=>!["completed","failed"].includes(x.status));
  const active=new Set();
  runs.forEach(run=>{
    const id = byId[run.agentId] ? run.agentId : (byId[run.appId]? run.appId : null);
    const c = id && byId[id]; if(!c) return; active.add(c.id); c.driven=true; c.msg=run.task||"";
    if(run.status==="blocked"||run.status==="needs_check"){ c.setAct("block",[c.home.c,c.home.r]); }
    else if(run.status==="verifying"||run.status==="fixing"){ c.setAct("verify",[c.home.c,c.home.r]); }
    else if(run.status==="approval_pending"){ c.setAct("approval",[CHAIR.x-1,CHAIR.y+2]); }
    else if(run.status==="deploying"){ c.setAct("deploy",[2,20]); }
    else { c.setAct("work",[c.home.c,c.home.r]); }
  });
  chars.forEach(c=>{ if(!active.has(c.id)) c.driven=false; });
  // 실데이터 회의: 같은 앱 2명↑ 동시 → 소집
  const byApp={}; runs.forEach(r=>{ if(r.appId) (byApp[r.appId]=byApp[r.appId]||[]).push(r.agentId); });
  for(const app in byApp){ if(byApp[app].length>=2 && !meeting.active){ const mem=byApp[app].map(a=>byId[a]).filter(Boolean); if(mem.length>=2) startMeeting(mem,`${NAMES[app]||app} 협의`,18000); } }
}

// ── 그리기 ──
function drawFloor(){
  ctx.save();
  for(let r=0;r<GH;r++)for(let c=0;c<GW;c++){ const p=scr(c,r); const alt=(c+r)&1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+TW/2*cam.s,p.y+TH/2*cam.s); ctx.lineTo(p.x,p.y+TH*cam.s); ctx.lineTo(p.x-TW/2*cam.s,p.y+TH/2*cam.s); ctx.closePath();
    ctx.fillStyle=alt?"#0e1728":"#101c30"; ctx.fill(); ctx.strokeStyle="rgba(255,255,255,.02)"; ctx.stroke(); }
  // 러그(존)
  ZONES.forEach(z=>{ const a=scr(z.x,z.y),b=scr(z.x+z.w,z.y),cc=scr(z.x+z.w,z.y+z.h),d=scr(z.x,z.y+z.h);
    ctx.beginPath(); ctx.moveTo(a.x,a.y+TH/2*cam.s);ctx.lineTo(b.x,b.y+TH/2*cam.s);ctx.lineTo(cc.x,cc.y+TH/2*cam.s);ctx.lineTo(d.x,d.y+TH/2*cam.s);ctx.closePath();
    ctx.fillStyle=z.c; ctx.fill(); ctx.strokeStyle=z.s; ctx.globalAlpha=.35; ctx.lineWidth=1.5; ctx.stroke(); ctx.globalAlpha=1; });
  ctx.restore();
}
function isoBox(c,r,w,d,h,top,lf,rt){ const z=h*cam.s; const g=(cc,rr,zz=0)=>scr(cc,rr,zz);
  const A=g(c,r,h),B=g(c+w,r,h),Cc=g(c+w,r+d,h),D=g(c,r+d,h),Bg=g(c+w,r),Cg=g(c+w,r+d),Dg=g(c,r+d);
  const P=(pts,f)=>{ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y+TH/2*cam.s);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y+TH/2*cam.s);ctx.closePath();ctx.fillStyle=f;ctx.fill();};
  P([D,Cc,Cg,Dg],lf); P([B,Cc,Cg,Bg],rt); P([A,B,Cc,D],top);
}
function monitor(c,r,on){ const p=scr(c,r,10*cam.s? 0:0); const s=cam.s; const b=scr(c,r); const x=b.x, y=b.y+TH/2*cam.s-14*s;
  ctx.fillStyle="#060c16"; ctx.fillRect(x-13*s,y-14*s,26*s,17*s); ctx.strokeStyle="#0b1626"; ctx.strokeRect(x-13*s,y-14*s,26*s,17*s);
  const col=on?C.work:"#33475f"; ctx.fillStyle=col; if(on){ctx.shadowColor=col;ctx.shadowBlur=8*s;} ctx.fillRect(x-10*s,y-11*s,(on?15:9)*s,2*s); ctx.shadowBlur=0;
  ctx.fillStyle=on?C.walk:"#2a3a52"; ctx.fillRect(x-10*s,y-7*s,10*s,2*s); ctx.fillStyle=col; ctx.globalAlpha=.8; ctx.fillRect(x-10*s,y-3*s,13*s,2*s); ctx.globalAlpha=1;
}
function drawChar(ch){
  const b=scr(ch.cx,ch.cy); const s=cam.s; const x=b.x, y=b.y+TH/2*s;
  const st=ch.mstate?"meet":ch.act; const ring={work:C.work,verify:C.verify,block:C.block,meet:C.meet,rest:C.rest,eat:C.eat,idle:C.idle,walk:C.walk,approval:C.appr,deploy:C.walk,chair:C.appr}[st]||C.idle;
  const bob=ch.walking?Math.abs(Math.sin(ch.phase))*3*s:0;
  const scale=ch.crown?1.35:1;
  // 그림자
  ctx.beginPath(); ctx.ellipse(x,y+2*s,15*s*scale,6*s*scale,0,0,7); ctx.fillStyle="rgba(0,0,0,.4)"; ctx.filter="blur(1px)"; ctx.fill(); ctx.filter="none";
  // 상태 링
  ctx.beginPath(); ctx.ellipse(x,y+2*s,14*s*scale,5.5*s*scale,0,0,7); ctx.strokeStyle=ring; ctx.lineWidth=2.4*s; ctx.shadowColor=ring; ctx.shadowBlur=(ch.driven||ch.walking||ch.mstate)?9*s:3*s; ctx.stroke(); ctx.shadowBlur=0;
  const bx=x, by=y-bob;
  // 몸통
  const bodyFill = ch.body==="gold"?(()=>{const g=ctx.createLinearGradient(bx,by-30*s,bx,by); g.addColorStop(0,"#f2d68a");g.addColorStop(1,"#b8912f");return g;})():ch.body;
  ctx.beginPath(); ctx.moveTo(bx-11*s*scale,by-1*s); ctx.quadraticCurveTo(bx-11*s*scale,by-17*s*scale,bx,by-17*s*scale); ctx.quadraticCurveTo(bx+11*s*scale,by-17*s*scale,bx+11*s*scale,by-1*s); ctx.closePath(); ctx.fillStyle=bodyFill; ctx.fill();
  // 팔(타이핑)
  if((st==="work"||st==="verify")&&!ch.walking){ const t=Math.sin(ch.phase*1.4)*2*s; ctx.fillStyle=bodyFill;
    ctx.fillRect(bx-9*s,by-9*s+t,4*s,7*s); ctx.fillRect(bx+5*s,by-9*s-t,4*s,7*s); }
  // 머리
  ctx.beginPath(); ctx.arc(bx,by-20*s*scale,7.5*s*scale,0,7); ctx.fillStyle="#f0d0a6"; ctx.fill(); ctx.strokeStyle="rgba(0,0,0,.15)"; ctx.stroke();
  ctx.beginPath(); ctx.arc(bx,by-22*s*scale,7.5*s*scale,Math.PI*1.05,Math.PI*1.95); ctx.fillStyle="#3a2c1e"; ctx.fill();
  if(ch.crown){ ctx.font=`${13*s}px serif`; ctx.textAlign="center"; ctx.fillText("👑",bx,by-30*s); }
  // 이름
  ctx.font=`700 ${9*s}px ui-monospace,monospace`; ctx.textAlign="center"; ctx.fillStyle="#dbe7fb"; ctx.shadowColor="#000"; ctx.shadowBlur=3*s; ctx.fillText(ch.name,bx,by+16*s); ctx.shadowBlur=0;
  // 이모트
  const em={work:"⌨️",verify:"🔍",block:"⚠️",meet:"💬",rest:"☕",eat:"🍚",idle:"💤",walk:"",approval:"✋",deploy:"🚀",chair:""}[st]||"";
  if(em){ ctx.font=`${13*s}px serif`; ctx.fillText(em,bx+11*s,by-27*s*scale); }
}

// ── 가구 렌더 목록(깊이정렬) ──
function furniture(){
  const items=[];
  DESKS.forEach(([id,x,y])=>items.push({d:x+y, f:()=>{ isoBox(x-0.45,y-0.45,0.9,0.62,11,"#2b3a55","#1b2740","#22314c"); monitor(x,y,byId[id]&&(byId[id].act==="work"||byId[id].act==="verify")); }}));
  // 회장 책상
  items.push({d:CHAIR.x+CHAIR.y, f:()=>{ isoBox(CHAIR.x-0.5,CHAIR.y-0.4,2.1,0.8,16,"#4a3c1c","#2a2210","#38300f"); }});
  // 회의 원탁
  items.push({d:MEET_TABLE[0]+MEET_TABLE[1], f:()=>{ const p=scr(MEET_TABLE[0],MEET_TABLE[1]); const s=cam.s; ctx.beginPath(); ctx.ellipse(p.x,p.y+TH/2*s,52*s,26*s,0,0,7); ctx.fillStyle="#20304e"; ctx.fill(); ctx.beginPath(); ctx.ellipse(p.x,p.y+TH/2*s-3*s,44*s,20*s,0,0,7); ctx.fillStyle="#182741"; ctx.fill(); }});
  // 소파
  items.push({d:22+18, f:()=>isoBox(21.6,17.6,3.2,0.8,10,"#2a3a58","#1a2740","#223050")});
  // 식당 테이블
  CAFE_T.forEach(([x,y])=>items.push({d:x+y, f:()=>{ isoBox(x-0.45,y-0.45,0.9,0.9,7,"#33425e","#212f47","#2a3850"); const p=scr(x,y);ctx.font=`${11*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("🍱",p.x,p.y+TH/2*cam.s-6*cam.s);}}));
  // 서버랙 + 커피
  items.push({d:2+20, f:()=>{ isoBox(1.6,19.6,0.8,0.8,42,"#182238","#0e1626","#111d30"); const p=scr(2,20);ctx.font=`${12*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("🖥️",p.x,p.y-30*cam.s);}});
  items.push({d:26+17, f:()=>{ const p=scr(26.5,17);ctx.font=`${13*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("☕",p.x,p.y+TH/2*cam.s);}});
  // 식물
  [[0,8],[10,2],[19,3],[29,8],[0,23],[29,15],[10,16]].forEach(([x,y])=>items.push({d:x+y-0.1, f:()=>{const p=scr(x,y);ctx.font=`${13*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("🪴",p.x,p.y+TH/2*cam.s);}}));
  return items;
}

// ── 존 라벨 ──
function drawLabels(){
  ctx.textAlign="left";
  ZONES.forEach(z=>{ const p=scr(z.x+0.3,z.y+0.3); const s=cam.s;
    ctx.font=`800 ${12*s}px "Pretendard Variable",sans-serif`; ctx.fillStyle="#dbe7fb"; ctx.shadowColor="#000"; ctx.shadowBlur=4*s; ctx.fillText(z.label,p.x,p.y+8*s);
    ctx.font=`${8*s}px ui-monospace,monospace`; ctx.fillStyle="#8ea3c4"; ctx.fillText(z.code,p.x,p.y+20*s); ctx.shadowBlur=0; });
}

// ── HUD ──
function updateHUD(){
  const cnt={work:0,verify:0,block:0,meet:0,rest:0,eat:0,idle:0};
  chars.forEach(c=>{ if(c.locked)return; const s=c.mstate?"meet":c.act; if(s in cnt)cnt[s]++; else if(s==="walk")cnt.idle++; });
  document.getElementById("k-work").textContent=cnt.work+cnt.verify;
  document.getElementById("k-meet").textContent=cnt.meet;
  document.getElementById("k-rest").textContent=cnt.rest+cnt.eat;
  document.getElementById("k-block").textContent=cnt.block;
  const mb=document.getElementById("meetban"); mb.style.display=meeting.active?"flex":"none";
  if(meeting.active) document.getElementById("meettopic").textContent=meeting.topic+" · "+meeting.members.length+"명";
  const live=!!(SNAP&&SNAP.connections&&(SNAP.connections.github||"").startsWith("connected"));
  const badge=document.getElementById("mode"); badge.textContent=window.__PREVIEW__?"PREVIEW":(live?"LIVE":"AUTO"); badge.className="mode "+(window.__PREVIEW__||!live?"warn":"");
}
function tickClock(){ try{ document.getElementById("clock").textContent=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()); }catch{} }

// ── 카메라 fit / 조작 ──
function fit(){ const corners=[w2(0,0),w2(GW,0),w2(0,GH),w2(GW,GH)]; let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  corners.forEach(p=>{minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);miny=Math.min(miny,p.y);maxy=Math.max(maxy,p.y+TH);});
  const W=cv.width/DPR,H=cv.height/DPR; const pad=60;
  cam.s=Math.min((W-pad)/(maxx-minx),(H-pad-70)/(maxy-miny)); cam.s=Math.max(.5,Math.min(cam.s,2.2));
  cam.x=W/2-(minx+maxx)/2*cam.s; cam.y=(H+70)/2-(miny+maxy)/2*cam.s;
}
function resize(){ DPR=Math.min(2,window.devicePixelRatio||1); cv.width=innerWidth*DPR; cv.height=innerHeight*DPR; cv.style.width=innerWidth+"px"; cv.style.height=innerHeight+"px"; ctx.setTransform(DPR,0,0,DPR,0,0); if(cam.fit)fit(); }
addEventListener("resize",resize);
cv.addEventListener("wheel",e=>{ e.preventDefault(); cam.fit=false; const f=e.deltaY<0?1.1:.9; cam.s=Math.max(.4,Math.min(cam.s*f,3)); },{passive:false});
cv.addEventListener("pointerdown",e=>{cam.drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y};cam.fit=false;});
addEventListener("pointermove",e=>{ if(cam.drag){cam.x=cam.drag.cx+(e.clientX-cam.drag.x);cam.y=cam.drag.cy+(e.clientY-cam.drag.y);} });
addEventListener("pointerup",()=>cam.drag=null);
document.getElementById("fitBtn").onclick=()=>{cam.fit=true;fit();};

// ── 루프 ──
let last=performance.now();
function loop(now){
  const dt=Math.min(.05,(now-last)/1000); last=now;
  // 오토파일럿 think
  chars.forEach(c=>{ if(c.locked||c.mstate)return; if(c.driven){return;} c.think-=dt; if(c.think<=0) autoPlan(c); c.update(dt); });
  chars.forEach(c=>{ if(c.locked){c.update(dt);return;} if(c.driven||c.mstate)c.update(dt); });
  // 회의 스케줄
  if(!meeting.active && now>nextMeet){ const free=chars.filter(c=>!c.locked&&!c.driven&&!PRODUCT.has(c.id)); if(free.length>=3){ const pick=free.sort(()=>Math.random()-.5).slice(0,4); startMeeting(pick,"주간 스탠드업",16000);} nextMeet=now+rnd(35000,60000); }
  if(meeting.active && now>meeting.until) endMeeting();
  // 렌더
  ctx.clearRect(0,0,cv.width,cv.height);
  drawFloor();
  const items=furniture();
  chars.forEach(c=>items.push({d:c.cx+c.cy+0.5, f:()=>drawChar(c)}));
  items.sort((a,b)=>a.d-b.d); items.forEach(it=>it.f());
  drawLabels();
  updateHUD();
  requestAnimationFrame(loop);
}
resize(); poll(); setInterval(poll,6000); setInterval(tickClock,1000); tickClock();
requestAnimationFrame(loop);
})();
