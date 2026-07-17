// 로봄 본부 스냅샷 생성기 — 실제 데이터만 모아 snapshots/latest.json 을 만든다.
// 외부 유료 API·상시 서버 없음. GitHub는 무료 REST(GITHUB_TOKEN 있으면 사용, 없으면 미연결).
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, readApps, readState, gitInfo, ghOpenPRs, ghRecentRuns, readDepartments, readAgents, parseYamlList, readText } from "./lib/sources.mjs";
import { readEvents, deriveRuns } from "./lib/events.mjs";

const NOW = process.env.ROBOM_HQ_NOW || new Date().toISOString();
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;

// 로컬 클론 위치 후보 (있으면 git 정보 수집)
const LOCAL_DIRS = {
  robom: REPO_ROOT,
  outbom: "/workspace/outbom",
  homebom: "/workspace/homebom",
  runningbom: "/workspace/runningbom",
  certbom: "/workspace/certbom",
};

function todayKst(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

function appHealth(ci) {
  if (!ci || ci.length === 0) return "unknown";
  const latestDeploy = ci.find((r) => /deploy/i.test(r.name)) || ci[0];
  if (latestDeploy.status !== "completed") return "running";
  return latestDeploy.conclusion === "success" ? "ok" : latestDeploy.conclusion === "failure" ? "down" : "warn";
}

async function collectApp(app) {
  const id = app.id;
  const state = readState(REPO_ROOT, id);
  const git = gitInfo(LOCAL_DIRS[id]);
  let openPrs = null, ci = null, github = "not_connected";
  if (app.repo && !app.repo.includes("calbom")) {
    try {
      [openPrs, ci] = await Promise.all([ghOpenPRs(app.repo, TOKEN), ghRecentRuns(app.repo, TOKEN)]);
      github = "connected";
    } catch (e) {
      github = "error";
    }
  }
  const health = app.id === "calbom" ? "planned" : appHealth(ci);
  const todayDeploys = (ci || []).filter((r) => /deploy/i.test(r.name) && todayKst(r.createdAt) === todayKst(NOW));
  const todayFails = (ci || []).filter((r) => r.conclusion === "failure" && todayKst(r.createdAt) === todayKst(NOW));
  return {
    id,
    name: app.name,
    accent: app.accent || null,
    repo: app.repo || null,
    url: app.url || app.current_url || null,
    version: app.version || state.version || null,
    registered: app.registered !== false,
    stack: app.stack || null,
    deployTarget: app.deploy || null,
    role: app.marketing_tone || null,
    tracked: state.tracked === true,
    nextActions: state.next || [],
    blocked: state.blocked || null,
    git: git.available ? { available: true, branch: git.branch, sha: git.sha, lastMsg: git.lastMsg, lastDate: git.lastDate, workBranches: git.workBranches } : { available: false },
    github,
    openPrs: openPrs || [],
    ci: ci || [],
    health,
    todayDeploys: todayDeploys.length,
    todayFails: todayFails.length,
    note: app.note || null,
  };
}

async function main() {
  const apps = readApps(REPO_ROOT);
  const appData = [];
  for (const app of apps) appData.push(await collectApp(app)); // 순차: rate limit 보호

  const departments = readDepartments(REPO_ROOT);
  const agents = readAgents(REPO_ROOT);
  const events = readEvents(REPO_ROOT, NOW);
  const runs = deriveRuns(events, NOW);

  // 승인함(선택): approvals.yml + 이벤트의 approval_requested pending
  const approvalsFile = parseYamlList(readText(join(REPO_ROOT, "ops/control-center/approvals.yml")), "approvals");
  const eventApprovals = runs.filter((r) => r.status === "approval_pending").map((r) => ({ id: r.runId, decision: r.task, app: r.appId, from: "event" }));
  const approvals = [...approvalsFile, ...eventApprovals];

  // 회사 요약(연출 없이 실데이터 집계)
  const workingStatuses = new Set(["assigned", "investigating", "implementing", "verifying", "fixing", "deploying", "working"]);
  const working = runs.filter((r) => workingStatuses.has(r.status));
  const liveApps = appData.filter((a) => a.id !== "calbom");
  const okCount = liveApps.filter((a) => a.health === "ok").length;
  const warnCount = liveApps.filter((a) => a.health === "warn" || a.health === "unknown" || a.health === "running").length;
  const downCount = liveApps.filter((a) => a.health === "down").length;
  const trafficLight = downCount > 0 ? "red" : warnCount > 0 ? "yellow" : "green";

  const company = {
    trafficLight,
    apps: { total: appData.length, live: liveApps.length, ok: okCount, warn: warnCount, down: downCount, planned: appData.filter((a) => a.id === "calbom").length },
    employees: { registered: agents.length, working: working.length },
    tasks: {
      investigating: runs.filter((r) => r.status === "investigating").length,
      implementing: runs.filter((r) => r.status === "implementing").length,
      verifying: runs.filter((r) => r.status === "verifying").length,
      approvalPending: runs.filter((r) => r.status === "approval_pending").length,
      blocked: runs.filter((r) => r.status === "blocked").length,
      needsCheck: runs.filter((r) => r.status === "needs_check").length,
    },
    todayDeploys: appData.reduce((n, a) => n + a.todayDeploys, 0),
    todayFailures: appData.reduce((n, a) => n + a.todayFails, 0),
  };

  const connections = {
    github: TOKEN ? "connected" : "not_connected(토큰 없음 · 로컬 git만)",
    localGit: Object.entries(LOCAL_DIRS).filter(([, d]) => existsSync(join(d, ".git"))).map(([id]) => id),
    events: events.length > 0 ? "connected" : "no_events(아직 작업 이벤트 없음)",
    claudeCode: "adapter_pending(훅으로 emit-event 연결 시 활성)",
    codex: "adapter_pending",
  };

  const snapshot = {
    product: "ROBOM Control Center · 로봄 본부",
    phase: "phase-1-readonly",
    generatedAt: NOW,
    company,
    apps: appData,
    departments,
    agents,
    runs,
    approvals,
    events: events.slice(-40).reverse(),
    connections,
  };

  const outDir = join(REPO_ROOT, "ops/control-center/snapshots");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "latest.json"), JSON.stringify(snapshot, null, 2));
  console.log(`[robom-hq] snapshot 생성: apps=${appData.length} agents=${agents.length} runs=${runs.length} github=${connections.github}`);
  return snapshot;
}

main().catch((e) => { console.error("[robom-hq] snapshot 실패:", e.message); process.exit(1); });
