// 배포 결과에 로봄 브랜드와 세 앱 연결이 정확히 렌더링되는지 검증한다.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://robom.kr/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished Robom signal hub", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>중요한 순간을 먼저 봅니다 \| 로봄<\/title>/);
  assert.match(html, /로봄/);
  assert.match(html, /robom/);
  assert.match(html, /한쪽 둥근 안경을 쓰고 손을 흔드는 흰색 로봄 캐릭터/);
  assert.match(html, /https:\/\/runningcall\.vercel\.app/);
  assert.match(html, /https:\/\/runnerpyrri-lgtm\.github\.io\/zoopzoopcall\//);
  assert.match(html, /https:\/\/runnerpyrri-lgtm\.github\.io\/pushrun\//);
  assert.match(html, /https:\/\/robom\.kr\/og\.png/);
  assert.match(html, /twitter:card/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps production branding and accessibility assets in place", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/robom-mascot.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/favicon.png", import.meta.url)),
  ]);

  assert.match(page, /function BrandLockup/);
  assert.match(page, /src="\/robom-mascot\.png"/);
  assert.match(layout, /metadataBase:\s*new URL\("https:\/\/robom\.kr"\)/);
  assert.match(layout, /summary_large_image/);
  assert.match(css, /a:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});
