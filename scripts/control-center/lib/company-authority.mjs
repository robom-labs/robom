// 로봄 24/7 회사 권한·가동 상태 — v2.0.0 프롬프트 PART I 반영.
// 회사 모드(RUNNING/MONITOR_ONLY/PAUSED)와 결재 모드(회장 직접 / 수석부회장 전결)를 정본으로 관리한다.
// 원칙: 전결 모드에서도 비위임 안건(결제·계약·홍보·개인정보·비밀값·삭제·스토어 등)은 절대 자동승인하지 않는다.
// v1.8 분 단위 점검 설정은 1회 마이그레이션(>0→RUNNING, 0→PAUSED)하고 backup에 보존한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_COMPANY_RUNTIME_DIR } from "./company-store.mjs";

// v2.3.0: 회사 가동 상태 6종(PART 01 0.2). RUNNING·MONITOR_ONLY·DRAINING·PAUSED·SAFE_MODE·EMERGENCY_STOP.
export const COMPANY_MODES = Object.freeze(["RUNNING", "MONITOR_ONLY", "DRAINING", "PAUSED", "SAFE_MODE", "EMERGENCY_STOP"]);
export const COMPANY_MODE_LABELS = Object.freeze({
  RUNNING: "가동 중", MONITOR_ONLY: "관제만", DRAINING: "안전 마무리", PAUSED: "일시정지", SAFE_MODE: "안전 복구", EMERGENCY_STOP: "긴급 정지",
});
export const APPROVAL_MODES = Object.freeze(["CHAIRMAN_DIRECT", "VICE_CHAIR_DELEGATED"]);
const FILE = (dir) => join(resolve(dir), "company-authority.json");
const AUDIT = (dir) => join(resolve(dir), "company-audit.jsonl");

// 비위임(회장 전용) 안건 분류 — 제목·본문에 아래 신호가 있으면 전결 금지.
// 사용량·요금제·한도·보안(quota/security 계열)도 포함해 자동 전결로 승인 경계가 뚫리지 않게 한다.
// incident-fix.mjs의 HUMAN_TEXT와 반드시 동일한 신호를 유지한다(전결 2차 방어). 결제·계정·권한·비밀값·개인정보 등
// 헌장상 항상 회장 확인이 필요한 범주를 텍스트로 백스톱한다. 계정·구매·환불·자격증명 누락은 전결 자동승인 escape였다.
const NON_DELEGABLE = /결제|구독료|유료|요금|청구|사용량|한도|quota|billing|광고|홍보 게시|외부 게시|캠페인|개인정보|법률|약관|계약|스토어 제출|App Store|Play Store|출시|도메인|소유권|계정|권한|보안|security|비밀값|secret|시크릿|토큰|자격증명|credentials|OAuth|인증서|키 교체|키 재발급|키 회전|API 키|구매|환불|삭제(?!된)|마이그레이션|이전(?:합니다| 작업)/;
export function isDelegable(approval) {
  if (!approval) return false;
  if (approval.requestedBy !== "auto-review") return false; // 시스템 상신만 전결 대상(사람 상신은 회장 확인)
  if (approval.fixClass === "human") return false; // 분류기가 '회장 확인 필수'로 판정한 것은 텍스트와 무관하게 전결 금지
  const text = `${approval.title || ""} ${approval.body || ""} ${approval.recommendation || ""}`;
  return !NON_DELEGABLE.test(text);
}

function audit(dir, entry) {
  try {
    mkdirSync(resolve(dir), { recursive: true, mode: 0o700 });
    appendFileSync(AUDIT(dir), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", { encoding: "utf8", mode: 0o600 });
  } catch { /* 감사 기록 실패가 운영을 막지 않는다 */ }
}

// v1.8 review-schedule.json → 회사 모드 1회 마이그레이션
function migrateIfNeeded(dir) {
  const legacy = join(resolve(dir), "review-schedule.json");
  let mode = "RUNNING";
  let migratedFrom = null;
  if (existsSync(legacy)) {
    try {
      const v = JSON.parse(readFileSync(legacy, "utf8"));
      migratedFrom = v.everyMinutes;
      if (Number(v.everyMinutes) === 0) mode = "PAUSED"; // 사용자가 꺼둔 상태를 몰래 켜지 않는다
      copyFileSync(legacy, `${legacy}.migrated-backup`);
    } catch { /* 손상 시 기본 RUNNING */ }
  }
  return { schemaVersion: 1, mode, approvalMode: "CHAIRMAN_DIRECT", delegatedAt: null, updatedAt: new Date().toISOString(), migratedFrom };
}

const isValidAuthority = (v) => v && COMPANY_MODES.includes(v.mode) && APPROVAL_MODES.includes(v.approvalMode);

export function readAuthority(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  const file = FILE(runtimeDir);
  const primaryExisted = existsSync(file);
  try {
    const v = JSON.parse(readFileSync(file, "utf8"));
    if (isValidAuthority(v)) return v;
  } catch { /* 손상 → 아래 복구 단계 */ }
  // 1순위 복구: 마지막 정상 저장본(.bak)에서 되살린다 — 정지(PAUSED/EMERGENCY_STOP) 상태를 잃지 않는다.
  try {
    const b = JSON.parse(readFileSync(`${file}.bak`, "utf8"));
    if (isValidAuthority(b)) {
      try { mkdirSync(resolve(runtimeDir), { recursive: true, mode: 0o700 }); writeFileSync(file, JSON.stringify(b, null, 2), { encoding: "utf8", mode: 0o600 }); } catch { /* 쓰기 실패 무시 */ }
      audit(runtimeDir, { action: "authority_restored_from_bak", mode: b.mode });
      return b;
    }
  } catch { /* bak 없음/손상 */ }
  // 파일이 존재했는데(=손상) 복구도 실패하면, RUNNING으로 몰래 되돌리지 않고 안전하게 PAUSED로 멈춘다(fail-safe).
  if (primaryExisted) {
    const safe = { schemaVersion: 1, mode: "PAUSED", approvalMode: "CHAIRMAN_DIRECT", delegatedAt: null, updatedAt: new Date().toISOString(), recoveredFrom: "corrupt-authority" };
    try { mkdirSync(resolve(runtimeDir), { recursive: true, mode: 0o700 }); writeFileSync(file, JSON.stringify(safe, null, 2), { encoding: "utf8", mode: 0o600 }); audit(runtimeDir, { action: "authority_safe_paused", reason: "corrupt-unrecoverable" }); } catch { /* 메모리 값으로 동작 */ }
    return safe;
  }
  // 진짜 첫 실행(파일·백업 모두 없음): 레거시 마이그레이션 또는 기본 RUNNING.
  const fresh = migrateIfNeeded(runtimeDir);
  try {
    mkdirSync(resolve(runtimeDir), { recursive: true, mode: 0o700 });
    writeFileSync(file, JSON.stringify(fresh, null, 2), { encoding: "utf8", mode: 0o600 });
    audit(runtimeDir, { action: "authority_initialized", mode: fresh.mode, migratedFrom: fresh.migratedFrom });
  } catch { /* 쓰기 실패 시 메모리 값으로 동작 */ }
  return fresh;
}

export function writeAuthority(changes, runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  const cur = readAuthority(runtimeDir);
  const next = { ...cur, ...changes, updatedAt: new Date().toISOString() };
  if (!COMPANY_MODES.includes(next.mode)) throw new Error(`잘못된 회사 모드: ${next.mode}`);
  if (!APPROVAL_MODES.includes(next.approvalMode)) throw new Error(`잘못된 결재 모드: ${next.approvalMode}`);
  if (changes.approvalMode === "VICE_CHAIR_DELEGATED" && cur.approvalMode !== "VICE_CHAIR_DELEGATED") next.delegatedAt = next.updatedAt;
  if (changes.approvalMode === "CHAIRMAN_DIRECT") next.delegatedAt = null;
  mkdirSync(resolve(runtimeDir), { recursive: true, mode: 0o700 });
  // 원자적 쓰기: tmp에 완전히 쓴 뒤 rename으로 교체한다. 쓰는 도중 크래시가 나도 원본이 잘려
  // PAUSED/EMERGENCY_STOP가 몰래 RUNNING으로 되돌아가는(fail-open) 사고를 막는다.
  const tmp = `${FILE(runtimeDir)}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, FILE(runtimeDir));
  // 마지막 정상 저장본을 .bak로 남긴다 — 원본이 유실·손상돼도 readAuthority가 여기서 정지 상태를 되살린다.
  try { writeFileSync(`${FILE(runtimeDir)}.bak`, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 }); } catch { /* bak 실패는 운영을 막지 않는다 */ }
  audit(runtimeDir, { action: "authority_changed", ...changes });
  return next;
}

// 현재 교대조(서울 기준): 06-14 주간 / 14-22 저녁 / 22-06 심야
export function currentShift(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now));
  if (h >= 6 && h < 14) return { id: "DAY", label: "주간 관제" };
  if (h >= 14 && h < 22) return { id: "EVENING", label: "저녁 관제" };
  return { id: "NIGHT", label: "심야 관제" };
}
