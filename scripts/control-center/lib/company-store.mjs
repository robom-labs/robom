// 로봄 Company OS의 회의·결재·요청·작업 기록을 로컬 JSONL로 안전하게 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
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

export const DEFAULT_COMPANY_RUNTIME_DIR = join(REPO_ROOT, "ops/control-center/runtime");
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
  approvals: new Set([...COMMON_FIELDS, "requestedBy", "recommendation", "impact", "reversible", "decidedAt"]),
  requests: new Set([...COMMON_FIELDS, "requestedBy", "desiredOutcome", "urgency"]),
  reviews: new Set([...COMMON_FIELDS, "target", "url", "viewport", "finding", "severity"]),
  tasks: new Set([...COMMON_FIELDS, "assignedTo", "targetRepo", "acceptanceCriteria", "startedAt", "completedAt"]),
  notes: new Set([...COMMON_FIELDS, "body", "topic"]),
  incidents: new Set([...COMMON_FIELDS, "impact", "cause", "mitigation", "severity", "detectedAt", "resolvedAt"]),
  feedback: new Set([...COMMON_FIELDS, "category", "channel", "userImpact", "appVersion"]),
});
const ARRAY_FIELDS = new Set(["tags", "relatedIds", "participants", "options", "acceptanceCriteria"]);
const BOOLEAN_FIELDS = new Set(["reversible"]);
const DATE_FIELDS = new Set(["dueAt", "scheduledAt", "decidedAt", "startedAt", "completedAt", "detectedAt", "resolvedAt"]);
const LONG_TEXT_FIELDS = new Set([
  "summary", "body", "agenda", "outcome", "rationale", "impact", "cause", "mitigation",
  "desiredOutcome", "finding", "userImpact",
]);
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
  const allowed = collection === "approvals"
    ? new Set(["status", "comment", "signatureRecorded"])
    : new Set(["status"]);
  if (!keys.length || !keys.includes("status") || keys.some((key) => !allowed.has(key))) {
    throw new CompanyStoreError(
      collection === "approvals"
        ? "결재 PATCH는 status와 짧은 comment·signatureRecorded만 허용합니다."
        : "PATCH는 허용된 status 하나만 변경할 수 있습니다.",
      { code: "INVALID_STATUS" },
    );
  }
  if (typeof payload.status !== "string" || !STATUSES.has(payload.status)) {
    throw new CompanyStoreError("status 값이 올바르지 않습니다.", { code: "INVALID_STATUS" });
  }
  const changes = { status: payload.status };
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

async function readJsonLines(path) {
  const text = await readText(path);
  const rows = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    try { rows.push(JSON.parse(raw)); }
    catch {
      throw new CompanyStoreError(`runtime JSONL이 손상되었습니다: ${index + 1}행`, { code: "CORRUPT_RUNTIME", statusCode: 500 });
    }
  }
  return rows;
}

function foldEvents(events) {
  const records = new Map();
  for (const event of events) {
    if (event.action === "created" && event.record) records.set(event.id, event.record);
    else if (event.action === "status_changed" && records.has(event.id)) {
      records.set(event.id, { ...records.get(event.id), ...event.changes });
    }
  }
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
  const ensureReady = () => Promise.all([
    mkdir(recordsDir, { recursive: true, mode: 0o700 }),
    mkdir(exportsDir, { recursive: true, mode: 0o700 }),
    mkdir(backupsDir, { recursive: true, mode: 0o700 }),
  ]);
  const appendLine = async (path, value) => {
    await appendFile(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
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
      records[collection] = await readCollectionNow(collection);
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
        await writeFile(file, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
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
