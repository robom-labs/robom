# changelog: zoopzoopcall

> 앱 상세 이력은 `apps/zoopzoopcall/CHANGELOG.md`. 여기는 holdings 관점 요약.

## 2026-07-10 (daily #3 · 코드) — PATCH 후보
- SW `install` 단계에서 앱 셸(manifest·아이콘 3종) 사전 캐시 추가. 캐시명 zzc-v1→v2. base path 무변경.
- 검증: node --check, typecheck, test(core44+web6), build 통과.
- PR #9(draft): https://github.com/runnerpyrri-lgtm/zoopzoopcall/pull/9

## 2026-07-10 (출시 준비 RC) — 머지 완료
- 알림 표시 성공 뒤에만 발송 완료 기록, 동일 알림 중복 전달 방지, 실패 경로 테스트를 추가했다.
- 원본 저장소 CI와 실공고 URL을 주입하는 Pages 빌드를 추가했다.
- 검증: typecheck, core 44 tests, web 6 tests, production build 통과.
- PR #8(draft): https://github.com/runnerpyrri-lgtm/zoopzoopcall/pull/8

## 2026-07-09
- holdings에 federated 편입(v0.1.0 스냅샷). 코드 변경 없음.

## 2026-07-09 (daily #1 · 홍보)
- 다채널 홍보 콘텐츠팩 초안 생성(게시대기). 코드 변경 없음.

## 2026-07-09 (daily #2 · 코드) — PATCH 후보
- `apps/web` 테스트를 no-op에서 실제 vitest 실행으로 전환 + `collectPendingAlerts` 순수함수 단위테스트 4개 추가.
- 검증: pnpm install(lockfile 3줄만 변경) / pnpm -r typecheck 통과 / vitest 4/4 통과.
- PR #3(draft): https://github.com/runnerpyrri-lgtm/zoopzoopcall/pull/3
- ROADMAP P0(Edge Function ↔ packages/core 정규화 중복 제거)는 조사만 진행 — Deno import 확장자 전면 수정 +
  로컬 배포검증 불가로 하루 범위 초과 판단, 착수하지 않음(제안서 필요 상태로 보류).
