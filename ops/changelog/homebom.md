# changelog: homebom (청약봄)

- 2026-07-13: 0.7.1. 청약홈 공고 원문 링크가 종종 404를 내던 문제를 고쳤다. 공공데이터 API가 PBLANC_URL의 `&`를 `&amp;`로 이스케이프해 pblancNo 파라미터가 깨지던 것을 URL 정규화에서 되돌리고, 저장된 캐시 링크도 렌더 시 복구한다. 캐시 zzc-v15.
- 2026-07-13: 0.7.0. 설정 화면을 패밀리 공통 IA로 재배치하고 하단 내비 규격을 맞췄다.
- 2026-07-13: 0.6.0. 커스텀 `봄` 마크, 일정 고정 순서·개별 행, 공고 모델·지도 fallback과 운영 데이터 검증을 반영했다.
- 2026-07-13: 0.5.0. 일정 우선 캘린더, 안정 이벤트 ID, 공고별 알림과 동일 기기 백업 데이터 호환성을 반영했다.
- 2026-07-13: 0.4.0. 공식 일반공급을 추가하고 접수·발표·계약 월간 일정, 다음 일정 카드와 지도 연결을 반영했다.
- 2026-07-11: 줍줍콜에서 청약봄으로 브랜드 전환 착수.

> 앱 상세 이력은 `apps/zoopzoopcall/CHANGELOG.md`. 여기는 holdings 관점 요약.

## 2026-07-10 (출시 준비 RC)
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
