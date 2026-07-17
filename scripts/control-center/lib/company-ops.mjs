// 로봄 Company OS 화면에 필요한 운영 장부·자동화·업데이트 정보를 정본 파일에서 읽는다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const read = (path) => existsSync(path) ? readFileSync(path, "utf8") : "";

export function parseMarkdownChecklist(text) {
  return String(text).split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/);
    return match ? [{ done: match[1].toLowerCase() === "x", title: match[2] }] : [];
  });
}

export function parseWorkflowAutomation(name, text) {
  const displayName = String(text).match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1] || basename(name, ".yml");
  const cron = [...String(text).matchAll(/cron:\s*["']([^"']+)["']/g)].map((match) => match[1]);
  const hasSchedule = /\bschedule\s*:/m.test(text);
  const hasDispatch = /\bworkflow_dispatch\s*:/m.test(text);
  return {
    id: basename(name).replace(/\.ya?ml$/, ""),
    name: displayName,
    schedule: cron.length ? cron.join(" · ") : hasSchedule ? "예약 주기 확인 필요" : hasDispatch ? "수동 실행" : "이벤트 실행",
    purpose: hasSchedule ? "GitHub Actions 예약 작업" : hasDispatch ? "필요할 때 사람이 실행" : "저장소 이벤트에 따라 실행",
    status: "planned",
    statusLabel: "등록됨 · 실행 증거 별도",
    lastRun: null,
  };
}

export function buildCompanyOperations(repoRoot, apps = []) {
  const humanTasks = parseMarkdownChecklist(read(join(repoRoot, "ops/HUMAN-TASKS.md")))
    .filter((item) => !item.done)
    .map((item) => item.title);
  const roadmap = parseMarkdownChecklist(read(join(repoRoot, "ops/ROADMAP.md")));
  const workflowsDir = join(repoRoot, ".github/workflows");
  const automations = existsSync(workflowsDir)
    ? readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file)).sort().map((file) => parseWorkflowAutomation(file, read(join(workflowsDir, file))))
    : [];
  const updates = apps
    .filter((app) => app.git?.lastMsg || app.git?.lastDate)
    .map((app) => ({
      appId: app.id,
      title: app.git?.lastMsg || `${app.name} 운영 상태 갱신`,
      at: app.git?.lastDate || null,
      version: app.version || null,
      sha: app.git?.sha || app.production?.deployedSha || null,
      reason: app.nextActions?.[0] || "운영 안정성과 사용자 경험 개선",
    }))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const gitignore = read(join(repoRoot, ".gitignore"));
  const security = [
    { name: "내부 runtime 커밋 제외", ok: /ops\/control-center\/runtime/.test(gitignore), note: "회의·결재·검수 기록을 공개 저장소에서 제외합니다." },
    { name: "비밀값 원문 저장 차단", ok: existsSync(join(repoRoot, "scripts/control-center/lib/company-store.mjs")), note: "토큰·키·비밀번호 패턴을 로컬 저장 단계에서 거부합니다." },
    { name: "로컬 전용 서버", ok: true, note: "127.0.0.1과 localhost Host만 허용합니다." },
    { name: "추가 운영비", ok: true, note: "유료 API와 상시 서버를 새로 사용하지 않습니다." },
  ];
  return { humanTasks, roadmap, automations, updates, security };
}
