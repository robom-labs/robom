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

test("위험한 정규식(중첩 수량자)은 거부한다", () => {
  assert.equal(safeRegex("(a+)+b"), null);
  assert.ok(safeRegex("^v\\d+\\.\\d+"));
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

test("age_lte_seconds는 주입된 현재 시각으로 판정한다", () => {
  const nowMs = Date.parse("2026-07-19T12:00:00Z");
  assert.equal(ASSERT_OPS.age_lte_seconds("2026-07-19T11:00:00Z", 7200, { nowMs }), true);
  assert.equal(ASSERT_OPS.age_lte_seconds("2026-07-19T05:00:00Z", 7200, { nowMs }), false);
});
