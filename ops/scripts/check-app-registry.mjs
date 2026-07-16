// 앱 registry의 필수 계약과 원본 저장소 버전 일치를 검사한다.
import { readRegistry, validateRegistryShape } from "./lib/registry.mjs";

const apps = await readRegistry();
const errors = validateRegistryShape(apps);

await Promise.all(apps.map(async (app) => {
  try {
    const response = await fetch(app.version_source, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const actual = (await response.json()).version;
    if (actual !== app.version) errors.push(`${app.id}: registry=${app.version}, source=${actual}`);
  } catch (error) {
    errors.push(`${app.id}: 버전 정본 확인 실패 (${error instanceof Error ? error.message : String(error)})`);
  }
}));

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(apps.map((app) => `${app.id}=${app.version} · ${app.stable_install_url}`).join("\n"));
