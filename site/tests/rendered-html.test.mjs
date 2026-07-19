// 빌드된 허브의 동적 앱 설치 전환·registry 생성물·접근성·이전 경로를 검증한다.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { parseRegistry } from "../../ops/scripts/lib/registry.mjs";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://robom.kr${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function jsonLdNodes(html) {
  return jsonLdBlocks(html).flatMap((block) => block["@graph"] ?? [block]);
}

function metadataOf(html) {
  return {
    title: html.match(/<title>([^<]+)<\/title>/)?.[1],
    description: html.match(/<meta name="description" content="([^"]+)"/)?.[1],
    canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1],
  };
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function registryApps() {
  return parseRegistry(await readFile(new URL("../../ops/registry/apps.yml", import.meta.url), "utf8"));
}

test("첫 화면은 회사 소개보다 등록된 앱 설치 선택을 먼저 제공한다", async () => {
  const apps = await registryApps();
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>로봄 \| 날씨·청약·러닝·달력·자격증·음성 메모<\/title>/);
  assert.match(html, /로봄 앱으로 오늘 필요한 정보를 고르고/);
  assert.ok((html.match(/설치·휴대폰 사용/g) ?? []).length >= apps.length * 2);
  for (const app of apps) {
    assert.match(html, new RegExp(`href="https://robom.kr/get/${app.id}"|href="/get/${app.id}"`), app.id);
    assert.match(html, new RegExp(app.name));
  }
  assert.doesNotMatch(html, /광고 준비 중|광고 영역 비활성|현재 비활성/);
  assert.doesNotMatch(html, /runningcall\.vercel\.app|robom\/calendarbom\/"[^>]*target="_blank"/);
  assert.match(html, /data-build-sha="[^"]+"/);
  assert.match(html, /본문 바로가기/);
  const nodes = jsonLdNodes(html);
  assert.equal(nodes.filter((node) => node["@type"] === "WebSite").length, 1);
  assert.equal(nodes.find((node) => node["@type"] === "Organization").name, "로봄");
});

test("등록된 앱 소개와 안정 설치 경로를 모두 서버 렌더링한다", async () => {
  for (const { id, name } of await registryApps()) {
    const appResponse = await render(`/apps/${id}`);
    assert.equal(appResponse.status, 200, `apps/${id}`);
    const appHtml = await appResponse.text();
    assert.match(appHtml, new RegExp(name));
    assert.match(appHtml, new RegExp(`href="https://robom.kr/get/${id}"|href="/get/${id}"`));
    // 웹 체험 링크는 제거 — 보기 전용 미리보기 + QR 설치만 제공한다
    assert.match(appHtml, /화면 미리보기/);
    assert.match(appHtml, /id="app-preview"/);
    assert.doesNotMatch(appHtml, /웹으로 먼저 체험|웹 체험/);
    const appNodes = jsonLdNodes(appHtml);
    assert.equal(appNodes.filter((node) => node["@type"] === "SoftwareApplication").length, 1);
    assert.equal(appNodes.filter((node) => node["@type"] === "BreadcrumbList").length, 1);

    const installResponse = await render(`/get/${id}`);
    assert.equal(installResponse.status, 200, `get/${id}`);
    const installHtml = await installResponse.text();
    assert.match(installHtml, new RegExp(`<title>${name} 설치 \\| 로봄<\\/title>`));
    assert.match(installHtml, new RegExp(`https://robom.kr/get/${id}`));
    assert.match(installHtml, new RegExp(`/install/qr/${id}\\.svg`));
    assert.match(installHtml, /Google Play·App Store 앱은 출시 준비 중/);
    assert.match(installHtml, /화면 미리보기/);
    assert.doesNotMatch(installHtml, /웹으로 계속 사용/);
    const installNodes = jsonLdNodes(installHtml);
    const software = installNodes.find((node) => node["@type"] === "SoftwareApplication");
    assert.equal(installNodes.filter((node) => node["@type"] === "SoftwareApplication").length, 1);
    assert.equal(installNodes.filter((node) => node["@type"] === "BreadcrumbList").length, 1);
    assert.equal(software.operatingSystem, "Web");
    assert.equal(software.softwareVersion, (await registryApps()).find((item) => item.id === id).version);
    assert.equal(new Set(installNodes.map((node) => node["@id"]).filter(Boolean)).size, installNodes.filter((node) => node["@id"]).length);
    assert.doesNotMatch(JSON.stringify(installNodes), /aggregateRating|review|FAQPage/);
  }
});

test("공개 검색 경로는 고유 title·description·canonical과 registry 기반 sitemap을 유지한다", async () => {
  const apps = await registryApps();
  const routes = [
    ["/", "/"],
    ...apps.map(({ id }) => [`/apps/${id}`, `/apps/${id}`]),
    ...apps.map(({ id }) => [`/get/${id}`, `/get/${id}`]),
    ["/support", "/support"],
    ["/privacy", "/privacy"],
    ...apps.map(({ id }) => [`/privacy/${id}`, `/privacy/${id}`]),
    ["/terms", "/terms"],
    ["/licenses", "/licenses"],
  ];
  const seenTitles = new Set();
  const seenDescriptions = new Set();
  for (const [path, canonicalPath] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const meta = metadataOf(await response.text());
    assert.ok(meta.title, `${path}: title`);
    assert.ok(meta.description, `${path}: description`);
    assert.equal(meta.canonical, `https://robom.kr${canonicalPath}`, `${path}: canonical`);
    assert.ok(!seenTitles.has(meta.title), `${path}: duplicate title ${meta.title}`);
    assert.ok(!seenDescriptions.has(meta.description), `${path}: duplicate description`);
    seenTitles.add(meta.title);
    seenDescriptions.add(meta.description);
  }

  const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(sitemapUrls, routes.map(([, canonicalPath]) => `https://robom.kr${canonicalPath}`));
  assert.doesNotMatch(sitemap, /\/open-source|\/auth\/callback/);

  const openSourceMeta = metadataOf(await (await render("/open-source")).text());
  assert.equal(openSourceMeta.canonical, "https://robom.kr/licenses");
  const authHtml = await (await render("/auth/callback")).text();
  assert.match(authHtml, /<meta name="robots" content="noindex, nofollow"/);
});

test("네이버 소유확인과 검색엔진 접근 계약은 빌드 결과에 남는다", async () => {
  const home = await (await render("/")).text();
  assert.match(home, /<meta name="naver-site-verification" content="b035d46dc4cc69df1255fa027ad8e939179f8150"/);
  const googleVerification = await readFile(new URL("../public/googledadbb8e65c2a996b.html", import.meta.url), "utf8");
  assert.equal(googleVerification.trim(), "google-site-verification: googledadbb8e65c2a996b.html");
  const robots = await readFile(new URL("../public/robots.txt", import.meta.url), "utf8");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/robom\.kr\/sitemap\.xml/);
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["family:verify"], /sitemap:check/);
});

test("지원·정책·라이선스 경로와 캘린더봄 독립 저장소 링크를 유지한다", async () => {
  const routes = [
    ["/support", "고객 지원"], ["/privacy", "개인정보처리방침"], ["/privacy/outbom", "야외봄 개인정보처리방침"],
    ["/privacy/homebom", "청약봄 개인정보처리방침"], ["/privacy/runningbom", "러닝봄 개인정보처리방침"],
    ["/privacy/calendarbom", "캘린더봄 개인정보처리방침"], ["/privacy/certbom", "자격증봄 개인정보처리방침"],
    ["/privacy/notebom", "노트봄 개인정보처리방침"],
    ["/terms", "이용약관"], ["/licenses", "오픈소스 라이선스"], ["/open-source", "오픈소스 라이선스"],
    ["/auth/callback", "계정 없이도"],
  ];
  for (const [path, copy] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(copy), path);
  }
  assert.match(await (await render("/licenses")).text(), /github\.com\/robom-labs\/calendarbom/);
  const authScrubber = await readFile(new URL("../app/auth/callback/auth-query-scrubber.tsx", import.meta.url), "utf8");
  assert.match(authScrubber, /history\.replaceState/);
  assert.doesNotMatch(authScrubber, /URLSearchParams|get\(["']code/);
});

test("registry와 생성된 홈페이지 앱 메타데이터가 완전히 일치한다", async () => {
  const [registrySource, generatedSource, publicData] = await Promise.all([
    readFile(new URL("../../ops/registry/apps.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/generated-app-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/family/apps.json", import.meta.url), "utf8"),
  ]);
  const registry = parseRegistry(registrySource);
  const publicApps = JSON.parse(publicData).apps;
  assert.ok(registry.length > 0);
  assert.equal(publicApps.length, registry.length);
  for (const app of registry) {
    const generated = publicApps.find((item) => item.id === app.id);
    assert.equal(generated.version, app.version);
    assert.equal(generated.webUrl, app.web_url);
    assert.equal(generated.stableInstallUrl, `https://robom.kr/get/${app.id}`);
    assert.equal(generated.googlePlayStatus, "planned");
    assert.equal(generated.appStoreStatus, "planned");
    assert.match(generatedSource, new RegExp(app.version.replaceAll(".", "\\.")));
  }
});

test("QR·워드마크·아이콘·PWA 자산과 모바일 접근성 계약이 존재한다", async () => {
  const apps = await registryApps();
  const [css, packageJson, versionSource, manifestSource, serviceWorker, favicon48, favicon96, faviconIco] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../VERSION", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/favicon-48.png", import.meta.url)),
    readFile(new URL("../public/favicon-96.png", import.meta.url)),
    readFile(new URL("../public/favicon.ico", import.meta.url)),
  ]);
  await Promise.all([
    "../public/og.png", "../public/icons/robom-192.png", "../public/icons/robom-512.png", "../public/family/icons.svg",
    "../public/brand/bom-outbom.svg", "../public/brand/bom-homebom.svg", "../public/brand/bom-runningbom.svg",
    "../public/brand/bom-calendarbom.svg", "../public/brand/bom-certbom.svg", "../public/brand/bom-notebom.svg",
    "../public/icons/notebom.svg", "../legacy/calendarbom/index.html", "../legacy/calendarbom/sw.js",
    ...apps.flatMap(({ id }) => [`../public/install/qr/${id}.svg`, `../public/install/qr/${id}.png`]),
  ].map((path) => access(new URL(path, import.meta.url))));
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /quick-install-grid/);
  assert.match(css, /family-line-icon/);
  assert.doesNotMatch(css, /\.ad-placeholder/);
  const siteVersion = versionSource.trim();
  assert.equal(JSON.parse(packageJson).version, siteVersion);
  assert.match(serviceWorker, new RegExp(siteVersion.replaceAll(".", "\\.")));
  assert.match(packageJson, /"qrcode": "1\.5\.4"/);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.match(serviceWorker, /robom-site-v/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.deepEqual(pngDimensions(favicon48), { width: 48, height: 48 });
  assert.deepEqual(pngDimensions(favicon96), { width: 96, height: 96 });
  assert.equal(faviconIco.readUInt16LE(2), 1);
});

test("기존 캘린더봄 경로는 데이터에 손대지 않고 자기 구형 캐시만 정리한다", async () => {
  const [html, sw] = await Promise.all([
    readFile(new URL("../legacy/calendarbom/index.html", import.meta.url), "utf8"),
    readFile(new URL("../legacy/calendarbom/sw.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /https:\/\/robom-labs\.github\.io\/calendarbom\//);
  assert.match(html, /이 화면은 데이터를 읽거나 지우지 않습니다/);
  assert.doesNotMatch(html, /localStorage\.(removeItem|clear|setItem)/);
  assert.match(sw, /LEGACY_CACHE_PREFIX = "calendarbom-v"/);
  assert.match(sw, /key\.startsWith\(LEGACY_CACHE_PREFIX\)/);
  assert.doesNotMatch(sw, /key !== (BRIDGE_)?CACHE/);
  await assert.rejects(access(new URL("../../apps/calendarbom/package.json", import.meta.url)));
});

test("Pages 프리렌더에는 앱 소개·설치·정책과 legacy bridge가 모두 포함된다", async () => {
  const script = await readFile(new URL("../scripts/prerender-static.mjs", import.meta.url), "utf8");
  assert.match(script, /public\/family\/apps\.json/);
  assert.match(script, /appIds\.flatMap/);
  assert.match(script, /legacy", "calendarbom/);
  assert.match(script, /replaceAll\('href="\//);
  assert.match(script, /application\\\/ld\\\+json/);
});

test("분석 adapter는 기본 OFF이며 금지 필드와 비밀을 scrub한다", async () => {
  const source = await readFile(new URL("../app/family-analytics.ts", import.meta.url), "utf8");
  assert.match(source, /NEXT_PUBLIC_FAMILY_ANALYTICS_ENDPOINT/);
  assert.match(source, /if \(!ENDPOINT \|\| !this\.consented\(\)\) return/);
  for (const forbidden of ["latitude", "longitude", "address", "token", "medicine", "hospital", "raw_query"]) assert.match(source, new RegExp(forbidden));
  assert.match(source, /credentials: "omit"/);
});
