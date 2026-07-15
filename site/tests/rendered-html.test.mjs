// 배포 결과의 패밀리 허브, 안정 경로, 정책과 운영 레지스트리 정합성을 검증한다.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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

function metaContent(html, attribute, value) {
  const escaped = escapeRegExp(value);
  const match = html.match(new RegExp(`<meta[^>]*${attribute}="${escaped}"[^>]*content="([^"]*)"[^>]*>`));
  return match?.[1];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("server-renders the Robom family hub", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>로봄 \| 날씨·청약·러닝·달력·자격증, 놓치기 전에<\/title>/);
  assert.equal(metaContent(html, "name", "description"), "날씨, 청약, 러닝 대회, 가족 일정, 자격증 시험 준비를 한곳에서 확인하세요. 야외봄·청약봄·러닝봄·캘린더봄·자격증봄으로 바로 연결됩니다.");
  assert.match(html, /<link rel="canonical" href="https:\/\/robom\.kr\/"\/>/);
  assert.equal(metaContent(html, "property", "og:site_name"), "로봄");
  assert.equal(metaContent(html, "property", "og:title"), "로봄 | 날씨·청약·러닝·달력·자격증, 놓치기 전에");
  assert.equal(metaContent(html, "name", "twitter:title"), "로봄 | 날씨·청약·러닝·달력·자격증, 놓치기 전에");
  const faviconLinks = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((link) => /rel="icon"|rel="apple-touch-icon"/.test(link))
    .filter((link) => /favicon\.ico|favicon-48\.png|favicon-96\.png|icons\/robom\.svg|icons\/robom-180\.png/.test(link));
  assert.deepEqual(faviconLinks.map((link) => link.match(/href="([^"]+)"/)?.[1]?.replace("https://robom.kr/", "")), [
    "favicon.ico", "favicon-48.png", "favicon-96.png", "icons/robom.svg", "icons/robom-180.png",
  ]);
  assert.match(html, /날씨·청약·러닝·달력·자격증,<br\/><em>중요한 순간을 놓치기 전에\.<\/em>/);
  assert.match(html, /자격증봄은 시험 준비를 챙깁니다\./);
  assert.match(html, /오늘 필요한 앱을 골라 바로 확인하세요\./);
  assert.match(html, /오늘 나가기 좋은 시간/);
  assert.match(html, /이번 달 접수 일정/);
  assert.match(html, /곧 열리는 대회 접수/);
  assert.match(html, /우리 가족 일정 알람/);
  assert.match(html, /공식 시험 일정과 준비물/);
  assert.match(html, /야외봄/);
  assert.match(html, /청약봄/);
  assert.match(html, /러닝봄/);
  assert.match(html, /캘린더봄/);
  assert.match(html, /자격증봄/);
  assert.match(html, /다섯 앱 운영 중/);
  assert.match(html, /현재 비활성/);
  assert.match(html, /\/apps\/outbom/);
  assert.match(html, /\/apps\/homebom/);
  assert.match(html, /\/apps\/runningbom/);
  assert.match(html, /\/apps\/calendarbom/);
  assert.match(html, /\/apps\/certbom/);
  assert.match(html, /hello\.robom@gmail\.com/);
  assert.match(html, /본문 바로가기/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /href="https:\/\/robom-labs\.github\.io\/outbom\/"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/robom-labs\.github\.io\/homebom\/"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/robom-labs\.github\.io\/runningbom\/"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/robom-labs\.github\.io\/robom\/calendarbom\/"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/certbom\.vercel\.app\/"[^>]*target="_blank"/);
  assert.doesNotMatch(html, /runnerpyrri-lgtm\.github\.io\/(zoopzoopcall|pushrun)/);
  assert.doesNotMatch(html, /러닝콜|줍줍콜|PushRun/);

  const blocks = jsonLdBlocks(html);
  const organization = blocks.find((block) => block["@type"] === "Organization");
  const website = blocks.find((block) => block["@type"] === "WebSite");
  assert.equal(blocks.filter((block) => block["@type"] === "WebSite").length, 1);
  assert.deepEqual(website, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://robom.kr/#website",
    url: "https://robom.kr/",
    name: "로봄",
    alternateName: ["ROBOM", "robom.kr"],
    inLanguage: "ko-KR",
    publisher: { "@id": "https://robom.kr/#organization" },
  });
  assert.deepEqual(organization.logo, { "@type": "ImageObject", url: "https://robom.kr/icons/robom-512.png", width: 512, height: 512 });
});

test("serves stable app, support, policy and license routes", async () => {
  const routes = [
    ["/apps/outbom", "야외봄 | 오늘 나가기 좋은 시간과 날씨", "걷기·러닝·등산·자전거에 좋은 시간과 비·바람·대기질, 준비물을 오늘과 내일 예보로 확인하세요."],
    ["/apps/homebom", "청약봄 | 특별공급·1순위·무순위 청약 일정", "특별공급·1순위·2순위·무순위·재공급의 접수와 발표·계약 일정을 달력과 알림으로 확인하세요."],
    ["/apps/runningbom", "러닝봄 | 마라톤 대회 접수 일정과 알림", "전국 마라톤·러닝 대회를 지역과 거리로 찾고, 공식 접수 일정과 시작 알림을 확인하세요."],
    ["/apps/calendarbom", "캘린더봄 | 큰 달력과 쉬운 알람", "큰 월간 달력에서 날짜를 누르고, 키보드 없이 버튼만으로 병원·약·가족 일정을 알람으로 챙기세요."],
    ["/apps/certbom", "자격증봄 | 자격증 시험 일정·준비물·추천", "공식 출처로 자격증 시험 일정과 준비물을 확인하고, 질문 5개로 내게 맞는 시험 3개와 추천 이유를 받아보세요."],
    ["/support", "고객 지원"],
    ["/privacy", "개인정보처리방침"],
    ["/privacy/outbom", "야외봄 개인정보처리방침"],
    ["/privacy/homebom", "청약봄 개인정보처리방침"],
    ["/privacy/runningbom", "러닝봄 개인정보처리방침"],
    ["/privacy/calendarbom", "캘린더봄 개인정보처리방침"],
    ["/privacy/certbom", "자격증봄 개인정보처리방침"],
    ["/terms", "이용약관"],
    ["/licenses", "오픈소스 라이선스"],
    ["/open-source", "오픈소스 라이선스"],
  ];

  for (const [path, copy, description] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, new RegExp(escapeRegExp(copy)), path);
    if (!description) continue;
    assert.match(html, new RegExp(`<title>${escapeRegExp(copy)}<\\/title>`), path);
    assert.equal(metaContent(html, "name", "description"), description, path);
    assert.match(html, /<nav class="breadcrumb" aria-label="현재 위치">/, path);
    assert.equal(jsonLdBlocks(html).filter((block) => block["@type"] === "BreadcrumbList").length, 1, path);
  }
});

test("keeps registry URLs and versions aligned with rendered data", async () => {
  const [registry, appData] = await Promise.all([
    readFile(new URL("../../ops/registry/apps.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/app-data.ts", import.meta.url), "utf8"),
  ]);

  for (const value of [
    "0.24.0",
    "0.12.0",
    "0.16.0",
    "0.3.0",
    "0.4.1",
    "https://robom-labs.github.io/outbom/",
    "https://robom-labs.github.io/homebom/",
    "https://robom-labs.github.io/runningbom/",
    "https://robom-labs.github.io/robom/calendarbom/",
    "https://certbom.vercel.app/",
  ]) {
    assert.match(registry, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(appData, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("keeps branding, accessibility, favicon and hosting assets in place", async () => {
  const [page, layout, css, packageJson, favicon48, favicon96, faviconIco, faviconScript] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/favicon-48.png", import.meta.url)),
    readFile(new URL("../public/favicon-96.png", import.meta.url)),
    readFile(new URL("../public/favicon.ico", import.meta.url)),
    readFile(new URL("../scripts/generate-brand-favicons.mjs", import.meta.url), "utf8"),
  ]);

  await Promise.all([
    "../public/og.png", "../public/favicon.svg", "../public/favicon.ico", "../public/favicon-48.png", "../public/favicon-96.png",
    "../public/icons/robom.svg", "../public/icons/robom-192.png", "../public/icons/robom-512.png", "../public/manifest.webmanifest",
    "../public/robots.txt", "../public/sitemap.xml", "../public/icons/outbom.svg", "../public/icons/homebom.svg",
    "../public/icons/runningbom.svg", "../public/icons/calendarbom.svg", "../public/icons/certbom.svg", "../public/brand/bom-robom.svg",
    "../public/brand/bom-calendarbom.svg", "../public/brand/bom-certbom.svg", "../../apps/calendarbom/app/index.html", "../.openai/hosting.json",
  ].map((path) => access(new URL(path, import.meta.url))));

  assert.match(page, /function Home/);
  assert.match(layout, /metadataBase:\s*new URL\("https:\/\/robom\.kr"\)/);
  assert.match(layout, /siteName:\s*"로봄"/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /width:\s*1200/);
  assert.match(layout, /height:\s*630/);
  assert.match(css, /a:focus-visible/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /max-height:\s*640px/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /font-weight:\s*900/);
  assert.match(css, /letter-spacing:\s*-0\.04em/);
  assert.match(css, /height:\s*1\.18em/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /"version": "2\.0\.0"/);
  assert.deepEqual(pngDimensions(favicon48), { width: 48, height: 48 });
  assert.deepEqual(pngDimensions(favicon96), { width: 96, height: 96 });
  assert.equal(faviconIco.readUInt16LE(2), 1);
  assert.equal(faviconIco.readUInt16LE(4), 2);
  assert.deepEqual([faviconIco[6], faviconIco[22]], [32, 48]);
  assert.match(faviconScript, /ROBOM_FAVICON_PREVIEW_DIR/);
  assert.doesNotMatch(faviconScript, /sharp/);
  assert.doesNotMatch(await readFile(new URL("../app/components.tsx", import.meta.url), "utf8"), /next\/image/);
});

test("prerenders subpath-safe links and PWA assets for the Pages preview", async () => {
  const [script, manifest] = await Promise.all([
    readFile(new URL("../scripts/prerender-static.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);

  assert.match(script, /replaceAll\('href="\//);
  assert.match(script, /replaceAll\('src="\//);
  assert.match(script, /modulepreload/);
  assert.match(script, /application\\\/ld\\\+json/);
  assert.match(script, /"\/apps\/certbom"/);
  assert.match(script, /"\/privacy\/certbom"/);
  assert.equal(JSON.parse(manifest).start_url, "./");
  assert.equal(JSON.parse(manifest).scope, "./");
});
