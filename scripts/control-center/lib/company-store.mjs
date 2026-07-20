// 로봄 Company OS의 회의·결재·요청·작업 기록을 로컬 JSONL로 안전하게 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { appendFile, chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { REPO_ROOT } from "./sources.mjs";

export const COMPANY_COLLECTIONS = Object.freeze([
  "meetings",
  "decisions",
  "approvals",
  "requests",
  "reviews",
  "tasks",
  "notes",
  "incidents",
  "feedback",
]);

// 데스크톱 앱(.app) 배포 시 read-only 번들과 데이터를 분리하기 위해 env로 재지정할 수 있다.
export const DEFAULT_COMPANY_RUNTIME_DIR = process.env.ROBOM_HQ_RUNTIME_DIR && isAbsolute(process.env.ROBOM_HQ_RUNTIME_DIR)
  ? process.env.ROBOM_HQ_RUNTIME_DIR
  : join(REPO_ROOT, "ops/control-center/runtime");
export const MAX_RECORD_BYTES = 16 * 1024;

const COLLECTION_SET = new Set(COMPANY_COLLECTIONS);
const RECORD_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set([
  "draft", "scheduled", "received", "queued", "pending", "proposed", "active", "open",
  "triaged", "assigned", "in_progress", "in_review", "verifying", "approval_pending",
  "approved", "rejected", "on_hold", "held", "blocked", "resolved", "decided", "completed", "done",
  "cancelled", "dismissed", "superseded", "archived",
]);
const DEFAULT_STATUS = Object.freeze({
  meetings: "scheduled",
  decisions: "proposed",
  approvals: "pending",
  requests: "received",
  reviews: "open",
  tasks: "queued",
  notes: "active",
  incidents: "open",
  feedback: "received",
});
const COMMON_FIELDS = [
  "title", "summary", "body", "status", "appId", "departmentId", "owner", "priority", "tags",
  "relatedIds", "dueAt", "source",
];
const COLLECTION_FIELDS = Object.freeze({
  meetings: new Set([...COMMON_FIELDS, "agenda", "participants", "scheduledAt", "outcome"]),
  decisions: new Set([...COMMON_FIELDS, "recommendation", "rationale", "options", "decidedAt"]),
  // fixClass·failureClass·detectedAt·loopId 없이는 자동 점검이 만드는 결재가 생성 단계에서 통째로 거부돼(silent throw)
  // 사건·성장 제안이 하나도 기록되지 않는다 — Loop 전결 human-gate(isDelegable fixClass)도 무력화. 반드시 허용한다.
  approvals: new Set([...COMMON_FIELDS, "requestedBy", "recommendation", "impact", "reversible", "decidedAt", "proposalKey", "approvedBy", "fixClass", "failureClass", "detectedAt", "loopId"]),
  requests: new Set([...COMMON_FIELDS, "requestedBy", "desiredOutcome", "urgency"]),
  reviews: new Set([...COMMON_FIELDS, "target", "url", "viewport", "finding", "severity"]),
  tasks: new Set([...COMMON_FIELDS, "assignedTo", "targetRepo", "acceptanceCriteria", "startedAt", "completedAt", "problem", "desiredOutcome", "mustPreserve", "autonomy", "attachments", "originContract", "approvalId", "loopId"]),
  notes: new Set([...COMMON_FIELDS, "body", "topic"]),
  incidents: new Set([...COMMON_FIELDS, "impact", "cause", "mitigation", "severity", "detectedAt", "resolvedAt"]),
  feedback: new Set([...COMMON_FIELDS, "category", "channel", "userImpact", "appVersion"]),
});
const ARRAY_FIELDS = new Set(["tags", "relatedIds", "participants", "options", "acceptanceCriteria", "attachments"]);
const BOOLEAN_FIELDS = new Set(["reversible"]);
const DATE_FIELDS = new Set(["dueAt", "scheduledAt", "decidedAt", "startedAt", "completedAt", "detectedAt", "resolvedAt"]);
const LONG_TEXT_FIELDS = new Set([
  "summary", "body", "agenda", "outcome", "rationale", "impact", "cause", "mitigation",
  "desiredOutcome", "finding", "userImpact", "problem", "mustPreserve",
]);
const AUTONOMY_VALUES = new Set(["research_only", "implement_and_review", "implement_test_wait_for_deploy", "guarded_auto_deploy"]);
const SENSITIVE_CONTENT = [
  /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|client[_-]?secret)\s*[:=]\s*\S+/i,
];

export class CompanyStoreError extends Error {
  constructor(message, { code = "INVALID_REQUEST", statusCode = 400 } = {}) {
    super(message);
    this.name = "CompanyStoreError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function assertCompanyCollection(collection) {
  if (typeof collection !== "string" || !COLLECTION_SET.has(collection)) {
    throw new CompanyStoreError("허용되지 않은 collection입니다.", { code: "INVALID_COLLECTION" });
  }
  return collection;
}

export function assertCompanyRecordId(id) {
  if (typeof id !== "string" || !RECORD_ID.test(id) || id.includes("..")) {
    throw new CompanyStoreError("잘못된 record id입니다.", { code: "INVALID_ID" });
  }
  return id;
}

function ensurePlainObject(value, message = "JSON 객체가 필요합니다.") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CompanyStoreError(message, { code: "INVALID_BODY" });
  }
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function assertNoSensitiveContent(value) {
  const strings = [];
  const visit = (current) => {
    if (typeof current === "string") strings.push(current);
    else if (Array.isArray(current)) current.forEach(visit);
    else if (current && typeof current === "object") Object.values(current).forEach(visit);
  };
  visit(value);
  if (strings.some((text) => SENSITIVE_CONTENT.some((pattern) => pattern.test(text)))) {
    throw new CompanyStoreError("비밀키·토큰·비밀번호 원문은 저장할 수 없습니다.", { code: "SENSITIVE_CONTENT" });
  }
}

function normalizeString(field, value) {
  if (typeof value !== "string") {
    throw new CompanyStoreError(`${field}는 문자열이어야 합니다.`, { code: "INVALID_FIELD" });
  }
  const normalized = value.trim();
  if (!normalized && field !== "title") return undefined;
  const limit = field === "url" ? 2048 : LONG_TEXT_FIELDS.has(field) ? 4_000 : 240;
  if (!normalized || normalized.length > limit) {
    throw new CompanyStoreError(`${field}의 길이가 허용 범위를 벗어났습니다.`, { code: "INVALID_FIELD" });
  }
  if (field === "url") {
    let parsed;
    try { parsed = new URL(normalized); } catch {
      throw new CompanyStoreError("url은 올바른 HTTP(S) 주소여야 합니다.", { code: "INVALID_FIELD" });
    }
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
      throw new CompanyStoreError("url은 HTTP(S) 주소만 허용합니다.", { code: "INVALID_FIELD" });
    }
  }
  if (DATE_FIELDS.has(field) && !Number.isFinite(Date.parse(normalized))) {
    throw new CompanyStoreError(`${field}는 올바른 날짜여야 합니다.`, { code: "INVALID_FIELD" });
  }
  return normalized;
}

function normalizeArray(field, value) {
  if (!Array.isArray(value) || value.length > 30) {
    throw new CompanyStoreError(`${field}는 최대 30개의 문자열 배열이어야 합니다.`, { code: "INVALID_FIELD" });
  }
  return value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 240) {
      throw new CompanyStoreError(`${field} 항목이 올바르지 않습니다.`, { code: "INVALID_FIELD" });
    }
    return item.trim();
  });
}

function normalizeRecord(collection, payload) {
  assertCompanyCollection(collection);
  ensurePlainObject(payload);
  if (byteLength(payload) > MAX_RECORD_BYTES) {
    throw new CompanyStoreError("record가 허용 크기를 초과했습니다.", { code: "RECORD_TOO_LARGE", statusCode: 413 });
  }
  const allowed = COLLECTION_FIELDS[collection];
  const normalized = {};
  for (const [field, value] of Object.entries(payload)) {
    if (!allowed.has(field)) {
      throw new CompanyStoreError(`허용되지 않은 필드입니다: ${field}`, { code: "INVALID_FIELD" });
    }
    if (ARRAY_FIELDS.has(field)) normalized[field] = normalizeArray(field, value);
    else if (BOOLEAN_FIELDS.has(field)) {
      if (typeof value !== "boolean") throw new CompanyStoreError(`${field}는 boolean이어야 합니다.`, { code: "INVALID_FIELD" });
      normalized[field] = value;
    } else {
      const fieldValue = normalizeString(field, value);
      if (fieldValue !== undefined) normalized[field] = fieldValue;
    }
  }
  if (!normalized.title) {
    throw new CompanyStoreError("title은 필수입니다.", { code: "INVALID_FIELD" });
  }
  if (normalized.priority && !PRIORITIES.has(normalized.priority)) {
    throw new CompanyStoreError("priority 값이 올바르지 않습니다.", { code: "INVALID_FIELD" });
  }
  if (normalized.autonomy && !AUTONOMY_VALUES.has(normalized.autonomy)) {
    throw new CompanyStoreError("autonomy 값이 올바르지 않습니다.", { code: "INVALID_FIELD" });
  }
  normalized.status = normalized.status || DEFAULT_STATUS[collection];
  if (!STATUSES.has(normalized.status)) {
    throw new CompanyStoreError("status 값이 올바르지 않습니다.", { code: "INVALID_STATUS" });
  }
  assertNoSensitiveContent(normalized);
  return normalized;
}

function normalizeStatusPatch(collection, payload) {
  ensurePlainObject(payload);
  const keys = Object.keys(payload);
  // Loop 생명주기가 실제로 기록하는 메타데이터를 append-only로 보존한다.
  // (과거엔 {status}만 허용해 verifiedBy·reason·originPassStreak·requeueCount·loopId 패치가 조용히 throw→유실됐고,
  //  그 결과 업무가 completed/blocked로 전이돼도 기록에 남지 않아 재검증·재시도 상한이 무력화됐다.)
  const allowed = collection === "approvals"
    ? new Set(["status", "comment", "signatureRecorded", "approvedBy", "fixClass", "loopId"])
    : new Set(["status", "verifiedBy", "reason", "originPassStreak", "requeueCount", "loopId", "approvalId"]);
  if (!keys.length || keys.some((key) => !allowed.has(key))) {
    throw new CompanyStoreError(
      collection === "approvals"
        ? "결재 PATCH는 status·comment·서명·fixClass·loopId만 허용합니다."
        : "업무 PATCH는 허용된 상태·메타데이터 필드만 변경할 수 있습니다.",
      { code: "INVALID_STATUS" },
    );
  }
  const changes = {};
  if (Object.hasOwn(payload, "status")) { // status는 선택(메타데이터만 갱신하는 패치도 허용)
    if (typeof payload.status !== "string" || !STATUSES.has(payload.status)) {
      throw new CompanyStoreError("status 값이 올바르지 않습니다.", { code: "INVALID_STATUS" });
    }
    changes.status = payload.status;
  }
  // 짧은 문자열 메타 필드(길이 제한)
  for (const [key, max] of [["verifiedBy", 120], ["reason", 500], ["loopId", 100], ["approvalId", 100], ["approvedBy", 60], ["fixClass", 20]]) {
    if (Object.hasOwn(payload, key)) {
      if (typeof payload[key] !== "string" || payload[key].length > max) {
        throw new CompanyStoreError(`${key}는 ${max}자 이하 문자열이어야 합니다.`, { code: "INVALID_FIELD" });
      }
      changes[key] = payload[key];
    }
  }
  // 0 이상 정수 메타 필드(재검증 연속 카운터·자동 재시도 횟수)
  for (const key of ["originPassStreak", "requeueCount"]) {
    if (Object.hasOwn(payload, key)) {
      if (!Number.isInteger(payload[key]) || payload[key] < 0) {
        throw new CompanyStoreError(`${key}는 0 이상 정수여야 합니다.`, { code: "INVALID_FIELD" });
      }
      changes[key] = payload[key];
    }
  }
  if (Object.hasOwn(payload, "comment")) {
    if (typeof payload.comment !== "string" || !payload.comment.trim() || payload.comment.trim().length > 500) {
      throw new CompanyStoreError("comment는 500자 이하의 짧은 문자열이어야 합니다.", { code: "INVALID_FIELD" });
    }
    changes.comment = payload.comment.trim();
  }
  if (Object.hasOwn(payload, "signatureRecorded")) {
    if (typeof payload.signatureRecorded !== "boolean") {
      throw new CompanyStoreError("signatureRecorded는 boolean이어야 합니다.", { code: "INVALID_FIELD" });
    }
    changes.signatureRecorded = payload.signatureRecorded;
  }
  assertNoSensitiveContent(changes);
  return changes;
}

async function readText(path) {
  try { return await readFile(path, "utf8"); }
  catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function readJsonLines(path, { strict = false } = {}) {
  const text = await readText(path);
  const rows = [];
  let corrupt = 0;
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    try { rows.push(JSON.parse(raw)); }
    catch {
      // 자가복구: 손상된 줄(동시 쓰기로 잘린 append 등)은 건너뛰고 나머지를 살린다.
      // 한 줄 손상으로 화면 전체가 '연결 안 됨'이 되지 않게 한다.
      corrupt += 1;
      if (strict) {
        throw new CompanyStoreError(`runtime JSONL이 손상되었습니다: ${index + 1}행`, { code: "CORRUPT_RUNTIME", statusCode: 500 });
      }
      console.error(`[company-store] 손상된 줄 건너뜀: ${path}:${index + 1}`);
    }
  }
  if (corrupt) console.error(`[company-store] ${path} — 손상된 줄 ${corrupt}개를 건너뛰고 로드`);
  return rows;
}

function foldEvents(events) {
  const records = new Map();
  let orphaned = 0;
  for (const event of events) {
    if (event.action === "created" && event.record) records.set(event.id, event.record);
    else if (event.action === "status_changed") {
      if (records.has(event.id)) records.set(event.id, { ...records.get(event.id), ...event.changes });
      else {
        // created 이벤트가 유실·손상돼 부모 없는 status_changed가 온 경우: 조용히 버리지 않는다.
        // 최소 레코드를 복구해 화면에 보이게 하고(_recovered), 로그로 알린다 — 침묵 유실 = 데이터 사고.
        orphaned += 1;
        records.set(event.id, { id: event.id, _recovered: true, ...event.changes });
      }
    }
  }
  if (orphaned) console.error(`[company-store] 부모(created) 없는 status_changed ${orphaned}건 — 손상 의심, 최소 복구로 보존`);
  return [...records.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function timestampForFile(iso) {
  return iso.replace(/[-:.TZ]/g, "").slice(0, 14);
}

export function createCompanyStore({
  runtimeDir = DEFAULT_COMPANY_RUNTIME_DIR,
  now = () => new Date(),
  idFactory = () => randomUUID(),
} = {}) {
  const root = resolve(runtimeDir);
  if (!isAbsolute(root)) throw new TypeError("runtimeDir는 절대 경로여야 합니다.");
  const recordsDir = join(root, "records");
  const exportsDir = join(root, "exports");
  const backupsDir = join(root, "backups");
  const auditPath = join(root, "audit.jsonl.local");
  let writeQueue = Promise.resolve();

  const paths = Object.freeze({ root, recordsDir, exportsDir, backupsDir, auditPath });
  const collectionPath = (collection) => join(recordsDir, `${assertCompanyCollection(collection)}.jsonl.local`);
  const isoNow = () => {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError("now()가 올바른 날짜를 반환해야 합니다.");
    return date.toISOString();
  };
  const nextId = (collection) => {
    const suffix = String(idFactory()).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    return assertCompanyRecordId(`${collection}_${Date.now().toString(36)}_${suffix || randomUUID().replaceAll("-", "").slice(0, 12)}`);
  };
  const ensurePrivateDir = async (path) => {
    await mkdir(path, { recursive: true, mode: 0o700 });
    // mkdir은 기존 디렉터리의 권한을 바꾸지 않으므로, 이전 설치의 느슨한 모드도 복구한다.
    await chmod(path, 0o700);
  };
  const ensureReady = () => Promise.all([
    ensurePrivateDir(root),
    ensurePrivateDir(recordsDir),
    ensurePrivateDir(exportsDir),
    ensurePrivateDir(backupsDir),
  ]);
  const appendLine = async (path, value) => {
    // 줄바꿈 안전: 직전 append가 크래시로 끊겨 파일이 개행 없이 끝나면, 그 조각에 새 JSON이 붙어
    // 한 줄이 되면서 새 레코드까지 파싱 불가로 유실된다. 마지막 바이트가 개행이 아니면 개행을 먼저 넣어
    // 끊긴 조각만 격리하고(그 줄만 corrupt로 건너뜀) 새 레코드는 온전히 보존한다.
    let prefix = "";
    try {
      const st = await stat(path);
      if (st.size > 0) {
        const fh = await open(path, "r");
        try { const buf = Buffer.alloc(1); await fh.read(buf, 0, 1, st.size - 1); if (buf[0] !== 0x0a) prefix = "\n"; }
        finally { await fh.close(); }
      }
    } catch { /* 파일 없음/조회 실패 → 새 줄로 시작 */ }
    await appendFile(path, `${prefix}${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  };
  const appendAudit = async ({ action, collection = null, id = null, status = null, payload = null }) => {
    const event = {
      schemaVersion: 1,
      auditId: randomUUID(),
      at: isoNow(),
      action,
      collection,
      id,
      status,
      payloadDigest: payload ? digest(payload) : null,
    };
    await appendLine(auditPath, event);
    return event;
  };
  const runExclusive = (operation) => {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.then(() => undefined, () => undefined);
    return result;
  };
  const readCollectionNow = async (collection) => foldEvents(await readJsonLines(collectionPath(collection)));
  const getStateNow = async () => {
    await ensureReady();
    const records = {};
    const counts = {};
    for (const collection of COMPANY_COLLECTIONS) {
      // 컬렉션 하나의 읽기 실패(권한·EIO 등)가 화면 전체를 하얗게 만들지 않게 컬렉션 단위로 격리한다.
      try { records[collection] = await readCollectionNow(collection); }
      catch (error) { console.error(`[company-store] ${collection} 읽기 실패 — 빈 목록으로 격리`, error?.message); records[collection] = []; }
      counts[collection] = records[collection].length;
    }
    return { schemaVersion: 1, generatedAt: isoNow(), counts, records };
  };
  const getStateWithAuditNow = async () => {
    const state = await getStateNow();
    const audit = await readJsonLines(auditPath);
    const lastBackup = [...audit].reverse().find((row) => row.action === "company_backed_up");
    const lastExport = [...audit].reverse().find((row) => row.action === "company_exported");
    return {
      ...state,
      audit,
      meta: {
        lastBackupAt: lastBackup?.at || null,
        lastExportAt: lastExport?.at || null,
      },
    };
  };

  return Object.freeze({
    paths,
    async getState() {
      await writeQueue;
      return getStateWithAuditNow();
    },
    async createRecord(collection, payload) {
      return runExclusive(async () => {
        await ensureReady();
        const normalized = normalizeRecord(collection, payload);
        const at = isoNow();
        const id = nextId(collection);
        const record = { id, collection, ...normalized, createdAt: at, updatedAt: at };
        const event = { schemaVersion: 1, eventId: randomUUID(), at, action: "created", collection, id, record };
        await appendLine(collectionPath(collection), event);
        await appendAudit({ action: "record_created", collection, id, status: record.status, payload: record });
        return record;
      });
    },
    async updateStatus(collection, id, payload) {
      return runExclusive(async () => {
        await ensureReady();
        assertCompanyCollection(collection);
        assertCompanyRecordId(id);
        const patch = normalizeStatusPatch(collection, payload);
        const records = await readCollectionNow(collection);
        const current = records.find((record) => record.id === id);
        if (!current) {
          throw new CompanyStoreError("record를 찾을 수 없습니다.", { code: "NOT_FOUND", statusCode: 404 });
        }
        const at = isoNow();
        const changes = { ...patch, updatedAt: at };
        const event = { schemaVersion: 1, eventId: randomUUID(), at, action: "status_changed", collection, id, changes };
        await appendLine(collectionPath(collection), event);
        await appendAudit({ action: "record_status_changed", collection, id, status: changes.status, payload: changes });
        return { ...current, ...changes };
      });
    },
    async exportData() {
      return runExclusive(async () => {
        const data = await getStateWithAuditNow();
        const at = isoNow();
        const filename = `company-export-${timestampForFile(at)}-${randomUUID().slice(0, 8)}.json.local`;
        const file = join(exportsDir, filename);
        await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
        await appendAudit({ action: "company_exported", payload: { filename, counts: data.counts } });
        return { filename, generatedAt: at, counts: data.counts, data };
      });
    },
    async backup() {
      return runExclusive(async () => {
        await ensureReady();
        const at = isoNow();
        const state = await getStateNow();
        const eventStreams = {};
        for (const collection of COMPANY_COLLECTIONS) {
          eventStreams[collection] = await readJsonLines(collectionPath(collection));
        }
        const audit = await readJsonLines(auditPath);
        const backup = { schemaVersion: 1, createdAt: at, state, eventStreams, audit };
        const filename = `company-backup-${timestampForFile(at)}-${randomUUID().slice(0, 8)}.json.local`;
        const file = join(backupsDir, filename);
        const tmp = `${file}.tmp`;
        const body = `${JSON.stringify(backup, null, 2)}\n`;
        // 원자적·검증된 백업: tmp에 쓰고 fsync로 디스크에 확정 → 다시 읽어 JSON 파싱 검증 → rename으로 확정.
        // 잘린 백업이 mtime상 '최신'으로 위장해 24h 동안 다음 자동 백업을 막던 사고를 방지한다(안전망은 신뢰 가능해야 함).
        const fh = await open(tmp, "w", 0o600);
        try { await fh.writeFile(body, "utf8"); await fh.sync(); } finally { await fh.close(); }
        try { JSON.parse(await readFile(tmp, "utf8")); }
        catch (error) { try { await unlink(tmp); } catch { /* skip */ } throw new CompanyStoreError("백업 검증 실패(파일 손상) — 성공으로 기록하지 않음", { code: "BACKUP_VERIFY_FAILED", statusCode: 500 }); }
        await rename(tmp, file);
        await appendAudit({ action: "company_backed_up", payload: { filename, counts: state.counts } });
        return { filename, createdAt: at, counts: state.counts };
      });
    },
    async readAudit() {
      await writeQueue;
      await ensureReady();
      return readJsonLines(auditPath);
    },
  });
}
