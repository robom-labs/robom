// 패밀리 정본을 앱 저장소가 독립 빌드할 수 있는 작은 생성물과 hash lock으로 변환한다.
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistry } from "../lib/registry.mjs";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

const appId = arg("app");
const target = arg("target");
const lockPath = arg("lock");
const flavor = arg("flavor") || "react";
const sourceCommit = arg("source-commit");
if (!appId || !target || !lockPath || !sourceCommit) {
  throw new Error("사용법: sync-app.mjs --app <id> --target <dir> --lock <file> --flavor react|vanilla --source-commit <sha>");
}
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("source-commit은 40자리 Git SHA여야 합니다.");
if (!["react", "vanilla"].includes(flavor)) throw new Error("flavor는 react 또는 vanilla여야 합니다.");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const apps = await readRegistry(new URL("../../../ops/registry/apps.yml", import.meta.url));
const app = apps.find((item) => item.id === appId);
if (!app) throw new Error(`알 수 없는 앱: ${appId}`);
const familyVersion = JSON.parse(await readFile(resolve(root, "ops/family/family-version.json"), "utf8"));
const core = JSON.parse(await readFile(resolve(root, "ops/family/design/core.tokens.json"), "utf8"));
const accent = JSON.parse(await readFile(resolve(root, `ops/family/design/apps/${appId}.json`), "utf8"));
const canonicalBom = await readFile(resolve(root, "ops/family/brand/bom.svg"), "utf8");
const icons = await readFile(resolve(root, "ops/family/brand/icons.svg"), "utf8");
const eventsSource = await readFile(resolve(root, "ops/family/analytics/events.yml"), "utf8");
// Family UI v1.1: settings 섹션 순서는 settings.yml 단일 정본을 파싱한다(이중 하드코딩 제거).
const settingsSource = await readFile(resolve(root, "ops/family/contracts/settings.yml"), "utf8");
function ymlList(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `${key}:`);
  if (start === -1) return [];
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const m = l.match(/^\s+-\s+(.+?)\s*$/);
    if (m) out.push(m[1].trim());
    else if (l.trim() && !l.startsWith(" ")) break;
  }
  return out;
}
const settingsSections = ymlList(settingsSource, "sections");
const settingsAppMeta = ymlList(settingsSource, "app_meta");
if (settingsSections.length < 3) throw new Error("ops/family/contracts/settings.yml의 sections 파싱 실패(단일 정본 손상).");
if (settingsAppMeta.length < 1) throw new Error("ops/family/contracts/settings.yml의 app_meta 파싱 실패.");
const eventMatch = eventsSource.match(new RegExp(`^${appId}: \\[(.*)\\]$`, "m"));
// 매치 실패를 빈 이벤트 목록으로 조용히 흘리면(오타로 앱이 events.yml에서 빠졌거나 포맷이
// 바뀐 경우) 그 앱은 유효 이벤트가 하나도 없는 분석 계약을 그대로 받는다 — 앱 키를 아예
// 못 찾은 경우는 실수일 가능성이 높으므로 loud하게 막는다(단일행 포맷 자체의 변경은 후속 과제).
if (!eventMatch) throw new Error(`ops/family/analytics/events.yml에서 "${appId}:" 항목을 찾지 못했습니다(오타이거나 앱이 등록 안 됨).`);
const events = eventMatch[1].split(",").map((item) => item.trim()).filter(Boolean);
const forbidden = ["latitude", "longitude", "address", "email", "phone", "oauth_token", "push_endpoint", "medication", "medicine", "hospital", "calendar_title", "family_event_title", "raw_query", "raw_answer", "api_key", "access_token", "refresh_token"];

const css = `/* DO NOT EDIT. 로봄 패밀리 ${familyVersion.familySpecVersion} 생성 토큰이다. */\n:root {\n  --family-font: ${core.fontFamily};\n  --family-space-1: ${core.space[1]};\n  --family-space-2: ${core.space[2]};\n  --family-space-3: ${core.space[3]};\n  --family-space-4: ${core.space[4]};\n  --family-space-5: ${core.space[5]};\n  --family-radius-sm: ${core.radius.sm};\n  --family-radius-md: ${core.radius.md};\n  --family-radius-lg: ${core.radius.lg};\n  --family-shadow-card: ${core.shadow.card};\n  --family-border: ${core.border};\n  --family-touch-min: ${core.touchMin};\n  --family-nav-height: ${core.navHeight};\n  --family-focus: ${core.focus};\n  --family-motion-fast: ${core.motionFast};\n  --app-brand: ${accent.brand};\n  --app-brand-deep: ${accent.brandDeep};\n  --app-brand-soft: ${accent.brandSoft};\n  --app-page: ${accent.page};\n  --app-ink: ${accent.ink};\n  --app-muted: ${accent.muted};\n}\n`;
const appMeta = {
  _generated: `DO NOT EDIT · robom family ${familyVersion.familySpecVersion}`,
  id: app.id,
  name: app.name,
  englishName: app.english_name,
  repo: app.repo,
  version: app.version,
  webUrl: app.web_url,
  stableInstallUrl: app.stable_install_url,
  privacyUrl: app.privacy_url,
  supportUrl: app.support_url,
  deployProvider: app.deploy_provider,
  familySpecVersion: familyVersion.familySpecVersion,
  lastVerifiedAt: app.last_verified_at,
  familyApps: apps.map((item) => ({ id: item.id, name: item.name, webUrl: item.web_url, installUrl: item.stable_install_url })),
};
const settings = {
  _generated: `DO NOT EDIT · robom family ${familyVersion.familySpecVersion}`,
  sections: settingsSections,
  appMeta: settingsAppMeta,
};
const featureFlags = {
  _generated: `DO NOT EDIT · robom family ${familyVersion.familySpecVersion}`,
  ads: { enabled: false, provider: "none", placement: "bottom-safe", minSessionDepth: 2, maxPerSession: 0, personalization: false },
  analytics: { enabled: false, consentRequired: true },
  experiments: { enabled: false, maxConcurrent: 1 },
};
const authConfig = {
  _generated: `DO NOT EDIT · robom family ${familyVersion.familySpecVersion}`,
  guestFirst: true,
  issuer: "",
  redirectBase: "https://robom.kr/auth/callback",
  providers: { kakao: "unconfigured", google: "unconfigured", apple: "unconfigured" },
  namespace: appId,
  calendarSensitiveSync: appId === "calendarbom" ? "local-only-default" : "not-applicable",
};
const analytics = flavor === "react"
  ? `// DO NOT EDIT. ${app.name}의 개인정보 최소 분석 이벤트 계약이다.\nexport const familyEventNames = ${JSON.stringify(events)} as const;\nexport type FamilyEventName = (typeof familyEventNames)[number];\nexport const forbiddenAnalyticsFields = ${JSON.stringify(forbidden)} as const;\n`
  : `// DO NOT EDIT. ${app.name}의 개인정보 최소 분석 이벤트 계약이다.\nwindow.RobomFamilyAnalyticsContract = Object.freeze({ appId: ${JSON.stringify(appId)}, events: ${JSON.stringify(events)}, forbiddenFields: ${JSON.stringify(forbidden)} });\n`;
const generated = new Map([
  ["tokens.css", css],
  ["app-meta.json", `${JSON.stringify(appMeta, null, 2)}\n`],
  ["wordmark.svg", canonicalBom.replace("__INK__", accent.ink).replaceAll("__ACCENT__", accent.brand)],
  ["icons.svg", icons],
  ["settings-contract.json", `${JSON.stringify(settings, null, 2)}\n`],
  ["feature-flags.json", `${JSON.stringify(featureFlags, null, 2)}\n`],
  ["auth-config.json", `${JSON.stringify(authConfig, null, 2)}\n`],
  [flavor === "react" ? "analytics-events.ts" : "analytics-events.js", analytics],
]);

await mkdir(target, { recursive: true });
const hashes = {};
for (const [name, content] of generated) {
  await writeFile(resolve(target, name), content);
  hashes[name] = `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
const lock = {
  familySpecVersion: familyVersion.familySpecVersion,
  sourceCommit,
  generatedAt: familyVersion.releasedAt,
  files: hashes,
};
await mkdir(dirname(lockPath), { recursive: true });
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`${appId}: ${generated.size} generated files + ${lockPath}`);
