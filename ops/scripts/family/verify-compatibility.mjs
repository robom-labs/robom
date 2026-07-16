// compatibility matrix가 registry의 다섯 앱과 현재 패밀리 규격을 모두 추적하는지 검사한다.
import { readFile } from "node:fs/promises";
import { readRegistry } from "../lib/registry.mjs";

const apps = await readRegistry(new URL("../../../ops/registry/apps.yml", import.meta.url));
const version = JSON.parse(await readFile(new URL("../../family/family-version.json", import.meta.url), "utf8")).familySpecVersion;
const matrix = await readFile(new URL("../../family/compatibility.yml", import.meta.url), "utf8");
const errors = [];
for (const app of apps) {
  if (!new RegExp(`^  ${app.id}:$`, "m").test(matrix)) errors.push(`${app.id}: compatibility 항목 없음`);
  if (!new RegExp(`^    family_spec: ${version}$`, "m").test(matrix)) errors.push(`${app.id}: family_spec ${version} 확인 불가`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`compatibility ${version}: ${apps.length} apps tracked`);
