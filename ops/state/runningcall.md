# state: runningcall (러닝콜)

## 현재 상태
- 버전: 0.13.1
- 상태: live (Vercel: https://runningcall.vercel.app)
- 스택: Next.js 16 + React 19, pnpm, vitest

## 방금 한 일 (최근)
- 2026-07-09 daily#2(코드): P0 해결 — `/api/search-location`, `/api/reverse-location`, `/api/forecast`에 in-memory 레이트리밋(IP당 분당 20회) + same-origin 검증 추가(`lib/rate-limit.ts` 신규, 외부 유료 서비스 미사용). Kakao 유료 API 키 소진 방지(D12/R9). pnpm install(lockfile 변경 없음)/pnpm test 31/31(신규 rate-limit 테스트 포함)/pnpm build 정상. PR #2(draft): https://github.com/runnerpyrri-lgtm/runningcall/pull/2
- 2026-07-09 daily#1: 홍보 다채널 콘텐츠팩 생성(ops/content/2026-07-09/runningcall/). 게시대기.
- 2026-07-09: holdings에 federated 편입.

## Next
- [ ] 콘텐츠팩 검수 → 게시 → 반응 측정
- [ ] PR #2(레이트리밋/오리진 제한) 검수·머지(사람) — 머지 후 R9 위험 종결
- [ ] docs/superpowers/plans 의 미완 로드맵 중 작은 것부터(코드 사이클)

## Blocked
- 없음

## 최근 실패
- 없음

## 홍보 성과 (성장 루프)
- 2026-07-09: 콘텐츠팩 4채널 초안 생성(게시 전).
