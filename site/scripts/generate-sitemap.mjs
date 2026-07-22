// registry 생성물의 앱 경로와 공개 정책 경로로 검색엔진 sitemap을 결정적으로 생성한다.
import { readFile, writeFile } from "node:fs/promises";

const siteRoot = new URL("..", import.meta.url);
const sitemapUrl = new URL("public/sitemap.xml", siteRoot);
const apps = JSON.parse(await readFile(new URL("public/family/apps.json", siteRoot), "utf8")).apps;
const paths = [
  "/",
  ...apps.map(({ id }) => `/get/${id}`),
  "/support",
  "/privacy",
  ...apps.map(({ id }) => `/privacy/${id}`),
  "/terms",
  "/licenses",
];
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...paths.map((path) => `  <url><loc>https://robom.kr${path}</loc></url>`),
  "</urlset>",
  "",
].join("\n");

if (process.argv.includes("--check")) {
  const current = await readFile(sitemapUrl, "utf8");
  if (current.replaceAll("\r\n", "\n") !== xml) {
    throw new Error("public/sitemap.xml이 registry 생성물과 다릅니다. npm run sitemap:generate를 실행하세요.");
  }
  console.log(`sitemap drift 0 · ${paths.length} URLs`);
} else {
  await writeFile(sitemapUrl, xml);
  console.log(`generated public/sitemap.xml · ${paths.length} URLs`);
}
