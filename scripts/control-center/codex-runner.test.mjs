// Codex 실행기 순수 함수 계약 — 실패 분류가 모델의 자유 서술에 속지 않는지 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyCodexFailure, resolveWorkdir } from "./codex-runner.mjs";

test("실패 분류는 stderr의 구체 신호만 본다 — stdout 산문에 속지 않는다", () => {
  // 실제 원인: 용량/로그인은 stderr의 구조화된 토큰으로 판정
  assert.equal(classifyCodexFailure("Error: insufficient_quota", "").kind, "quota");
  assert.equal(classifyCodexFailure("HTTP 429 Too Many Requests", "").kind, "quota");
  assert.equal(classifyCodexFailure("resource_exhausted", "").kind, "quota");
  assert.equal(classifyCodexFailure("Error: not logged in", "").kind, "auth");
  assert.equal(classifyCodexFailure("HTTP 401 Unauthorized", "").kind, "auth");

  // 모델이 작업 내용으로 auth/login/billing/401/429를 '언급'한 것은 실패 원인이 아니다 → 일반 error
  assert.equal(classifyCodexFailure("build failed", "작업: 로그인(login) 페이지에 401 처리를 추가하고 billing 안내를 넣었습니다").kind, "error");
  assert.equal(classifyCodexFailure("syntax error at App.tsx:12", "테스트 중 서버가 429를 반환했습니다").kind, "error");
  assert.equal(classifyCodexFailure("", "auth 관련 유틸을 리팩터링했습니다").kind, "error");

  // stdout의 아주 구체적인 구조화 토큰은 안전망으로 인정
  assert.equal(classifyCodexFailure("", "the API returned insufficient_quota").kind, "quota");
});

test("resolveWorkdir은 안전하지 않은 저장소 이름(경로 탈출)을 거부한다", () => {
  const root = "/home/user/robom";
  // '..'·경로 구분자 섞인 이름은 작업 디렉터리가 의도 밖으로 이동할 수 있어 null.
  assert.equal(resolveWorkdir({ target_repo: "robom-labs/.." }, root), null);
  assert.equal(resolveWorkdir({ target_repo: "x/../.." }, root), null);
  assert.equal(resolveWorkdir({ target_repo: "robom-labs/a/../../etc" }, root), null);
  // robom 자신은 이 저장소 루트.
  assert.equal(resolveWorkdir({ target_repo: "robom-labs/robom" }, root), root);
  // 정상 slug이지만 형제 클론이 없으면(.git 부재) null — 안전하게 실행 안 함.
  assert.equal(resolveWorkdir({ target_repo: "robom-labs/nonexistent-app-xyz" }, root), null);
});
