# state: runningcall (러닝콜)

## 현재 상태
- 버전: main 0.13.3(머지·배포됨) / draft PR #6 대기 중 0.13.4
- 상태: live — PR #5가 이미 머지되어 Vercel 자동 배포 완료(이전 state의 "대기"는 stale 정보였음, 2026-07-10 확인). Kakao 키 등록은 여전히 사람 확인 필요.
- 스택: Next.js 16 + React 19, pnpm, vitest

## 방금 한 일 (최근)
- 2026-07-10 daily#3(코드): `lib/insights.ts` 추천 로직(getRankedWindows·getDayParts·getConditionChips·getMetricDetail) 단위테스트 16개 추가. ESLint+CI 연결(P2)은 신규 devDependency로 lockfile 대규모 변경 위험 있어 보류. typecheck·test 52/52·build 통과. PR #6(draft): https://github.com/runnerpyrri-lgtm/runningcall/pull/6
- 2026-07-10: PR #5 머지 완료 — Nominatim 위치 오답 폴백 제거, same-origin·좌표검증·역지오코딩 속도/캐시, 출처·GPS 안내, 앱 실행 중 알림 고지, PostCSS 취약점·원본 CI. typecheck·36 tests·build·audit 통과.
- 2026-07-09 daily#2(코드): P0 해결 — `/api/search-location`, `/api/reverse-location`, `/api/forecast`에 in-memory 레이트리밋(IP당 분당 20회) + same-origin 검증 추가(`lib/rate-limit.ts` 신규, 외부 유료 서비스 미사용). Kakao 유료 API 키 소진 방지(D12/R9). pnpm install(lockfile 변경 없음)/pnpm test 31/31(신규 rate-limit 테스트 포함)/pnpm build 정상. PR #2(draft): https://github.com/runnerpyrri-lgtm/runningcall/pull/2
- 2026-07-09 daily#1: 홍보 다채널 콘텐츠팩 생성(ops/content/2026-07-09/runningcall/). 게시대기.
- 2026-07-09: holdings에 federated 편입.

## Next
- [ ] 콘텐츠팩 검수 → 게시 → 반응 측정
- [ ] Vercel Production `KAKAO_REST_API_KEY` 등록 확인(실제 위치 검색 활성화)
- [ ] 과거 노출 GitHub 토큰 폐기 확인(사람)
- [ ] PR #6 검수·머지(insights.ts 테스트)
- [ ] ESLint+CI 연결 — 실제 lockfile 변경량 측정 후 재검토
- [ ] docs/superpowers/plans 의 미완 로드맵 중 작은 것부터(코드 사이클)

## Blocked
- 없음

## 최근 실패
- 없음

## 홍보 성과 (성장 루프)
- 2026-07-09: 콘텐츠팩 4채널 초안 생성(게시 전).
