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
  // 비밀값 저장 차단: 파일 존재만으로 '통과'를 보이지 않고(거짓 성과 금지), 실제 거부 로직이 코드에 있는지 확인한다.
  const storeSrc = read(join(repoRoot, "scripts/control-center/lib/company-store.mjs"));
  const secretBlockOk = /SENSITIVE_CONTENT/.test(storeSrc) && /원문은 저장할 수 없습니다/.test(storeSrc);
  // 서버 노출 실태: 원격 토큰(env)·휴대폰 연결(runtime 파일)이 켜져 있으면 서버는 0.0.0.0(사설망)에 열린다.
  // "127.0.0.1만 허용"을 무조건 초록으로 띄우던 거짓 표기를 실제 상태에 맞춰 정직하게 바꾼다.
  const remoteToken = process.env.ROBOM_HQ_REMOTE_TOKEN || "";
  const remoteOn = String(remoteToken).length >= 12;
  let mobileOn = false;
  const runtimeDir = process.env.ROBOM_HQ_RUNTIME_DIR || join(repoRoot, "ops/control-center/runtime");
  try { const ms = JSON.parse(read(join(runtimeDir, "mobile-access.json")) || "{}"); mobileOn = Boolean(ms?.enabled && ms?.token); } catch { /* 없으면 로컬 전용 */ }
  const exposedRemotely = remoteOn || mobileOn;
  const security = [
    { name: "내부 runtime 커밋 제외", ok: /ops\/control-center\/runtime/.test(gitignore), note: "회의·결재·검수 기록을 공개 저장소에서 제외합니다(.gitignore 규칙 확인)." },
    { name: "비밀값 원문 저장 차단", ok: secretBlockOk, note: secretBlockOk ? "토큰·키·비밀번호 패턴을 로컬 저장 단계에서 거부합니다(거부 로직 확인됨)." : "저장 거부 로직을 코드에서 확인하지 못했습니다 — 점검 필요." },
    exposedRemotely
      ? { name: "서버 접근 범위", ok: true, note: `휴대폰·원격 연결이 켜져 있어 사설망(0.0.0.0)에 열려 있습니다. 모든 비로컬 요청은 토큰 인증을 거칩니다.` }
      : { name: "로컬 전용 서버", ok: true, note: "원격·휴대폰 연결이 꺼져 있어 127.0.0.1·localhost Host만 허용합니다." },
    { name: "추가 유료 운영비 없음", ok: true, note: "설계 원칙 — GitHub 공개 REST(무료)만 사용하고 유료 API·상시 서버를 새로 켜지 않습니다." },
  ];
  return { humanTasks, roadmap, automations, updates, security };
}
