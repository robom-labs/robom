// ROBOM Context & Family OS v1.0.0 — 라우터 golden 테스트 (doc-03 §29).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";
import { loadRouting, buildPack, classify, estimateTokens, appMapSections } from "./lib/context-os.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const routing = await loadRouting(root);
const apps = await readRegistry(new URL("../../registry/apps.yml", import.meta.url));
const repoMapText = await readFile(resolve(root, "ops/family/ai/REPO-MAP.yml"), "utf8");
const { fixtures } = JSON.parse(await readFile(resolve(root, "ops/family/ai/context-fixtures.json"), "utf8"));

test("estimateTokens은 결정론적이고 0 이상", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("가나다라마"), 2);
});

test("appMapSections는 요청한 섹션만 남긴다", () => {
  const shellOnly = appMapSections(repoMapText, "outbom", ["shell"]);
  assert.match(shellOnly, /shell:/);
  assert.doesNotMatch(shellOnly, /domain:/);
});

for (const fx of fixtures) {
  test(`fixture ${fx.id}: 프로파일·레벨·포함·제외`, async () => {
    const { profile } = classify(fx.request, routing);
    assert.equal(profile.id, fx.expectedProfile, `프로파일 불일치: ${fx.request}`);

    const pack = await buildPack({ request: fx.request, appId: fx.app, root, routing, apps, repoMapText });
    assert.equal(pack.level, fx.expectedLevel, `레벨 불일치: ${fx.id}`);

    // 헌법(L0)은 항상 포함
    assert.equal(pack.constitutionPath, routing.constitution);

    // must-exclude 토픽은 neverLoad에 있어야 한다
    for (const topic of fx.mustExcludeTopics || []) {
      assert.ok(pack.neverLoad.includes(topic), `${fx.id}: ${topic}가 neverLoad에 없음`);
    }

    // 앱이 지정된 fixture는 read-next에 해당 섹션 파일이 있어야 한다
    if (fx.app && (fx.mustIncludeSections || []).length) {
      const joined = pack.readNext.join(" ");
      assert.ok(pack.readNext.length > 0, `${fx.id}: read-next가 비었음`);
      assert.ok(joined.startsWith(fx.app) || joined.includes(`${fx.app}:`), `${fx.id}: read-next에 대상 앱 파일 없음`);
    }

    // 추정 컨텍스트는 해당 레벨 예산 안(무제한 레벨 제외)
    assert.ok(pack.withinBudget, `${fx.id}: 예산 초과 (${pack.estimatedTokens} > ${pack.budget})`);
  });
}

test("결정론: 같은 요청은 같은 pack", async () => {
  const a = await buildPack({ request: "청약봄 버튼 문구", appId: "homebom", root, routing, apps, repoMapText });
  const b = await buildPack({ request: "청약봄 버튼 문구", appId: "homebom", root, routing, apps, repoMapText });
  assert.deepEqual(a, b);
});

test("앱 자동 감지: 요청에 앱 이름이 있으면 --app 없이도 대상 설정", async () => {
  const pack = await buildPack({ request: "러닝봄 카드 간격 조정", appId: null, root, routing, apps, repoMapText });
  assert.equal(pack.app, "runningbom");
});

test("모든 registry 앱이 REPO-MAP에 존재(새 앱 profile 누락 방지, doc-03 §10)", () => {
  for (const app of apps) {
    assert.match(repoMapText, new RegExp(`^${app.id}:`, "m"), `${app.id}가 REPO-MAP.yml에 없음`);
  }
});
