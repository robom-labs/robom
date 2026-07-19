// 로봄 HQ 결정론적 health 엔진 — AI 없이 실제 신호로 정상/부분 열화/장애/점검 불가를 판정한다.
// 신호 수집은 기존 build-snapshot(운영 watchdog·git·GitHub REST)이 이미 하므로, 이 엔진은 그 스냅샷 위에
// "결정론적 판정 + 연속 실패/회복(anti-flap) + incident/회복 + 전역 네트워크 선행"만 얹는다.
// 원칙(업로드 프롬프트): 주관적 판정 금지, 임의 eval/shell 금지, 비밀/원문 저장 금지, source 없음을 정상으로 위장 금지,
//   전역 네트워크 장애 시 앱별 critical 스팸 금지, critical은 1회로 확정·warn/error는 연속 2회, 회복은 연속 2회 PASS.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
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
  const withProd = fam.filter((a) => a.production !== undefined && a.production !== null);
  const configured = fam.filter((a) => a.url); // healthcheck 대상
  const allDown = configured.length >= 2 && configured.every((a) => a.production?.status === "FAIL" || a.production === null);
  const results = [];
  if (allDown) {
    // 로컬 네트워크·공통 host 장애로 간주 → 회사 incident 1건, 앱 production은 UNAVAILABLE로 강등(스팸 억제)
    results.push({ contractId: "company:network", target: "company", category: "network", failureClass: "local_network",
      status: HEALTH_STATUS.FAIL, severity: "warning",
      userImpact: "여러 앱의 운영 점검이 동시에 실패했습니다. 인터넷 연결 또는 공통 호스트 문제일 수 있습니다.",
      recommendedAction: "네트워크 연결을 확인하세요. 연결이 정상이면 개별 앱을 다시 점검합니다.", actual: `${configured.length}개 앱 동시 실패`, expected: "정상 응답" });
    for (const a of configured) results.push({ contractId: `production:${a.id}`, target: a.id, category: "production", failureClass: "production",
      status: HEALTH_STATUS.UNAVAILABLE, severity: "info", actual: "network", expected: "PASS", userImpact: "", recommendedAction: "" });
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
  try { return JSON.parse(readFileSync(join(healthDir(runtimeDir), "state.json"), "utf8")); } catch { return { contracts: {} }; }
}
function writeJson(file, value) {
  mkdirSync(join(file, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
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
      const needed = r.severity === "critical" ? 1 : CONFIRM_CONSECUTIVE;
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

    state.contracts[r.contractId] = { status: r.status, cf, cs, firstFailedAt, lastPassedAt, incidentId, severity: r.severity, updatedAt: nowIso };
    results.push({ contractId: r.contractId, target: r.target, category: r.category, status: r.status, severity: r.severity,
      confirmed, incidentId, userImpact: r.userImpact, recommendedAction: r.recommendedAction, actual: r.actual, expected: r.expected, checkedAt: nowIso });
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
