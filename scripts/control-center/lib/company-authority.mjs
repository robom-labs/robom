// 로봄 24/7 회사 권한·가동 상태 — v2.0.0 프롬프트 PART I 반영.
// 회사 모드(RUNNING/MONITOR_ONLY/PAUSED)와 결재 모드(회장 직접 / 수석부회장 전결)를 정본으로 관리한다.
// 원칙: 전결 모드에서도 비위임 안건(결제·계약·홍보·개인정보·비밀값·삭제·스토어 등)은 절대 자동승인하지 않는다.
// v1.8 분 단위 점검 설정은 1회 마이그레이션(>0→RUNNING, 0→PAUSED)하고 backup에 보존한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync } from "node:fs";
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

// 비위임(회장 전용) 안건 분류 — 제목·본문에 아래 신호가 있으면 전결 금지
const NON_DELEGABLE = /결제|구독료|유료|광고|홍보 게시|외부 게시|캠페인|개인정보 수집|법률|약관|계약|스토어 제출|App Store|Play Store|출시|도메인|청구|소유권|비밀값|secret|시크릿|삭제(?!된)|마이그레이션|이전(?:합니다| 작업)/;
export function isDelegable(approval) {
  if (!approval) return false;
  if (approval.requestedBy !== "auto-review") return false; // 시스템 상신만 전결 대상(사람 상신은 회장 확인)
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

export function readAuthority(runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR) {
  try {
    const v = JSON.parse(readFileSync(FILE(runtimeDir), "utf8"));
    if (COMPANY_MODES.includes(v.mode) && APPROVAL_MODES.includes(v.approvalMode)) return v;
  } catch { /* 없거나 손상 → 마이그레이션/기본 */ }
  const fresh = migrateIfNeeded(runtimeDir);
  try {
    mkdirSync(resolve(runtimeDir), { recursive: true, mode: 0o700 });
    writeFileSync(FILE(runtimeDir), JSON.stringify(fresh, null, 2), { encoding: "utf8", mode: 0o600 });
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
  const tmp = `${FILE(runtimeDir)}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  writeFileSync(FILE(runtimeDir), JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
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
