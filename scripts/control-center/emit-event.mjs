// 작업 이벤트 기록기 — Claude Code / Codex / GitHub Actions 훅이 호출해 같은 형식으로 남긴다.
// 이 이벤트가 있어야만 본부가 직원을 '작업 중'으로 표시한다(연출 금지).
// 사용: node scripts/control-center/emit-event.mjs --type test_completed --agent homebom-data --app homebom --repo robom-labs/homebom --status verifying --message "..." [--json '{...}']
// 민감정보(프롬프트 원문·비밀값·개인정보·전체 로그) 저장 금지 — 요약과 증거만.
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/sources.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { out[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i]; }
  }
  return out;
}

const a = parseArgs(process.argv.slice(2));
const now = new Date().toISOString();
let event;
if (a.json) {
  event = JSON.parse(a.json);
} else {
  event = {
    eventId: `evt_${now.replace(/[^0-9]/g, "").slice(0, 17)}_${Math.floor(performance.now())}`,
    taskId: a.task || null,
    runId: a.run || a.runId || null,
    agentId: a.agent || null,
    departmentId: a.department || a.dept || null,
    appId: a.app || null,
    repo: a.repo || null,
    branch: a.branch || null,
    sha: a.sha || null,
    type: a.type || "heartbeat",
    status: a.status || null,
    message: a.message || null,
    evidence: { command: a.command || null, result: a.result || null, pullRequest: a.pr || null, workflowRun: a.workflow || null },
  };
}
event.createdAt = event.createdAt || now;

if (!event.type) { console.error("emit-event: --type 필수"); process.exit(1); }

const dir = join(REPO_ROOT, "ops/control-center/events");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(now));
appendFileSync(join(dir, `${day}.jsonl`), JSON.stringify(event) + "\n");
console.log(`[robom-hq] event 기록: ${event.type} · ${event.agentId || "?"} · ${event.appId || "-"}`);
