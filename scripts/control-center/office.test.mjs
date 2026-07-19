// 로봄 오피스 맵의 직원 구성·공간·상호작용 계약을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, readAgents, readApps } from "./lib/sources.mjs";

const map = JSON.parse(readFileSync(join(REPO_ROOT, "ops/control-center/app/office-map.json"), "utf8"));
const officeJs = readFileSync(join(REPO_ROOT, "ops/control-center/app/office.js"), "utf8");
const officeHtml = readFileSync(join(REPO_ROOT, "ops/control-center/app/office.html"), "utf8");
const employees = [...map.desks.filter((desk) => !map.products.includes(desk.id)), map.chair, ...map.secretaries];

test("오피스 팀 편성이 실제 조직(agents.yml)과 6개 앱(registry)을 모두 반영한다", () => {
  const deskIds = new Set(map.desks.map((d) => d.id));
  // 실제 직원(에이전트) 전원에게 자리가 있어야 실시간 run이 들어오면 애니메이션된다
  for (const agent of readAgents(REPO_ROOT)) assert.ok(deskIds.has(agent.id), `오피스에 ${agent.id} 자리 없음`);
  // 6개 계열사 앱 셀(out/home/run/cert/cal/note)이 모두 있어야 한다(노트봄 포함)
  const APP_CELL = { outbom: "out", homebom: "home", runningbom: "run", calendarbom: "cal", certbom: "cert", notebom: "note" };
  for (const app of readApps(REPO_ROOT).filter((a) => a.registered !== false)) {
    const cell = APP_CELL[app.id];
    assert.ok(cell && deskIds.has(cell), `오피스에 ${app.id} 앱 셀(${cell}) 없음`);
  }
  // 오피스 정본과 폴백(office.js 내장) 둘 다 같은 팀 색을 정의한다(폴백 누락 방지)
  for (const team of ["design", "data", "support"]) assert.ok(map.teams[team], `팀 색 ${team} 누락`);
  assert.match(officeJs, new RegExp(`design:"|data:"|support:"`));
});

test("직원 캐릭터 27명 — 여성 다수(약 78%) 구성 유지", () => {
  assert.equal(employees.length, 27);
  assert.equal(employees.filter((person) => person.appearance.gender === "male").length, 6);
  assert.equal(employees.filter((person) => person.appearance.gender === "female").length, 21);
});

test("캐릭터 외형은 여러 헤어·의상으로 구분된다", () => {
  const hair = new Set(employees.map((person) => person.appearance.hair));
  const outfits = new Set(employees.map((person) => person.appearance.outfit));
  assert.ok(hair.size >= 8);
  assert.ok(outfits.size >= 8);
  assert.ok(employees.filter((person) => ["long", "ponytail", "waves", "braid", "bun"].includes(person.appearance.hair)).length >= 10);
  for (const style of hair) assert.match(officeJs, new RegExp(`SUPPORTED_HAIR=.*["']${style}["']`));
  for (const outfit of outfits) assert.match(officeJs, new RegExp(`SUPPORTED_OUTFITS=.*["']${outfit}["']`));
  for (const accessory of ["glasses", "headset", "hairAccessory"]) assert.match(officeJs, new RegExp(`a\\.${accessory}`));
});

test("주요 캐릭터는 외부 LPC가 아닌 자체 Canvas SD 렌더러를 사용한다", () => {
  assert.match(officeJs, /CHARACTER_RENDERER="robom-canvas-sd-v1"/);
  assert.match(officeJs, /function drawSdCharacter/);
  assert.match(officeJs, /drawSdHairBack\(ch,m\);drawSdBody\(ch,m,state\);drawSdHead\(ch,m\);drawSdHairFront\(ch,m\);drawSdFace\(ch,m,expression\);drawSdAccessories\(ch,m\)/);
  assert.doesNotMatch(officeJs, /loadSprites|characterSheet|lpc-(?:body|shirt|pants|hair)\.png/);
});

test("업무 상태는 구분 가능한 SD 표정 프리셋에 연결된다", () => {
  const expected = {
    idle: "calm",
    work: "focus",
    verify: "inspect",
    block: "concern",
    meet: "talk",
    approval: "waiting",
    deploy: "proud",
    completed: "joy",
  };
  for (const [state, expression] of Object.entries(expected)) {
    assert.match(officeJs, new RegExp(`${state}:["']${expression}["']`));
  }
  assert.ok(new Set(Object.values(expected)).size >= 6);
  assert.match(officeJs, /function expressionFor\(ch\).*visualState\(ch\)/);
});

test("대기업형 오피스 필수 공간과 비품이 모두 존재한다", () => {
  assert.ok(map.zones.length >= 34, "존 34개 이상(복지·수석부회장 층 포함)");
  const codes = new Set(map.zones.map((zone) => zone.code));
  for (const code of ["CHAIRMAN OFFICE", "EXEC BOARDROOM", "ENGINEERING", "QA DEVICE LAB", "GRAND LOBBY", "DATA CENTER", "NOC", "BACKUP VAULT", "FACILITIES"]) assert.ok(codes.has(code), code);
  const props = new Set(map.zones.flatMap((zone) => zone.props.map((prop) => prop.type)));
  for (const type of ["projector", "projectorScreen", "whiteboard", "serverRack", "storageRack", "receptionDesk", "phoneBooth", "coffeeMachine"]) assert.ok(props.has(type), type);
});

test("각 층은 목적과 두 업무 축을 가지며 최상층 회장실은 가장 크다", () => {
  for (const floor of map.floors) {
    assert.ok(floor.headline);
    assert.ok(floor.purpose);
    assert.ok(floor.access);
    assert.ok(floor.teams.length >= 1);
    assert.ok(floor.zones.length >= 1);
  }
  const chairman = map.zones.find((zone) => zone.code === "CHAIRMAN OFFICE");
  const ordinaryMax = Math.max(...map.zones.filter((zone) => zone.code !== "CHAIRMAN OFFICE").map((zone) => zone.w * zone.h));
  assert.ok(chairman.w * chairman.h > ordinaryMax);
});

test("방문객은 층별 목적·담당·이동 경로를 가지고 1층을 가장 붐비게 한다", () => {
  assert.ok(map.visitors.length >= 10);
  assert.ok(map.visitors.filter((visitor) => visitor.floor === "1F").length >= 6);
  for (const visitor of map.visitors) {
    assert.ok(visitor.purpose);
    assert.ok(visitor.host);
    assert.ok(visitor.route.length >= 4);
  }
  assert.match(officeJs, /visitor:true,route:v\.route/);
  assert.match(officeJs, /ch\.visitor/);
});

test("오피스는 수석부회장 층부터 복지·옥상까지 10개 층으로 탐색된다", () => {
  assert.deepEqual(map.floors.map((floor) => floor.id), ["6F", "5F", "4F", "3F", "2F", "1F", "B1", "B2", "B3", "ROOF"]);
  assert.equal(new Set(map.floors.flatMap((floor) => floor.zones)).size, map.zones.length);
  assert.match(officeHtml, /id="floorNav"/);
  assert.match(officeJs, /function renderFloorNav/);
  assert.match(officeJs, /CURRENT_FLOOR=btn\.dataset\.floor;applyMap\(OFFICE_MAP\)/);
});

test("문은 방 경계에 있고 고체 비품은 방 안에 배치된다", () => {
  for (const zone of map.zones) {
    if (!zone.door) { assert.ok(!zone.walls, `${zone.code}: 벽이 있으면 문이 필요`); continue; }
    const [x, y] = zone.door;
    const onBoundary = x === zone.x || x === zone.x + zone.w - 1 || y === zone.y || y === zone.y + zone.h - 1;
    assert.ok(onBoundary, `${zone.code} door`);
    for (const prop of zone.props.filter((item) => item.solid)) {
      assert.ok(prop.x >= zone.x && prop.x < zone.x + zone.w, `${zone.code}/${prop.type} x`);
      assert.ok(prop.y >= zone.y && prop.y < zone.y + zone.h, `${zone.code}/${prop.type} y`);
    }
  }
});

test("기본 자동 업무 연출 없이 명시적인 전원 시연과 상호작용 계약을 제공한다", () => {
  assert.doesNotMatch(officeJs, /Math\.random\(\).*work/);
  assert.match(officeHtml, /id="demoBtn"/);
  assert.match(officeHtml, /aria-pressed="false">전원 업무 시연/);
  assert.match(officeJs, /function setDemoMode/);
  assert.match(officeJs, /실제 실행 기록이 아닌 화면 연출/);
  assert.match(officeJs, /screenToTile/);
  assert.match(officeJs, /pointers\.size===2/);
  assert.match(officeJs, /prefers-reduced-motion/);
  assert.match(officeJs, /function visualState/);
  assert.match(officeJs, /function expressionFor/);
  assert.match(officeJs, /document\.getElementById\("ariaLive"\)\.textContent/);
  assert.match(officeJs, /blocked:"block"/);
  assert.match(officeJs, /!\["blocked","needs_check","approval_pending","deploying"\]\.includes\(r\.status\)/);
  assert.match(officeHtml, /aria-live="polite"/);
  assert.match(officeHtml, /직원과 공간 상세/);
  assert.match(officeJs, /현재 업무/);
  assert.match(officeJs, /function assignedTaskFor/);
  assert.match(officeJs, /지시된 업무/);
  assert.match(officeJs, /\/api\/company-state/);
  assert.match(officeJs, /function renderZonePanel/);
});
