// 로컬 확인용 정적 서버: node scripts/serve.mjs [포트]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "app");
const port = Number(process.argv[2]) || 4177;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ics": "text/calendar",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) throw new Error("path traversal");
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => console.log(`캘린더봄 로컬 서버: http://localhost:${port}/`));
