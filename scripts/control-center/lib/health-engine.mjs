// 로봄 HQ 결정론적 health 엔진 — AI 없이 실제 신호로 정상/부분 열화/장애/점검 불가를 판정한다.
// 신호 수집은 기존 build-snapshot(운영 watchdog·git·GitHub REST)이 이미 하므로, 이 엔진은 그 스냅샷 위에
// "결정론적 판정 + 연속 실패/회복(anti-flap) + incident/회복 + 전역 네트워크 선행"만 얹는다.
// 원칙(업로드 프롬프트): 주관적 판정 금지, 임의 eval/shell 금지, 비밀/원문 저장 금지, source 없음을 정상으로 위장 금지,
//   전역 네트워크 장애 시 앱별 critical 스팸 금지, critical은 1회로 확정·warn/error는 연속 2회, 회복은 연속 2회 PASS.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_COMPANY_RUNTIME_DIR } from "./company-store.mjs";

export const HEALTH_STATUS = Object.freeze({ PASS: "PASS", DEGRADED: "DEGRADED", FAIL: "FAIL", UNAVAILABLE: "UNAVAILABLE", SKIPPED: "SKIPPED" });
const CONFIRM_CONSECUTIVE = 2; // warning/error 확정에 필요한 연속 실패
const RECOVERY_CONSECUTIVE = 2; // 회복에 필요한 연속 PASS

const familyApps = (snapshot) => (snapshot?.apps || []).filter((a) => a.id !== "robom");
const hqSystems = (snapshot) => (snapshot?.apps || []).filter((a) => a.id === "robom");

// ── 앱별 원시 판정(스냅샷 신호만 사용, 네트워크 재호출 없음) ──
function productionResult(app) {
  const p = app.production;
  const base = { contractId: `production:${app.id}`, target: app.id, category: "production", failureClass: "production" };
  if (!p) {
    // 운영 점검을 선언(healthcheck)했는데 결과가 없으면 점검 불가(정상으로 위장하지 않음)
    return { ...base, status: HEALTH_STATUS.UNAVAILABLE, severity: "info",
      userImpact: `${app.name} 운영 상태를 아직 확인하지 못했습니다.`, recommendedAction: "네트워크 연결 후 다음 점검에서 다시 확인합니다.", actual: null, expected: "운영 점검 결과 존재" };
  }
  if (p.status === "PASS") return { ...base, status: HEALTH_STATUS.PASS, severity: "info", actual: "PASS", expected: "PASS" };
  if (p.status === "STALE") return { ...base, status: HEALTH_STATUS.DEGRADED, severity: "warning", failureClass: "data_stale",
    userImpact: `${app.name} 데이터가 권장 갱신 시점을 넘겼습니다. 사용자는 마지막 정상 데이터를 보고 있습니다.`,
    recommendedAction: "공식 데이터 소스를 다시 수집해 최신성을 회복합니다.", actual: p.warnings?.[0] || "STALE", expected: "신선한 데이터" };
  if (p.status === "FAIL") return { ...base, status: HEALTH_STATUS.FAIL, severity: "critical",
    userImpact: `${app.name}을(를) 열어도 화면이 뜨지 않거나 오래된 파일이 보일 수 있습니다.`,
    recommendedAction: "운영 배포와 핵심 자산을 확인하고 마지막 정상 배포로 복구합니다.", actual: p.warnings?.[0] || "FAIL", expected: "정상 응답(200)" };
  return { ...base, status: HEALTH_STATUS.UNAVAILABLE, severity: "info", actual: p.status || null, expected: "PASS" };
}
function ciResult(app) {
  const base = { contractId: `ci:${app.id}`, target: app.id, category: "ci", failureClass: "ci" };
  const ci = app.ci || [];
  if (!ci.length) return { ...base, status: HEALTH_STATUS.UNAVAILABLE, severity: "info", actual: null, expected: "CI 실행 이력" };
  const latest = ci[0];
  if (latest.status && latest.status !== "completed") return { ...base, status: HEALTH_STATUS.PASS, severity: "info", actual: "in_progress", expected: "완료" }; // 실행 중은 정상
  if (latest.conclusion === "failure") return { ...base, status: HEALTH_STATUS.FAIL, severity: "error",
    userImpact: `${app.name} 자동 검사(CI)가 실패로 끝났습니다. 다음 배포 안전성에 영향이 있을 수 있습니다.`,
    recommendedAction: "실패 로그를 확인하고 배포 전에 원인을 수정하거나 재실행합니다.", actual: `${latest.name || "workflow"}: failure`, expected: "success" };
  return { ...base, status: HEALTH_STATUS.PASS, severity: "info", actual: latest.conclusion || "success", expected: "success" };
}
function prAgeResult(app, now) {
  const base = { contractId: `pr-age:${app.id}`, target: app.id, category: "github", failureClass: "open_pr" };
  const prs = app.openPrs || [];
  if (!prs.length) return { ...base, status: HEALTH_STATUS.PASS, severity: "info", actual: 0, expected: "정체 PR 없음" };
  const ageDays = (pr) => { const t = Date.parse(pr.createdAt || pr.created_at || ""); return Number.isFinite(t) ? (now.getTime() - t) / 86_400_000 : 0; };
  const oldest = Math.max(...prs.map(ageDays));
  if (oldest >= 30) return { ...base, status: HEALTH_STATUS.FAIL, severity: "error",
    userImpact: `${app.name}에 30일 넘게 병합되지 않은 변경이 있습니다.`, recommendedAction: "리뷰를 마치고 병합하거나 필요 없으면 닫아 정리합니다.", actual: `${Math.round(oldest)}일`, expected: "30일 미만" };
  if (oldest >= 14) return { ...base, status: HEALTH_STATUS.DEGRADED, severity: "warning",
    userImpact: `${app.name}에 병합 대기 중인 변경이 오래 남아 있습니다.`, recommendedAction: "리뷰를 마치고 병합하거나 닫아 작업 흐름을 정리합니다.", actual: `${Math.round(oldest)}일`, expected: "14일 미만", failureClass: "open_pr_warn" };
  return { ...base, status: HEALTH_STATUS.PASS, severity: "info", actual: `${Math.round(oldest)}일`, expected: "14일 미만" };
}
function nextActionResult(app) {
  const base = { contractId: `next-action:${app.id}`, target: app.id, category: "roadmap", failureClass: "next_action" };
  const next = (app.nextActions || [])[0];
  if (!next) return { ...base, status: HEALTH_STATUS.PASS, severity: "info", actual: null, expected: "대기 중 개선 없음" };
  return { ...base, status: HEALTH_STATUS.DEGRADED, severity: "info",
    userImpact: `${app.name} 개선 대기: ${next.length > 60 ? next.slice(0, 60) + "…" : next}`,
    recommendedAction: "핵심 행동까지의 단계를 줄이거나 오류를 낮추는 방향으로 작은 단위로 구현합니다.", actual: next, expected: "완료", failureClass: "next_action" };
}

// ── HQ 자체 health (로컬 신호) ──
function hqSelfResults(snapshot, ctx) {
  const out = [];
  const now = ctx.now;
  // 스냅샷 신선도
  const gen = Date.parse(snapshot?.generatedAt || "");
  if (snapshot?.example) {
    out.push({ contractId: "robom-hq:snapshot-example", target: "robom-hq", category: "self", failureClass: "snapshot_fallback",
      status: HEALTH_STATUS.DEGRADED, severity: "warning", userImpact: "예시(offline) 스냅샷을 표시 중입니다. 실제 운영 상태가 아닙니다.",
      recommendedAction: "본부 서버가 실제 스냅샷을 생성하면 자동으로 교체됩니다.", actual: "example", expected: "실제 스냅샷" });
  } else if (Number.isFinite(gen)) {
    const ageMin = (now.getTime() - gen) / 60_000;
    const stale = ageMin > (ctx.watchdogMinutes || 10) * 3 + 5;
    out.push({ contractId: "robom-hq:snapshot-age", target: "robom-hq", category: "self", failureClass: "snapshot_age",
      status: stale ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.PASS, severity: "warning",
      userImpact: stale ? "회사 상태 갱신이 예상보다 지연되고 있습니다." : "", recommendedAction: "감시기·스냅샷 생성 프로세스를 확인합니다.",
      actual: `${Math.round(ageMin)}분 전`, expected: "정상 주기 내" });
  }
  // 관리 러너
  if (ctx.runner) {
    const r = ctx.runner;
    if (r.managed && r.state === "not_running") {
      out.push({ contractId: "robom-hq:runner-down", target: "robom-hq", category: "self", failureClass: "runner_down",
        status: HEALTH_STATUS.DEGRADED, severity: "warning", userImpact: "자동 실행기가 잠시 꺼졌습니다. HQ가 다시 켜는 중입니다.",
        recommendedAction: "잠시 후 자동 복구됩니다. 반복되면 로그를 확인합니다.", actual: "not_running", expected: "실행 중" });
    }
  }
  return out;
}

// 심층 계약 엔진 결과가 있으면 같은 근거의 레거시 스냅샷 판정을 대체한다(중복 incident 방지).
const SUPERSEDE = [
  [(id) => `c:${id}:production-home`, (id) => `production:${id}`],
  [(id) => `c:${id}:ci-latest`, (id) => `ci:${id}`],
  [(id) => `c:${id}:open-pr-age`, (id) => `pr-age:${id}`],
];
export function mergeExtraResults(raw, extraResults) {
  if (!extraResults?.length) return raw;
  const extraIds = new Set(extraResults.map((r) => r.contractId));
  const dropped = new Set();
  for (const r of raw) {
    for (const [deepId, legacyId] of SUPERSEDE) {
      if (extraIds.has(deepId(r.target))) dropped.add(legacyId(r.target));
    }
  }
  return [...raw.filter((r) => !dropped.has(r.contractId)), ...extraResults];
}

// ── 전역 네트워크 선행: 모든 앱 운영 점검이 동시에 불가하면 앱별 스팸 대신 회사 incident 1건 ──
export function collectRawResults(snapshot, ctx) {
  const fam = familyApps(snapshot);
  // 실제로 점검된(production 결과가 있는) 앱만 전역 판정에 쓴다. production===null(아직 미점검)을 FAIL로 취급하면
  // 무관한 앱이 미점검이란 이유로 진짜 단일 장애를 가리거나(HIGH), 전부 미점검(콜드 스타트)일 때 헛경보를 낸다.
  const withProd = fam.filter((a) => a.production !== undefined && a.production !== null);
  const failed = withProd.filter((a) => a.production.status === "FAIL");
  const allDown = withProd.length >= 2 && failed.length === withProd.length; // 점검된 앱이 2개 이상이고 그 전부가 실제 FAIL
  const results = [];
  if (allDown) {
    // 로컬 네트워크·공통 host 장애로 간주 → 회사 incident 1건, 실패한 앱 production만 UNAVAILABLE로 강등(스팸 억제).
    // 미점검·통과 앱은 정상 처리해 실제 상태를 가리지 않는다.
    const failedIds = new Set(failed.map((a) => a.id));
    results.push({ contractId: "company:network", target: "company", category: "network", failureClass: "local_network",
      status: HEALTH_STATUS.FAIL, severity: "warning",
      userImpact: "점검된 앱이 모두 동시에 응답 실패했습니다. 인터넷 연결·공통 호스트 문제일 수도, 실제 전면 장애일 수도 있습니다.",
      recommendedAction: "네트워크 연결을 확인하세요. 연결이 정상이면 공통 배포·호스트를 점검합니다.", actual: `점검된 ${withProd.length}개 앱 전부 실패`, expected: "정상 응답" });
    for (const a of fam) {
      if (failedIds.has(a.id)) results.push({ contractId: `production:${a.id}`, target: a.id, category: "production", failureClass: "production",
        status: HEALTH_STATUS.UNAVAILABLE, severity: "info", actual: "network", expected: "PASS", userImpact: "", recommendedAction: "" });
      else results.push(productionResult(a)); // 미점검·통과 앱은 정상 처리
    }
  } else {
    for (const a of fam) results.push(productionResult(a));
  }
  for (const a of fam) { results.push(ciResult(a)); results.push(prAgeResult(a, ctx.now)); results.push(nextActionResult(a)); }
  for (const a of hqSystems(snapshot)) results.push(productionResult(a));
  results.push(...hqSelfResults(snapshot, ctx));
  return results;
}

// ── anti-flap 상태 + evidence 저장 ──
function healthDir(runtimeDir) { return join(resolve(runtimeDir), "health"); }
function readState(runtimeDir) {
  const file = join(healthDir(runtimeDir), "state.json");
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch {
    // 손상 시 곧바로 빈 상태로 리셋하면 anti-flap 카운터·열린 incidentId가 통째로 날아가
    // 회복돼도 자동 종료되지 않는 '영구 열림' 사고가 난다. .bak을 먼저 복구한다.
    try { return JSON.parse(readFileSync(`${file}.bak`, "utf8")); } catch { return { contracts: {} }; }
  }
}
function writeJson(file, value) {
  mkdirSync(join(file, ".."), { recursive: true, mode: 0o700 });
  // 원자적 쓰기: 쓰는 도중 크래시로 잘린 파일이 다음 실행에서 파싱 실패 → 상태 전멸(영구 열림 incident)을 막는다.
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  if (existsSync(file)) { try { copyFileSync(file, `${file}.bak`); } catch { /* 백업 실패는 무시 */ } }
  renameSync(tmp, file);
}

// 원시 결과 배열 → 확정 상태·신규 incident·회복. 순수 로직(now 주입) + runtimeDir 지속.
export function runHealthEngine({ snapshot, runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = new Date(), runner = null, watchdogMinutes = 10, extraResults = [] } = {}) {
  const raw = mergeExtraResults(collectRawResults(snapshot, { now, runner, watchdogMinutes }), extraResults);
  const state = readState(runtimeDir);
  state.contracts = state.contracts || {};
  const nowIso = now.toISOString();
  const newIncidents = [];
  const recoveries = [];
  const results = [];

  for (const r of raw) {
    const prev = state.contracts[r.contractId] || { status: null, cf: 0, cs: 0, firstFailedAt: null, lastPassedAt: null, incidentId: null };
    const isFail = r.status === HEALTH_STATUS.FAIL || (r.status === HEALTH_STATUS.DEGRADED && r.severity !== "info");
    const isPass = r.status === HEALTH_STATUS.PASS;
    let cf = prev.cf, cs = prev.cs, incidentId = prev.incidentId, firstFailedAt = prev.firstFailedAt, lastPassedAt = prev.lastPassedAt;
    let confirmed = Boolean(prev.incidentId);

    if (isFail) {
      cf += 1; cs = 0;
      if (!firstFailedAt) firstFailedAt = nowIso;
      // critical도 최소 2회 연속 확인한다. 상류 운영 점검은 재시도 없는 단발 probe라, critical=1이면
      // 순간 5xx·타임아웃 한 번이 곧바로 '긴급' 카드로 확정돼 회장에게 헛경보를 낸다(거짓 성과).
      const needed = CONFIRM_CONSECUTIVE;
      if (!confirmed && cf >= needed) {
        confirmed = true;
        incidentId = `${r.contractId}#${firstFailedAt}`;
        newIncidents.push({ id: incidentId, contractId: r.contractId, target: r.target, category: r.category, severity: r.severity,
          failureClass: r.failureClass, userImpact: r.userImpact, recommendedAction: r.recommendedAction, actual: r.actual, expected: r.expected, detectedAt: nowIso });
      }
    } else if (isPass) {
      cs += 1; cf = 0; lastPassedAt = nowIso;
      if (confirmed && cs >= RECOVERY_CONSECUTIVE) {
        recoveries.push({ incidentId, contractId: r.contractId, target: r.target, recoveredAt: nowIso });
        confirmed = false; incidentId = null; firstFailedAt = null;
      }
    } else {
      // UNAVAILABLE/SKIPPED: 플랩 카운터 유지, 확정/회복 없음
    }

    state.contracts[r.contractId] = { status: r.status, cf, cs, firstFailedAt, lastPassedAt, incidentId, severity: r.severity, updatedAt: nowIso, lastSeenAt: nowIso };
    results.push({ contractId: r.contractId, target: r.target, category: r.category, status: r.status, severity: r.severity,
      failureClass: r.failureClass || "", confirmed, incidentId, firstFailedAt, userImpact: r.userImpact, recommendedAction: r.recommendedAction, actual: r.actual, expected: r.expected, checkedAt: nowIso });
  }
  // 고아 계약 정리: 더 이상 방출되지 않는 계약(retired 앱·중단된 점검)이 incidentId를 영구 보유해
  // 자동 종료가 안 되고(회장 화면에 영원히 열린 카드) 상태가 무한 증식하는 것을 막는다.
  // 유예를 넘겨 사라진 항목은 정리하고, 열려 있던 incident는 회복으로 닫아 결재도 자동 종료되게 한다.
  const ORPHAN_TTL_MS = 7 * 24 * 3600_000;
  const seenIds = new Set(raw.map((r) => r.contractId));
  for (const [cid, entry] of Object.entries(state.contracts)) {
    if (seenIds.has(cid)) continue;
    const last = Date.parse(entry.lastSeenAt || entry.updatedAt || "");
    if (Number.isFinite(last) && (now.getTime() - last) <= ORPHAN_TTL_MS) continue; // 아직 유예 내 — 유지
    if (entry.incidentId) recoveries.push({ incidentId: entry.incidentId, contractId: cid, target: cid.split(":")[1] || cid, recoveredAt: nowIso, reason: "orphan_pruned" });
    delete state.contracts[cid];
  }
  state.updatedAt = nowIso;

  const summary = {
    runAt: nowIso,
    total: results.length,
    fail: results.filter((r) => r.status === HEALTH_STATUS.FAIL).length,
    degraded: results.filter((r) => r.status === HEALTH_STATUS.DEGRADED).length,
    pass: results.filter((r) => r.status === HEALTH_STATUS.PASS).length,
    unavailable: results.filter((r) => r.status === HEALTH_STATUS.UNAVAILABLE).length,
    openIncidents: Object.values(state.contracts).filter((c) => c.incidentId).length,
  };

  try {
    writeJson(join(healthDir(runtimeDir), "state.json"), state);
    writeJson(join(healthDir(runtimeDir), "latest.json"), { summary, results });
    const dateKey = nowIso.slice(0, 10);
    for (const inc of newIncidents) appendFileSync(join(healthDir(runtimeDir), "incidents.jsonl"), JSON.stringify(inc) + "\n", { encoding: "utf8", mode: 0o600 });
    for (const rec of recoveries) appendFileSync(join(healthDir(runtimeDir), "recoveries.jsonl"), JSON.stringify(rec) + "\n", { encoding: "utf8", mode: 0o600 });
    if (newIncidents.length || recoveries.length) appendFileSync(join(healthDir(runtimeDir), "history", `${dateKey}.jsonl`), JSON.stringify({ at: nowIso, summary }) + "\n", { encoding: "utf8", mode: 0o600 });
  } catch { /* evidence 저장 실패가 엔진을 멈추지 않게 한다 */ }

  return { summary, results, newIncidents, recoveries };
}
