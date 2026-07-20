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

test("권한 파일이 손상돼도 RUNNING으로 몰래 되돌리지 않는다 — .bak 복구, 없으면 안전 PAUSED", () => {
  // 정지 상태를 저장하면 .bak도 남는다.
  const a = tmp();
  writeAuthority({ mode: "EMERGENCY_STOP" }, a);
  assert.ok(existsSync(join(a, "company-authority.json.bak")), "정상 저장 시 .bak 보존");
  // 원본이 손상돼도 .bak에서 EMERGENCY_STOP을 되살린다(fail-open 아님).
  writeFileSync(join(a, "company-authority.json"), "{손상된 JSON");
  assert.equal(readAuthority(a).mode, "EMERGENCY_STOP", ".bak에서 정지 상태 복구");
  // 원본·백업 모두 손상이면 RUNNING이 아니라 안전 PAUSED로 멈춘다.
  const c = tmp();
  writeFileSync(join(c, "company-authority.json"), "{깨짐");
  writeFileSync(join(c, "company-authority.json.bak"), "{깨짐");
  assert.equal(readAuthority(c).mode, "PAUSED", "복구 불가 시 fail-safe PAUSED(≠RUNNING)");
});

test("전결 분류: 시스템 상신 코드 수정은 위임 가능, 결제·계약·비밀값·홍보는 회장 전용", () => {
  const ok = { requestedBy: "auto-review", title: "러닝봄 CI 실패 확인", body: "실패 로그", recommendation: "수정" };
  assert.equal(isDelegable(ok), true);
  for (const bad of ["신규 유료 결제 승인", "광고 캠페인 홍보 게시", "secret 키 변경", "약관 계약 갱신", "백업 없는 대량 삭제", "App Store 제출",
    // 헌장 필수-회장 범주의 키워드 공백(전결 escape)이었던 것들:
    "개인정보 노출 3건 확인", "개인정보 처리방침 업데이트", "GitHub 계정 전환", "인앱 구매 UI 추가", "환불 정책 반영", "OAuth 자격증명 갱신"]) {
    assert.equal(isDelegable({ requestedBy: "auto-review", title: bad }), false, bad);
  }
  assert.equal(isDelegable({ requestedBy: "chairman", title: "아무거나" }), false, "사람 상신은 전결 대상 아님");
  // 분류기가 '회장 확인 필수(human)'로 판정하면 제목·본문이 무해해 보여도 전결 금지(승인 경계 우회 방지).
  assert.equal(isDelegable({ requestedBy: "auto-review", title: "일반 점검", fixClass: "human" }), false, "fixClass=human은 텍스트와 무관하게 전결 금지");
  assert.equal(isDelegable({ requestedBy: "auto-review", title: "러닝봄 CI 실패 확인", fixClass: "codex" }), true, "fixClass=codex는 위임 가능");
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
