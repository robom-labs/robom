import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runContractEngine, contractResultsToRaw, redactEvidence, C_STATUS } from "./contract-engine.mjs";
import { mergeExtraResults } from "./health-engine.mjs";

// 로컬 fixture 서버 — 운영 대신 결정론적 표면을 제공한다(테스트는 외부 네트워크 금지)
function startFixture() {
  const server = createServer((req, res) => {
    const path = req.url.split("?")[0];
    const send = (code, type, body, headers = {}) => { res.writeHead(code, { "content-type": type, ...headers }); res.end(body); };
    if (path === "/") return send(200, "text/html", `<html><head><title>야외봄</title><script src="/app.js"></script></head><body>야외봄 v9.9.9 sha1234 ${"내용".repeat(300)}</body></html>`);
    if (path === "/app.js") return send(200, "text/javascript", "const KEY='calendarbom:events:v1'; const K2='calendarbom:data:v2'; // v9.9.9 sha1234abc");
    if (path === "/manifest.webmanifest") return send(200, "application/json", JSON.stringify({ name: "야외봄", start_url: "/", icons: [{ src: "/icon.png", sizes: "192x192" }] }));
    if (path === "/icon.png") return send(200, "image/png", "png");
    if (path === "/sw.js") return send(200, "text/javascript", "const CACHE='testapp-v1'; caches.open(CACHE); // index.html precache");
    if (path === "/broken.js") return send(404, "text/plain", "no");
    if (path === "/data.json") return send(200, "application/json", JSON.stringify([{ id: "a", houseName: "집", region: "서울" }, { id: "b", houseName: "집2", region: "부산" }]),
      { "x-verified-at": new Date(Date.now() - 60_000).toISOString(), "access-control-expose-headers": "x-verified-at, x-data-stale" });
    if (path === "/stale.json") return send(200, "application/json", "[]", { "x-verified-at": new Date().toISOString(), "x-data-stale": "1" });
    if (path === "/fresh-flag.json") return send(200, "application/json", "[]", { "x-verified-at": new Date().toISOString(), "x-data-stale": "0" }); // 명시적 fresh
    if (path === "/with-broken") return send(200, "text/html", `<html><head><title>깨진자산</title><script src="/broken.js"></script></head><body>${"내용".repeat(300)}</body></html>`);
    if (path === "/error-page") return send(200, "text/html", "<html>Application Error</html>");
    if (path === "/empty-title") return send(200, "text/html", `<html><head><title>   </title></head><body>${"내용".repeat(300)}</body></html>`);
    if (path === "/bare") return send(200, "text/html", `<html><head><title>bare</title></head><body>${"내용".repeat(300)}</body></html>`); // 동일 출처 js/css 자산 없음
    return send(404, "text/plain", "not found");
  });
  return new Promise((resolvePromise) => server.listen(0, "127.0.0.1", () => resolvePromise({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

function tempRuntime() {
  const dir = mkdtempSync(join(tmpdir(), "robom-contract-"));
  mkdirSync(join(dir, "health"), { recursive: true });
  return dir;
}
const base_contract = (over) => ({
  schemaVersion: "2.2.0", runTier: "standard", enabled: true, timeoutMs: 10_000,
  requiredCapabilities: ["network"], severityIfFail: "error", failureClass: "availability",
  what: "테스트", userImpact: "테스트", recommendedAction: "테스트", ...over,
});

test("http_html·surface_marker·manifest·sw evaluator가 fixture에서 정확히 판정한다", async () => {
  const { server, base } = await startFixture();
  const runtimeDir = tempRuntime();
  try {
    const contracts = [
      base_contract({ id: "t:home", target: "t", category: "production", evaluator: "http_html", config: { url: `${base}/`, minBytes: 500, negativeMarkers: ["Application Error"] } }),
      base_contract({ id: "t:error-page", target: "t", category: "production", evaluator: "http_html", config: { url: `${base}/error-page`, negativeMarkers: ["Application Error"] } }),
      base_contract({ id: "t:marker", target: "t", category: "version", evaluator: "surface_marker", config: { url: `${base}/`, baseUrl: `${base}/`, markersAny: ["v9.9.9"], markersAll: ["calendarbom:events:v1", "calendarbom:data:v2"] } }),
      base_contract({ id: "t:secret", target: "t", category: "security", evaluator: "surface_marker", config: { url: `${base}/`, baseUrl: `${base}/`, forbiddenMarkers: ["sk-proj-"] } }),
      base_contract({ id: "t:manifest", target: "t", category: "pwa", evaluator: "manifest_contract", config: { baseUrl: `${base}/` } }),
      base_contract({ id: "t:manifest-icons", target: "t", category: "pwa", evaluator: "manifest_contract", config: { baseUrl: `${base}/`, iconCheck: true } }),
      base_contract({ id: "t:sw", target: "t", category: "pwa", evaluator: "service_worker_contract", config: { baseUrl: `${base}/`, syntax: true, mustContainAny: ["cache"] } }),
      base_contract({ id: "t:404", target: "t", category: "production", evaluator: "http_status", config: { url: `${base}/nope`, expectStatus: [200] } }),
      // regexMarkers — 단순 substring이 아니라 '실제로 비어있지 않은 title'을 검사(공허 계약 제거)
      base_contract({ id: "t:title-ok", target: "t", category: "seo", evaluator: "http_html", config: { url: `${base}/`, regexMarkers: ["<title[^>]*>\\s*[^\\s<]"] } }),
      base_contract({ id: "t:title-empty", target: "t", category: "seo", evaluator: "http_html", config: { url: `${base}/empty-title`, regexMarkers: ["<title[^>]*>\\s*[^\\s<]"] } }),
      base_contract({ id: "t:title-tag-only", target: "t", category: "seo", evaluator: "http_html", config: { url: `${base}/empty-title`, markers: ["<title"] } }),
    ];
    const report = await runContractEngine({ contracts, runtimeDir, repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date() });
    const by = Object.fromEntries(report.results.map((r) => [r.contractId, r]));
    assert.equal(by["t:home"].status, C_STATUS.PASS);
    assert.equal(by["t:error-page"].status, C_STATUS.FAIL); // provider 오류 페이지 탐지
    assert.equal(by["t:title-ok"].status, C_STATUS.PASS); // 내용 있는 title 통과
    assert.equal(by["t:title-empty"].status, C_STATUS.FAIL); // 공백만 있는 title은 regexMarker로 실패
    assert.equal(by["t:title-tag-only"].status, C_STATUS.PASS); // substring marker는 빈 title도 통과(page-title와 title-nonempty가 다른 이유)
    assert.equal(by["t:marker"].status, C_STATUS.PASS); // 자산까지 병합된 표면에서 marker 발견
    assert.equal(by["t:secret"].status, C_STATUS.PASS);
    assert.equal(by["t:manifest"].status, C_STATUS.PASS);
    assert.equal(by["t:manifest-icons"].status, C_STATUS.PASS);
    assert.equal(by["t:sw"].status, C_STATUS.PASS);
    assert.equal(by["t:404"].status, C_STATUS.FAIL);
    assert.ok(report.coverage.totalContracts === 11);
  } finally { server.close(); }
});

test("surface_assets — 동일 출처 자산이 하나도 없으면 '자산 0개 전부 200'으로 위장하지 않고 UNAVAILABLE", async () => {
  const { server, base } = await startFixture();
  const runtimeDir = tempRuntime();
  try {
    const contracts = [
      base_contract({ id: "t:assets-real", target: "t", category: "production", evaluator: "surface_assets", config: { url: `${base}/`, baseUrl: `${base}/` } }),
      base_contract({ id: "t:assets-bare", target: "t", category: "production", evaluator: "surface_assets", config: { url: `${base}/bare`, baseUrl: `${base}/bare` } }),
    ];
    const report = await runContractEngine({ contracts, runtimeDir, repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date() });
    const by = Object.fromEntries(report.results.map((r) => [r.contractId, r]));
    assert.equal(by["t:assets-real"].status, C_STATUS.PASS); // 실제 자산(app.js) 200
    assert.equal(by["t:assets-bare"].status, C_STATUS.UNAVAILABLE); // 자산 0개 → '전부 200' 위장 금지
  } finally { server.close(); }
});

test("surface_marker — 금지 marker '없음=PASS'는 자산을 실제로 다 봤을 때만(미수신은 UNAVAILABLE)", async () => {
  const { server, base } = await startFixture();
  const runtimeDir = tempRuntime();
  try {
    const contracts = [
      // 자산(app.js) 200 → 금지 marker 부재 확정 가능 → PASS
      base_contract({ id: "t:secret-ok", target: "t", category: "security", evaluator: "surface_marker", config: { url: `${base}/`, baseUrl: `${base}/`, forbiddenMarkers: ["sk-proj-"] } }),
      // 참조한 자산(/broken.js)이 404라 못 봄 → 비밀 부재를 확정 못 함 → PASS 위장 금지(UNAVAILABLE)
      base_contract({ id: "t:secret-broken", target: "t", category: "security", evaluator: "surface_marker", config: { url: `${base}/with-broken`, baseUrl: `${base}/with-broken`, forbiddenMarkers: ["sk-proj-"] } }),
      // 동일 출처 자산이 없어 HTML만 봄 → 번들 내 비밀 여부 확정 불가 → UNAVAILABLE
      base_contract({ id: "t:secret-bare", target: "t", category: "security", evaluator: "surface_marker", config: { url: `${base}/bare`, baseUrl: `${base}/bare`, forbiddenMarkers: ["sk-proj-"] } }),
    ];
    const report = await runContractEngine({ contracts, runtimeDir, repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date() });
    const by = Object.fromEntries(report.results.map((r) => [r.contractId, r]));
    assert.equal(by["t:secret-ok"].status, C_STATUS.PASS);
    assert.equal(by["t:secret-broken"].status, C_STATUS.UNAVAILABLE); // 자산 미수신 → 초록 위장 금지
    assert.equal(by["t:secret-bare"].status, C_STATUS.UNAVAILABLE); // HTML만 봄 → 확정 불가
  } finally { server.close(); }
});

test("engine-self — 정상 run은 PASS다(off-by-one으로 늘 DEGRADED로 오표기되지 않는다)", async () => {
  const { server, base } = await startFixture();
  const runtimeDir = tempRuntime();
  try {
    const contracts = [
      base_contract({ id: "t:a", target: "t", category: "production", evaluator: "http_status", config: { url: `${base}/`, expectStatus: [200] } }),
      base_contract({ id: "t:b", target: "t", category: "production", evaluator: "http_status", config: { url: `${base}/manifest.webmanifest`, expectStatus: [200] } }),
      { ...base_contract({ id: "t:self", target: "robom-hq", category: "self", evaluator: "hq_runtime", config: { check: "engine-self" } }), requiredCapabilities: [] },
    ];
    const report = await runContractEngine({ contracts, runtimeDir, repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date() });
    const self = report.results.find((r) => r.contractId === "t:self");
    assert.equal(self.status, C_STATUS.PASS, "전 계약 실행 완료 시 engine-self는 PASS");
  } finally { server.close(); }
});

test("http_json_contract — 헤더 신선도·항목 계약·빈 배열·stale 강등을 판정한다", async () => {
  const { server, base } = await startFixture();
  const runtimeDir = tempRuntime();
  try {
    const contracts = [
      base_contract({ id: "t:data", target: "t", category: "data", evaluator: "http_json_contract", config: {
        url: `${base}/data.json`, contentTypeIncludes: "json", itemsPathCandidates: ["", "data"],
        headerAssertions: [
          { path: "x-verified-at", op: "exists" },
          { path: "x-verified-at", op: "age_lte_seconds", value: 3600 },
          { path: "access-control-expose-headers", op: "contains", value: "x-verified-at" }],
        assertions: [
          { path: "", op: "length_gte", value: 1 },
          { path: "", op: "nonempty_string", quantifier: "every", itemPath: "id" },
          { path: "", op: "unique", value: "id" }],
      } }),
      base_contract({ id: "t:stale", target: "t", category: "data", evaluator: "http_json_contract", config: { url: `${base}/stale.json`, staleHeaderDegraded: "x-data-stale" } }),
      base_contract({ id: "t:fresh-flag", target: "t", category: "data", evaluator: "http_json_contract", config: { url: `${base}/fresh-flag.json`, staleHeaderDegraded: "x-data-stale" } }),
      base_contract({ id: "t:empty", target: "t", category: "data", evaluator: "http_json_contract", config: { url: `${base}/stale.json`, itemsPathCandidates: [""], assertions: [{ path: "", op: "length_gte", value: 1, label: "빈 배열 위장 금지" }] } }),
    ];
    const report = await runContractEngine({ contracts, runtimeDir, repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date() });
    const by = Object.fromEntries(report.results.map((r) => [r.contractId, r]));
    assert.equal(by["t:data"].status, C_STATUS.PASS);
    assert.equal(by["t:stale"].status, C_STATUS.DEGRADED); // x-data-stale=1 → 정직 강등
    assert.equal(by["t:fresh-flag"].status, C_STATUS.PASS); // x-data-stale=0(명시적 fresh)을 stale로 오표기하지 않음
    assert.equal(by["t:empty"].status, C_STATUS.FAIL); // 빈 200 배열을 정상으로 위장 금지
  } finally { server.close(); }
});

test("네트워크 계약은 예산 소진 시 budget_exhausted UNAVAILABLE로 명시된다(§6.3)", async () => {
  const { server, base } = await startFixture();
  const runtimeDir = tempRuntime();
  try {
    const contracts = [
      base_contract({ id: "t:a", target: "t", category: "production", evaluator: "http_status", config: { url: `${base}/`, expectStatus: [200] } }),
      base_contract({ id: "t:b", target: "t", category: "production", evaluator: "http_status", config: { url: `${base}/manifest.webmanifest`, expectStatus: [200] } }),
    ];
    const report = await runContractEngine({ contracts, runtimeDir, repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date(), budget: { maxRequests: 1 } });
    const statuses = report.results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [C_STATUS.PASS, C_STATUS.UNAVAILABLE].sort());
    assert.ok(report.results.some((r) => r.actual === "budget_exhausted"));
  } finally { server.close(); }
});

test("github_actions — timed_out·startup_failure 같은 미완료 종료를 success로 위장하지 않는다", async () => {
  const runtimeDir = tempRuntime();
  const ghResponse = (conclusion) => ({
    status: 200, ok: true, headers: { get: () => "" },
    json: async () => ({ workflow_runs: [{ name: "deploy", status: "completed", conclusion, updated_at: new Date().toISOString() }] }),
  });
  const run = async (conclusion) => {
    const fetchImpl = async (url) => (String(url).includes("api.github.com") ? ghResponse(conclusion) : { status: 404, ok: false, headers: { get: () => "" }, json: async () => ({}) });
    // severityIfFail: error인 deep 계약이라도 skipped·neutral은 incident로 새면 안 된다(severity:info 명시 검증).
    const contracts = [{ ...base_contract({ id: "t:ci", target: "t", category: "ci", evaluator: "github_actions", config: { repo: "robom-labs/x" }, severityIfFail: "error" }), requiredCapabilities: [] }];
    const report = await runContractEngine({ contracts, runtimeDir: tempRuntime(), repoRoot: runtimeDir, snapDir: runtimeDir, now: new Date(), fetchImpl });
    return report.results.find((r) => r.contractId === "t:ci");
  };
  assert.equal((await run("timed_out")).status, C_STATUS.FAIL);       // 완료 못한 실패를 초록으로 위장 금지
  assert.equal((await run("startup_failure")).status, C_STATUS.FAIL); // 워크플로가 시작조차 못함 → 실패
  assert.equal((await run("success")).status, C_STATUS.PASS);         // 진짜 성공만 PASS
  // cancelled·skipped·neutral·action_required는 실패가 아님 → DEGRADED-info(사건 안 남 — health-engine ciResult와 일치)
  for (const c of ["cancelled", "skipped", "neutral", "action_required"]) {
    const r = await run(c);
    assert.equal(r.status, C_STATUS.DEGRADED, `${c} → DEGRADED`);
    assert.equal(r.severity, "info", `${c} → severity info(계약 severityIfFail=error여도 incident 안 남)`);
  }
});

test("redaction — 증거에서 secret 패턴이 제거된다(CI 필수 게이트 §7.2)", () => {
  const scrubbed = redactEvidence({ note: "Bearer abcdefghijklmnopqrstuvwxyz012345 안에 sk-proj-aaaaaaaaaaaaaaaa 존재", authorization: "지워야 함" });
  assert.ok(!JSON.stringify(scrubbed).includes("sk-proj-a"));
  assert.ok(!JSON.stringify(scrubbed).includes("Bearer a"));
  assert.equal(scrubbed.authorization, undefined);
});

test("hq_runtime 계약 — version-triad·redaction-selftest·clock-seoul이 로컬 정본으로 판정한다", async () => {
  const runtimeDir = tempRuntime();
  const repoRoot = mkdtempSync(join(tmpdir(), "robom-repo-"));
  mkdirSync(join(repoRoot, "ops/control-center/app"), { recursive: true });
  mkdirSync(join(repoRoot, "desktop"), { recursive: true });
  writeFileSync(join(repoRoot, "desktop/package.json"), JSON.stringify({ version: "9.9.9" }));
  writeFileSync(join(repoRoot, "ops/control-center/app/version.json"), JSON.stringify({ version: "9.9.9" }));
  writeFileSync(join(repoRoot, "ops/control-center/app/app.js"), 'const HQ_VERSION="9.9.9";');
  const hq = (cid, check) => ({ ...base_contract({ id: cid, target: "robom-hq", category: "self", evaluator: "hq_runtime", config: { check } }), requiredCapabilities: ["filesystem"] });
  const report = await runContractEngine({
    contracts: [hq("h:triad", "version-triad"), hq("h:redact", "redaction-selftest"), hq("h:clock", "clock-seoul"), hq("h:authority", "authority-valid")],
    runtimeDir, repoRoot, snapDir: runtimeDir, now: new Date(),
  });
  const by = Object.fromEntries(report.results.map((r) => [r.contractId, r]));
  assert.equal(by["h:triad"].status, C_STATUS.PASS);
  assert.equal(by["h:redact"].status, C_STATUS.PASS);
  assert.equal(by["h:clock"].status, C_STATUS.PASS);
  assert.equal(by["h:authority"].status, C_STATUS.PASS);
});

test("mergeExtraResults — 심층 계약이 레거시 production·ci 판정을 대체한다(중복 incident 방지)", () => {
  const raw = [
    { contractId: "production:outbom", target: "outbom", status: "FAIL" },
    { contractId: "ci:outbom", target: "outbom", status: "PASS" },
    { contractId: "next-action:outbom", target: "outbom", status: "PASS" },
  ];
  const extra = [
    { contractId: "c:outbom:production-home", target: "outbom", status: "PASS" },
    { contractId: "c:outbom:ci-latest", target: "outbom", status: "PASS" },
  ];
  const merged = mergeExtraResults(raw, extra);
  const ids = merged.map((r) => r.contractId);
  assert.ok(!ids.includes("production:outbom"));
  assert.ok(!ids.includes("ci:outbom"));
  assert.ok(ids.includes("next-action:outbom"));
  assert.ok(ids.includes("c:outbom:production-home"));
});

test("contractResultsToRaw — need_new_source는 incident 경로에서 제외(§18 반복 상신 금지)", () => {
  const raw = contractResultsToRaw({ results: [
    { contractId: "a", target: "t", category: "data", status: "FAIL", severity: "error", failureClass: "schema", userImpact: "", recommendedAction: "", actual: "x", expected: "y", needNewSource: false },
    { contractId: "b", target: "t", category: "data", status: "UNAVAILABLE", severity: "info", failureClass: "observability", userImpact: "", recommendedAction: "", actual: "새 신호 필요", expected: "", needNewSource: true },
    { contractId: "c", target: "t", category: "ci", status: "BLOCKED_EXTERNAL", severity: "info", failureClass: "quota", userImpact: "", recommendedAction: "", actual: "", expected: "", needNewSource: false },
  ] });
  assert.equal(raw.length, 2);
  assert.equal(raw.find((r) => r.contractId === "c").status, "UNAVAILABLE"); // BLOCKED → UNAVAILABLE 매핑
});
