// 데스크톱 앱 payload 준비 — 본부 실행에 필요한 저장소 부분집합을 desktop/payload/에 복사한다.
// payload는 저장소 구조를 그대로 미러링해 REPO_ROOT(../../..) 해석이 payload 루트가 되게 한다.
// 내부 데이터(runtime·latest.json·events)는 절대 포함하지 않는다.
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const payload = resolve(here, "../payload");

rmSync(payload, { recursive: true, force: true });
mkdirSync(payload, { recursive: true });

const copies = [
  // 서버·수집기·러너·라이브러리 (테스트 포함: 용량 작고 현장 진단에 유용)
  ["scripts/control-center", "scripts/control-center"],
  // 화면(경영 OS + 오피스 + 스프라이트)
  ["ops/control-center/app", "ops/control-center/app"],
  ["ops/control-center/schemas", "ops/control-center/schemas"],
  // 스냅샷 수집기가 쓰는 본사 공용 라이브러리
  ["ops/scripts/lib", "ops/scripts/lib"],
  ["ops/scripts/family", "ops/scripts/family"],
  // 조직·앱 정본
  ["ops/control-center/departments.yml", "ops/control-center/departments.yml"],
  ["ops/control-center/agents.yml", "ops/control-center/agents.yml"],
  ["ops/control-center/apps-extra.yml", "ops/control-center/apps-extra.yml"],
  ["ops/registry/apps.yml", "ops/registry/apps.yml"],
  ["ops/organization", "ops/organization"],
  // health contract 정본(진단률 100% 카탈로그 산출물 — 엔진은 카탈로그 모듈로 재생성하지만 감사를 위해 동봉)
  ["ops/health-contracts", "ops/health-contracts"],
  // 운영 장부(회장 할 일·로드맵·상태)
  ["ops/state", "ops/state"],
  ["ops/HUMAN-TASKS.md", "ops/HUMAN-TASKS.md"],
  ["ops/ROADMAP.md", "ops/ROADMAP.md"],
  // 예시 스냅샷(정직: runs 0) — 첫 실행 화면용
  ["ops/control-center/snapshots/example.json", "ops/control-center/snapshots/example.json"],
  // 본사 웹 버전 표시용(코드 아님, 버전 메타만)
  ["site/package.json", "site/package.json"],
];

let copied = 0;
for (const [from, to] of copies) {
  const src = join(repoRoot, from);
  if (!existsSync(src)) { console.warn(`[payload] 건너뜀(없음): ${from}`); continue; }
  const dest = join(payload, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  copied += 1;
}

// 내부 데이터가 우연히 들어오지 않게 방어적으로 제거
for (const internal of ["ops/control-center/snapshots/latest.json", "ops/control-center/runtime", "ops/control-center/events"]) {
  rmSync(join(payload, internal), { recursive: true, force: true });
}

// 트레이 아이콘(있으면)
const trayIcon = join(here, "../build/icon.png");
if (existsSync(trayIcon)) copyFileSync(trayIcon, join(payload, "tray.png"));

// 화면에 표시할 버전을 데스크톱 앱 버전(=다운로드한 버전)으로 확정 주입 → 회장이 어떤 버전인지 항상 확인 가능
try {
  const pkg = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));
  const verFile = join(payload, "ops/control-center/app/version.json");
  writeFileSync(verFile, JSON.stringify({ version: pkg.version }) + "\n");
  console.log(`[payload] 화면 표시 버전 = v${pkg.version}`);
} catch (e) { console.warn("[payload] version.json 주입 실패:", e.message); }

console.log(`[payload] ${copied}개 항목 복사 완료 → ${payload}`);
