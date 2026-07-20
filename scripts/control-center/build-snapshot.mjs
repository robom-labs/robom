// 로봄 본부 스냅샷 생성기 — 실제 데이터만 모아 snapshots/latest.json 을 만든다.
// 외부 유료 API·상시 서버 없음. GitHub 공개 저장소는 무료 REST로 읽고 토큰이 있으면 호출 한도만 높인다.
import { writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO_ROOT, readApps, readState, gitInfo, ghOpenPRs, ghRecentRuns, readDepartments, readAgents, parseYamlList, readText } from "./lib/sources.mjs";
import { controlCenterFields } from "./lib/sources.mjs";
import { readEvents, deriveRuns } from "./lib/events.mjs";
import { siteDeploySha } from "../../ops/scripts/lib/deployment-sha.mjs";
import { inspectApp } from "../../ops/scripts/family/operations-watchdog.mjs";
import { buildCompanyOperations } from "./lib/company-ops.mjs";

const NOW = process.env.ROBOM_HQ_NOW || new Date().toISOString();
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;

// 로컬 클론 위치 후보 (있으면 git 정보 수집)
const localDir = (id) => {
  if (id === "robom") return REPO_ROOT;
  const sibling = join(dirname(REPO_ROOT), id);
  return existsSync(join(sibling, ".git")) ? sibling : `/workspace/${id}`;
};

function todayKst(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

function appHealth(ci) {
  if (!ci || ci.length === 0) return "unknown";
  // 배포 run이 없으면 무관한 워크플로(lint·test 등)로 앱을 down/ok 판정하지 않는다(거짓 장애·거짓 정상 방지) → 미확인.
  const latestDeploy = ci.find((r) => /deploy/i.test(r.name));
  if (!latestDeploy) return "unknown";
  if (latestDeploy.status !== "completed") return "running";
  return latestDeploy.conclusion === "success" ? "ok" : latestDeploy.conclusion === "failure" ? "down" : "warn";
}

async function collectApp(app) {
  const id = app.id;
  const state = readState(REPO_ROOT, id);
  const git = gitInfo(localDir(id));
  let openPrs = null, ci = null, github = "not_connected";
  if (app.repo) {
    try {
      [openPrs, ci] = await Promise.all([ghOpenPRs(app.repo, TOKEN), ghRecentRuns(app.repo, TOKEN)]);
      github = "connected";
    } catch (e) {
      github = "error";
    }
  }
  let production = null;
  if (app.healthcheck_url && app.web_url && app.version_source) {
    try { production = await inspectApp(app, new Date(NOW)); }
    catch (e) { production = null; } // 운영 점검 실패가 앱 자체를 목록에서 떨어뜨리지 않게 한다
  }
  const health = production?.status === "PASS" ? "ok" : production?.status === "STALE" ? "warn" : production?.status === "FAIL" ? "down" : appHealth(ci);
  const fields = controlCenterFields(app);
  const todayDeploys = (ci || []).filter((r) => /deploy/i.test(r.name) && todayKst(r.createdAt) === todayKst(NOW));
  // '오늘 실패'는 배포 실패를 뜻한다('오늘 배포'와 같은 기준). lint·test 워크플로 실패로 배포 실패 수를 부풀리지 않는다.
  const todayFails = (ci || []).filter((r) => /deploy/i.test(r.name) && r.conclusion === "failure" && todayKst(r.createdAt) === todayKst(NOW));
  return {
    id,
    name: app.name,
    accent: app.accent || null,
    repo: app.repo || null,
    url: fields.url,
    version: app.version || state.version || null,
    registered: app.registered !== false,
    stack: app.stack || null,
    deployTarget: fields.deployTarget,
    role: app.marketing_tone || null,
    tracked: state.tracked === true,
    nextActions: state.next || [],
    blocked: state.blocked || null,
    git: git.available ? { available: true, branch: git.branch, sha: git.sha, lastMsg: git.lastMsg, lastDate: git.lastDate, workBranches: git.workBranches } : { available: false },
    github,
    openPrs: openPrs || [],
    ci: ci || [],
    health,
    production,
    todayDeploys: todayDeploys.length,
    todayFails: todayFails.length,
    note: app.note || null,
  };
}

async function main() {
  const sitePackage = JSON.parse(readText(join(REPO_ROOT, "site/package.json")) || "{}"); // 데스크톱 payload처럼 site가 없는 배치에서도 동작
  const centralGit = gitInfo(REPO_ROOT);
  const deployedSiteSha = siteDeploySha(REPO_ROOT);
  const apps = [{
    id: "robom",
    name: "로봄 본사",
    repo: "robom-labs/robom",
    version: sitePackage.version || null,
    version_source: "https://raw.githubusercontent.com/robom-labs/robom/main/site/package.json",
    web_url: "https://robom.kr/",
    healthcheck_url: "https://robom.kr/",
    deploy_provider: "openai-sites",
    last_deployed_sha: deployedSiteSha || centralGit.sha || "",
    last_verified_at: NOW,
    last_data_sync_at: NOW,
    freshness_status: "runtime",
    freshness_slo_hours: 48,
    registered: true,
  }, ...readApps(REPO_ROOT)];
  const appData = [];
  // 순차 수집(rate limit 보호). 한 앱 수집이 실패해도 목록에서 빠지지 않도록 최소 항목으로 보존한다.
  for (const app of apps) {
    try {
      appData.push(await collectApp(app));
    } catch (error) {
      console.error(`[robom-hq] ${app.id} 수집 실패 — 최소 항목으로 보존:`, error.message);
      appData.push({
        id: app.id, name: app.name, accent: app.accent || null, repo: app.repo || null,
        url: app.web_url || app.url || null, version: app.version || null, registered: app.registered !== false,
        stack: app.stack || null, deployTarget: app.deploy_provider || null, role: app.marketing_tone || null,
        tracked: false, nextActions: [], blocked: null, git: { available: false }, github: "error",
        openPrs: [], ci: [], health: "unknown", production: null, todayDeploys: 0, todayFails: 0,
        note: app.note || null, collectError: true,
      });
    }
  }

  // 전역 네트워크 선행: 운영 점검(healthcheck) 대상이 2개 이상인데 전부 동시에 FAIL이면
  // 개별 앱 장애가 아니라 로컬 네트워크·공통 호스트 문제로 본다(health-engine의 company:network 가드와 정렬).
  // 이 경우 신호등을 '전부 빨강(장애)'으로 위장하지 않고 미확인(unknown)으로 낮춰 거짓 경보를 막는다.
  const probed = appData.filter((a) => a.production && a.production.status);
  const networkSuspected = probed.length >= 2 && probed.every((a) => a.production.status === "FAIL");
  if (networkSuspected) {
    for (const a of probed) { a.health = "unknown"; a.networkSuspected = true; }
  }

  const departments = readDepartments(REPO_ROOT);
  const agents = readAgents(REPO_ROOT);
  const events = readEvents(REPO_ROOT, NOW);
  const runs = deriveRuns(events, NOW);

  // 승인함(선택): approvals.yml + 이벤트의 approval_requested pending
  const approvalsFile = parseYamlList(readText(join(REPO_ROOT, "ops/control-center/approvals.yml")), "approvals");
  const eventApprovals = runs.filter((r) => r.status === "approval_pending").map((r) => ({ id: r.runId, decision: r.task, app: r.appId, from: "event" }));
  // 같은 안건이 approvals.yml과 이벤트 양쪽에 있으면 회장 화면에 두 번 뜬다 → id 기준 중복 제거.
  const approvalSeen = new Set();
  const approvals = [...approvalsFile, ...eventApprovals].filter((a) => {
    const key = a?.id || `${a?.app || ""}:${a?.decision || ""}`;
    if (approvalSeen.has(key)) return false;
    approvalSeen.add(key);
    return true;
  });

  // 회사 요약(연출 없이 실데이터 집계)
  const workingStatuses = new Set(["assigned", "investigating", "implementing", "verifying", "fixing", "deploying", "working"]);
  const working = runs.filter((r) => workingStatuses.has(r.status));
  const liveApps = appData.filter((a) => a.health !== "planned");
  const okCount = liveApps.filter((a) => a.health === "ok").length;
  const warnCount = liveApps.filter((a) => a.health === "warn" || a.health === "unknown" || a.health === "running").length;
  const downCount = liveApps.filter((a) => a.health === "down").length;
  const trafficLight = downCount > 0 ? "red" : warnCount > 0 ? "yellow" : "green";

  const company = {
    trafficLight,
    apps: { total: appData.length, live: liveApps.length, ok: okCount, warn: warnCount, down: downCount, planned: appData.filter((a) => a.health === "planned").length },
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

  const githubReadable = appData.some((app) => app.github === "connected");
  const connections = {
    github: githubReadable
      ? (TOKEN ? "connected(authenticated REST)" : "connected(public REST · 추가 비용 없음)")
      : "not_connected(GitHub REST 읽기 실패 · 로컬 git만)",
    localGit: apps.map((app) => app.id).filter((id) => existsSync(join(localDir(id), ".git"))),
    events: events.length > 0 ? "connected" : "no_events(아직 작업 이벤트 없음)",
    codex: "runner(단일 실행기 — 모든 자동 수정은 코덱스)",
  };

  const operations = buildCompanyOperations(REPO_ROOT, appData);

  const snapshot = {
    product: "ROBOM COMPANY OS · 로봄 본부",
    phase: "company-os-v2",
    generatedAt: NOW,
    company,
    apps: appData,
    departments,
    agents,
    runs,
    approvals,
    events: events.slice(-40).reverse(),
    connections,
    operations,
  };

  const outDir = process.env.ROBOM_HQ_SNAP_DIR || join(REPO_ROOT, "ops/control-center/snapshots");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  // 조회 중인 UI가 반쯤 기록된 JSON을 읽지 않도록 임시 파일을 완성한 뒤 한 번에 교체한다.
  const latest = join(outDir, "latest.json");
  const temporary = join(outDir, "latest.json.tmp");
  writeFileSync(temporary, JSON.stringify(snapshot, null, 2));
  renameSync(temporary, latest);
  console.log(`[robom-hq] snapshot 생성: apps=${appData.length} agents=${agents.length} runs=${runs.length} github=${connections.github}`);
  return snapshot;
}

main().catch((e) => { console.error("[robom-hq] snapshot 실패:", e.message); process.exit(1); });
