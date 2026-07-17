// 작업 이벤트(jsonl) 읽기 + "등록됨 vs 실제 작업 중" 상태 판정.
// 실제 증거(이벤트)가 없으면 절대 '작업 중'으로 표시하지 않는다(연출 금지).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./sources.mjs";

export const STALE_MINUTES = 30;

const TERMINAL = new Set(["run_completed", "run_failed", "rollback_completed"]);

export function readEvents(root = REPO_ROOT, nowMs = null) {
  const dir = join(root, "ops/control-center/events");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const events = [];
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try { events.push(JSON.parse(t)); } catch { /* 손상 라인 무시 */ }
    }
  }
  events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return events;
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
    list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const last = list[list.length - 1];
    const first = list[0];
    const types = new Set(list.map((e) => e.type));
    let status = last.status || inferStatus(types, last.type);
    const lastAt = Date.parse(last.createdAt || "");
    const terminal = TERMINAL.has(last.type);
    // heartbeat 만료 → 상태 확인 필요 (터미널이 아닐 때만)
    if (!terminal && now && Number.isFinite(lastAt) && (now - lastAt) > STALE_MINUTES * 60000) {
      status = "needs_check";
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
  // 최근 활동 순
  runs.sort((a, b) => String(b.lastActivity).localeCompare(String(a.lastActivity)));
  return runs;
}

function inferStatus(types, lastType) {
  if (lastType === "approval_requested") return "approval_pending";
  if (lastType === "deploy_started") return "deploying";
  if (lastType === "test_started") return "verifying";
  if (lastType === "run_blocked") return "blocked";
  if (lastType === "run_failed") return "failed";
  if (lastType === "run_completed") return "completed";
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
  needs_check: "상태 확인 필요", working: "작업 중",
};
