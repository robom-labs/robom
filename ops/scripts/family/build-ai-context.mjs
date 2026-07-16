// 변경 파일과 앱 진입점만 모아 크기가 제한된 AI 작업 컨텍스트를 만든다.
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const app = arg("app");
const base = arg("base", "HEAD~1");
const head = arg("head", "HEAD");
const output = arg("out");
if (!app) throw new Error("--app이 필요합니다.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const familyContext = await readFile(resolve(root, "ops/family/ai/FAMILY-CONTEXT.md"), "utf8");
const repoMap = await readFile(resolve(root, "ops/family/ai/REPO-MAP.yml"), "utf8");
const appBlock = repoMap.match(new RegExp(`^${app}:\\n([\\s\\S]*?)(?=^[a-z][a-z0-9-]*:|$)`, "m"))?.[0] ?? `${app}: 지도 없음`;
let changed = [];
try {
  changed = execFileSync("git", ["diff", "--name-only", base, head], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
} catch {
  changed = ["diff를 계산하지 못했습니다."];
}
const context = [
  `# ${app} 증분 컨텍스트`,
  "",
  `기준: ${base} → ${head}`,
  "",
  "## 변경 파일",
  ...changed.map((file) => `- ${file}`),
  "",
  "## 앱 지도",
  "```yml",
  appBlock.trim(),
  "```",
  "",
  "## 패밀리 핵심 규칙",
  familyContext,
].join("\n").slice(0, 16_384);
if (output) await writeFile(resolve(process.cwd(), output), `${context}\n`);
else process.stdout.write(`${context}\n`);
