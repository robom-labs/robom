// 빌드된 워커에서 홈페이지 HTML을 렌더해 GitHub Pages용 정적 사이트를 dist/static 에 만든다.
// - 자산 경로를 상대경로(./)로 바꿔 프로젝트 페이지(/robom/)와 커스텀 도메인(robom.kr) 양쪽에서 동작하게 한다.
// - 이 스크립트는 `npm run build` 이후에 실행해야 한다. (tests/rendered-html.test.mjs 와 같은 렌더 방식)
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url);
const staticDir = resolve(root.pathname, "dist", "static");

const routes = [
  "/",
  "/apps/outbom",
  "/apps/homebom",
  "/apps/runningbom",
  "/support",
  "/privacy",
  "/terms",
  "/licenses",
  "/open-source",
];

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("prerender", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://robom.kr${path}`, { headers: { accept: "text/html" } }),
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

await rm(staticDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await cp(resolve(root.pathname, "dist", "client"), staticDir, {
  recursive: true,
  filter: (src) => !src.includes("/.vite") && !src.endsWith("/.assetsignore") && !src.endsWith("/_headers"),
});
for (const path of routes) {
  const response = await render(path);
  if (response.status !== 200) {
    throw new Error(`prerender failed for ${path}: HTTP ${response.status}`);
  }

  const depth = path === "/" ? 0 : path.split("/").filter(Boolean).length;
  const prefix = depth === 0 ? "./" : "../".repeat(depth);
  const html = (await response.text())
    .replaceAll('"/assets/', `"${prefix}assets/`)
    .replaceAll('"/favicon.svg', `"${prefix}favicon.svg`)
    .replaceAll('"/brand/', `"${prefix}brand/`);

  if (html.includes('"/assets/')) {
    throw new Error(`prerender sanity check failed for ${path}: absolute /assets/ path remains`);
  }

  const outputDir = path === "/" ? staticDir : resolve(staticDir, path.slice(1));
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "index.html"), html);
}
await writeFile(resolve(staticDir, ".nojekyll"), "");

console.log(`prerendered ${routes.length} static routes → ${staticDir}`);
