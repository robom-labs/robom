// 로봄 본부(ROBOM Control Center) 데이터 수집 공용 라이브러리.
// 외부 유료 API·상시 서버 없이, 저장소 파일 + git + GitHub 무료 REST만 읽는다(읽기 전용).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const repoRootFromModuleUrl = (moduleUrl) => resolve(dirname(fileURLToPath(moduleUrl)), "../../..");
// 기본은 이 스크립트가 들어 있는 저장소. 단, 데스크톱 앱은 읽기 전용 payload에서 실행되므로
// 실제 git 클론을 ROBOM_HQ_REPO_ROOT로 지정하면 그 클론을 정본으로 사용한다(러너가 실제 작업 가능).
export const REPO_ROOT = (() => {
  const override = process.env.ROBOM_HQ_REPO_ROOT;
  if (override && existsSync(join(override, ".git"))) return resolve(override);
  return repoRootFromModuleUrl(import.meta.url);
})();

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
    // 새 최상위 키(들여쓰기 없는 `key:`)를 만나면 리스트를 벗어난다 — 뒤따르는 다른 섹션의 키가
    // 마지막 항목에 잘못 붙거나 유령 항목이 되는 것을 막는다(여러 섹션 파일 대응).
    if (inList && /^[A-Za-z0-9_][^:]*:\s*(.*)$/.test(line) && !topRe.test(line)) { if (cur) { items.push(cur); cur = null; } inList = false; continue; }
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
  const registryPath = join(root, "ops/registry/apps.yml");
  const registry = parseAppsYaml(readText(registryPath));
  // 정본 레지스트리 파일은 있는데 앱이 0개면(권한·손상·BOM 등) '앱 없음=정상'으로 위장하지 않도록 이상을 로그로 남긴다.
  if (registry.length === 0 && existsSync(registryPath)) {
    console.warn("[robom-hq] 경고: apps.yml이 존재하나 앱 0개로 파싱됨 — 레지스트리 손상 가능성. 화면의 앱 목록·신호등을 신뢰하지 마세요.");
  }
  const registeredIds = new Set(registry.map((a) => a.id));
  const extra = parseAppsYaml(readText(join(root, "ops/control-center/apps-extra.yml")));
  const all = [
    ...registry.map((a) => ({ ...a, registered: true })),
    ...extra.filter((a) => !registeredIds.has(a.id)).map((a) => ({ ...a, registered: false })),
  ];
  return all;
}

export function controlCenterFields(app) {
  return {
    url: app.web_url || app.url || app.current_url || null,
    deployTarget: app.deploy_provider || app.deploy || null,
  };
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
  // '없음'이 부분 문자열로 들어간 실제 막힘("결제 응답 없음", "권한 없음")을 '막힘 없음'으로 오인하지 않는다.
  // 섹션 전체가 none-표식이거나 비어있을 때만 null(막힘 없음)로 본다.
  const strippedBlocked = blockedSec.replace(/[-*\s]/g, "");
  const blocked = (strippedBlocked === "" || /^(없음|없습니다|해당없음|none|n\/?a)$/i.test(strippedBlocked)) ? null : blockedSec.trim();
  return { tracked: true, version, deploy, next, doneCount: done.length, blocked };
}

// ── 로컬 git 정보(클론이 있으면) ──
export function gitInfo(dir) {
  if (!dir || !existsSync(join(dir, ".git"))) return { available: false };
  const run = (args) => { try { return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
  const sha = run(["rev-parse", "--short", "HEAD"]);
  // git 자체가 실패(바이너리 부재·손상)하면 available:true로 '깨끗한 idle(작업 브랜치 0)'로 위장하지 않는다.
  if (sha === null) return { available: false, gitError: true };
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
  const lastMsg = run(["log", "-1", "--pretty=%s"]);
  const lastDate = run(["log", "-1", "--pretty=%cI"]);
  const branchesRaw = run(["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)|%(committerdate:iso-strict)", "refs/heads"]) || "";
  const branches = branchesRaw.split("\n").filter(Boolean).map((l) => { const [name, date] = l.split("|"); return { name, date }; });
  const workBranches = branches.filter((b) => /^(r0[0-9]|agent|claude|codex)\//.test(b.name));
  return { available: true, sha, branch, lastMsg, lastDate, branches, workBranches };
}

// ── GitHub 무료 REST (기존 gh 로그인 우선, 토큰이 있으면 직접 인증) ──
export async function ghFetch(path, token) {
  if (!token) {
    try {
      const output = execFileSync("gh", ["api", path, "--method", "GET"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 20_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      return JSON.parse(output);
    } catch {
      // gh가 없거나 로그인되지 않은 컴퓨터에서는 아래 공개 REST로 폴백한다.
    }
  }
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
