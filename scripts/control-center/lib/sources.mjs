// 로봄 본부(ROBOM Control Center) 데이터 수집 공용 라이브러리.
// 외부 유료 API·상시 서버 없이, 저장소 파일 + git + GitHub 무료 REST만 읽는다(읽기 전용).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export const REPO_ROOT = join(new URL("../../..", import.meta.url).pathname);

export function readText(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

// ── 최소 YAML 파서 (알려진 구조 전용: 최상위 `<topKey>:` 아래 `- key: value` 리스트) ──
export function parseYamlList(text, topKey = "apps") {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const items = [];
  let cur = null;
  let inList = false;
  const topRe = new RegExp(`^${topKey}:\\s*$`);
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, ""); // 인라인 주석 제거(단순화)
    if (topRe.test(line)) { inList = true; continue; }
    if (!inList) continue;
    const item = line.match(/^\s*-\s*([A-Za-z0-9_]+):\s*(.*)$/);
    if (item) {
      if (cur) items.push(cur);
      cur = {};
      cur[item[1]] = unquote(item[2]);
      continue;
    }
    const kv = line.match(/^\s{2,}([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = unquote(kv[2]);
  }
  if (cur) items.push(cur);
  return items;
}
export const parseAppsYaml = (text) => parseYamlList(text, "apps");

export function readDepartments(root = REPO_ROOT) {
  return parseYamlList(readText(join(root, "ops/control-center/departments.yml")), "departments");
}
export function readAgents(root = REPO_ROOT) {
  return parseYamlList(readText(join(root, "ops/control-center/agents.yml")), "agents");
}
function unquote(v) {
  const t = String(v ?? "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

// ── 공식 앱 레지스트리 + 본부 보조 등록부 병합 ──
export function readApps(root = REPO_ROOT) {
  const registry = parseAppsYaml(readText(join(root, "ops/registry/apps.yml")));
  const registeredIds = new Set(registry.map((a) => a.id));
  const extra = parseAppsYaml(readText(join(root, "ops/control-center/apps-extra.yml")));
  const all = [
    ...registry.map((a) => ({ ...a, registered: true })),
    ...extra.filter((a) => !registeredIds.has(a.id)).map((a) => ({ ...a, registered: false })),
  ];
  return all;
}

// ── ops/state/<id>.md 파서 (인수인계 장부) ──
export function readState(root, id) {
  const text = readText(join(root, `ops/state/${id}.md`));
  if (!text) return { tracked: false };
  const version = (text.match(/버전:\s*([0-9][\w.\-]*)/) || text.match(/버전\s*([0-9][\w.\-]*)/) || [])[1] || null;
  const deploy = (text.match(/현재 배포:\s*(\S+)/) || [])[1] || null;
  const next = [...text.matchAll(/^-\s*\[ \]\s*(.+)$/gm)].map((m) => m[1].trim()).slice(0, 6);
  const done = [...text.matchAll(/^-\s*\[x\]\s*(.+)$/gim)].map((m) => m[1].trim());
  const blockedSec = (text.match(/##\s*Blocked([\s\S]*?)(?:\n##|\n*$)/) || [])[1] || "";
  const blocked = /없음|^\s*$/.test(blockedSec.replace(/[-*\s]/g, "")) ? null : blockedSec.trim();
  return { tracked: true, version, deploy, next, doneCount: done.length, blocked };
}

// ── 로컬 git 정보(클론이 있으면) ──
export function gitInfo(dir) {
  if (!dir || !existsSync(join(dir, ".git"))) return { available: false };
  const run = (args) => { try { return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
  const sha = run(["rev-parse", "--short", "HEAD"]);
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
  const lastMsg = run(["log", "-1", "--pretty=%s"]);
  const lastDate = run(["log", "-1", "--pretty=%cI"]);
  const branchesRaw = run(["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)|%(committerdate:iso-strict)", "refs/heads"]) || "";
  const branches = branchesRaw.split("\n").filter(Boolean).map((l) => { const [name, date] = l.split("|"); return { name, date }; });
  const workBranches = branches.filter((b) => /^(r0[0-9]|agent|claude|codex)\//.test(b.name));
  return { available: true, sha, branch, lastMsg, lastDate, branches, workBranches };
}

// ── GitHub 무료 REST (토큰 있으면 rate limit 완화, 없으면 미연결 처리) ──
export async function ghFetch(path, token) {
  const base = { "Accept": "application/vnd.github+json", "User-Agent": "robom-hq" };
  const doFetch = (headers) => fetch(`https://api.github.com${path}`, { headers });
  let res = await doFetch(token ? { ...base, Authorization: `Bearer ${token}` } : base);
  // 토큰이 무효(401/403)여도 공개 저장소는 무인증으로 읽을 수 있으므로 폴백한다.
  if ((res.status === 401 || res.status === 403) && token) res = await doFetch(base);
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}`);
  return res.json();
}

export async function ghOpenPRs(repo, token) {
  const prs = await ghFetch(`/repos/${repo}/pulls?state=open&per_page=20`, token);
  return prs.map((p) => ({ number: p.number, title: p.title, draft: p.draft, branch: p.head?.ref, updatedAt: p.updated_at, url: p.html_url }));
}

export async function ghRecentRuns(repo, token) {
  const data = await ghFetch(`/repos/${repo}/actions/runs?per_page=8`, token);
  return (data.workflow_runs || []).map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion, sha: (r.head_sha || "").slice(0, 7), event: r.event, createdAt: r.created_at, url: r.html_url }));
}

export function listStateIds(root = REPO_ROOT) {
  try {
    return readdirSync(join(root, "ops/state")).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => f.replace(/\.md$/, ""));
  } catch { return []; }
}
