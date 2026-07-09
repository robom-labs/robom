# 롤백 플레이북

> release-manager 가 배포 전 이 문서가 최신인지 확인한다. **배포는 각 앱 원본 저장소에서** 이뤄지므로 롤백도 거기서 한다(holdings는 배포 주체 아님 — D1).

## 원칙
- 배포가 아직 수동(예: zoopzoopcall `gh-pages` force push)이라 자동 롤백 안전망이 없다. 되돌리는 절차를 미리 안다.
- 사용자 영향(링크 사망·알림 미발송)이 의심되면 **먼저 롤백, 원인분석은 그 다음**.

## 앱별 롤백 방법
### zoopzoopcall (GitHub Pages `/zoopzoopcall/`)
- 배포 = `apps/web/dist` → `gh-pages` 브랜치 push. 롤백 = `gh-pages` 를 직전 정상 커밋으로 되돌려 재배포.
  ```
  git checkout gh-pages
  git reset --hard <직전_정상_커밋>
  git push -f origin gh-pages
  ```
- ★ base path `/zoopzoopcall/` 가 유지되는지 재배포 후 반드시 확인(URL 사망 방지, R1).

### runningcall (Vercel)
- Vercel 대시보드 → Deployments → 직전 정상 배포 **"Promote to Production"**(즉시 롤백). 코드 되돌림 없이 가능.

### pushrun (GitHub Pages + Vercel, 정적)
- `outputs/pushrun-site` 를 직전 정상 커밋으로 되돌려 재배포. Vercel 쪽은 위와 동일 Promote.

## 롤백 후
- `ops/state/<app>.md` "최근 실패"에 원인 한 줄 + 롤백 사실 기록.
- 재발 방지책이 있으면 ROADMAP/guardrail 로.
