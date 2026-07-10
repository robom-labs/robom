#!/usr/bin/env bash
# 시스템 버전은 루트 VERSION 파일이 단일 소스다(DECISIONS D13).
# 문서에 시스템 버전 숫자를 손으로 적으면(드리프트 원인) 실패시킨다.
# 앱 버전(apps.yml·앱 표)과 CHANGELOG의 버전 표기는 검사 대상이 아니다.
set -euo pipefail

bad=0
# "시스템 버전 ... 0.N.N" 또는 "현재 0.N.N" 또는 "시스템 v0.N" 하드코딩 금지
pattern='(시스템 버전|현재[[:space:]])[^0-9]{0,12}[0-9]+\.[0-9]+\.[0-9]+|시스템 v[0-9]+\.[0-9]+'
for f in README.md AGENTS.md REPO-SETUP.md ops/state/holdings.md; do
  [ -f "$f" ] || continue
  if grep -nE "$pattern" "$f"; then
    echo "::error file=${f}::시스템 버전 숫자를 문서에 하드코딩했다. VERSION 파일만 단일 소스(D13)."
    bad=1
  fi
done

if [ "$bad" = 0 ]; then
  echo "version single-source ok (VERSION=$(tr -d '[:space:]' < VERSION))"
fi
exit "$bad"
