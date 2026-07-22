// 출시 준비(QR-only) 허브의 렌더 결과, registry 생성물, 접근성, 제거된 경로를 검증한다.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { parseRegistry } from "../../ops/scripts/lib/registry.mjs";

const ACTIVE_IDS = ["outbom", "homebom", "runningbom", "certbom"];

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

// 하이드레이션 RSC payload 스크립트는 화면 문자열을 중복 포함하므로, ld+json 외 스크립트를 제거한 뒤 센다.
function visibleHtml(html) {
  return html.replace(/<script(?![^>]*type="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/g, "");
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function registryApps() {
  return parseRegistry(await readFile(new URL("../../ops/registry/apps.yml", import.meta.url), "utf8"));
}

test("registry ID 집합은 정확히 4개 활성 앱이다", async () => {
  const apps = await registryApps();
  assert.deepEqual(apps.map(({ id }) => id), ACTIVE_IDS);
});

test("첫 화면은 출시 준비 중인 4개 앱을 QR로만 안내한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>로봄 \| 4개 앱 출시 예정<\/title>/);
  assert.match(html, /곧 출시됩니다/);
  assert.match(html, /본문 바로가기/);
  assert.match(html, /data-build-sha="[^"]+"/);

  // 정확히 4개 QR 이미지 참조와, "준비 중"·"2026년 8월 초 출시 예정" 각각 4회
  const visible = visibleHtml(html);
  assert.equal(countOccurrences(visible, 'src="/install/qr/'), 4);
  assert.equal(countOccurrences(visible, "준비 중"), 4);
  assert.equal(countOccurrences(visible, "2026년 8월 초 출시 예정"), 4);

  // 각 앱의 QR과 공식 주소 텍스트가 노출된다
  for (const id of ACTIVE_IDS) {
    assert.match(html, new RegExp(`/install/qr/${id}\\.svg`), id);
    assert.match(html, new RegExp(`robom\\.kr/get/${id}`), id);
  }

  // 웹 진입·미리보기·설치 CTA·운영 중 문구는 모두 사라진다
  for (const forbidden of ["미리보기", "설치·휴대폰 사용", "운영 중", "웹으로 열기", "홈 화면에 추가"]) {
    assert.doesNotMatch(html, new RegExp(forbidden), forbidden);
  }
  // 앱 웹 경험으로 들어가는 링크(github.io / vercel webUrl)는 없다
  assert.doesNotMatch(html, /href="[^"]*(?:github\.io|vercel\.app)[^"]*"/);

  const nodes = jsonLdNodes(html);
  assert.equal(nodes.filter((node) => node["@type"] === "WebSite").length, 1);
  assert.equal(nodes.find((node) => node["@type"] === "Organization").name, "로봄");
  assert.equal(nodes.filter((node) => node["@type"] === "ItemList").length, 1);
  assert.equal(nodes.filter((node) => node["@type"] === "SoftwareApplication").length, 0);
});

test("미리보기(/apps) 경로는 완전히 제거되어 404다", async () => {
  for (const id of ACTIVE_IDS) {
    assert.equal((await render(`/apps/${id}`)).status, 404, `apps/${id}`);
  }
  // 알 수 없는 id는 /get·/apps 모두 404
  assert.equal((await render("/get/zzznope")).status, 404, "get/zzznope");
  assert.equal((await render("/apps/zzznope")).status, 404, "apps/zzznope");
});

test("설치 안내 페이지는 QR·준비 중 안내·공식 주소만 제공한다", async () => {
  for (const { id, name } of await registryApps()) {
    const installResponse = await render(`/get/${id}`);
    assert.equal(installResponse.status, 200, `get/${id}`);
    const html = await installResponse.text();
    assert.match(html, new RegExp(`<title>${name} 설치 \\| 로봄<\\/title>`));
    assert.match(html, new RegExp(`robom\\.kr/get/${id}`));
    assert.match(html, new RegExp(`/install/qr/${id}\\.svg`));
    assert.match(html, /준비 중/);
    assert.match(html, /2026년 8월 초 출시 예정/);
    assert.match(html, /스토어 출시 후 이 QR에서 설치할 수 있습니다/);
    assert.match(html, /로봄 홈으로/);
    // 스토어·PWA·웹 사용·미리보기·자동 이동은 모두 제거
    for (const forbidden of ["Safari에서", "홈 화면에 추가", "화면 미리보기", "Google Play", "App Store", "웹으로"]) {
      assert.doesNotMatch(html, new RegExp(forbidden), `${id}: ${forbidden}`);
    }
    // 출시 전이므로 SoftwareApplication 구조화 데이터를 내지 않는다
    assert.doesNotMatch(html, /SoftwareApplication/, `${id}: SoftwareApplication`);
    const nodes = jsonLdNodes(html);
    assert.equal(nodes.filter((node) => node["@type"] === "SoftwareApplication").length, 0);
    assert.equal(nodes.filter((node) => node["@type"] === "BreadcrumbList").length, 1);
    assert.doesNotMatch(JSON.stringify(nodes), /operatingSystem|installUrl|"offers"|aggregateRating|review|FAQPage/);
  }
});

test("공개 검색 경로는 고유 title·description·canonical과 registry 기반 sitemap을 유지한다", async () => {
  const apps = await registryApps();
  const routes = [
    ["/", "/"],
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
    const html = await response.text();
    const meta = metadataOf(html);
    assert.ok(meta.title, `${path}: title`);
    assert.ok(meta.description, `${path}: description`);
    assert.equal(meta.canonical, `https://robom.kr${canonicalPath}`, `${path}: canonical`);
    assert.ok(!seenTitles.has(meta.title), `${path}: duplicate title ${meta.title}`);
    assert.ok(!seenDescriptions.has(meta.description), `${path}: duplicate description`);
    seenTitles.add(meta.title);
    seenDescriptions.add(meta.description);
    // /apps 경로로의 내부 링크가 어디에도 남아있지 않다
    assert.doesNotMatch(html, /href="[^"]*\/apps\/[^"]*"/, `${path}: /apps 링크 잔존`);
  }

  const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(sitemapUrls, routes.map(([, canonicalPath]) => `https://robom.kr${canonicalPath}`));
  assert.doesNotMatch(sitemap, /\/apps\//);
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

test("지원·정책·라이선스 경로를 유지한다", async () => {
  const routes = [
    ["/support", "고객 지원"], ["/privacy", "개인정보처리방침"], ["/privacy/outbom", "야외봄 개인정보처리방침"],
    ["/privacy/homebom", "청약봄 개인정보처리방침"], ["/privacy/runningbom", "러닝봄 개인정보처리방침"],
    ["/privacy/certbom", "자격증봄 개인정보처리방침"],
    ["/terms", "이용약관"], ["/licenses", "오픈소스 라이선스"], ["/open-source", "오픈소스 라이선스"],
    ["/auth/callback", "계정 없이도"],
  ];
  for (const [path, copy] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(copy), path);
  }
  assert.match(await (await render("/licenses")).text(), /github\.com\/robom-labs\/certbom/);
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

test("QR·워드마크·아이콘 자산과 모바일 접근성 계약이 존재하며 PWA 설치는 꺼져 있다", async () => {
  const apps = await registryApps();
  const [css, packageJson, versionSource, serviceWorker, layoutSource, cleanupSource, favicon48, favicon96, faviconIco] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../VERSION", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PwaRegistration.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/favicon-48.png", import.meta.url)),
    readFile(new URL("../public/favicon-96.png", import.meta.url)),
    readFile(new URL("../public/favicon.ico", import.meta.url)),
  ]);
  await Promise.all([
    "../public/og.png", "../public/icons/robom-192.png", "../public/icons/robom-512.png", "../public/family/icons.svg",
    "../public/brand/bom-outbom.svg", "../public/brand/bom-homebom.svg", "../public/brand/bom-runningbom.svg",
    "../public/brand/bom-certbom.svg",
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
  assert.match(packageJson, /"qrcode": "1\.5\.4"/);
  // 허브 PWA OFF: manifest 링크가 없고, 서비스워커를 등록하지 않으며 기존 것을 정리만 한다.
  assert.doesNotMatch(layoutSource, /rel="manifest"/);
  assert.match(layoutSource, /PwaCleanup/);
  assert.doesNotMatch(cleanupSource, /serviceWorker\.register\b/);
  assert.match(cleanupSource, /unregister\(\)/);
  assert.match(cleanupSource, /robom-site-v/);
  // sw.js는 스스로를 해제하고 허브 캐시만 비운다(self-destroying).
  assert.match(serviceWorker, /self\.registration\.unregister\(\)/);
  assert.match(serviceWorker, /robom-site-v/);
  assert.deepEqual(pngDimensions(favicon48), { width: 48, height: 48 });
  assert.deepEqual(pngDimensions(favicon96), { width: 96, height: 96 });
  assert.equal(faviconIco.readUInt16LE(2), 1);
});

test("Pages 프리렌더에는 홈·설치·정책이 포함되고 미리보기 경로는 없다", async () => {
  const script = await readFile(new URL("../scripts/prerender-static.mjs", import.meta.url), "utf8");
  assert.match(script, /public\/family\/apps\.json/);
  assert.match(script, /appIds\.map\(\(id\) => `\/get\/\$\{id\}`\)/);
  assert.doesNotMatch(script, /\/apps\/\$\{id\}/);
  assert.match(script, /replaceAll\('href="\//);
  assert.match(script, /application\\\/ld\\\+json/);
  assert.match(script, /CNAME/);
  assert.match(script, /nojekyll/);
  assert.match(script, /sw\.js/);
});

test("분석 adapter는 기본 OFF이며 금지 필드와 비밀을 scrub한다", async () => {
  const source = await readFile(new URL("../app/family-analytics.ts", import.meta.url), "utf8");
  assert.match(source, /NEXT_PUBLIC_FAMILY_ANALYTICS_ENDPOINT/);
  assert.match(source, /if \(!ENDPOINT \|\| !this\.consented\(\)\) return/);
  for (const forbidden of ["latitude", "longitude", "address", "token", "medicine", "hospital", "raw_query"]) assert.match(source, new RegExp(forbidden));
  assert.match(source, /credentials: "omit"/);
});
