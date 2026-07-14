// 빌드된 워커에서 홈페이지 HTML을 렌더해 GitHub Pages용 정적 사이트를 dist/static 에 만든다.
// - 자산 경로를 상대경로(./)로 바꿔 프로젝트 페이지(/robom/)와 커스텀 도메인(robom.kr) 양쪽에서 동작하게 한다.
// - 이 스크립트는 `npm run build` 이후에 실행해야 한다. (tests/rendered-html.test.mjs 와 같은 렌더 방식)
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url);
const staticDir = resolve(root.pathname, "dist", "static");

const routes = [
  "/",
  "/apps/outbom",
  "/apps/homebom",
  "/apps/runningbom",
  "/apps/calendarbom",
  "/support",
  "/privacy",
  "/privacy/outbom",
  "/privacy/homebom",
  "/privacy/runningbom",
  "/privacy/calendarbom",
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
    // 정적 허브에는 클라이언트 상태가 없으므로 루트 경로를 다시 요청하는 hydration 런타임을 싣지 않는다.
    .replace(/<link rel="modulepreload"[^>]*>/g, "")
    .replace(/<script(?![^>]*type="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/g, "")
    .replaceAll('href="https://robom.kr/icons/', `href="${prefix}icons/`)
    .replaceAll('href="https://robom.kr/favicon.ico', `href="${prefix}favicon.ico`)
    .replaceAll('href="https://robom.kr/favicon-48.png', `href="${prefix}favicon-48.png`)
    .replaceAll('href="https://robom.kr/favicon-96.png', `href="${prefix}favicon-96.png`)
    .replaceAll('href="https://robom.kr/manifest.webmanifest', `href="${prefix}manifest.webmanifest`)
    .replaceAll('href="/', `href="${prefix}`)
    .replaceAll('src="/', `src="${prefix}`)
    .replaceAll('"/assets/', `"${prefix}assets/`)
    .replaceAll('"/favicon.svg', `"${prefix}favicon.svg`)
    .replaceAll('"/icons/', `"${prefix}icons/`)
    .replaceAll('"/brand/', `"${prefix}brand/`)
    .replaceAll('"/manifest.webmanifest', `"${prefix}manifest.webmanifest`);

  if (html.includes('href="/') || html.includes('src="/') || html.includes('"/assets/') || html.includes('rel="modulepreload"')) {
    throw new Error(`prerender sanity check failed for ${path}: root-relative path remains`);
  }

  const outputDir = path === "/" ? staticDir : resolve(staticDir, path.slice(1));
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "index.html"), html);
}
// 캘린더봄 임시 호스팅: robom-labs/calendarbom 저장소 생성 전까지 본사 Pages 아래 /calendarbom/ 로 함께 배포한다.
// 원본 소스는 apps/calendarbom 이며, 저장소가 생기면 그쪽 파이프라인으로 이전한다(ops/HUMAN_ACTIONS.md).
const calendarbomTarget = resolve(staticDir, "calendarbom");
await cp(resolve(root.pathname, "..", "apps", "calendarbom", "app"), calendarbomTarget, { recursive: true });
const calendarbomAppJs = resolve(calendarbomTarget, "app.js");
const buildSha = (process.env.GITHUB_SHA || "").slice(0, 7) || "local";
await writeFile(calendarbomAppJs, (await readFile(calendarbomAppJs, "utf8")).replace("__BUILD_SHA__", buildSha));

await writeFile(resolve(staticDir, ".nojekyll"), "");

console.log(`prerendered ${routes.length} static routes → ${staticDir}`);
