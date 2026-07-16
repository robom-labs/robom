// 로봄 registry의 평면 앱 레코드를 외부 의존성 없이 안전하게 읽고 검증한다.
import { readFile } from "node:fs/promises";

export const APP_IDS = ["outbom", "homebom", "runningbom", "calendarbom", "certbom"];

function stripInlineComment(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('"') || trimmed.startsWith("'")) return trimmed;
  const index = trimmed.indexOf(" #");
  return index === -1 ? trimmed : trimmed.slice(0, index).trimEnd();
}

function parseScalar(value) {
  const clean = stripInlineComment(value);
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    return clean.slice(1, -1);
  }
  return clean;
}

export function parseRegistry(source) {
  const apps = [];
  let current = null;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#") || line.trim() === "apps:") continue;
    const idMatch = line.match(/^\s{2}- id:\s*([^#]+?)\s*$/);
    if (idMatch) {
      current = { id: parseScalar(idMatch[1]), _line: index + 1 };
      apps.push(current);
      continue;
    }
    const fieldMatch = line.match(/^\s{4}([a-z0-9_]+):(?:\s*(.*))?$/);
    if (fieldMatch && current) current[fieldMatch[1]] = parseScalar(fieldMatch[2] ?? "");
  }
  return apps;
}

export async function readRegistry(url = new URL("../../registry/apps.yml", import.meta.url)) {
  return parseRegistry(await readFile(url, "utf8"));
}

export function validateRegistryShape(apps) {
  const required = [
    "id", "name", "english_name", "repo", "version", "version_source", "web_url", "healthcheck_url",
    "deploy_provider", "base_path", "privacy_url", "support_url", "android_app_id", "ios_bundle_id",
    "google_play_url", "google_play_status", "app_store_url", "app_store_status", "pwa_install_url",
    "stable_install_url", "mobile_status", "family_spec_version", "last_verified_at", "test", "build",
  ];
  const errors = [];
  const ids = apps.map((app) => app.id);
  if (new Set(ids).size !== ids.length) errors.push("registry 앱 ID가 중복됩니다.");
  if (JSON.stringify(ids) !== JSON.stringify(APP_IDS)) errors.push(`registry 앱 순서가 정본과 다릅니다: ${ids.join(", ")}`);
  for (const app of apps) {
    for (const field of required) if (!(field in app)) errors.push(`${app.id}: ${field} 필드가 없습니다.`);
    if (!app.repo?.startsWith("robom-labs/")) errors.push(`${app.id}: repo는 robom-labs 조직이어야 합니다.`);
    if (app.stable_install_url !== `https://robom.kr/get/${app.id}`) errors.push(`${app.id}: 안정 설치 URL이 정본 패턴과 다릅니다.`);
    if (!/^kr\.robom\.[a-z]+$/.test(app.android_app_id ?? "")) errors.push(`${app.id}: Android 앱 ID 형식이 잘못됐습니다.`);
    if (app.ios_bundle_id !== app.android_app_id) errors.push(`${app.id}: iOS와 Android 식별자가 확정 후보와 다릅니다.`);
    for (const [statusField, urlField, allowed] of [
      ["google_play_status", "google_play_url", ["planned", "internal", "live"]],
      ["app_store_status", "app_store_url", ["planned", "testflight", "live"]],
    ]) {
      if (!allowed.includes(app[statusField])) errors.push(`${app.id}: ${statusField} 값이 잘못됐습니다.`);
      if (app[statusField] === "live" && !app[urlField]) errors.push(`${app.id}: live 스토어 URL이 없습니다.`);
      if (app[statusField] !== "live" && app[urlField]) errors.push(`${app.id}: 미출시 스토어에 URL을 넣을 수 없습니다.`);
    }
  }
  return errors;
}
