// registry와 패밀리 정본에서 홈페이지 메타데이터·스토어 ID·워드마크 생성물을 만든다.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readRegistry, validateRegistryShape } from "../lib/registry.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkOnly = process.argv.includes("--check");
const apps = await readRegistry(new URL("../../../ops/registry/apps.yml", import.meta.url));
const errors = validateRegistryShape(apps);
if (errors.length) throw new Error(errors.join("\n"));

const familyVersion = JSON.parse(await readFile(resolve(root, "ops/family/family-version.json"), "utf8"));
const canonicalBom = await readFile(resolve(root, "ops/family/brand/bom.svg"), "utf8");
const canonicalIcons = await readFile(resolve(root, "ops/family/brand/icons.svg"), "utf8");
const outputs = new Map();

const meta = apps.map((app) => ({
  id: app.id,
  name: app.name,
  englishName: app.english_name,
  repo: app.repo,
  version: app.version,
  webUrl: app.web_url,
  healthcheckUrl: app.healthcheck_url,
  deployProvider: app.deploy_provider,
  basePath: app.base_path,
  privacyUrl: app.privacy_url,
  supportUrl: app.support_url,
  androidAppId: app.android_app_id,
  iosBundleId: app.ios_bundle_id,
  googlePlayUrl: app.google_play_url,
  googlePlayStatus: app.google_play_status,
  appStoreUrl: app.app_store_url,
  appStoreStatus: app.app_store_status,
  pwaInstallUrl: app.pwa_install_url,
  stableInstallUrl: app.stable_install_url,
  mobileStatus: app.mobile_status,
  familySpecVersion: app.family_spec_version,
  lastVerifiedAt: app.last_verified_at,
}));

outputs.set(
  "site/app/generated-app-data.ts",
  `// DO NOT EDIT. ops/registry/apps.yml에서 생성된 홈페이지 앱 메타데이터다.\nexport const generatedAppMeta = ${JSON.stringify(meta, null, 2)} as const;\n`,
);
outputs.set(
  "site/public/family/apps.json",
  `${JSON.stringify({ familySpecVersion: familyVersion.familySpecVersion, apps: meta }, null, 2)}\n`,
);
outputs.set("site/public/family/icons.svg", canonicalIcons);

const appIds = [
  "# DO NOT EDIT. ops/registry/apps.yml에서 생성되는 스토어 앱 식별자 목록이다.",
  `family_spec_version: ${familyVersion.familySpecVersion}`,
  "apps:",
  ...apps.flatMap((app) => [
    `  ${app.id}:`,
    `    android: ${app.android_app_id}`,
    `    ios: ${app.ios_bundle_id}`,
  ]),
  "",
].join("\n");
outputs.set("ops/family/store/app-ids.yml", appIds);

for (const app of apps) {
  const tokens = JSON.parse(await readFile(resolve(root, `ops/family/design/apps/${app.id}.json`), "utf8"));
  outputs.set(
    `site/public/brand/bom-${app.id}.svg`,
    canonicalBom.replace("__INK__", tokens.ink).replaceAll("__ACCENT__", tokens.brand),
  );
}

let changed = 0;
for (const [relative, desired] of outputs) {
  const path = resolve(root, relative);
  let actual = null;
  try { actual = await readFile(path, "utf8"); } catch { /* 새 생성물 */ }
  if (actual === desired) continue;
  changed += 1;
  if (checkOnly) {
    console.error(`drift: ${relative}`);
    continue;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, desired);
  console.log(`generated ${relative}`);
}

if (checkOnly && changed) process.exit(1);
console.log(checkOnly ? `family drift 0 · ${outputs.size} files` : `family generated · ${outputs.size} files · ${changed} updated`);
