// 로봄 본부 — 살아있는 아이소메트릭 오피스 게임 (canvas, 무의존).
// 실제 LPC 픽셀 스프라이트(걷기 사이클, 팀색 틴트) + 깔끔한 격자·넓은 복도. 스프라이트 없으면 프로시저럴 폴백.
// 캐릭터가 A*로 걷고·자리에서 일하고·휴게실 휴식·식당 식사·회의실 스탠드업. 연출 금지(실제 이벤트 있을 때만 '일하는 중').
"use strict";
(() => {
const TW=64, TH=32, GW=40, GH=28;
const cv=document.getElementById("game"), ctx=cv.getContext("2d");
ctx.imageSmoothingEnabled=false;
let DPR=Math.min(2,window.devicePixelRatio||1);
let cam={s:1,x:0,y:0,drag:null,fit:true};

// ── 팀 색 ──
const T={cmd:"#4f8fe0",strat:"#9a6cf0",dev:"#2fd08a",qa:"#39b98a",ops:"#f59a3c",sec:"#e8b93c",gold:"#e8b93c",
  out:"#48a7d4",home:"#4da35e",run:"#e0574a",cert:"#5b6ee0",cal:"#2fd0bd"};
const NAMES={"ceo-orchestrator":"비서실장","room-01":"room-01","room-02":"room-02","room-03":"room-03",
  strategist:"전략팀",recorder:"기록팀",builder:"개발팀",planner:"기획팀",inspector:"검사팀",architect:"설계팀",upgrader:"R&D팀",
  "growth-marketer":"홍보팀","release-manager":"릴리즈팀",supervisor:"감독팀",
  out:"야외봄",home:"청약봄",run:"러닝봄",cert:"자격증봄",cal:"캘린더봄"};
const PRODUCT=new Set(["out","home","run","cert","cal"]);

// ── 레이아웃(정렬된 격자, 넓은 복도) ──
// 방: {x,y,w,h,c(러그),s(테두리),label,code}
const ZONES=[
  {x:2,y:2,w:10,h:7,s:"#4f8fe0",label:"🧭 본부·전략실",code:"COMMAND"},
  {x:15,y:2,w:9,h:7,s:"#9a6cf0",label:"💬 회의실",code:"MEETING"},
  {x:28,y:2,w:10,h:7,s:"#e8b93c",label:"👑 회장실",code:"CHAIRMAN"},
  {x:2,y:11,w:9,h:7,s:"#2fd08a",label:"🛠️ 개발·QA실",code:"FLOOR ENG"},
  {x:13,y:11,w:10,h:7,s:"#f59a3c",label:"📣 홍보·보안·릴리스",code:"FLOOR OPS"},
  {x:25,y:11,w:13,h:7,s:"#9a6cf0",label:"📦 프로젝트 룸 · 5 APPS",code:"PROJECTS"},
  {x:2,y:20,w:11,h:6,s:"#2fd0bd",label:"☕ 휴게실",code:"LOUNGE"},
  {x:15,y:20,w:11,h:6,s:"#e8b93c",label:"🍚 구내식당",code:"CAFETERIA"},
  {x:28,y:20,w:10,h:6,s:"#4f8fe0",label:"🖥️ 서버·리셉션",code:"SERVER"},
];
// 책상 [id, x, y] — 직원은 y+1 착석
const DESKS=[
  ["ceo-orchestrator",3,4],["room-01",5,4],["room-02",7,4],["room-03",9,4],["strategist",4,7],["recorder",7,7],
  ["builder",3,13],["planner",5,13],["inspector",7,13],["architect",4,16],["upgrader",7,16],
  ["growth-marketer",14,13],["release-manager",17,13],["supervisor",20,13],
  ["out",27,13],["home",30,13],["run",33,13],["cert",28,16],["cal",31,16],
];
const CHAIR={id:"chairman",name:"황준필 · 회장",x:32,y:4};
const SECS=[["sec-arin","비서 아린",35,4],["sec-sein","비서 세인",35,6]];
const BODY={};DESKS.forEach(([id])=>{ const t= id in NAMES ? (
  ["ceo-orchestrator","room-01","room-02","room-03"].includes(id)?T.cmd:
  ["strategist","recorder","supervisor"].includes(id)?T.strat:
  ["builder","planner","architect"].includes(id)?T.dev:
  ["inspector","upgrader"].includes(id)?T.qa:
  ["growth-marketer","release-manager"].includes(id)?T.ops: T[id]||T.cmd):T.cmd; BODY[id]=t; });
const MEET=[[19,4.4],[16.6,6],[21.4,6],[19,7.8],[17,7],[21,7]]; const MEET_T=[19,6];
const LOUNGE=[[4,22.4],[5.2,22.4],[6.4,22.4],[9,21.4]];
const CAFE=[[17,22.6],[18.4,22.6],[21,22.6],[22.4,22.6],[17,24.4],[21,24.4]]; const CAFE_T=[[17.7,23],[21.7,23]];

// ── 막힌 타일(가구) ──
const BLOCK=new Set(); const K=(c,r)=>c+","+r;
DESKS.forEach(([,x,y])=>BLOCK.add(K(x,y)));
BLOCK.add(K(CHAIR.x,CHAIR.y));BLOCK.add(K(CHAIR.x+1,CHAIR.y));
[[19,6]].forEach(([x,y])=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)BLOCK.add(K(x+a,y+b));});
for(let i=4;i<=7;i++)BLOCK.add(K(i,22)); // 소파
CAFE_T.forEach(([x,y])=>BLOCK.add(K(Math.round(x),Math.round(y))));
[[30,22],[30,24],[34,22]].forEach(([x,y])=>BLOCK.add(K(x,y))); // 서버·리셉션
const walk=(c,r)=>c>=0&&r>=0&&c<GW&&r<GH&&!BLOCK.has(K(c,r));

// ── 투영 ──
const W2=(c,r)=>({x:(c-r)*TW/2,y:(c+r)*TH/2});
const SC=(c,r,z=0)=>{const p=W2(c,r);return{x:p.x*cam.s+cam.x,y:(p.y-z)*cam.s+cam.y};};

// ── A* ──
function astar(a,b){a={c:Math.round(a.c),r:Math.round(a.r)};b={c:Math.round(b.c),r:Math.round(b.r)};
  if(!walk(b.c,b.r)){let bd=1e9,bb=null;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const c=b.c+dc,r=b.r+dr;if(walk(c,r)){const d=dc*dc+dr*dr;if(d<bd){bd=d;bb={c,r};}}}if(bb)b=bb;else return[];}
  const h=n=>Math.abs(n.c-b.c)+Math.abs(n.r-b.r);const open=[{...a,g:0,f:h(a),p:null}],seen=new Map([[K(a.c,a.r),0]]);const N=[[1,0],[-1,0],[0,1],[0,-1]];let gd=0;
  while(open.length&&gd++<6000){open.sort((x,y)=>x.f-y.f);const cur=open.shift();if(cur.c===b.c&&cur.r===b.r){const p=[];let n=cur;while(n){p.unshift({c:n.c,r:n.r});n=n.p;}return p;}
    for(const[dc,dr]of N){const c=cur.c+dc,r=cur.r+dr;if(!walk(c,r))continue;const g=cur.g+1,k=K(c,r);if(seen.has(k)&&seen.get(k)<=g)continue;seen.set(k,g);open.push({c,r,g,f:g+h({c,r}),p:cur});}}
  return[];}

// ── LPC 스프라이트 (걷기 4방향×9프레임, 팀색 틴트) ──
const IMG={}; let SPRITES=false; const teamSheet={};
function tintLayer(img, teamColor){ // img 소스에서 walk rows(8-11, y512)만 추출·틴트 → 576x256 캔버스
  const o=document.createElement("canvas");o.width=576;o.height=256;const c=o.getContext("2d");
  c.drawImage(img,0,512,576,256,0,0,576,256);
  if(teamColor){ c.globalCompositeOperation="multiply";c.fillStyle=teamColor;c.fillRect(0,0,576,256);
    c.globalCompositeOperation="destination-in";c.drawImage(img,0,512,576,256,0,0,576,256);c.globalCompositeOperation="source-over"; }
  return o;
}
function buildSheet(teamColor){
  const o=document.createElement("canvas");o.width=576;o.height=256;const c=o.getContext("2d");
  c.imageSmoothingEnabled=false;
  c.drawImage(tintLayer(IMG.body,null),0,0);          // 피부
  c.drawImage(tintLayer(IMG.pants,"#2a3a58"),0,0);    // 바지(네이비)
  c.drawImage(tintLayer(IMG.shirt,teamColor),0,0);    // 셔츠(팀색)
  c.drawImage(tintLayer(IMG.hair,"#5a4636"),0,0);     // 머리(브라운)
  return o;
}
function loadSprites(){
  const files={body:"./assets/lpc-body.png",shirt:"./assets/lpc-shirt.png",pants:"./assets/lpc-pants.png",hair:"./assets/lpc-hair.png"};
  let n=0,fail=false; const done=()=>{ if(fail){SPRITES=false;return;} const cols=new Set(Object.values(BODY).concat([T.gold],[...PRODUCT].map(p=>T[p]))); cols.forEach(col=>teamSheet[col]=buildSheet(col)); SPRITES=true; };
  for(const k in files){ const im=new Image(); im.onload=()=>{IMG[k]=im; if(++n===4)done();}; im.onerror=()=>{fail=true; if(++n===4)done();}; im.src=files[k]; }
}
const DIR={up:0,left:1,down:2,right:3};

// ── 캐릭터 ──
class Char{
  constructor(id,name,body,home,opt={}){this.id=id;this.name=name;this.body=body;this.home=home;
    this.cx=home.c;this.cy=home.r;this.path=[];this.dest=null;this.act="idle";this.phase=Math.random()*6;
    this.think=Math.random()*4;this.crown=opt.crown;this.locked=opt.locked;this.facing="down";this.walking=false;this.driven=false;this.mstate=false;}
  goto(c,r){const p=astar({c:this.cx,r:this.cy},{c,r});this.path=p.slice(1);this.dest={c,r};}
  setAct(act,tile){this.act=act;if(tile){const t={c:tile[0],r:tile[1]};if(Math.abs(t.c-this.cx)>.4||Math.abs(t.r-this.cy)>.4)this.goto(t.c,t.r);else this.dest={c:t.c,r:t.r};}}
  face(dc,dr){if(Math.abs(dc)>=Math.abs(dr))this.facing=dc>0?"right":"left";else this.facing=dr>0?"down":"up";}
  update(dt){
    if(this.path.length){const n=this.path[0],dx=n.c-this.cx,dy=n.r-this.cy,d=Math.hypot(dx,dy),sp=2.6*dt;
      if(d<=sp){this.cx=n.c;this.cy=n.r;this.path.shift();}else{this.cx+=dx/d*sp;this.cy+=dy/d*sp;this.face(dx,dy);}this.phase+=dt*9;this.walking=true;return;}
    if(this.dest&&(Math.abs(this.dest.c-this.cx)>.03||Math.abs(this.dest.r-this.cy)>.03)){const dx=this.dest.c-this.cx,dy=this.dest.r-this.cy,d=Math.hypot(dx,dy),sp=2.6*dt;if(d<=sp){this.cx=this.dest.c;this.cy=this.dest.r;}else{this.cx+=dx/d*sp;this.cy+=dy/d*sp;this.face(dx,dy);}this.phase+=dt*9;this.walking=true;return;}
    this.walking=false;this.facing=(this.act==="meet")?"down":"down";this.phase+=dt*(this.act==="work"||this.act==="verify"?7:2);}
}
const chars=[],byId={};
DESKS.forEach(([id,x,y])=>{const ch=new Char(id,NAMES[id]||id,BODY[id]||T.cmd,{c:x,r:y+1});chars.push(ch);byId[id]=ch;});
const cm=new Char(CHAIR.id,CHAIR.name,T.gold,{c:CHAIR.x,r:CHAIR.y+1},{crown:true,locked:true});cm.act="chair";chars.push(cm);byId[cm.id]=cm;
SECS.forEach(([id,nm,x,y])=>{const ch=new Char(id,nm,T.sec,{c:x,r:y});chars.push(ch);byId[id]=ch;});

// ── 오토파일럿 ──
const rnd=(a,b)=>a+Math.random()*(b-a);
function autoPlan(ch){if(ch.locked)return;
  if(PRODUCT.has(ch.id)){ch.setAct(Math.random()<.6?"work":"idle",[ch.home.c,ch.home.r]);ch.think=rnd(6,13);return;}
  const r=Math.random();
  if(r<.44)ch.setAct("work",[ch.home.c,ch.home.r]),ch.think=rnd(7,16);
  else if(r<.64){const s=CAFE[Math.floor(Math.random()*CAFE.length)];ch.setAct("eat",s);ch.think=rnd(8,15);}
  else if(r<.82){const s=LOUNGE[Math.floor(Math.random()*LOUNGE.length)];ch.setAct("rest",s);ch.think=rnd(8,15);}
  else{let c,r2,g=0;do{c=Math.floor(rnd(1,GW-1));r2=Math.floor(rnd(2,GH-2));}while(!walk(c,r2)&&g++<25);ch.setAct("walk",[c,r2]);ch.think=rnd(4,8);}}

// ── 회의 ──
let meeting={active:false,until:0,topic:"",members:[]};let nextMeet=performance.now()+rnd(18000,36000);
function startMeeting(mem,topic,dur){meeting={active:true,until:performance.now()+dur,topic,members:mem.map(c=>c.id)};mem.forEach((c,i)=>{if(c.locked)return;c.mstate=true;c.setAct("meet",MEET[i%MEET.length]);});}
function endMeeting(){meeting.members.forEach(id=>{const c=byId[id];if(c){c.mstate=false;c.think=0;}});meeting.active=false;meeting.members=[];}

// ── 실데이터 ──
let SNAP=null;
async function poll(){try{const r=window.__SNAP__?window.__SNAP__:await(await fetch("./snapshot.json",{cache:"no-store"})).json();SNAP=r;applySnap();}catch(e){}}
function applySnap(){if(!SNAP)return;const runs=(SNAP.runs||[]).filter(x=>!["completed","failed"].includes(x.status));const act=new Set();
  runs.forEach(run=>{const id=byId[run.agentId]?run.agentId:(byId[run.appId]?run.appId:null);const c=id&&byId[id];if(!c)return;act.add(c.id);c.driven=true;
    if(run.status==="blocked"||run.status==="needs_check")c.setAct("block",[c.home.c,c.home.r]);
    else if(run.status==="verifying"||run.status==="fixing")c.setAct("verify",[c.home.c,c.home.r]);
    else if(run.status==="approval_pending")c.setAct("approval",[CHAIR.x-1,CHAIR.y+2]);
    else if(run.status==="deploying")c.setAct("deploy",[30,23]);
    else c.setAct("work",[c.home.c,c.home.r]);});
  chars.forEach(c=>{if(!act.has(c.id))c.driven=false;});
  const byApp={};runs.forEach(r=>{if(r.appId)(byApp[r.appId]=byApp[r.appId]||[]).push(r.agentId);});
  for(const a in byApp){if(byApp[a].length>=2&&!meeting.active){const m=byApp[a].map(x=>byId[x]).filter(Boolean);if(m.length>=2)startMeeting(m,`${NAMES[a]||a} 협의`,18000);}}}

// ── 렌더 ──
const RING={work:"#35e39b",verify:"#a879ff",block:"#ff5d6c",meet:"#c9a3ff",rest:"#ffcf4d",eat:"#2fe0c4",idle:"#6f86a8",walk:"#3ba7ff",approval:"#ffd15c",deploy:"#3ba7ff",chair:"#ffd15c"};
const EMO={work:"⌨️",verify:"🔍",block:"⚠️",meet:"💬",rest:"☕",eat:"🍚",idle:"💤",approval:"✋",deploy:"🚀",chair:"",walk:""};
function tileDiamond(c,r,fill,stroke){const p=SC(c,r);const hw=TW/2*cam.s,hh=TH/2*cam.s;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+hw,p.y+hh);ctx.lineTo(p.x,p.y+2*hh);ctx.lineTo(p.x-hw,p.y+hh);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function drawFloor(){
  for(let r=0;r<GH;r++)for(let c=0;c<GW;c++)tileDiamond(c,r,((c+r)&1)?"#0e1a2f":"#10203a","rgba(255,255,255,.02)");
  ZONES.forEach(z=>{for(let r=z.y;r<z.y+z.h;r++)for(let c=z.x;c<z.x+z.w;c++)tileDiamond(c,r,z.s+"14",null);
    // 러그 테두리
    const a=SC(z.x,z.y),b=SC(z.x+z.w,z.y),cc=SC(z.x+z.w,z.y+z.h),d=SC(z.x,z.y+z.h);const hh=TH/2*cam.s;
    ctx.beginPath();ctx.moveTo(a.x,a.y+hh);ctx.lineTo(b.x,b.y+hh);ctx.lineTo(cc.x,cc.y+hh);ctx.lineTo(d.x,d.y+hh);ctx.closePath();ctx.strokeStyle=z.s;ctx.globalAlpha=.4;ctx.lineWidth=1.4;ctx.stroke();ctx.globalAlpha=1;});
}
function isoBox(c,r,w,d,h,top,lf,rt){const g=(cc,rr,z=0)=>SC(cc,rr,z),hh=TH/2*cam.s;
  const A=g(c,r,h),B=g(c+w,r,h),Cc=g(c+w,r+d,h),D=g(c,r+d,h),Bg=g(c+w,r),Cg=g(c+w,r+d),Dg=g(c,r+d);
  const P=(pts,f)=>{ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y+hh);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y+hh);ctx.closePath();ctx.fillStyle=f;ctx.fill();};
  P([D,Cc,Cg,Dg],lf);P([B,Cc,Cg,Bg],rt);P([A,B,Cc,D],top);}
function monitor(c,r,on){const b=SC(c,r),s=cam.s,x=b.x,y=b.y+TH/2*s-13*s,col=on?"#35e39b":"#33475f";
  ctx.fillStyle="#060c16";ctx.fillRect(x-12*s,y-13*s,24*s,16*s);ctx.strokeStyle="#0b1626";ctx.strokeRect(x-12*s,y-13*s,24*s,16*s);
  ctx.fillStyle=col;if(on){ctx.shadowColor=col;ctx.shadowBlur=7*s;}ctx.fillRect(x-9*s,y-10*s,(on?14:8)*s,2*s);ctx.shadowBlur=0;
  ctx.fillStyle=on?"#3ba7ff":"#2a3a52";ctx.fillRect(x-9*s,y-6*s,9*s,2*s);}
function drawChar(ch){
  const b=SC(ch.cx,ch.cy),s=cam.s,x=b.x,y=b.y+TH/2*s;const st=ch.mstate?"meet":ch.act,ring=RING[st]||RING.idle;const sc=ch.crown?1.3:1;
  // 그림자·상태링
  ctx.beginPath();ctx.ellipse(x,y+2*s,15*s*sc,6*s*sc,0,0,7);ctx.fillStyle="rgba(0,0,0,.4)";ctx.fill();
  ctx.beginPath();ctx.ellipse(x,y+2*s,14*s*sc,5.5*s*sc,0,0,7);ctx.strokeStyle=ring;ctx.lineWidth=2.4*s;ctx.shadowColor=ring;ctx.shadowBlur=(ch.driven||ch.walking||ch.mstate)?9*s:3*s;ctx.stroke();ctx.shadowBlur=0;
  if(SPRITES){ const sheet=teamSheet[ch.body]||teamSheet[T.cmd]; if(sheet){
    const dir=DIR[ch.facing]!==undefined?DIR[ch.facing]:2; const fr=ch.walking?(1+Math.floor(ch.phase)%8):0;
    const dw=64*s*0.92*sc,dh=64*s*0.92*sc; ctx.drawImage(sheet, fr*64, dir*64, 64,64, x-dw/2, y-dh+7*s, dw, dh); }
  } else { // 프로시저럴 폴백
    const bob=ch.walking?Math.abs(Math.sin(ch.phase))*3*s:0,by=y-bob;
    ctx.beginPath();ctx.moveTo(x-10*s*sc,by-1*s);ctx.quadraticCurveTo(x-10*s*sc,by-16*s*sc,x,by-16*s*sc);ctx.quadraticCurveTo(x+10*s*sc,by-16*s*sc,x+10*s*sc,by-1*s);ctx.closePath();ctx.fillStyle=ch.body;ctx.fill();
    ctx.beginPath();ctx.arc(x,by-19*s*sc,7*s*sc,0,7);ctx.fillStyle="#f0d0a6";ctx.fill();
    ctx.beginPath();ctx.arc(x,by-21*s*sc,7*s*sc,Math.PI*1.05,Math.PI*1.95);ctx.fillStyle="#5a4636";ctx.fill();
  }
  if(ch.crown){ctx.font=`${13*s}px serif`;ctx.textAlign="center";ctx.fillText("👑",x,y-(SPRITES?58:34)*s);}
  ctx.font=`700 ${9*s}px ui-monospace,monospace`;ctx.textAlign="center";ctx.fillStyle="#dbe7fb";ctx.shadowColor="#000";ctx.shadowBlur=3*s;ctx.fillText(ch.name,x,y+16*s);ctx.shadowBlur=0;
  const em=EMO[st]||"";if(em){ctx.font=`${12*s}px serif`;ctx.fillText(em,x+13*s,y-(SPRITES?50:28)*s);}
}
function furniture(){const it=[];
  DESKS.forEach(([id,x,y])=>it.push({d:x+y,f:()=>{isoBox(x-0.45,y-0.45,0.9,0.62,10,"#2b3a55","#1b2740","#22314c");monitor(x,y,byId[id]&&(byId[id].act==="work"||byId[id].act==="verify"));}}));
  it.push({d:CHAIR.x+CHAIR.y,f:()=>isoBox(CHAIR.x-0.5,CHAIR.y-0.4,2.1,0.8,15,"#4a3c1c","#2a2210","#38300f")});
  it.push({d:MEET_T[0]+MEET_T[1],f:()=>{const p=SC(MEET_T[0],MEET_T[1]),s=cam.s;ctx.beginPath();ctx.ellipse(p.x,p.y+TH/2*s,54*s,27*s,0,0,7);ctx.fillStyle="#20304e";ctx.fill();ctx.beginPath();ctx.ellipse(p.x,p.y+TH/2*s-3*s,46*s,21*s,0,0,7);ctx.fillStyle="#182741";ctx.fill();}});
  it.push({d:5+22,f:()=>isoBox(3.6,21.6,4.2,0.8,9,"#2a3a58","#1a2740","#223050")});
  CAFE_T.forEach(([x,y])=>it.push({d:x+y,f:()=>{isoBox(x-0.45,y-0.45,0.9,0.9,7,"#33425e","#212f47","#2a3850");const p=SC(x,y);ctx.font=`${11*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("🍱",p.x,p.y+TH/2*cam.s-6*cam.s);}}));
  [[30,22],[30,24]].forEach(([x,y])=>it.push({d:x+y,f:()=>isoBox(x-0.4,y-0.4,0.8,0.8,40,"#182238","#0e1626","#111d30")}));
  it.push({d:34+22,f:()=>{isoBox(33.5,21.6,1.6,0.8,11,"#26344e","#18223a","#1e2b44");const p=SC(34,22);ctx.font=`${12*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("🖥️",p.x,p.y+TH/2*cam.s-14*cam.s);}});
  it.push({d:9+21.4,f:()=>{const p=SC(9,21.4);ctx.font=`${13*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("☕",p.x,p.y+TH/2*cam.s);}});
  [[0,9],[12,2],[24,2],[38,9],[0,26],[38,18],[11,18],[12,26]].forEach(([x,y])=>it.push({d:x+y-0.1,f:()=>{const p=SC(x,y);ctx.font=`${13*cam.s}px serif`;ctx.textAlign="center";ctx.fillText("🪴",p.x,p.y+TH/2*cam.s);}}));
  return it;}
function drawLabels(){ctx.textAlign="left";ZONES.forEach(z=>{const p=SC(z.x+0.2,z.y+0.2),s=cam.s;
  ctx.font=`800 ${12*s}px "Pretendard Variable",sans-serif`;ctx.fillStyle="#e3ecfa";ctx.shadowColor="#000";ctx.shadowBlur=4*s;ctx.fillText(z.label,p.x,p.y+8*s);
  ctx.font=`${8*s}px ui-monospace,monospace`;ctx.fillStyle="#8ea3c4";ctx.fillText(z.code,p.x,p.y+20*s);ctx.shadowBlur=0;});}

// ── HUD ──
function updateHUD(){const cnt={work:0,verify:0,block:0,meet:0,rest:0,eat:0};chars.forEach(c=>{if(c.locked)return;const s=c.mstate?"meet":c.act;if(s in cnt)cnt[s]++;});
  document.getElementById("k-work").textContent=cnt.work+cnt.verify;document.getElementById("k-meet").textContent=cnt.meet;
  document.getElementById("k-rest").textContent=cnt.rest+cnt.eat;document.getElementById("k-block").textContent=cnt.block;
  const mb=document.getElementById("meetban");mb.style.display=meeting.active?"flex":"none";if(meeting.active)document.getElementById("meettopic").textContent=meeting.topic+" · "+meeting.members.length+"명";
  const live=!!(SNAP&&SNAP.connections&&(SNAP.connections.github||"").startsWith("connected"));const bd=document.getElementById("mode");bd.textContent=window.__PREVIEW__?"PREVIEW":(live?"LIVE":"AUTO");bd.className="mode "+(window.__PREVIEW__||!live?"warn":"");}
function tickClock(){try{document.getElementById("clock").textContent=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());}catch{}}

// ── 카메라 ──
function fit(){const cs=[W2(0,0),W2(GW,0),W2(0,GH),W2(GW,GH)];let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;cs.forEach(p=>{mnx=Math.min(mnx,p.x);mxx=Math.max(mxx,p.x);mny=Math.min(mny,p.y);mxy=Math.max(mxy,p.y+TH);});
  const W=innerWidth,H=innerHeight,pad=70;cam.s=Math.min((W-pad)/(mxx-mnx),(H-pad-80)/(mxy-mny));cam.s=Math.max(.4,Math.min(cam.s,2));cam.x=W/2-(mnx+mxx)/2*cam.s;cam.y=(H+80)/2-(mny+mxy)/2*cam.s;}
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);cv.width=innerWidth*DPR;cv.height=innerHeight*DPR;cv.style.width=innerWidth+"px";cv.style.height=innerHeight+"px";ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;if(cam.fit)fit();}
addEventListener("resize",resize);
cv.addEventListener("wheel",e=>{e.preventDefault();cam.fit=false;const f=e.deltaY<0?1.1:.9;const W=innerWidth/2,H=innerHeight/2;cam.x=W-(W-cam.x)*f;cam.y=H-(H-cam.y)*f;cam.s=Math.max(.35,Math.min(cam.s*f,3));},{passive:false});
cv.addEventListener("pointerdown",e=>{cam.drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y};cam.fit=false;});
addEventListener("pointermove",e=>{if(cam.drag){cam.x=cam.drag.cx+(e.clientX-cam.drag.x);cam.y=cam.drag.cy+(e.clientY-cam.drag.y);}});
addEventListener("pointerup",()=>cam.drag=null);
document.getElementById("fitBtn").onclick=()=>{cam.fit=true;fit();};

// ── 루프 ──
let last=performance.now();
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;
  chars.forEach(c=>{if(c.locked){c.update(dt);return;}if(c.mstate){c.update(dt);return;}if(c.driven){c.update(dt);return;}c.think-=dt;if(c.think<=0)autoPlan(c);c.update(dt);});
  if(!meeting.active&&now>nextMeet){const free=chars.filter(c=>!c.locked&&!c.driven&&!PRODUCT.has(c.id));if(free.length>=3)startMeeting(free.sort(()=>Math.random()-.5).slice(0,4),"주간 스탠드업",15000);nextMeet=now+rnd(30000,55000);}
  if(meeting.active&&now>meeting.until)endMeeting();
  ctx.clearRect(0,0,cv.width,cv.height);
  drawFloor();
  const it=furniture();chars.forEach(c=>it.push({d:c.cx+c.cy+0.6,f:()=>drawChar(c)}));it.sort((a,b)=>a.d-b.d);it.forEach(o=>o.f());
  drawLabels();updateHUD();requestAnimationFrame(loop);}
loadSprites();resize();poll();setInterval(poll,6000);setInterval(tickClock,1000);tickClock();requestAnimationFrame(loop);
})();
