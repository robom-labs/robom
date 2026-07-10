#!/usr/bin/env bash
# registry 앱 버전과 vendored package.json 버전이 일치하는지 검사한다.
set -euo pipefail

registry="ops/registry/apps.yml"
failed=0

while read -r id version; do
  package="apps/${id}/package.json"
  if [ ! -f "$package" ]; then
    echo "::error file=${package}::package.json 없음"
    failed=1
    continue
  fi
  actual=$(node -e 'const p=require(process.argv[1]); process.stdout.write(String(p.version))' "./${package}")
  if [ "$actual" != "$version" ]; then
    echo "::error file=${registry}::${id} registry=${version}, package.json=${actual}"
    failed=1
  else
    echo "${id} version ok (${version})"
  fi
done < <(awk '/^[[:space:]]*-[[:space:]]*id:/ { id=$3 } /^[[:space:]]*version:/ { print id, $2 }' "$registry")

exit "$failed"
