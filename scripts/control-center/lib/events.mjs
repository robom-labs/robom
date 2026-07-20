// 작업 이벤트(jsonl) 읽기 + "등록됨 vs 실제 작업 중" 상태 판정.
// 실제 증거(이벤트)가 없으면 절대 '작업 중'으로 표시하지 않는다(연출 금지).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./sources.mjs";

export const STALE_MINUTES = 30;

const TERMINAL = new Set(["run_completed", "run_failed", "rollback_completed"]);
// 사람 승인 대기·외부 작업 대기는 heartbeat 없이 오래 걸리는 게 정상(사람이 30분 넘게 결재를 안 할 수 있고,
// 스토어 심사 등 외부 대기는 며칠 간다). 이를 시간 경과로 '상태 확인 필요'로 낮추면 회장 승인함에서 조용히 사라진다(승인 게이트 붕괴).
const WAIT_EXEMPT = new Set(["approval_pending", "external_wait"]);

// createdAt을 숫자 시각으로 판정한다. 없거나 깨진 값은 -Infinity(가장 과거)로 취급해
// 절대 '가장 최신 이벤트(last)'로 정렬돼 실제 최종 상태를 덮어쓰지 못하게 한다.
// (문자열 localeCompare는 "undefined"가 "2026-..."보다 뒤로 정렬돼 깨진 이벤트가 last를 오염시켰다.)
function eventTime(e) { const t = Date.parse(e?.createdAt || ""); return Number.isFinite(t) ? t : -Infinity; }
function byTime(a, b) { const x = eventTime(a), y = eventTime(b); return x === y ? 0 : x < y ? -1 : 1; } // Array.sort 안정성으로 동시각은 삽입 순서 유지

// 손상 라인 수(dropped)까지 함께 반환한다 — 스냅샷/화면에 데이터 유실을 정직하게 노출하기 위함(로그만으론 회장이 못 본다).
export function readEventsWithMeta(root = REPO_ROOT, nowMs = null) {
  const dir = join(root, "ops/control-center/events");
  if (!existsSync(dir)) return { events: [], dropped: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const events = [];
  let dropped = 0;
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try { events.push(JSON.parse(t)); } catch { dropped += 1; } // 손상 라인은 건너뛰되 조용히 삼키지 않는다
    }
  }
  // 손상 이벤트가 있으면 로그로 남긴다(터미널 이벤트가 유실돼 완료된 작업이 '작업 중'으로 보일 수 있음을 감춤 금지).
  if (dropped > 0) console.warn(`[robom-hq] 손상된 이벤트 줄 ${dropped}개 건너뜀 — 일부 작업 상태가 정확하지 않을 수 있습니다.`);
  events.sort(byTime);
  return { events, dropped };
}

export function readEvents(root = REPO_ROOT, nowMs = null) {
  return readEventsWithMeta(root, nowMs).events;
}

// runId(없으면 agentId) 단위로 최신 상태를 접는다.
export function deriveRuns(events, nowIso) {
  const now = nowIso ? Date.parse(nowIso) : null;
  const byRun = new Map();
  for (const e of events) {
    const key = e.runId || e.taskId || e.agentId || "unknown";
    if (!byRun.has(key)) byRun.set(key, []);
    byRun.get(key).push(e);
  }
  const runs = [];
  for (const [key, list] of byRun) {
    list.sort(byTime);
    const last = list[list.length - 1];
    const first = list[0];
    const types = new Set(list.map((e) => e.type));
    // last.status는 알려진 상태일 때만 신뢰한다(라벨 없는 임의 문자열이 빈 상태로 렌더되는 것 방지).
    let status = (last.status && STATUS_LABEL[last.status]) ? last.status : inferStatus(types, last.type);
    const lastAt = Date.parse(last.createdAt || "");
    const terminal = TERMINAL.has(last.type);
    // 사람 승인 대기·외부 작업 대기는 정상적으로 오래 걸린다 → 시간 경과·시각 부재로 강등해 승인함에서 사라지게 하지 않는다.
    // (그 외 '작업 중'류는 heartbeat가 끊기면 러너가 죽은 것일 수 있어 정직하게 '상태 확인 필요'로 낮춘다.)
    if (!terminal && !WAIT_EXEMPT.has(status)) {
      if (!Number.isFinite(lastAt)) status = "needs_check";
      else if (now && (now - lastAt) > STALE_MINUTES * 60000) status = "needs_check";
    }
    runs.push({
      runId: key,
      agentId: last.agentId || null,
      departmentId: last.departmentId || null,
      appId: last.appId || null,
      repo: last.repo || null,
      branch: last.branch || null,
      sha: last.sha || null,
      task: last.message || last.task || null,
      status,
      startedAt: first.createdAt || null,
      lastActivity: last.createdAt || null,
      stage: last.type,
      pr: last.evidence?.pullRequest || null,
      workflowRun: last.evidence?.workflowRun || null,
      checks: list.filter((e) => e.type === "test_completed" || e.type === "test_failed").map((e) => ({ name: e.evidence?.command || "test", result: e.type === "test_completed" ? "PASS" : "FAIL" })),
      blockedReason: last.type === "run_blocked" ? (last.message || "사유 미기재") : null,
      timeline: list.map((e) => ({ at: e.createdAt, type: e.type, message: e.message || "" })),
    });
  }
  // 최근 활동 순 — 문자열 localeCompare는 lastActivity가 null인 항목("null")을 실제 ISO 시각보다 뒤로 정렬해
  // 순서를 오염시킨다(이 파일이 last 판정에서 이미 버린 안티패턴). 시각으로 비교하고 깨진 값은 가장 과거로 둔다.
  const activityMs = (r) => { const v = Date.parse(r.lastActivity || ""); return Number.isFinite(v) ? v : -Infinity; };
  runs.sort((a, b) => activityMs(b) - activityMs(a));
  return runs;
}

function inferStatus(types, lastType) {
  if (lastType === "approval_requested") return "approval_pending";
  if (lastType === "deploy_started") return "deploying";
  if (lastType === "test_started") return "verifying";
  if (lastType === "run_blocked") return "blocked";
  if (lastType === "run_failed") return "failed";
  if (lastType === "run_completed") return "completed";
  if (lastType === "rollback_completed") return "rolled_back"; // 롤백=배포 되돌림(회귀 발생) — '배정됨'으로 위장 금지
  if (lastType === "implementation_started" || lastType === "file_changed") return "implementing";
  if (lastType === "scope_declared" || lastType === "repository_read") return "investigating";
  if (lastType === "task_assigned") return "assigned";
  if (lastType === "heartbeat") return "working";
  return "assigned";
}

export const STATUS_LABEL = {
  waiting: "대기", assigned: "배정됨", investigating: "조사 중", implementing: "구현 중",
  verifying: "검증 중", fixing: "수정 중", deploying: "배포 중", approval_pending: "사람 승인 대기",
  external_wait: "외부 작업 대기", blocked: "막힘", completed: "완료", failed: "실패",
  needs_check: "상태 확인 필요", working: "작업 중", rolled_back: "되돌림(롤백)",
};
