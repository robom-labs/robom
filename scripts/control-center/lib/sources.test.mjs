// 관제 화면이 registry의 실제 URL·배포 필드를 읽는지 회귀 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { controlCenterFields, readApps, readState, repoRootFromModuleUrl } from "./sources.mjs";

test("readState는 '없음'이 부분 문자열로 들어간 실제 막힘을 '막힘 없음'으로 오인하지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "robom-state-"));
  try {
    mkdirSync(join(root, "ops/state"), { recursive: true });
    // 실제 막힘 — 텍스트에 '없음'이 포함되지만 막힘이 있는 것이다.
    writeFileSync(join(root, "ops/state/blocked-app.md"), "버전: 1.0.0\n\n## Blocked\n- 결제 응답 없음\n");
    const blockedState = readState(root, "blocked-app");
    assert.equal(blockedState.blocked, "- 결제 응답 없음", "실제 막힘이 보존돼야 한다");
    // 진짜 '막힘 없음' 섹션은 null.
    writeFileSync(join(root, "ops/state/clear-app.md"), "버전: 1.0.0\n\n## Blocked\n- 없음\n");
    assert.equal(readState(root, "clear-app").blocked, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Application Support처럼 공백이 있는 실행 경로를 실제 파일 경로로 복원한다", () => {
  const root = repoRootFromModuleUrl(pathToFileURL("/tmp/Robom HQ/scripts/control-center/lib/sources.mjs").href);
  assert.equal(root, "/tmp/Robom HQ");
  assert.doesNotMatch(root, /%20/);
});

test("등록 앱의 canonical URL과 배포 provider를 보존한다", () => {
  const apps = readApps();
  assert.ok(apps.length > 0);
  for (const app of apps) {
    const fields = controlCenterFields(app);
    assert.equal(fields.url, app.web_url, app.id);
    assert.equal(fields.deployTarget, app.deploy_provider, app.id);
    assert.ok(fields.url?.startsWith("https://"), app.id);
  }
});
