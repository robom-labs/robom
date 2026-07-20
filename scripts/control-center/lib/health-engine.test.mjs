// health 엔진 — 결정론적 판정·anti-flap·전역 네트워크 선행·incident/회복.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHealthEngine, collectRawResults, HEALTH_STATUS } from "./health-engine.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "robom-health-"));
const app = (id, over = {}) => ({ id, name: id, url: `https://x/${id}`, production: { status: "PASS" }, ci: [], openPrs: [], nextActions: [], ...over });
const snap = (apps, over = {}) => ({ generatedAt: new Date().toISOString(), apps, ...over });

test("critical 운영 실패도 2회 연속에서 확정된다(순간 blip 단발 헛경보 방지)", () => {
  const dir = tmp();
  const s = snap([app("outbom"), app("homebom", { production: { status: "FAIL", warnings: ["502"] } })]);
  const r1 = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:00:00Z") });
  assert.equal(r1.newIncidents.length, 0, "1회 실패(순간 blip 가능)로는 확정하지 않음");
  const r2 = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:10:00Z") });
  assert.equal(r2.summary.fail >= 1, true);
  const inc = r2.newIncidents.find((i) => i.target === "homebom" && i.category === "production");
  assert.ok(inc, "critical도 2회 연속에서 incident 생성");
  assert.equal(inc.severity, "critical");
  assert.match(inc.userImpact, /homebom/);
});

test("warning(STALE)은 연속 2회에서 확정된다(anti-flap)", () => {
  const dir = tmp();
  const s = snap([app("homebom", { production: { status: "STALE", warnings: ["지연"] } })]);
  const r1 = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:00:00Z") });
  assert.equal(r1.newIncidents.length, 0, "1회차는 확정 아님");
  const r2 = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:10:00Z") });
  assert.equal(r2.newIncidents.length, 1, "2회차에 확정");
});

test("회복은 연속 2회 PASS에서 닫힌다", () => {
  const dir = tmp();
  const fail = snap([app("homebom", { production: { status: "FAIL" } })]);
  runHealthEngine({ snapshot: fail, runtimeDir: dir, now: new Date("2026-07-19T00:00:00Z") }); // 1회
  runHealthEngine({ snapshot: fail, runtimeDir: dir, now: new Date("2026-07-19T00:05:00Z") }); // 2회 연속 → incident 확정
  const ok = snap([app("homebom", { production: { status: "PASS" } })]);
  const rr1 = runHealthEngine({ snapshot: ok, runtimeDir: dir, now: new Date("2026-07-19T00:10:00Z") });
  assert.equal(rr1.recoveries.length, 0, "1회 PASS로는 회복 아님");
  const rr2 = runHealthEngine({ snapshot: ok, runtimeDir: dir, now: new Date("2026-07-19T00:20:00Z") });
  assert.equal(rr2.recoveries.length, 1, "연속 2회 PASS에서 회복");
});

test("전역 네트워크 장애: 앱별 critical 스팸 대신 회사 incident 1건", () => {
  const dir = tmp();
  const s = snap([
    app("outbom", { production: { status: "FAIL" } }),
    app("homebom", { production: { status: "FAIL" } }),
    app("runningbom", { production: null }),
  ]);
  const raw = collectRawResults(s, { now: new Date() });
  const companyNet = raw.find((r) => r.contractId === "company:network");
  assert.ok(companyNet, "회사 네트워크 결과 존재");
  // 앱 production은 UNAVAILABLE로 강등(critical 아님)
  const appProd = raw.filter((r) => r.category === "production" && r.target !== "company");
  assert.ok(appProd.every((r) => r.status === HEALTH_STATUS.UNAVAILABLE), "앱 운영은 UNAVAILABLE로 강등");
});

test("단일 앱 실패 + 다른 앱 미점검(null)은 전역 네트워크로 오인해 가리지 않는다", () => {
  // 미점검(null)을 FAIL로 취급하던 버그: 무관한 앱이 아직 점검 안 됐다는 이유로 진짜 단일 장애가 숨겨졌다.
  const s = snap([
    app("homebom", { production: { status: "FAIL" } }), // 실제 장애
    app("outbom", { production: null }),                 // 아직 미점검
  ]);
  const raw = collectRawResults(s, { now: new Date() });
  assert.ok(!raw.find((r) => r.contractId === "company:network"), "전역 네트워크로 오판하지 않음");
  const homebomProd = raw.find((r) => r.contractId === "production:homebom");
  assert.equal(homebomProd.status, HEALTH_STATUS.FAIL, "실제 장애가 UNAVAILABLE로 강등되지 않고 그대로 드러남");
});

test("고아 계약(retired 앱 등)은 유예 후 정리되고 열린 incident는 회복으로 닫힌다", () => {
  const dir = tmp();
  const fail = snap([app("homebom", { production: { status: "FAIL" } })]);
  runHealthEngine({ snapshot: fail, runtimeDir: dir, now: new Date("2026-07-01T00:00:00Z") });
  runHealthEngine({ snapshot: fail, runtimeDir: dir, now: new Date("2026-07-01T00:05:00Z") }); // incident 확정
  // homebom이 목록에서 사라진(retired) 스냅샷으로 8일 뒤 실행 → 고아 정리 + 회복.
  const gone = snap([app("outbom")]);
  const r = runHealthEngine({ snapshot: gone, runtimeDir: dir, now: new Date("2026-07-09T00:00:00Z") });
  assert.ok(r.recoveries.some((rec) => rec.contractId === "production:homebom"), "고아 incident가 회복으로 닫힘");
});

test("동일 실패가 지속되면 새 incident를 반복 생성하지 않는다", () => {
  const dir = tmp();
  const s = snap([app("homebom", { production: { status: "FAIL" } })]);
  const a = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:00:00Z") }); // 1회 — 미확정
  const b = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:10:00Z") }); // 2회 — 확정
  const c = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date("2026-07-19T00:20:00Z") }); // 3회 — 중복 없음
  assert.equal(a.newIncidents.length, 0);
  assert.equal(b.newIncidents.length, 1);
  assert.equal(c.newIncidents.length, 0, "지속 실패는 중복 incident 없음");
});

test("CI 실패는 error incident, 열린 PR 30일+는 error", () => {
  const dir = tmp();
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  // 실제 스냅샷 필드: PR은 updatedAt(생성일 createdAt은 존재하지 않음), CI는 deploy run.
  const s = snap([app("outbom", { ci: [{ name: "deploy", status: "completed", conclusion: "failure" }], openPrs: [{ updatedAt: old }] })]);
  const r1 = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date() });
  const r2 = runHealthEngine({ snapshot: s, runtimeDir: dir, now: new Date() });
  // CI·PR은 error(연속 2회) → 두 번째 실행에서 확정
  assert.ok(r2.newIncidents.some((i) => i.category === "ci"), "CI 실패 incident");
  assert.ok(r2.newIncidents.some((i) => i.category === "github"), "오래된 PR incident");
});

test("정체 PR은 실제 스냅샷 필드 updatedAt로 판정한다(createdAt은 존재하지 않아 늘 PASS로 삼켰다)", () => {
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  // createdAt만 있고 updatedAt이 없으면(옛 버그 재현) 판정 불가로 안전하게 PASS.
  const wrongField = collectRawResults(snap([app("outbom", { openPrs: [{ createdAt: old }] })]), { now: new Date() });
  assert.equal(wrongField.find((r) => r.contractId === "pr-age:outbom").status, HEALTH_STATUS.PASS);
  // 실제 필드 updatedAt로는 30일+ 정체를 FAIL로 잡는다.
  const realField = collectRawResults(snap([app("outbom", { openPrs: [{ updatedAt: old }] })]), { now: new Date() });
  assert.equal(realField.find((r) => r.contractId === "pr-age:outbom").status, HEALTH_STATUS.FAIL);
});

test("draft PR은 정체 신호에서 제외한다(의도된 작업 중)", () => {
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const raw = collectRawResults(snap([app("outbom", { openPrs: [{ updatedAt: old, draft: true }] })]), { now: new Date() });
  assert.equal(raw.find((r) => r.contractId === "pr-age:outbom").status, HEALTH_STATUS.PASS, "draft만 있으면 정체로 보지 않음");
});

test("CI는 배포(deploy) run만으로 판정한다 — 무관 워크플로 실패로 거짓 경보하지 않는다", () => {
  // 최근 run이 lint 실패여도 deploy가 성공이면 배포는 안전 → PASS.
  const lintFail = collectRawResults(snap([app("outbom", { ci: [
    { name: "lint", status: "completed", conclusion: "failure" },
    { name: "deploy", status: "completed", conclusion: "success" },
  ] })]), { now: new Date() });
  assert.equal(lintFail.find((r) => r.contractId === "ci:outbom").status, HEALTH_STATUS.PASS);
  // deploy가 timed_out이면 완료 못한 실패 → FAIL(거짓 정상 방지).
  const timedOut = collectRawResults(snap([app("outbom", { ci: [
    { name: "deploy", status: "completed", conclusion: "timed_out" },
  ] })]), { now: new Date() });
  assert.equal(timedOut.find((r) => r.contractId === "ci:outbom").status, HEALTH_STATUS.FAIL);
  // deploy run이 아예 없으면 미확인(UNAVAILABLE) — 무관 워크플로로 정상/장애를 위장하지 않는다.
  const noDeploy = collectRawResults(snap([app("outbom", { ci: [
    { name: "test", status: "completed", conclusion: "success" },
  ] })]), { now: new Date() });
  assert.equal(noDeploy.find((r) => r.contractId === "ci:outbom").status, HEALTH_STATUS.UNAVAILABLE);
});
