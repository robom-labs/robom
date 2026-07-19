// 회사 권한·가동 — 마이그레이션·전결 분류·상태 전환.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAuthority, writeAuthority, isDelegable } from "./company-authority.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "robom-auth-"));

test("v1.8 interval>0 → RUNNING, 0 → PAUSED로 1회 마이그레이션(backup 보존)", () => {
  const a = tmp();
  writeFileSync(join(a, "review-schedule.json"), JSON.stringify({ everyMinutes: 30 }));
  assert.equal(readAuthority(a).mode, "RUNNING");
  assert.ok(existsSync(join(a, "review-schedule.json.migrated-backup")), "backup 보존");
  const b = tmp();
  writeFileSync(join(b, "review-schedule.json"), JSON.stringify({ everyMinutes: 0 }));
  assert.equal(readAuthority(b).mode, "PAUSED", "사용자가 꺼둔 상태를 몰래 켜지 않는다");
});

test("전결 분류: 시스템 상신 코드 수정은 위임 가능, 결제·계약·비밀값·홍보는 회장 전용", () => {
  const ok = { requestedBy: "auto-review", title: "러닝봄 CI 실패 확인", body: "실패 로그", recommendation: "수정" };
  assert.equal(isDelegable(ok), true);
  for (const bad of ["신규 유료 결제 승인", "광고 캠페인 홍보 게시", "secret 키 변경", "약관 계약 갱신", "백업 없는 대량 삭제", "App Store 제출"]) {
    assert.equal(isDelegable({ requestedBy: "auto-review", title: bad }), false, bad);
  }
  assert.equal(isDelegable({ requestedBy: "chairman", title: "아무거나" }), false, "사람 상신은 전결 대상 아님");
});

test("모드·전결 전환은 지속 저장되고 delegatedAt이 기록된다", () => {
  const a = tmp();
  readAuthority(a);
  const d = writeAuthority({ approvalMode: "VICE_CHAIR_DELEGATED" }, a);
  assert.ok(d.delegatedAt, "위임 시각 기록");
  assert.equal(readAuthority(a).approvalMode, "VICE_CHAIR_DELEGATED");
  const off = writeAuthority({ approvalMode: "CHAIRMAN_DIRECT" }, a);
  assert.equal(off.delegatedAt, null);
  const paused = writeAuthority({ mode: "PAUSED" }, a);
  assert.equal(readAuthority(a).mode, "PAUSED");
  assert.throws(() => writeAuthority({ mode: "WRONG" }, a));
});
