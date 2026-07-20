// 로봄 Company OS 운영 장부 파서가 완료·미완료와 자동화 증거를 정직하게 구분하는지 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCompanyOperations, parseMarkdownChecklist, parseWorkflowAutomation } from "./company-ops.mjs";

test("Markdown 체크리스트에서 완료 여부를 보존한다", () => {
  assert.deepEqual(parseMarkdownChecklist("- [x] 완료\n- [ ] 다음\n일반 문장"), [
    { done: true, title: "완료" },
    { done: false, title: "다음" },
  ]);
});

test("workflow 예약은 등록 상태일 뿐 실행 완료로 만들지 않는다", () => {
  const item = parseWorkflowAutomation("daily.yml", "name: Daily company\non:\n  schedule:\n    - cron: '0 0 * * *'\n  workflow_dispatch:");
  assert.equal(item.name, "Daily company");
  assert.equal(item.schedule, "0 0 * * *");
  assert.equal(item.status, "planned");
  assert.equal(item.lastRun, null);
});

test("정본 파일과 앱 git 증거에서 Company OS 운영 데이터를 만든다", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "robom-company-ops-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "ops/control-center"), { recursive: true });
  await mkdir(join(root, ".github/workflows"), { recursive: true });
  await writeFile(join(root, "ops/HUMAN-TASKS.md"), "- [ ] 스토어 계약\n- [x] Pages 배포\n");
  await writeFile(join(root, "ops/ROADMAP.md"), "- [x] 본사 구축\n- [ ] Android 파일럿\n");
  await writeFile(join(root, ".github/workflows/weekly.yml"), "name: Weekly review\non:\n  workflow_dispatch:\n");
  await writeFile(join(root, ".gitignore"), "ops/control-center/runtime/\n");
  await writeFile(join(root, "scripts-placeholder"), "");
  const operations = buildCompanyOperations(root, [{ id: "homebom", name: "청약봄", version: "1.0.0", git: { lastMsg: "feat: 알림", lastDate: "2026-07-17T00:00:00Z", sha: "abc1234" } }]);
  assert.deepEqual(operations.humanTasks, ["스토어 계약"]);
  assert.equal(operations.roadmap[1].done, false);
  assert.equal(operations.automations[0].statusLabel, "등록됨 · 실행 증거 별도");
  assert.equal(operations.updates[0].appId, "homebom");
});

test("보안 카드는 파일 존재가 아니라 실제 거부 로직으로 판정한다(거짓 성과 금지)", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "robom-secops-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "scripts/control-center/lib"), { recursive: true });
  await writeFile(join(root, ".gitignore"), "ops/control-center/runtime/\n");
  // 거부 로직이 없는 껍데기 파일 → 통과로 위장하면 안 된다
  await writeFile(join(root, "scripts/control-center/lib/company-store.mjs"), "export const x = 1;\n");
  let ops = buildCompanyOperations(root, []);
  const secretCard = (o) => o.security.find((c) => c.name === "비밀값 원문 저장 차단");
  assert.equal(secretCard(ops).ok, false); // 껍데기 → 미확인
  // 실제 거부 로직이 있으면 통과
  await writeFile(join(root, "scripts/control-center/lib/company-store.mjs"), "const SENSITIVE_CONTENT = [/x/];\nthrow new Error('비밀키·토큰·비밀번호 원문은 저장할 수 없습니다.');\n");
  ops = buildCompanyOperations(root, []);
  assert.equal(secretCard(ops).ok, true);
});

test("서버 접근 카드는 원격 토큰이 켜지면 '로컬 전용'이라 위장하지 않는다", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "robom-bind-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, ".gitignore"), "");
  const prev = process.env.ROBOM_HQ_REMOTE_TOKEN;
  try {
    process.env.ROBOM_HQ_REMOTE_TOKEN = "x".repeat(16); // 원격 연결 켜짐 → 0.0.0.0 바인딩
    const ops = buildCompanyOperations(root, []);
    const names = ops.security.map((c) => c.name);
    assert.ok(names.includes("서버 접근 범위")); // '로컬 전용 서버'가 아니라 정직한 범위 표기
    assert.ok(!names.includes("로컬 전용 서버"));
  } finally {
    if (prev === undefined) delete process.env.ROBOM_HQ_REMOTE_TOKEN; else process.env.ROBOM_HQ_REMOTE_TOKEN = prev;
  }
});
