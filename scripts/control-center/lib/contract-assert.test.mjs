import test from "node:test";
import assert from "node:assert/strict";
import { ASSERT_OPS, runAssertions, resolvePath, safeRegex } from "./contract-assert.mjs";

test("연산자는 type을 검증한다 — 문자열 숫자 coercion 금지", () => {
  assert.equal(ASSERT_OPS.gte("5", 1), false); // 문자열은 숫자 비교 실패
  assert.equal(ASSERT_OPS.gte(5, 1), true);
  assert.equal(ASSERT_OPS.finite(Number.NaN), false);
  assert.equal(ASSERT_OPS.date_order_lte("2026-01-01", "2026-02-01"), true);
  assert.equal(ASSERT_OPS.date_order_lte("2026-03-01", "2026-02-01"), false);
});

test("경로 해석은 프로토타입 접근을 차단한다", () => {
  assert.equal(resolvePath({ a: { b: 1 } }, "a.b"), 1);
  assert.equal(resolvePath({}, "__proto__.polluted"), undefined);
  assert.equal(resolvePath([{ x: 2 }], "0.x"), 2);
});

test("위험한 정규식(중첩 수량자·중첩 대체)은 거부한다 — catastrophic backtracking 방지", () => {
  assert.equal(safeRegex("(a+)+b"), null);
  // (a|a)+ 같은 겹치는 대체+반복도 지수적 backtracking을 일으킨다(31자 입력에 실측 73초 지연) —
  // 예전 검사는 그룹 '안'의 수량자만 봐서 대체(|)+바깥 수량자 조합을 놓쳤다.
  assert.equal(safeRegex("(a|a)+"), null);
  assert.equal(safeRegex("^(a|a)+$"), null);
  assert.equal(safeRegex("(a|ab)*x"), null);
  // 대체가 있어도 수량자가 안 붙으면(한 번만 매칭) 안전 — 계속 허용
  assert.ok(safeRegex("(png|jpg|gif)"));
  assert.ok(safeRegex("^v\\d+\\.\\d+"));
});

test("matches_safe_regex는 거부된 패턴에서 항상 false — 위험 패턴이 실행조차 되지 않는다", () => {
  assert.equal(ASSERT_OPS.matches_safe_regex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!", "(a|a)+"), false);
  assert.equal(ASSERT_OPS.matches_safe_regex("v1.2", "^v\\d+\\.\\d+"), true);
});

test("quantifier every·optional이 배열 항목을 판정한다", () => {
  const items = [{ id: "a", url: "https://x.kr" }, { id: "b" }];
  const failed = runAssertions(items, [
    { path: "", op: "nonempty_string", quantifier: "every", itemPath: "id" },
    { path: "", op: "url_https", quantifier: "every", itemPath: "url" }, // b에 url 없음 → 실패
  ]);
  assert.equal(failed.length, 1);
  const okOptional = runAssertions(items[1], [{ path: "url", op: "url_https", optional: true }]);
  assert.equal(okOptional.length, 0);
});

test("거짓 PASS 방지: 빈 배열 every·undefined eq·중복 same_set는 통과하지 않는다", () => {
  // 빈 배열에 every 진공참 금지 — 확인한 원소 0개면 실패
  assert.equal(runAssertions({ routes: [] }, [{ path: "routes", op: "eq", value: 200, quantifier: "every", itemPath: "status" }]).length, 1);
  // 정상(비어있지 않은 배열)은 그대로 통과
  assert.equal(runAssertions({ routes: [{ status: 200 }, { status: 200 }] }, [{ path: "routes", op: "eq", value: 200, quantifier: "every", itemPath: "status" }]).length, 0);
  // 둘 다 없는 필드끼리 'eq'는 거짓 PASS가 아니라 실패
  assert.equal(ASSERT_OPS.eq(undefined, undefined), false);
  assert.equal(ASSERT_OPS.eq(200, 200), true);
  // unique: 빈 배열은 '중복 0개'로 진공참 통과하지 않는다(확인한 원소가 없으면 실패)
  assert.equal(ASSERT_OPS.unique([], undefined), false);
  assert.equal(ASSERT_OPS.unique(["a", "b"], undefined), true);
  assert.equal(ASSERT_OPS.unique(["a", "a"], undefined), false);
  // same_set: 중복이 length를 속여 다른 집합을 통과시키지 못한다
  assert.equal(ASSERT_OPS.same_set([1, 1], [1, 2]), false);
  assert.equal(ASSERT_OPS.same_set([1, 2, 2], [1, 2]), true);
  assert.equal(ASSERT_OPS.same_set([1, 2], [2, 1]), true);
});

test("age_lte_seconds는 주입된 현재 시각으로 판정한다", () => {
  const nowMs = Date.parse("2026-07-19T12:00:00Z");
  assert.equal(ASSERT_OPS.age_lte_seconds("2026-07-19T11:00:00Z", 7200, { nowMs }), true);
  assert.equal(ASSERT_OPS.age_lte_seconds("2026-07-19T05:00:00Z", 7200, { nowMs }), false);
});
