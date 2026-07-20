// 로봄 운영 watchdog의 자산 탐색과 신선도 경계를 고정한다.
import assert from "node:assert/strict";
import test from "node:test";
import { cacheBustedUrl, certExpiryDays, dataProbeState, extractAssetUrls, freshnessState, inspectCertbomSourceWorkflow } from "./operations-watchdog.mjs";

test("상대·절대 운영 자산만 같은 origin에서 수집한다", () => {
  const urls = extractAssetUrls(
    '<script src="./assets/app.js"></script><link href="/app.css" rel="stylesheet"><script src="https://other.test/x.js"></script>',
    "https://robom.kr/get/outbom/",
  );
  assert.deepEqual(urls, [
    "https://robom.kr/get/outbom/assets/app.js",
    "https://robom.kr/app.css",
  ]);
});

test("48시간 전후의 중앙 확인 상태를 구분한다", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  assert.equal(freshnessState("2026-07-15T12:00:00Z", now).status, "fresh");
  assert.equal(freshnessState("2026-07-14T11:59:59Z", now).status, "stale");
  assert.equal(freshnessState("invalid", now).status, "missing");
});

test("데이터 probe는 기준 시간·헤더 부재를 구분한다", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  assert.equal(dataProbeState("2026-07-16T08:00:00Z", now, 6).status, "fresh");
  assert.equal(dataProbeState("2026-07-16T05:00:00Z", now, 6).status, "stale");
  assert.equal(dataProbeState(null, now, 6).status, "missing");
});

test("미래 시각(시계 오류·placeholder)은 fresh로 위장하지 않고 future로 표시한다", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  assert.equal(freshnessState("2026-07-16T18:00:00Z", now).status, "future"); // 6시간 미래
  assert.equal(freshnessState("9999-01-01T00:00:00Z", now).status, "future"); // placeholder
  assert.equal(freshnessState("2026-07-16T12:05:00Z", now).status, "fresh");   // 5분 미래는 skew 허용
  // dataProbe도 미래 헤더를 fresh로 통과시키지 않는다(≠ fresh → 상류에서 FAIL 처리).
  assert.notEqual(dataProbeState("2030-01-01T00:00:00Z", now, 6).status, "fresh");
});

test("TLS 인증서 잔여일을 계산한다", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  assert.equal(Math.floor(certExpiryDays("Aug  5 12:00:00 2026 GMT", now)), 20);
  assert.equal(certExpiryDays("invalid", now), null);
});

test("운영 점검 URL에 CDN 캐시 우회 marker를 붙인다", () => {
  const url = new URL(cacheBustedUrl("https://robom.kr/?existing=1", 1234));
  assert.equal(url.searchParams.get("existing"), "1");
  assert.equal(url.searchParams.get("robom-watchdog"), "1234");
});

test("certbom source workflow 조회는 HTTP 오류 응답과 네트워크 예외를 다르게 처리한다", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  // 응답을 받았다는 것은 GitHub가 확정적으로 답했다는 뜻(토큰 만료·권한·워크플로 삭제 등) → FAIL로
  // 승격돼야 한다. BLOCKED_EXTERNAL로 묻으면 영구 실패가 무기한 마스킹된다.
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  const httpError = await inspectCertbomSourceWorkflow(new Date("2026-07-16T12:00:00Z"));
  assert.equal(httpError.status, "FAIL");
  assert.match(httpError.detail, /HTTP 404/);

  // fetch 자체가 던지는 경우(DNS·타임아웃)만 진짜 일시적 도달 불가 → BLOCKED_EXTERNAL 유지.
  globalThis.fetch = async () => { throw new Error("network unreachable"); };
  const networkError = await inspectCertbomSourceWorkflow(new Date("2026-07-16T12:00:00Z"));
  assert.equal(networkError.status, "BLOCKED_EXTERNAL");
});
