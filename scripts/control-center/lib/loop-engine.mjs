// loop-engine.mjs — 장애·개선·성장 후보를 하나의 Loop로 관리하는 결정론적 엔진(AI 없음).
// v3.1.0 지침 §6 Loop 객체 · §7 상태기계 · 이벤트 저장소.
// 핵심 원칙: "Codex exit 0 = 해결"이 아니다. 원래 실패한 계약이 다시 PASS해야만 CLOSED로 본다(§7).
//           실패하면 같은 수정을 무한 반복하지 않고 새 iteration으로 접근을 바꾼다(§10.2).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_COMPANY_RUNTIME_DIR } from "./company-store.mjs";

// §7 상태기계 — 정의된 상태만 허용한다.
export const LOOP_STATES = Object.freeze([
  "DISCOVERED", "TRIAGED", "OBJECTIVE_DEFINED", "CRITERIA_DEFINED", "AWAITING_APPROVAL",
  "DELEGATED_APPROVAL", "QUEUED", "CLAIMED", "INVESTIGATING", "IMPLEMENTING", "VERIFYING_LOCAL",
  "WAITING_CI", "MERGING", "DEPLOYING", "VERIFYING_PRODUCTION", "RECHECKING_ORIGIN",
  "RED_TEAM_AUDIT", "LEARNING", "RECOVERED", "CLOSED", "RETRY_WAIT",
  "BLOCKED_EXTERNAL", "BLOCKED_HUMAN", "FAILED_SAFE",
]);
export const TERMINAL_STATES = Object.freeze(new Set(["CLOSED", "FAILED_SAFE"]));
// 활성(닫히지 않은) 상태 = 회사가 계속 돌보는 Loop.
export function isActive(state) { return !TERMINAL_STATES.has(state); }

export const LOOP_TYPES = Object.freeze([
  "reliability", "security", "data_quality", "performance", "accessibility", "design_quality",
  "user_experience", "maintenance", "product_growth", "portfolio_growth", "meta_improvement",
]);
export const AUTHORITY_CLASSES = Object.freeze(["self_heal", "codex", "human"]);

const LOOP_STATE_LABEL = {
  DISCOVERED: "발견", TRIAGED: "분류", OBJECTIVE_DEFINED: "목표 정의", CRITERIA_DEFINED: "기준 정의",
  AWAITING_APPROVAL: "회장 승인 대기", DELEGATED_APPROVAL: "전결 승인", QUEUED: "대기열", CLAIMED: "배정됨",
  INVESTIGATING: "조사 중", IMPLEMENTING: "수정 중", VERIFYING_LOCAL: "로컬 검증", WAITING_CI: "CI 대기",
  MERGING: "병합", DEPLOYING: "배포 중", VERIFYING_PRODUCTION: "운영 검증", RECHECKING_ORIGIN: "원래 계약 재검증",
  RED_TEAM_AUDIT: "반박 감사", LEARNING: "학습", RECOVERED: "회복", CLOSED: "종료",
  RETRY_WAIT: "재시도 대기", BLOCKED_EXTERNAL: "외부 대기", BLOCKED_HUMAN: "회장 확인", FAILED_SAFE: "안전 중단",
};
export function loopStateLabel(state) { return LOOP_STATE_LABEL[state] || state; }

function loopDir(runtimeDir) { return join(resolve(runtimeDir), "loop-engineering"); }
function loopsFile(runtimeDir) { return join(loopDir(runtimeDir), "loops.json"); }
function eventsFile(runtimeDir) { return join(loopDir(runtimeDir), "events.jsonl"); }

export function readLoops(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  try { return JSON.parse(readFileSync(loopsFile(runtimeDir), "utf8")); } catch { return {}; }
}
function writeLoops(runtimeDir, loops) {
  mkdirSync(loopDir(runtimeDir), { recursive: true, mode: 0o700 });
  writeFileSync(loopsFile(runtimeDir), JSON.stringify(loops, null, 2), { encoding: "utf8", mode: 0o600 });
}
function appendEvent(runtimeDir, event) {
  try {
    mkdirSync(loopDir(runtimeDir), { recursive: true, mode: 0o700 });
    appendFileSync(eventsFile(runtimeDir), JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
  } catch { /* 증거 저장 실패가 엔진을 멈추지 않게 한다 */ }
}

// 계약/사건에서 기계 판독 가능한 합격 기준을 파생한다(§8). 핵심: "원래 실패한 그 계약이 다시 PASS".
export function deriveAcceptanceCriteria(origin = {}) {
  const criteria = [{
    id: "origin-contract-pass",
    evaluator: "health_contract",
    source: origin.contractId || origin.id || "origin",
    expected: origin.expected || "PASS",
    required: true,
    evidenceFields: ["origin_recheck"],
  }];
  // 코드 변경형은 로컬 테스트·CI 통과도 요구한다(있을 때만 판정, 없으면 UNAVAILABLE로 남긴다).
  if (origin.authorityClass === "codex" || origin.fixClass === "codex") {
    criteria.push({ id: "local-tests-pass", evaluator: "test_exit", source: "task", expected: 0, required: true, evidenceFields: ["local"] });
    criteria.push({ id: "ci-success", evaluator: "ci_conclusion", source: "task", expected: "success", required: false, evidenceFields: ["ci"] });
  }
  return criteria;
}

let SEQ = 0;
function nextId(now) {
  SEQ = (SEQ + 1) % 100000;
  return `loop-${now.getTime().toString(36)}-${SEQ.toString(36)}`;
}

// Loop 생성 — objective·acceptance_criteria·owner·verifier가 없으면 만들지 않는다(§6 규칙).
export function createLoop(input = {}, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = new Date() } = {}) {
  const objective = input.objective || input.title || "";
  if (!objective) throw new Error("Loop에는 objective가 필요합니다.");
  const authorityClass = input.authorityClass || input.fixClass || "codex";
  const acceptanceCriteria = input.acceptanceCriteria?.length ? input.acceptanceCriteria : deriveAcceptanceCriteria({ ...input, authorityClass });
  const owner = input.ownerAgent || input.ownerTeam || "개발팀";
  const verifier = input.verifierAgent || "검사팀";
  const nowIso = now.toISOString();
  const state = input.state || (authorityClass === "self_heal" ? "TRIAGED" : "AWAITING_APPROVAL");
  const loop = {
    loopId: input.loopId || nextId(now),
    loopType: input.loopType || "reliability",
    origin: input.origin || { type: "health_contract", id: input.contractId || "" },
    targetApp: input.targetApp || input.appId || "",
    targetRepo: input.targetRepo || "",
    baseSha: input.baseSha || "",
    objective,
    whyNow: input.whyNow || input.userImpact || "",
    userImpact: input.userImpact || "",
    acceptanceCriteria,
    severity: input.severity || "warning",
    authorityClass,
    ownerTeam: input.ownerTeam || owner,
    ownerAgent: owner,
    verifierAgent: verifier,
    executor: input.executor || "codex",
    iteration: 1,
    state,
    failureSignature: null,
    evidence: {},
    attemptHistory: [],
    nextAction: input.nextAction || (state === "AWAITING_APPROVAL" ? "회장 승인 대기" : "조사 시작"),
    baselineFailCount: Number.isFinite(input.baselineFailCount) ? input.baselineFailCount : null, // §17 회귀 감사 기준선
    contractId: input.contractId || "",
    taskId: input.taskId || null,
    approvalId: input.approvalId || null,
    createdAt: nowIso,
    updatedAt: nowIso,
    closedAt: null,
  };
  const loops = readLoops(runtimeDir);
  loops[loop.loopId] = loop;
  writeLoops(runtimeDir, loops);
  appendEvent(runtimeDir, { at: nowIso, loopId: loop.loopId, event: "created", state, authorityClass });
  return loop;
}

// 상태 전이 — 정의된 상태만 허용하고 종료 상태에서는 되돌리지 않는다.
export function transitionLoop(loopId, toState, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = new Date(), note = "", evidence = null, patch = {} } = {}) {
  if (!LOOP_STATES.includes(toState)) throw new Error(`알 수 없는 Loop 상태: ${toState}`);
  const loops = readLoops(runtimeDir);
  const loop = loops[loopId];
  if (!loop) return null;
  if (TERMINAL_STATES.has(loop.state) && loop.state !== toState) return loop; // 종료된 Loop는 재개하지 않음
  const nowIso = now.toISOString();
  loop.state = toState;
  loop.updatedAt = nowIso;
  if (toState === "CLOSED" || toState === "FAILED_SAFE") loop.closedAt = nowIso;
  if (evidence && typeof evidence === "object") loop.evidence = { ...loop.evidence, ...evidence };
  Object.assign(loop, patch);
  loops[loopId] = loop;
  writeLoops(runtimeDir, loops);
  appendEvent(runtimeDir, { at: nowIso, loopId, event: "transition", state: toState, note });
  return loop;
}

// 새 iteration — 같은 실패 원인이면 접근을 바꾸도록 iteration을 올리고 재시도 대기로 둔다(§10.2).
export function openIteration(loopId, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, now = new Date(), failureSignature = "", note = "" } = {}) {
  const loops = readLoops(runtimeDir);
  const loop = loops[loopId];
  if (!loop || TERMINAL_STATES.has(loop.state)) return loop || null;
  const nowIso = now.toISOString();
  loop.attemptHistory = loop.attemptHistory || [];
  loop.attemptHistory.push({ iteration: loop.iteration, failureSignature: loop.failureSignature || failureSignature, endedAt: nowIso });
  loop.iteration += 1;
  loop.failureSignature = failureSignature || loop.failureSignature;
  loop.state = "TRIAGED";
  loop.updatedAt = nowIso;
  loop.nextAction = "접근 방식을 바꿔 다시 시도";
  loops[loopId] = loop;
  writeLoops(runtimeDir, loops);
  appendEvent(runtimeDir, { at: nowIso, loopId, event: "iteration", iteration: loop.iteration, failureSignature });
  return loop;
}

export function findLoopByContract(contractId, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR } = {}) {
  const loops = readLoops(runtimeDir);
  return Object.values(loops).find((l) => l.contractId === contractId && isActive(l.state)) || null;
}
export function findLoopByTask(taskId, { runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR } = {}) {
  const loops = readLoops(runtimeDir);
  return Object.values(loops).find((l) => l.taskId === taskId) || null;
}

// §14 Meta Loop — Loop 시스템 자체를 점검한다. 멈춘 Loop·재시도 폭주·담당/검증자 누락을 결정론으로 찾아
// 회장에게 "회사가 스스로 자기 운영도 감시한다"를 정직하게 보여준다. 이 자체는 부작용이 없다(읽기·플래그만).
export function metaAudit(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR, { now = new Date(), stuckHours = 24, maxIteration = 5 } = {}) {
  const active = Object.values(readLoops(runtimeDir)).filter((l) => isActive(l.state));
  const nowMs = now.getTime();
  const issues = [];
  const waiting = new Set(["AWAITING_APPROVAL", "DELEGATED_APPROVAL", "BLOCKED_HUMAN", "BLOCKED_EXTERNAL", "RETRY_WAIT"]);
  for (const l of active) {
    if (!l.ownerAgent || !l.verifierAgent) issues.push({ loopId: l.loopId, objective: l.objective, kind: "missing_role", note: "담당자·검증자가 지정되지 않았습니다." });
    if ((l.iteration || 1) >= maxIteration) issues.push({ loopId: l.loopId, objective: l.objective, kind: "retry_storm", note: `${l.iteration}회 재시도 — 접근을 근본적으로 바꿔야 합니다.` });
    const ageH = (nowMs - Date.parse(l.updatedAt || l.createdAt || now.toISOString())) / 3.6e6;
    if (Number.isFinite(ageH) && ageH > stuckHours && !waiting.has(l.state)) issues.push({ loopId: l.loopId, objective: l.objective, kind: "stuck", note: `${Math.round(ageH)}시간째 진행이 없습니다.` });
  }
  return { checkedAt: now.toISOString(), activeCount: active.length, issueCount: issues.length, issues: issues.slice(0, 20) };
}

// 요약(회장 화면·hq-status 노출용).
export function summarizeLoops(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  const loops = Object.values(readLoops(runtimeDir));
  const active = loops.filter((l) => isActive(l.state));
  const byState = {};
  for (const l of active) byState[l.state] = (byState[l.state] || 0) + 1;
  return {
    total: loops.length,
    active: active.length,
    closed: loops.filter((l) => l.state === "CLOSED").length,
    failedSafe: loops.filter((l) => l.state === "FAILED_SAFE").length,
    byState,
    meta: metaAudit(runtimeDir),
    activeLoops: active
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 30)
      .map((l) => ({
        loopId: l.loopId, loopType: l.loopType, targetApp: l.targetApp, objective: l.objective,
        state: l.state, stateLabel: loopStateLabel(l.state), authorityClass: l.authorityClass,
        iteration: l.iteration, nextAction: l.nextAction, severity: l.severity, taskId: l.taskId || null,
        acceptanceCriteria: l.acceptanceCriteria, evidence: l.evidence, createdAt: l.createdAt, updatedAt: l.updatedAt,
      })),
  };
}
