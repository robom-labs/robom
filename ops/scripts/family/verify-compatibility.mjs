// compatibility matrix가 registry의 모든 앱과 현재 패밀리 규격을 추적하는지 검사한다.
import { readFile } from "node:fs/promises";
import { readRegistry } from "../lib/registry.mjs";

const apps = await readRegistry(new URL("../../../ops/registry/apps.yml", import.meta.url));
const version = JSON.parse(await readFile(new URL("../../family/family-version.json", import.meta.url), "utf8")).familySpecVersion;
const matrix = await readFile(new URL("../../family/compatibility.yml", import.meta.url), "utf8");
const errors = [];

const appBlocks = new Map(
  [...matrix.matchAll(/^  ([a-z][a-z0-9-]*):\n((?:    [^\n]*(?:\n|$))+)/gm)].map((match) => [match[1], match[2]]),
);

function readField(block, field) {
  return new RegExp(`^    ${field}: (.+)$`, "m").exec(block)?.[1]?.trim();
}

for (const app of apps) {
  const block = appBlocks.get(app.id);
  if (!block) {
    errors.push(`${app.id}: compatibility 항목 없음`);
    continue;
  }

  const familySpec = readField(block, "family_spec");
  const generatedCommit = readField(block, "generated_commit");
  const deployedSha = readField(block, "deployed_sha");
  if (familySpec !== version) errors.push(`${app.id}: family_spec ${version} 불일치 (${familySpec ?? "없음"})`);
  if (!/^[0-9a-f]{40}$/.test(generatedCommit ?? "")) errors.push(`${app.id}: generated_commit은 40자 commit SHA여야 합니다.`);
  if (deployedSha !== app.last_deployed_sha) {
    errors.push(`${app.id}: deployed_sha가 registry와 다릅니다. (${deployedSha ?? "없음"} != ${app.last_deployed_sha})`);
  }
}
// registry에 없는 여분 항목(폐기된 앱의 잔존 compatibility 블록)은 지금까지 검사 대상에서
// 완전히 빠져 무기한 방치될 수 있었다 — 드리프트 검출기 자신의 사각지대를 없앤다.
const registryIds = new Set(apps.map((app) => app.id));
for (const id of appBlocks.keys()) {
  if (!registryIds.has(id)) errors.push(`${id}: registry에 없는 여분 compatibility 항목(폐기된 앱이면 제거하세요).`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`compatibility ${version}: ${apps.length} apps tracked`);
