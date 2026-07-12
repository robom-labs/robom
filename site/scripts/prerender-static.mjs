// 빌드된 워커에서 홈페이지 HTML을 렌더해 GitHub Pages용 정적 사이트를 dist/static 에 만든다.
// - 자산 경로를 상대경로(./)로 바꿔 프로젝트 페이지(/robom/)와 커스텀 도메인(robom.kr) 양쪽에서 동작하게 한다.
// - 이 스크립트는 `npm run build` 이후에 실행해야 한다. (tests/rendered-html.test.mjs 와 같은 렌더 방식)
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url);
const staticDir = resolve(root.pathname, "dist", "static");

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("prerender", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://robom.kr${pathname}`, { headers: { accept: "text/html" } }),
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

// 홈 + 정책 페이지를 정적으로 렌더한다. 하위 경로는 자산 상대경로 깊이를 맞춘다.
const ROUTES = [
  { path: "/", out: "index.html", prefix: ".", marker: "app-home" },
  { path: "/privacy", out: "privacy/index.html", prefix: "..", marker: "개인정보처리방침" },
  { path: "/terms", out: "terms/index.html", prefix: "..", marker: "이용약관" },
];

await rm(staticDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await cp(resolve(root.pathname, "dist", "client"), staticDir, {
  recursive: true,
  filter: (src) => !src.includes("/.vite") && !src.endsWith("/.assetsignore") && !src.endsWith("/_headers"),
});

for (const route of ROUTES) {
  const response = await render(route.path);
  if (response.status !== 200) {
    throw new Error(`prerender failed: ${route.path} HTTP ${response.status}`);
  }
  let html = await response.text();
  html = html
    .replaceAll('"/assets/', `"${route.prefix}/assets/`)
    .replaceAll('"/favicon.svg', `"${route.prefix}/favicon.svg`);
  if (!html.includes(route.marker) || !html.includes("로봄")) {
    throw new Error(`prerender sanity check failed: ${route.path} markers missing`);
  }
  if (html.includes('"/assets/')) {
    throw new Error(`prerender sanity check failed: ${route.path} absolute path remains`);
  }
  const outPath = resolve(staticDir, route.out);
  await mkdir(resolve(outPath, ".."), { recursive: true });
  await writeFile(outPath, html);
}
await writeFile(resolve(staticDir, ".nojekyll"), "");

console.log(`prerendered static site (${ROUTES.length} routes) → ${staticDir}`);
