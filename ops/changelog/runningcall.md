# changelog: runningcall

> 앱 상세 이력은 원본 저장소 CHANGELOG. 여기는 holdings 관점 요약.

## 2026-07-10 (출시 준비 RC)
- Kakao 키 부재 시 Nominatim 텍스트 검색 오답을 내지 않고 현재 위치 사용 안내와 503을 반환한다.
- API same-origin·좌표검증·캐시·Nominatim 속도 제한, 데이터 출처·GPS 전송·알림 동작범위 안내를 보강했다.
- PostCSS 보안 업데이트와 원본 CI를 추가했다.
- 검증: typecheck, 36 tests, production build, production audit 통과.
- PR #5(draft): https://github.com/runnerpyrri-lgtm/runningcall/pull/5

## 2026-07-09
- holdings에 federated 편입. 코드 변경 없음.

## 2026-07-09 (daily #1 · 홍보)
- 다채널 홍보 콘텐츠팩 초안 생성(게시대기). 코드 변경 없음.

## 2026-07-09 (daily #2 · 코드) — MINOR 후보
- ROADMAP P0 실행: `/api/search-location`, `/api/reverse-location`, `/api/forecast`에 in-memory
  레이트리밋(IP당 분당 20회) + same-origin 검증 추가(`lib/rate-limit.ts` 신규). 외부 유료 서비스 미사용.
- 이유: Kakao 유료 API 키 소진 방지(D12 진단 R9). 실사용 리스크 해소.
- 검증: pnpm install(lockfile 변경 없음) / pnpm test 31/31 통과(신규 rate-limit 테스트 포함) / pnpm build
  (next build --webpack) 정상.
- PR #2(draft): https://github.com/runnerpyrri-lgtm/runningcall/pull/2
