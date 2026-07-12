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

test("server-renders the Robom family hub", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>중요한 순간을 먼저 봅니다 \| 로봄<\/title>/);
  assert.match(html, /야외봄/);
  assert.match(html, /청약봄/);
  assert.match(html, /러닝봄/);
  assert.match(html, /세 앱 운영 중/);
  assert.match(html, /현재 비활성/);
  assert.match(html, /\/apps\/outbom/);
  assert.match(html, /\/apps\/homebom/);
  assert.match(html, /\/apps\/runningbom/);
  assert.match(html, /hello\.robom@gmail\.com/);
  assert.match(html, /href="https:\/\/runningcall\.vercel\.app"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/robom-labs\.github\.io\/homebom\/"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/robom-labs\.github\.io\/runningbom\/"[^>]*target="_blank"/);
  assert.doesNotMatch(html, /runnerpyrri-lgtm\.github\.io\/(zoopzoopcall|pushrun)/);
  assert.doesNotMatch(html, /러닝콜|줍줍콜|PushRun/);
});

test("serves stable app, support, policy and license routes", async () => {
  const routes = [
    ["/apps/outbom", "나가기 좋은 시간을 먼저 봅니다"],
    ["/apps/homebom", "접수 시작과 마감을 놓치지 않게"],
    ["/apps/runningbom", "대회 접수가 열리기 전에 준비합니다"],
    ["/support", "무엇을 도와드릴까요"],
    ["/privacy", "개인정보처리방침"],
    ["/terms", "이용약관"],
    ["/licenses", "오픈소스 라이선스"],
    ["/open-source", "오픈소스 라이선스"],
  ];

  for (const [path, copy] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(copy), path);
  }
});

test("keeps registry URLs and versions aligned with rendered data", async () => {
  const [registry, appData] = await Promise.all([
    readFile(new URL("../../ops/registry/apps.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/app-data.ts", import.meta.url), "utf8"),
  ]);

  for (const value of [
    "0.14.0",
    "0.2.0",
    "0.7.0",
    "https://runningcall.vercel.app",
    "https://robom-labs.github.io/homebom/",
    "https://robom-labs.github.io/runningbom/",
  ]) {
    assert.match(registry, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(appData, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("keeps branding, accessibility and hosting assets in place", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/favicon.svg", import.meta.url)),
    access(new URL("../public/icons/robom.svg", import.meta.url)),
    access(new URL("../public/icons/outbom.svg", import.meta.url)),
    access(new URL("../public/icons/homebom.svg", import.meta.url)),
    access(new URL("../public/icons/runningbom.svg", import.meta.url)),
    access(new URL("../public/brand/bom-robom.svg", import.meta.url)),
    access(new URL("../.openai/hosting.json", import.meta.url)),
  ]);

  assert.match(page, /function Home/);
  assert.match(layout, /metadataBase:\s*new URL\("https:\/\/robom\.kr"\)/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /a:focus-visible/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
