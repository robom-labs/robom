// 로봄 오피스 맵의 직원 구성·공간·상호작용 계약을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/sources.mjs";

const map = JSON.parse(readFileSync(join(REPO_ROOT, "ops/control-center/app/office-map.json"), "utf8"));
const officeJs = readFileSync(join(REPO_ROOT, "ops/control-center/app/office.js"), "utf8");
const officeHtml = readFileSync(join(REPO_ROOT, "ops/control-center/app/office.html"), "utf8");
const employees = [...map.desks.filter((desk) => !map.products.includes(desk.id)), map.chair, ...map.secretaries];

test("직원 캐릭터는 남성 20%, 여성 80%로 구성된다", () => {
  assert.equal(employees.length, 20);
  assert.equal(employees.filter((person) => person.appearance.gender === "male").length, 4);
  assert.equal(employees.filter((person) => person.appearance.gender === "female").length, 16);
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
  assert.equal(map.zones.length, 12);
  const codes = new Set(map.zones.map((zone) => zone.code));
  for (const code of ["BOARD ROOM", "ENGINEERING", "OPERATIONS", "DESIGN LAB", "RECEPTION", "NOC", "STORAGE"]) assert.ok(codes.has(code), code);
  const props = new Set(map.zones.flatMap((zone) => zone.props.map((prop) => prop.type)));
  for (const type of ["projector", "projectorScreen", "whiteboard", "serverRack", "storageRack", "receptionDesk", "phoneBooth", "coffeeMachine"]) assert.ok(props.has(type), type);
});

test("오피스는 경영부터 시스템까지 6개 층으로 탐색된다", () => {
  assert.deepEqual(map.floors.map((floor) => floor.id), ["5F", "4F", "3F", "2F", "1F", "B1"]);
  assert.equal(new Set(map.floors.flatMap((floor) => floor.zones)).size, map.zones.length);
  assert.match(officeHtml, /id="floorNav"/);
  assert.match(officeJs, /function renderFloorNav/);
  assert.match(officeJs, /CURRENT_FLOOR=btn\.dataset\.floor;applyMap\(OFFICE_MAP\)/);
});

test("문은 방 경계에 있고 고체 비품은 방 안에 배치된다", () => {
  for (const zone of map.zones) {
    const [x, y] = zone.door;
    const onBoundary = x === zone.x || x === zone.x + zone.w - 1 || y === zone.y || y === zone.y + zone.h - 1;
    assert.ok(onBoundary, `${zone.code} door`);
    for (const prop of zone.props.filter((item) => item.solid)) {
      assert.ok(prop.x >= zone.x && prop.x < zone.x + zone.w, `${zone.code}/${prop.type} x`);
      assert.ok(prop.y >= zone.y && prop.y < zone.y + zone.h, `${zone.code}/${prop.type} y`);
    }
  }
});

test("업무 연출 없이 상호작용·모바일·접근성 계약을 제공한다", () => {
  assert.doesNotMatch(officeJs, /Math\.random\(\).*work/);
  assert.match(officeJs, /screenToTile/);
  assert.match(officeJs, /pointers\.size===2/);
  assert.match(officeJs, /prefers-reduced-motion/);
  assert.match(officeJs, /function visualState/);
  assert.match(officeJs, /function expressionFor/);
  assert.match(officeJs, /document\.getElementById\("ariaLive"\)\.textContent/);
  assert.match(officeJs, /blocked:"block"/);
  assert.match(officeJs, /!\["blocked","needs_check","approval_pending","deploying"\]\.includes\(r\.status\)/);
  assert.match(officeHtml, /aria-live="polite"/);
  assert.match(officeHtml, /직원 작업 상세/);
});
