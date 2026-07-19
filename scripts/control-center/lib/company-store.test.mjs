// 로봄 Company OS 로컬 저장소와 제한된 HTTP API의 CRUD·보안·백업 계약을 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { chmod, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CompanyStoreError,
  createCompanyStore,
} from "./company-store.mjs";
import {
  createControlCenterServer,
  LOCAL_HOST,
  startControlCenter,
} from "../serve.mjs";

async function makeStore(t) {
  const runtimeDir = await mkdtemp(join(tmpdir(), "robom-company-store-"));
  t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  return createCompanyStore({ runtimeDir });
}

async function mode(path) {
  return (await stat(path)).mode & 0o777;
}

test("기존 로컬 기록 디렉터리도 700으로 복구한다", async (t) => {
  const runtimeDir = await mkdtemp(join(tmpdir(), "robom-company-store-"));
  t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  const recordsDir = join(runtimeDir, "records");
  await chmod(runtimeDir, 0o755);
  await mkdir(recordsDir, { recursive: true, mode: 0o755 });
  await chmod(recordsDir, 0o755);

  const store = createCompanyStore({ runtimeDir });
  await store.getState();

  assert.equal(await mode(runtimeDir), 0o700);
  assert.equal(await mode(store.paths.recordsDir), 0o700);
  assert.equal(await mode(store.paths.exportsDir), 0o700);
  assert.equal(await mode(store.paths.backupsDir), 0o700);
});

async function listen(t, store, options = {}) {
  const server = createControlCenterServer({ store, ...options });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOCAL_HOST, resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server.address().port;
}

function rawJsonRequest({ port, path, method = "GET", body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    const req = request({
      hostname: LOCAL_HOST,
      port,
      path,
      method,
      headers: {
        Host: `${LOCAL_HOST}:${port}`,
        ...(data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch { /* 텍스트 응답 */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

test("회의·작업 record를 생성하고 상태 변경 이력을 append-only로 남긴다", async (t) => {
  const store = await makeStore(t);
  const created = await store.createRecord("tasks", {
    title: "청약봄 모바일 회귀검사",
    summary: "390px 화면에서 겹침을 확인한다.",
    acceptanceCriteria: ["가로 스크롤 없음", "하단 메뉴가 CTA를 가리지 않음"],
    priority: "high",
    assignedTo: "inspector",
  });
  assert.match(created.id, /^tasks_[a-z0-9_]+$/);
  assert.equal(created.status, "queued");
  assert.equal(created.assignedTo, "inspector");

  const updated = await store.updateStatus("tasks", created.id, { status: "in_progress" });
  assert.equal(updated.status, "in_progress");
  const state = await store.getState();
  assert.equal(state.counts.tasks, 1);
  assert.equal(state.records.tasks[0].status, "in_progress");

  const recordLines = (await readFile(join(store.paths.recordsDir, "tasks.jsonl.local"), "utf8")).trim().split("\n");
  assert.equal(recordLines.length, 2);
  assert.deepEqual(recordLines.map((line) => JSON.parse(line).action), ["created", "status_changed"]);
  assert.deepEqual((await store.readAudit()).map((row) => row.action), ["record_created", "record_status_changed"]);
});

test("잘못된 collection·id·민감정보 키워드를 거부한다", async (t) => {
  const store = await makeStore(t);
  await assert.rejects(
    store.createRecord("../../secrets", { title: "금지" }),
    (error) => error instanceof CompanyStoreError && error.code === "INVALID_COLLECTION",
  );
  await assert.rejects(
    store.updateStatus("tasks", "../secret", { status: "done" }),
    (error) => error instanceof CompanyStoreError && error.code === "INVALID_ID",
  );
  await assert.rejects(
    store.createRecord("notes", { title: "보안", body: "access_token=plain-secret-value" }),
    (error) => error instanceof CompanyStoreError && error.code === "SENSITIVE_CONTENT",
  );
  await assert.rejects(
    store.createRecord("notes", { title: "보안", password: "원문" }),
    (error) => error instanceof CompanyStoreError && error.code === "INVALID_FIELD",
  );
});

test("incidents와 feedback collection을 정식 저장한다", async (t) => {
  const store = await makeStore(t);
  const incident = await store.createRecord("incidents", {
    title: "야외봄 날씨 API 지연",
    impact: "추천 시간 계산이 늦어질 수 있다.",
    severity: "major",
    status: "open",
  });
  const feedback = await store.createRecord("feedback", {
    title: "모바일 버튼 위치 개선 요청",
    body: "엄지로 누르기 쉬운 위치가 필요하다.",
    category: "usability",
  });
  const state = await store.getState();
  assert.equal(incident.collection, "incidents");
  assert.equal(feedback.collection, "feedback");
  assert.equal(state.counts.incidents, 1);
  assert.equal(state.counts.feedback, 1);
});

test("approvals PATCH만 짧은 의견과 서명 기록 여부를 append-only로 허용한다", async (t) => {
  const store = await makeStore(t);
  const approval = await store.createRecord("approvals", {
    title: "Android 스토어 제출",
    requestedBy: "출시팀",
  });
  const updated = await store.updateStatus("approvals", approval.id, {
    status: "approved",
    comment: "내부 테스트 완료 후 제출을 승인합니다.",
    signatureRecorded: true,
  });
  assert.equal(updated.status, "approved");
  assert.equal(updated.comment, "내부 테스트 완료 후 제출을 승인합니다.");
  assert.equal(updated.signatureRecorded, true);
  const lines = (await readFile(join(store.paths.recordsDir, "approvals.jsonl.local"), "utf8")).trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[1]).changes, {
    status: "approved",
    comment: "내부 테스트 완료 후 제출을 승인합니다.",
    signatureRecorded: true,
    updatedAt: updated.updatedAt,
  });

  await assert.rejects(
    store.updateStatus("approvals", approval.id, { status: "approved", signature: "서명 원문" }),
    (error) => error instanceof CompanyStoreError && error.code === "INVALID_STATUS",
  );
  await assert.rejects(
    store.updateStatus("approvals", approval.id, { status: "approved", comment: "access_token=plain-secret-value" }),
    (error) => error instanceof CompanyStoreError && error.code === "SENSITIVE_CONTENT",
  );
  await assert.rejects(
    store.updateStatus("tasks", "bad-id", { status: "done", comment: "허용 안 됨" }),
    (error) => error instanceof CompanyStoreError && error.code === "INVALID_STATUS",
  );
});

test("export와 backup을 별도 로컬 JSON으로 만들고 감사 로그에 기록한다", async (t) => {
  const store = await makeStore(t);
  await store.createRecord("meetings", {
    title: "주간 제품회의",
    agenda: "세 앱의 출시 준비 상태를 확인한다.",
    participants: ["총괄", "제품", "QA"],
  });
  const exported = await store.exportData();
  const exportFile = JSON.parse(await readFile(join(store.paths.exportsDir, exported.filename), "utf8"));
  assert.equal(exportFile.counts.meetings, 1);
  assert.equal(exportFile.records.meetings[0].title, "주간 제품회의");

  const backedUp = await store.backup();
  const backupFile = JSON.parse(await readFile(join(store.paths.backupsDir, backedUp.filename), "utf8"));
  assert.equal(backupFile.state.counts.meetings, 1);
  assert.equal(backupFile.eventStreams.meetings.length, 1);
  assert.ok(backupFile.audit.some((row) => row.action === "company_exported"));
  assert.deepEqual((await store.readAudit()).map((row) => row.action), [
    "record_created",
    "company_exported",
    "company_backed_up",
  ]);
});

test("HTTP API로 CRUD·상태 조회·export·backup을 수행한다", async (t) => {
  const store = await makeStore(t);
  const port = await listen(t, store);
  const created = await rawJsonRequest({
    port,
    path: "/api/records/requests",
    method: "POST",
    body: {
      title: "로봄 웹 수정 요청",
      body: "모바일 CTA를 위로 옮긴다.",
      appId: "",
      priority: "normal",
      status: "open",
    },
  });
  assert.equal(created.status, 201);
  const id = created.json.record.id;
  assert.equal(created.json.state.records.requests.length, 1);

  const patched = await rawJsonRequest({
    port,
    path: `/api/records/requests/${id}`,
    method: "PATCH",
    body: { status: "in_progress" },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.record.status, "in_progress");
  assert.equal(patched.json.state.records.requests[0].status, "in_progress");

  const approvalCreated = await rawJsonRequest({
    port,
    path: "/api/records/approvals",
    method: "POST",
    body: { title: "스토어 제출", body: "내부 테스트 완료 후 제출한다.", status: "pending" },
  });
  const approvalPatched = await rawJsonRequest({
    port,
    path: `/api/records/approvals/${approvalCreated.json.record.id}`,
    method: "PATCH",
    body: { status: "approved", comment: "승인합니다.", signatureRecorded: true },
  });
  assert.equal(approvalPatched.status, 200);
  assert.equal(approvalPatched.json.record.signatureRecorded, true);
  assert.equal(approvalPatched.json.state.records.approvals[0].comment, "승인합니다.");

  const state = await rawJsonRequest({ port, path: "/api/company-state" });
  assert.equal(state.status, 200);
  assert.equal(state.json.counts.requests, 1);
  assert.equal(state.json.records.requests[0].title, "로봄 웹 수정 요청");
  const exported = await rawJsonRequest({ port, path: "/api/export", method: "POST" });
  assert.equal(exported.status, 200);
  assert.match(exported.json.name, /^company-export-.+\.json\.local$/);
  assert.equal(exported.json.payload.records.requests.length, 1);
  const backup = await rawJsonRequest({ port, path: "/api/backup", method: "POST" });
  assert.equal(backup.status, 201);
  assert.match(backup.json.file, /^company-backup-.+\.json\.local$/);
  assert.ok(backup.json.state.meta.lastBackupAt);
});

test("잘못된 API collection·oversized body·traversal·id를 거부한다", async (t) => {
  const store = await makeStore(t);
  const port = await listen(t, store, { maxBodyBytes: 256 });
  const invalidCollection = await rawJsonRequest({
    port,
    path: "/api/records/not-allowed",
    method: "POST",
    body: { title: "거부" },
  });
  assert.equal(invalidCollection.status, 400);
  assert.equal(invalidCollection.json.error, "INVALID_COLLECTION");

  const oversized = await rawJsonRequest({
    port,
    path: "/api/records/notes",
    method: "POST",
    body: { title: "큰 본문", body: "가".repeat(400) },
  });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.json.error, "BODY_TOO_LARGE");

  const traversal = await rawJsonRequest({
    port,
    path: "/api/records/tasks/%2e%2e%2fsecret",
    method: "PATCH",
    body: { status: "done" },
  });
  assert.equal(traversal.status, 400);
  assert.equal(traversal.json.error, "INVALID_PATH");

  const invalidId = await rawJsonRequest({
    port,
    path: "/api/records/tasks/bad.id",
    method: "PATCH",
    body: { status: "done" },
  });
  assert.equal(invalidId.status, 400);
  assert.equal(invalidId.json.error, "INVALID_ID");
});

test("기존 정적 화면과 snapshot 제공 동작을 유지하고 외부 Host를 거부한다", async (t) => {
  const store = await makeStore(t);
  const port = await listen(t, store);
  const office = await rawJsonRequest({ port, path: "/office.html" });
  assert.equal(office.status, 200);
  assert.match(office.headers["content-type"], /^text\/html/);
  const snapshot = await rawJsonRequest({ port, path: "/snapshot.json" });
  assert.equal(snapshot.status, 200);
  assert.match(snapshot.json.product, /^ROBOM .+ · 로봄 본부$/);
  const denied = await rawJsonRequest({ port, path: "/api/company-state", headers: { Host: "evil.example" } });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error, "LOCAL_ONLY");
});

test("공식 로컬 실행 함수는 127.0.0.1에만 bind한다", async (t) => {
  const { server, link } = await startControlCenter({ port: 0, openBrowser: false, refreshSnapshot: false });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  assert.equal(server.address().address, LOCAL_HOST);
  assert.match(link, /^http:\/\/127\.0\.0\.1:\d+\/$/);
});
