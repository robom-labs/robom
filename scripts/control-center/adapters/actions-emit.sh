#!/usr/bin/env bash
# GitHub Actions 어댑터 — 워크플로 step에서 호출해 로봄 본부에 배포/CI 이벤트를 남긴다.
# 사용: bash actions-emit.sh <type> <status> <agent> <app> "<message>"
# 예:  bash scripts/control-center/adapters/actions-emit.sh deploy_started deploying release-manager runningbom "Pages 배포 시작"
# (본부 저장소 체크아웃이 있는 러너에서 events/*.jsonl 로 append. 로컬 관제에서 읽힘.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
node "$ROOT/scripts/control-center/emit-event.mjs" \
  --type "${1:-heartbeat}" --status "${2:-}" --agent "${3:-release-manager}" --app "${4:-}" --message "${5:-}"
