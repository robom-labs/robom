// 비공개 집계 JSON을 금지 필드 검사 후 주간·월간 실행 가능한 성장 보고서로 변환한다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

const inputPath = arg("input");
const outputPath = arg("output");
const checkOnly = process.argv.includes("--check");
if (!inputPath || !outputPath) throw new Error("--input과 --output이 필요합니다.");
const input = JSON.parse(await readFile(resolve(process.cwd(), inputPath), "utf8"));
const forbidden = /latitude|longitude|address|email|phone|token|endpoint|medication|medicine|hospital|calendar_title|family_event_title|raw_query|raw_answer|api_key/i;

function scan(value, path = "root") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key)) throw new Error(`금지 필드 발견: ${path}.${key}`);
    scan(child, `${path}.${key}`);
  }
}
scan(input);
if (!input.period?.start || !input.period?.end || !input.apps || !input.portfolio) throw new Error("집계 보고서 필수 필드가 없습니다.");

const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const appNames = { outbom: "야외봄", homebom: "청약봄", runningbom: "러닝봄", calendarbom: "캘린더봄", certbom: "자격증봄" };
const rows = Object.entries(input.apps).map(([id, app]) => ({ id, ...app })).sort((a, b) => b.activeUsers - a.activeUsers);
const biggestDrop = rows.slice().sort((a, b) => a.activationRate - b.activationRate)[0];
const weakestRetention = rows.slice().sort((a, b) => a.d7Retention - b.d7Retention)[0];
const installRate = input.portfolio.installLandingViews ? input.portfolio.installActions / input.portfolio.installLandingViews : 0;
const sampleWarning = input.portfolio.activeUsers < 30 ? "> 표본 30명 미만이므로 방향성만 봅니다.\n\n" : "";
const lines = [
  `# 로봄 ${input.period.kind === "monthly" ? "월간" : "주간"} 성장 보고서`,
  "",
  `기간: ${input.period.start} ~ ${input.period.end}`,
  input.synthetic ? "데이터: 검증용 합성 집계이며 실제 사용자 데이터가 아닙니다." : "데이터: 비공개 집계 endpoint 결과입니다.",
  "",
  sampleWarning.trimEnd(),
  "## 포트폴리오 요약",
  "",
  `- 활성 사용자 ${input.portfolio.activeUsers}명, activation ${percent(input.portfolio.activationRate)}, D7 재방문 ${percent(input.portfolio.d7Retention)}.` ,
  `- 설치 랜딩 ${input.portfolio.installLandingViews}회 중 설치 행동 ${input.portfolio.installActions}회로 측정 전환은 ${percent(installRate)}.` ,
  `- 오류 ${input.portfolio.errors}건, stale 복구 ${input.portfolio.staleRecoveries}건, 패밀리 이동 ${input.portfolio.crossAppClicks}건.` ,
  "",
  "## 앱별 핵심 지표",
  "",
  "| 앱 | 활성 사용자 | activation | D7 | 많이 쓴 기능 3개 |",
  "|---|---:|---:|---:|---|",
  ...rows.map((app) => `| ${appNames[app.id] ?? app.id} | ${app.activeUsers} | ${percent(app.activationRate)} | ${percent(app.d7Retention)} | ${app.features.slice(0, 3).map((feature) => `${feature.name} ${feature.count}`).join(", ")} |`),
  "",
  "## 다음 우선 실험",
  "",
  `1. ${appNames[biggestDrop.id]} activation이 ${percent(biggestDrop.activationRate)}로 가장 낮습니다. 첫 핵심 행동 직전의 CTA 문구와 위치를 한 가지 variant로 검증합니다.`,
  `2. ${appNames[weakestRetention.id]} D7 재방문이 ${percent(weakestRetention.d7Retention)}로 가장 낮습니다. 사용자가 저장·알림을 완료한 뒤 다음 방문 이유를 한 문장으로 안내합니다.`,
  `3. 설치 랜딩→행동 전환 ${percent(installRate)}를 플랫폼별로 분리해 QR·PWA·스토어 중 실제 이탈 지점을 확인합니다.`,
  "",
  "접근성·알림 신뢰도·개인정보 수집 범위는 실험하지 않습니다.",
];
const report = `${lines.join("\n")}\n`;
const output = resolve(process.cwd(), outputPath);
if (checkOnly) {
  const current = await readFile(output, "utf8");
  if (current !== report) throw new Error(`성장 보고서 drift: ${outputPath}`);
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, report);
}
console.log(`${input.period.kind} growth report ${checkOnly ? "verified" : "generated"}: ${outputPath}`);
