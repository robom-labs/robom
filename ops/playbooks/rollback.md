# 롤백 플레이북 — 배포가 깨졌을 때 되돌리기

> release-manager가 매주 이 문서 최신 여부를 확인한다. 배포는 각 앱 **원본 저장소**에서 이뤄진다(모델 A / D1).
> holdings는 배포 주체가 아니므로, 실제 롤백은 각 앱 저장소에서 실행한다. 여기선 절차만 표준화한다.

## 공통 원칙
- 롤백은 "고치기"보다 우선한다. 사용자 영향이 있으면 먼저 되돌리고, 원인은 그 다음에 본다.
- 롤백도 사람(사장) 판단·실행. AI는 절차를 정리해 제시만 한다.

## homebom (GitHub Pages, `gh-pages` 브랜치)
- 배포가 `push -f` 방식이라 복구가 특히 중요.
1. `gh-pages` 브랜치의 직전 정상 커밋 SHA 확인.
2. `git checkout gh-pages && git reset --hard <정상SHA> && git push -f origin gh-pages`.
3. `https://runnerpyrri-lgtm.github.io/homebom/` 에서 base path·주요 화면 스모크.
- 예방: 배포 전 `dist/index.html`에 `/homebom/` 자산 경로가 박혔는지 grep(release-manager 3단계).

## outbom (Vercel)
1. Vercel 대시보드 → Deployments → 직전 정상 배포 → **Promote to Production**(즉시 롤백).
2. 원인 커밋은 별도 revert PR로 처리.

## runningbom (GitHub Pages + Vercel, 정적)
1. Pages: `gh-pages`를 직전 정상 커밋으로 되돌림(homebom과 동일).
2. Vercel: 직전 배포 Promote.
3. `races.json` 데이터 문제면 데이터만 되돌려도 됨(코드 무관).

## 롤백 후
- `ops/state/<app>.md`의 "최근 실패"에 원인 한 줄 + 롤백 사실 기록.
- 재발 방지책이 있으면 ROADMAP/DECISIONS에 남긴다.
