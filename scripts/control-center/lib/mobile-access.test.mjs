import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateMobileToken, readMobileAccess, writeMobileAccess, connectUrls, lanAddresses, mobileTokenExpired, mobileTokenExpiresAt, MOBILE_TOKEN_TTL_MS } from "./mobile-access.mjs";

test("토큰은 12자 이상·헷갈리는 글자(0/O/1/l) 없음·매번 다름", () => {
  const a = generateMobileToken(), b = generateMobileToken();
  assert.ok(a.length >= 12 && b.length >= 12);
  assert.notEqual(a, b);
  assert.ok(!/[0O1lI]/.test(a), `혼동 글자 포함: ${a}`);
  assert.ok(a.startsWith("robom-"));
  // 거부 표집 이후에도 본문은 정확히 11자, 허용 알파벳만 — 길이가 흔들리거나 이상 글자가 끼지 않는다.
  for (let i = 0; i < 50; i++) {
    const t = generateMobileToken();
    assert.match(t, /^robom-[abcdefghjkmnpqrstuvwxyz23456789]{11}$/, `형식 위반: ${t}`);
  }
});

test("상태 파일: 기본 꺼짐 → 켜면 토큰 자동 생성·재시작 후 유지 → 꺼도 토큰 보존", () => {
  const dir = mkdtempSync(join(tmpdir(), "robom-mobile-"));
  assert.equal(readMobileAccess(dir).enabled, false);
  const on = writeMobileAccess({ enabled: true }, dir);
  assert.equal(on.enabled, true);
  assert.ok(on.token.length >= 12);
  const again = readMobileAccess(dir); // 재시작 시뮬레이션
  assert.equal(again.enabled, true);
  assert.equal(again.token, on.token);
  const off = writeMobileAccess({ enabled: false }, dir);
  assert.equal(off.enabled, false);
  assert.equal(off.token, on.token); // 다시 켜면 같은 QR 재사용 가능
});

test("페어링 토큰은 서버가 수명을 강제한다 — TTL 지나면 만료(유출 토큰 무기한 유효 방지)", () => {
  const fresh = { enabled: true, token: "robom-testtoken23", updatedAt: new Date().toISOString() };
  assert.equal(mobileTokenExpired(fresh, new Date()), false, "방금 발급된 토큰은 유효");
  // TTL(+1분) 지난 시각에는 만료
  const issued = Date.parse(fresh.updatedAt);
  assert.equal(mobileTokenExpired(fresh, new Date(issued + MOBILE_TOKEN_TTL_MS + 60_000)), true, "TTL 초과 → 만료");
  // 발급 시각 없음(구버전·수기 편집) → 만료 판정 보류(false, 재발급 시 정상화)
  assert.equal(mobileTokenExpired({ enabled: true, token: "x" }, new Date()), false);
  // expiresAt은 발급+TTL
  assert.equal(mobileTokenExpiresAt(fresh), new Date(issued + MOBILE_TOKEN_TTL_MS).toISOString());
  assert.equal(mobileTokenExpiresAt({}), null);
});

test("접속 URL은 켜졌을 때만·토큰 포함·와이파이 사설망 우선", () => {
  const state = { enabled: true, token: "robom-testtoken23", port: 4323 };
  const urls = connectUrls(state);
  for (const u of urls) {
    assert.ok(u.url.includes("token=robom-testtoken23"));
    assert.ok(u.url.startsWith("http://"));
  }
  assert.deepEqual(connectUrls({ enabled: false, token: "robom-testtoken23", port: 4323 }), []);
  // lanAddresses는 환경 의존 — 형태만 검증
  for (const a of lanAddresses()) assert.ok(/^\d+\.\d+\.\d+\.\d+$/.test(a.ip));
});
