#!/usr/bin/env bash
# 원본 앱 저장소(배포 소스) main의 package.json 버전을 registry·vendored 사본과 대조한다.
# verify-app-registry.sh 는 registry↔vendored 만 봤다 — 이 스크립트가 "원본" 축을 추가한다.
set -euo pipefail

registry="ops/registry/apps.yml"
failed=0

while read -r id version repo; do
  # 1) vendored 사본
  package="apps/${id}/package.json"
  if [ -f "$package" ]; then
    vendored=$(node -e 'const p=require(process.argv[1]); process.stdout.write(String(p.version))' "./${package}")
  else
    vendored="(없음)"
  fi

  # 2) 원본 저장소 main (공개 저장소 — 인증 불필요)
  url="https://raw.githubusercontent.com/${repo}/main/package.json"
  origin_ver=$(curl -fsSL --max-time 20 "$url" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{process.stdout.write(String(JSON.parse(d).version))})' 2>/dev/null || echo "(조회실패)")

  if [ "$origin_ver" = "(조회실패)" ]; then
    echo "::warning::${id}: 원본(${url}) 조회 실패 — 네트워크 또는 저장소 문제"
    continue
  fi

  app_ok=1
  if [ "$origin_ver" != "$version" ]; then
    echo "::error::${id}: 원본 main=${origin_ver}, registry=${version} — registry 갱신 + 사본 동기화 PR 필요"
    failed=1; app_ok=0
  fi
  if [ "$origin_ver" != "$vendored" ]; then
    echo "::error::${id}: 원본 main=${origin_ver}, vendored 사본=${vendored} — 사본 동기화 PR 필요"
    failed=1; app_ok=0
  fi
  if [ "$app_ok" = "1" ]; then
    echo "${id}: 원본=registry=사본=${origin_ver} ✅"
  fi
done < <(awk '
  /^[[:space:]]*-[[:space:]]*id:/      { id=$3 }
  /^[[:space:]]*version:/              { ver=$2 }
  /^[[:space:]]*repo:/                 { print id, ver, $2 }
' "$registry")

exit "$failed"
