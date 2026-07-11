// 빌드된 워커에서 홈페이지 HTML을 렌더해 GitHub Pages용 정적 사이트를 dist/static 에 만든다.
// - 자산 경로를 상대경로(./)로 바꿔 프로젝트 페이지(/robom/)와 커스텀 도메인(robom.kr) 양쪽에서 동작하게 한다.
// - 이 스크립트는 `npm run build` 이후에 실행해야 한다. (tests/rendered-html.test.mjs 와 같은 렌더 방식)
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url);
const staticDir = resolve(root.pathname, "dist", "static");

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("prerender", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://robom.kr/", { headers: { accept: "text/html" } }),
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

const response = await render();
if (response.status !== 200) {
  throw new Error(`prerender failed: HTTP ${response.status}`);
}

let html = await response.text();

// 루트 절대경로 자산 참조를 상대경로로 바꾼다. (외부 https:// URL은 건드리지 않는다)
html = html
  .replaceAll('"/assets/', '"./assets/')
  .replaceAll('"/favicon.svg', '"./favicon.svg');

if (!html.includes("app-home") || !html.includes("야외봄")) {
  throw new Error("prerender sanity check failed: expected markers missing");
}
if (html.includes('"/assets/')) {
  throw new Error("prerender sanity check failed: absolute /assets/ path remains");
}

await rm(staticDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await cp(resolve(root.pathname, "dist", "client"), staticDir, {
  recursive: true,
  filter: (src) => !src.includes("/.vite") && !src.endsWith("/.assetsignore") && !src.endsWith("/_headers"),
});
await writeFile(resolve(staticDir, "index.html"), html);
await writeFile(resolve(staticDir, ".nojekyll"), "");

console.log(`prerendered static site → ${staticDir}`);
