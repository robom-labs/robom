#!/usr/bin/env bash
# 로봄 본부 실행 (바탕화면에서 더블클릭). node만 있으면 됨.
cd "$(dirname "$0")/.." || exit 1
exec node scripts/control-center/serve.mjs
