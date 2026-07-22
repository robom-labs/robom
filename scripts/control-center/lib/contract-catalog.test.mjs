import test from "node:test";
import assert from "node:assert/strict";
import { buildContractCatalog, catalogCoverage, MIN_CONTRACTS } from "./contract-catalog.mjs";
import { EVALUATOR_NAMES } from "./contract-engine.mjs";
import { readApps, REPO_ROOT } from "./sources.mjs";

const registryApps = readApps(REPO_ROOT).filter((a) => a.registered);
const contracts = buildContractCatalog({ registryApps, siteVersion: "0.0.0" });

test("프롬프트 최소 계약 수를 모든 타깃이 충족한다(§9~§17)", () => {
  const byTarget = {};
  for (const c of contracts) byTarget[c.target] = (byTarget[c.target] || 0) + 1;
  for (const [target, min] of Object.entries(MIN_CONTRACTS)) {
    assert.ok((byTarget[target] || 0) >= min, `${target}: ${byTarget[target] || 0} < 최소 ${min}`);
  }
  assert.ok(byTarget.company >= 6, "회사 전역 선행 계약");
  assert.ok(contracts.length >= 200, `전체 계약 ${contracts.length} < 200`);
});

test("계약 id 중복 0 · evaluator 미등록 0 (§9.7 게이트)", () => {
  const ids = new Set();
  for (const c of contracts) {
    assert.ok(!ids.has(c.id), `중복 id: ${c.id}`);
    ids.add(c.id);
    assert.ok(EVALUATOR_NAMES.includes(c.evaluator), `${c.id}: 미등록 evaluator ${c.evaluator}`);
  }
});

test("need_new_source 계약은 §18 메타데이터(source_needed 등)를 전부 갖는다", () => {
  const nns = contracts.filter((c) => c.needNewSource);
  assert.ok(nns.length >= 2, "실측 불가 항목을 숨기지 말고 정직 표기");
  // 표면 substring으로 특정 기능을 증명 못 하는 계약은 거짓 green(PASS) 대신 need_new_source로 정직 표기한다.
  for (const cid of ["offline-shell", "stale-banner", "pipeline-workflow"]) {
    assert.ok(nns.some((c) => c.id.endsWith(`:${cid}`)), `${cid}는 진공 marker green이 아니라 need_new_source여야 함`);
  }
  for (const c of nns) {
    for (const k of ["sourceNeeded", "whyNeeded", "privacyRisk", "freeImplementationOption", "fallbackStatus"]) {
      assert.ok(c[k], `${c.id}: ${k} 누락`);
    }
  }
});

test("4개 앱 전부에 production·PWA·보안·버전·데이터 범주 계약이 존재한다", () => {
  for (const app of registryApps) {
    const mine = contracts.filter((c) => c.target === app.id);
    for (const cat of ["production", "pwa", "security", "version"]) {
      assert.ok(mine.some((c) => c.category === cat), `${app.id}: ${cat} 계약 없음`);
    }
    assert.ok(mine.some((c) => c.evaluator === "browser_smoke"), `${app.id}: 브라우저 심층 smoke 없음`);
  }
});

test("threshold에 주관 문장이 없다 — config는 수치·enum·목록만", () => {
  for (const c of contracts) {
    const json = JSON.stringify(c.config || {});
    assert.ok(!/충분히|적당|좋음|빠름/.test(json), `${c.id}: 주관 threshold`);
  }
});

test("mutating probe 금지 — 계약 config에 POST·DELETE 요청이 없다", () => {
  for (const c of contracts) {
    const method = c.config?.method;
    assert.ok(!method || ["GET", "HEAD"].includes(method), `${c.id}: mutating method ${method}`);
  }
});

test("청약봄 수집 파이프라인 계약은 git push 빈도를 대리 신호로 쓰지 않는다(false alarm 방지)", () => {
  // 실제 수집은 Supabase pg_cron(15분 주기)이 맡고 GitHub Actions와 무관하다. workflowFile 없는
  // github_actions 계약은 main의 '가장 최근 아무 run'(CI·Pages 배포 등)의 나이를 보므로, 며칠 커밋이
  // 없으면 수집이 멀쩡해도 "워크플로가 죽으면 수집이 멈춥니다"라는 거짓 인과로 오경보한다.
  const c = contracts.find((x) => x.id === "c:homebom:pipeline-workflow");
  assert.ok(c, "pipeline-workflow 계약이 존재해야 함");
  assert.notEqual(c.evaluator, "github_actions", "GH Actions 최근 run 나이를 수집 파이프라인 대리 신호로 쓰면 안 됨(push 빈도 ≠ 수집 상태)");
  assert.equal(c.evaluator, "need_new_source");
});

test("coverage 집계 — 정의 진단률 100%", () => {
  const cov = catalogCoverage(contracts);
  assert.equal(cov.definedRate, 1);
  assert.equal(cov.total, contracts.length);
  assert.ok(cov.executable > cov.total * 0.9, "실행 가능 계약이 90% 이상");
});
