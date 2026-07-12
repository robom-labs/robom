// 루트 VERSION(단일 소스) → app/version.ts 생성. prebuild에서 자동 실행.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const version = readFileSync(join(here, "..", "..", "VERSION"), "utf8").trim();
writeFileSync(
  join(here, "..", "app", "version.ts"),
  `// 자동 생성 파일 — 수정 금지. 단일 소스는 루트 VERSION (scripts/gen-version.mjs)\nexport const ROBOM_VERSION = "${version}";\n`,
);
console.log("version.ts ←", version);
