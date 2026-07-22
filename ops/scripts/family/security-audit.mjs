// 로봄 패밀리 6개 저장소의 production 의존성 취약점(high 이상)을 정기 감사한다.
// 저장소가 조용해도(커밋 없음) 새 CVE가 감지되도록 watchdog과 별도의 주간 cron으로 실행된다.
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPOS = ["outbom", "homebom", "runningbom", "certbom"];
const results = [];

function auditDir(label, dir) {
  const isPnpm = existsSync(join(dir, "pnpm-lock.yaml"));
  const hasNpmLock = existsSync(join(dir, "package-lock.json"));
  if (!isPnpm && !hasNpmLock) return null;
  const command = isPnpm ? "pnpm audit --prod --json" : "npm audit --omit=dev --json";
  let raw = "";
  try {
    raw = execSync(command, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    // audit는 취약점이 있으면 비정상 종료하므로 stdout을 그대로 사용한다.
    raw = error.stdout?.toString() ?? "";
    if (!raw) return { label, error: String(error.message).slice(0, 200) };
  }
  try {
    const parsed = JSON.parse(raw);
    // pnpm(=npm v6 형식) advisories 또는 npm v7+ metadata.vulnerabilities 모두 지원한다.
    // 둘 다 없으면 "취약점 0개"가 아니라 audit 도구가 예상 못 한 새 출력 포맷을 뱉었다는 뜻이다
    // (두 형식 모두 실제로 0개일 때도 해당 키 자체는 항상 존재한다) — 조용히 0으로 집계하면
    // 스키마 드리프트로 실재 취약점이 있어도 PASS로 새는 위양성이 된다.
    if (!parsed.metadata?.vulnerabilities && !parsed.advisories) {
      return { label, error: "audit 출력 포맷을 인식하지 못함(스키마 변경 가능성) — 취약점 0으로 간주하지 않음" };
    }
    let high = 0;
    let critical = 0;
    if (parsed.metadata?.vulnerabilities) {
      high = parsed.metadata.vulnerabilities.high ?? 0;
      critical = parsed.metadata.vulnerabilities.critical ?? 0;
    } else {
      for (const advisory of Object.values(parsed.advisories)) {
        if (advisory.severity === "high") high += 1;
        if (advisory.severity === "critical") critical += 1;
      }
    }
    return { label, high, critical };
  } catch {
    return { label, error: "audit JSON 파싱 실패" };
  }
}

const workRoot = mkdtempSync(join(tmpdir(), "robom-security-audit-"));
const selfRoot = resolve(import.meta.dirname, "../../..");

results.push(auditDir("robom/site", resolve(selfRoot, "site")));
for (const repo of REPOS) {
  const dir = join(workRoot, repo);
  try {
    execFileSync("git", ["clone", "--depth", "1", `https://github.com/robom-labs/${repo}.git`, dir], { stdio: "ignore" });
  } catch (error) {
    results.push({ label: repo, error: `clone 실패: ${String(error.message).slice(0, 120)}` });
    continue;
  }
  // 하드코딩 3경로(.·apps/mobile·apps/web) 중 lockfile을 찾은 곳이 하나도 없으면 auditDir가 매번 null을
  // 반환해 이 저장소는 results에 흔적조차 안 남았다 — failures 집계가 실패로 못 잡아 조용히 PASS로
  // 새는 구조였다(보안 감사가 스스로 "감사 못 함"을 놓치는 유형). 저장소당 최소 1회 실제 감사를 강제한다.
  let auditedAny = false;
  for (const [label, sub] of [[repo, "."], [`${repo}/apps/mobile`, "apps/mobile"], [`${repo}/apps/web`, "apps/web"]]) {
    const target = join(dir, sub);
    if (!existsSync(target)) continue;
    const entry = auditDir(label, target);
    if (entry) { results.push(entry); auditedAny = true; }
  }
  if (!auditedAny) results.push({ label: repo, error: "lockfile을 찾지 못해 감사하지 못함(.·apps/mobile·apps/web 전부 확인)" });
}

const flat = results.filter(Boolean);
const failures = flat.filter((entry) => entry.error || (entry.high ?? 0) > 0 || (entry.critical ?? 0) > 0);
const report = { checkedAt: new Date().toISOString(), status: failures.length ? "FAIL" : "PASS", results: flat };
console.log(JSON.stringify(report, null, 2));
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
  writeFileSync(process.argv[outputIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}
if (report.status === "FAIL") process.exitCode = 1;
