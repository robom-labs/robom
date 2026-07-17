// 로봄 여섯 운영 표면과 자격증봄 데이터 workflow의 배포·PWA·heartbeat를 감시한다.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import tls from "node:tls";
import { readRegistry } from "../lib/registry.mjs";

function option(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

export function freshnessState(value, now = new Date(), staleAfterHours = 48) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return { status: "missing", ageHours: null };
  const ageHours = (now.getTime() - timestamp) / 3_600_000;
  return { status: ageHours >= staleAfterHours ? "stale" : "fresh", ageHours };
}

// 런타임 데이터 API의 검증 시각 헤더로 갱신 파이프라인 생존을 판정한다 (missed-run heartbeat).
export function dataProbeState(verifiedAtHeader, now = new Date(), maxAgeHours = 6) {
  return freshnessState(verifiedAtHeader ?? "", now, maxAgeHours);
}

// TLS 인증서 잔여일 — 만료 전에 미리 경고한다 (자동 갱신 실패 조기 감지).
export function certExpiryDays(validTo, now = new Date()) {
  const expires = Date.parse(validTo);
  if (!Number.isFinite(expires)) return null;
  return (expires - now.getTime()) / 86_400_000;
}

async function fetchCertValidTo(host, timeout = 15_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      cert?.valid_to ? resolvePromise(cert.valid_to) : rejectPromise(new Error("인증서 정보를 읽지 못했습니다."));
    });
    socket.on("timeout", () => { socket.destroy(); rejectPromise(new Error("TLS 연결 시간 초과")); });
    socket.on("error", rejectPromise);
  });
}

async function inspectTlsCertificates(hosts, now) {
  const results = [];
  for (const host of hosts) {
    try {
      const validTo = await fetchCertValidTo(host);
      const days = certExpiryDays(validTo, now);
      const status = days === null ? "FAIL" : days < 10 ? "FAIL" : days < 21 ? "STALE" : "PASS";
      results.push({ host, status, daysLeft: days === null ? null : Math.floor(days), validTo });
    } catch (error) {
      // 조회 실패는 만료 임박과 구분해 경고로만 남긴다(네트워크 요인 오탐 방지).
      results.push({ host, status: "STALE", daysLeft: null, detail: String(error instanceof Error ? error.message : error) });
    }
  }
  return results;
}

export function extractAssetUrls(html, baseUrl) {
  const urls = new Set();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"'#]+)["'][^>]*>/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === new URL(baseUrl).origin && /\.(?:js|css)(?:$|\?)/.test(url.pathname + url.search)) urls.add(url.href);
    } catch {
      // 잘못된 선택 자산은 운영 HTML 검사에서 제외한다.
    }
  }
  return [...urls];
}

async function fetchText(url, timeout = 20_000) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "text/html,application/json,text/javascript,*/*", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function collectSurfaceText(app) {
  const html = await fetchText(app.healthcheck_url);
  const parts = [html];
  const queue = extractAssetUrls(html, app.web_url).slice(0, 24);
  const seen = new Set();
  while (queue.length && seen.size < 40) {
    const asset = queue.shift();
    if (!asset || seen.has(asset)) continue;
    seen.add(asset);
    try {
      const source = await fetchText(asset);
      if (source.length <= 4_000_000) {
        parts.push(source);
        if (/\.js(?:$|\?)/.test(asset)) {
          for (const match of source.matchAll(/[A-Za-z0-9_-]{6,}\.js/g)) {
            const nested = new URL(match[0], asset).href;
            if (new URL(nested).origin === new URL(app.web_url).origin && !seen.has(nested)) queue.push(nested);
          }
        }
      }
    } catch {
      // 개별 비핵심 자산 실패는 manifest·service worker·marker 검사와 분리한다.
    }
  }
  return { html, combined: parts.join("\n"), assetCount: seen.size };
}

async function inspectApp(app, now) {
  const errors = [];
  const warnings = [];
  let surface;
  try {
    surface = await collectSurfaceText(app);
  } catch (error) {
    return {
      id: app.id,
      status: "FAIL",
      errors: [`운영 화면 응답 실패: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }

  let manifest = "";
  let serviceWorker = "";
  try {
    manifest = await fetchText(new URL("manifest.webmanifest", app.web_url));
    JSON.parse(manifest);
  } catch (error) {
    errors.push(`manifest 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    serviceWorker = await fetchText(new URL("sw.js", app.web_url));
    if (!/(?:cache|workbox|serviceWorker)/i.test(serviceWorker)) errors.push("service worker에 cache 동작이 보이지 않습니다.");
  } catch (error) {
    errors.push(`service worker 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const sourceMetadata = JSON.parse(await fetchText(app.version_source));
    if (sourceMetadata.version !== app.version) {
      errors.push(`registry ${app.version}과 main version ${sourceMetadata.version}이 다릅니다.`);
    }
  } catch (error) {
    errors.push(`main version 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!surface.combined.includes(app.version) && !manifest.includes(app.version) && !serviceWorker.includes(app.version)) {
    errors.push(`운영 자산에서 버전 ${app.version}을 찾지 못했습니다.`);
  }
  const shortSha = app.last_deployed_sha?.slice(0, 7);
  if (shortSha && !surface.combined.includes(shortSha)) errors.push(`운영 자산에서 build marker ${shortSha}를 찾지 못했습니다.`);

  const verified = freshnessState(app.last_verified_at, now, Number(app.freshness_slo_hours ?? 48));
  if (verified.status !== "fresh") warnings.push(`중앙 확인 시각이 ${Math.round(verified.ageHours ?? 0)}시간 지났습니다.`);
  if (!["runtime", "local-only"].includes(app.freshness_status)) {
    const dataFreshness = freshnessState(app.last_data_sync_at, now, Number(app.freshness_slo_hours ?? 48));
    if (dataFreshness.status !== "fresh") {
      errors.push(`데이터 동기화가 SLO를 넘겼습니다: ${Math.round(dataFreshness.ageHours ?? 0)}시간`);
    }
  }

  // 런타임 데이터 갱신 파이프라인 heartbeat: registry에 probe URL이 선언된 앱만 검사한다.
  if (app.data_probe_url) {
    const maxAge = Number(app.data_probe_max_age_hours ?? 6);
    const headerName = app.data_probe_verified_header ?? "x-verified-at";
    try {
      const response = await fetch(app.data_probe_url, {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const probe = dataProbeState(response.headers.get(headerName), now, maxAge);
      if (probe.status !== "fresh") {
        errors.push(`데이터 probe(${headerName})가 신선하지 않습니다: ${probe.status === "missing" ? "헤더 없음" : `${Math.round(probe.ageHours ?? 0)}시간 경과 (기준 ${maxAge}시간)`}`);
      }
    } catch (error) {
      errors.push(`데이터 probe 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    id: app.id,
    status: errors.length ? "FAIL" : warnings.length ? "STALE" : "PASS",
    errors,
    warnings,
    assetCount: surface.assetCount,
    version: app.version,
    deployedSha: app.last_deployed_sha,
  };
}

async function inspectCertbomSourceWorkflow(now) {
  const workflowUrl = "https://api.github.com/repos/robom-labs/certbom/actions/workflows/source-operations.yml/runs?status=success&per_page=1";
  try {
    const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(workflowUrl, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const run = payload.workflow_runs?.[0];
    if (!run) return { status: "BLOCKED_EXTERNAL", detail: "source workflow 성공 기록이 아직 없습니다." };
    const heartbeat = freshnessState(run.updated_at, now, 36);
    return {
      status: heartbeat.status === "fresh" ? "PASS" : "FAIL",
      detail: `${run.updated_at} · ${run.html_url}`,
      ageHours: heartbeat.ageHours,
    };
  } catch (error) {
    return {
      status: "BLOCKED_EXTERNAL",
      detail: `source workflow 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main() {
  const now = option("now") ? new Date(option("now")) : new Date();
  const root = resolve(import.meta.dirname, "../../..");
  const apps = await readRegistry();
  const siteMetadata = JSON.parse(await readFile(resolve(root, "site/package.json"), "utf8"));
  let currentSha = process.env.GITHUB_SHA ?? "";
  if (!currentSha) {
    try {
      currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    } catch {
      currentSha = "";
    }
  }
  const results = [await inspectApp({
    id: "robom",
    version: siteMetadata.version,
    version_source: "https://raw.githubusercontent.com/robom-labs/robom/main/site/package.json",
    web_url: "https://robom.kr/",
    healthcheck_url: "https://robom.kr/",
    last_deployed_sha: currentSha,
    last_verified_at: now.toISOString(),
    last_data_sync_at: now.toISOString(),
    freshness_status: "runtime",
    freshness_slo_hours: 48,
  }, now)];
  for (const app of apps) results.push(await inspectApp(app, now));
  const sourceWorkflow = await inspectCertbomSourceWorkflow(now);
  const tlsCertificates = await inspectTlsCertificates(["robom.kr", "certbom.vercel.app", "robom-labs.github.io"], now);
  const failures = results.filter((result) => result.status === "FAIL");
  const tlsFailures = tlsCertificates.filter((cert) => cert.status === "FAIL");
  const report = {
    checkedAt: now.toISOString(),
    status: failures.length || sourceWorkflow.status === "FAIL" || tlsFailures.length ? "FAIL" : "PASS",
    apps: results,
    certbomSourceWorkflow: sourceWorkflow,
    tlsCertificates,
  };
  const output = option("output");
  if (output) await writeFile(resolve(process.cwd(), output), `${JSON.stringify(report, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = results.map((result) => `| ${result.id} | ${result.status} | ${[...result.errors, ...result.warnings].join("; ") || "정상"} |`);
    await writeFile(process.env.GITHUB_STEP_SUMMARY, [
      "## 로봄 패밀리 운영 watchdog",
      "",
      "| 제품 | 상태 | 근거 |",
      "|---|---|---|",
      ...table,
      "",
      `자격증봄 source workflow: ${sourceWorkflow.status} · ${sourceWorkflow.detail}`,
      "",
      ...tlsCertificates.map((cert) => `TLS ${cert.host}: ${cert.status}${cert.daysLeft === null ? "" : ` · 잔여 ${cert.daysLeft}일`}${cert.detail ? ` · ${cert.detail}` : ""}`),
      "",
    ].join("\n"), { flag: "a" });
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
