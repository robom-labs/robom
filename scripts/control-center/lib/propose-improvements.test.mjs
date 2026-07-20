// 자동 개선 제안 생성기 — 실제 신호에서만, 중복 없이, 우선순위대로.
import test from "node:test";
import assert from "node:assert/strict";
import { generateProposals } from "./propose-improvements.mjs";

const snap = (apps) => ({ apps });

test("장애·경고·다음행동에서만 제안하고 우선순위대로 정렬한다", () => {
  const s = snap([
    { id: "robom", name: "로봄", health: "ok" }, // 본사는 제외
    { id: "runningbom", name: "러닝봄", health: "down", blocked: "접수 링크 깨짐" },
    { id: "homebom", name: "청약봄", health: "warn", production: { warnings: ["데이터 갱신 지연"] } },
    { id: "outbom", name: "야외봄", health: "ok", nextActions: ["예보 fallback 개선"] },
  ]);
  const out = generateProposals(s, [], { limit: 5 });
  assert.ok(out.length >= 3);
  assert.equal(out[0].appId, "runningbom"); // urgent(장애)가 최상위
  assert.equal(out[0].priority, "urgent");
  assert.ok(out.some((p) => p.appId === "homebom" && p.priority === "high"));
  assert.ok(out.some((p) => p.appId === "outbom" && p.priority === "normal"));
  assert.ok(out.every((p) => p.appId !== "robom"), "본사는 제안 대상 아님");
  for (const p of out) { assert.ok(p.title && p.recommendation && p.key); }
});

test("이미 올라온 제안(proposalKey)은 중복 생성하지 않는다", () => {
  const s = snap([{ id: "homebom", name: "청약봄", health: "warn", production: { warnings: ["지연"] } }]);
  const existing = [{ proposalKey: "homebom:warn", status: "pending" }];
  assert.equal(generateProposals(s, existing).length, 0);
  assert.equal(generateProposals(s, []).length, 1);
});

test("가짜 문제는 안 만든다 — 건강한 앱엔 정직한 '성장 지시'만(회장 요구 8)", () => {
  // 건강한 앱: 장애·경고를 지어내지 않되, 유지보수에 머물지 않도록 정직한 성장 지시 하나를 세운다.
  const out = generateProposals(snap([{ id: "outbom", name: "야외봄", health: "ok" }]), []);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, "outbom:grow");
  assert.equal(out[0].priority, "low"); // 실제 문제보다 뒤
  assert.match(out[0].body, /급한 장애나 대기 중 개선이 없습니다/); // 문제를 지어내지 않고 정직히 밝힘
  assert.match(out[0].recommendation, /Codex/); // 창의적 발굴은 Codex 실행 단계
  // 이미 이 앱에 대기 중 제안이 있으면 성장 지시는 중복 생성하지 않는다
  assert.equal(generateProposals(snap([{ id: "outbom", name: "야외봄", health: "ok" }]), [{ proposalKey: "outbom:grow", status: "pending" }]).length, 0);
  // 입력이 없으면 빈 배열
  assert.deepEqual(generateProposals(null, []), []);
});
