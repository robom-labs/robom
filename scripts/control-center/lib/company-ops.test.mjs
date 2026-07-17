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
