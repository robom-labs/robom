# state: zoopzoopcall (줍줍콜)

## 현재 상태
- 버전: main 0.1.3(머지·배포됨) / draft PR #9 대기 중 0.1.4
- 상태: live — PR #8이 이미 머지되어 자동 배포 완료(이전 state의 "대기"는 stale 정보였음, 2026-07-10 확인)
- 스택: Vite + React PWA, pnpm, vitest

## 방금 한 일 (최근)
- 2026-07-10 daily#3(코드): SW `install` 단계에서 앱 셸(manifest·아이콘 3종) 사전 캐시 추가, 캐시명 zzc-v1→v2. base path 무변경. typecheck·test(core44+web6)·build 통과. PR #9(draft): https://github.com/runnerpyrri-lgtm/zoopzoopcall/pull/9
- 2026-07-10: PR #8 머지 완료 — 알림 표시 성공 후에만 발송 완료 기록, 중복 전달 방지, 원본 CI, 실공고 URL을 포함한 Pages 빌드. typecheck·core 44·web 6·build 통과.
- 2026-07-09 daily#2(코드): `apps/web` 테스트를 no-op에서 실제 vitest 실행으로 전환 + `collectPendingAlerts` 순수함수 단위테스트 4개 추가. pnpm install(lockfile 3줄만 변경)/typecheck/vitest 4/4 통과. PR #3(draft): https://github.com/runnerpyrri-lgtm/zoopzoopcall/pull/3
  - ROADMAP P0(Edge Function ↔ packages/core 정규화 중복 제거)는 조사 결과 Deno import 확장자 전면 수정 + 로컬 배포검증 불가로 하루짜리 범위 초과 판단 → 미착수, 제안서 필요 상태로 보류.
- 2026-07-09 daily#1: 홍보 다채널 콘텐츠팩 생성(ops/content/2026-07-09/zoopzoopcall/). 게시대기.
- 2026-07-09: holdings에 federated 편입.

## Next
- [ ] 콘텐츠팩 사장 검수 → 채널별 실제 게시 → 반응 측정
- [ ] PR #9 검수·머지(SW precache)
- [ ] P0: Edge Function ↔ packages/core 정규화 중복 제거 — 제안서 작성 필요(MAJOR 후보, 하루 범위 초과로 보류)
- [ ] core ↔ supabase 정규화 중복 제거(공유 스냅샷 테스트) — 다음 코드 작업 후보
- [ ] 폰트 self-host(pretendard/Gowun Batang CDN→로컬) — 바이너리 확보·라이선스 확인 필요

## Blocked
- 없음

## 최근 실패
- 없음

## 홍보 성과 (성장 루프)
- 2026-07-09: 콘텐츠팩 4채널 초안 생성(게시 전). 게시 후 조회·유입 여기 기록.
