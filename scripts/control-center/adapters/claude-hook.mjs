// Claude Code 훅 어댑터 — 세션이 실제로 일할 때 로봄 본부에 작업 이벤트를 남긴다.
// .claude/settings.json 의 hooks(command)에서 호출한다(아래 ADAPTERS.md 참고).
// stdin으로 Claude Code 훅 JSON을 받고, argv[2]로 훅 종류를 받아 emit-event 형식으로 append.
// 민감정보 저장 금지 — 요약/증거만. 실제 이벤트가 있을 때만 본부에서 '일하는 중'으로 보인다(연출 금지).
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
const ROOT = join(new URL("../../..", import.meta.url).pathname);
const KIND = process.argv[2] || "heartbeat";
const AGENT = process.env.ROBOM_HQ_AGENT || "builder";           // 회의실별로 지정: room-01/02/03 등
const RUN = process.env.ROBOM_HQ_RUN || process.env.CLAUDE_SESSION_ID || "claude-session";

let stdin = "";
try { stdin = await new Promise((res) => { let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>res(s)).on("error",()=>res("")); setTimeout(()=>res(s),300); }); } catch {}
let hook = {}; try { hook = JSON.parse(stdin || "{}"); } catch {}

// cwd/repo → appId 추정
const APPS = ["outbom","homebom","runningbom","certbom","robom"];
const ALIAS = { outbom:"out", homebom:"home", runningbom:"run", certbom:"cert", robom:"robom" };
const cwd = (hook.cwd || process.cwd() || "");
const appHit = APPS.find(a => cwd.includes(a));
const appId = appHit ? (ALIAS[appHit] || appHit) : null;

const tool = hook.tool_name || hook.tool || "";
const isTest = /Bash/i.test(tool) && /\b(test|vitest|jest|pnpm test|npm test|node --test|typecheck|build)\b/i.test(JSON.stringify(hook.tool_input||hook.input||""));

// 훅 종류 → (type, status)
let type = "heartbeat", status = null, msg = "";
if (KIND === "session-start") { type="task_assigned"; status="assigned"; msg="세션 시작"; }
else if (KIND === "pretool") {
  if (/Edit|Write|MultiEdit/i.test(tool)) { type="implementation_started"; status="implementing"; msg="코드 수정"; }
  else if (isTest) { type="test_started"; status="verifying"; msg="테스트 실행"; }
  else { type="heartbeat"; status=null; }
}
else if (KIND === "posttool") {
  if (isTest) { type="test_completed"; status="verifying"; msg="테스트 완료"; }
  else { type="heartbeat"; }
}
else if (KIND === "stop") { type="run_completed"; status="completed"; msg="세션 종료"; }
else if (KIND === "notification") { type="run_blocked"; status="blocked"; msg="입력 대기/차단"; }

const now = new Date().toISOString();
const event = {
  eventId: `evt_${now.replace(/[^0-9]/g,"").slice(0,17)}_${Math.floor(performance.now())}`,
  runId: RUN, agentId: AGENT, appId, repo: appHit ? `robom-labs/${appHit}` : null,
  type, status, message: msg || null, evidence: { source: "claude-code" }, createdAt: now,
};
if (type === "heartbeat" && !status) event.status = "working";

const dir = join(ROOT, "ops/control-center/events");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(now));
appendFileSync(join(dir, `${day}.jsonl`), JSON.stringify(event) + "\n");
