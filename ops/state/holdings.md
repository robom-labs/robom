# state: holdings (본사)

## 현재 상태
- 시스템 버전: 루트 `VERSION` 파일 참조(단일 소스, 여기 숫자 복제 안 함)
- 단계: 가동(저장소 live, 첫 사이클 성공)
- 저장소: github.com/runnerpyrri-lgtm/Zoop-holdings (main)

## 방금 한 일 (최근)
- 2026-07-10: 중복 PR 정리(#3·#7·#8 클로즈) + 살릴 것 통합(v0.3.1) — monthly-board-run(전략·설계 호출),
  버전 드리프트 방지 검사, 빠진 문서 3개, 앱 알림 버그 백로그(R11), 카카오 시간먼저. 8시 보고는 슬랙·노션·카카오 3채널 가동.
- 2026-07-10: 전체 코드리뷰 → 운영 규율 정합화(v0.3.0, #9 머지). 버전 5곳 불일치 단일화, 데일리 프롬프트 근본원인 교정,
  agent 경로 holdings 레이아웃 정합, registry-sanity apps.yml 기반화, CODEOWNERS·rollback·new-app-onboarding 추가.
- 2026-07-09: 3개 앱 각 1개 소규모 안전 변경 + draft PR 3개 생성.
- 2026-07-09: Day1 — 3개 앱 홍보 콘텐츠팩 생성(게시대기), CI 자기수정(D10).

## Next
- [ ] **사장**: main branch protection + "Require review from Code Owners" 켜기(R7 종결)
- [ ] 3개 앱 draft PR 검수·머지(사람)
- [ ] ANTHROPIC_API_KEY 시크릿 등록(사장) → 매일 자동 가동
- [ ] 앱 코드 개선(각 원본 저장소): zoopzoopcall dedup(R3/R10), runningcall 토큰폐기 확인, pushrun PWA

## Blocked
- 없음 (저장소 생성 완료)

## 최근 실패
- 2026-07-09 첫 CI runningcall 실패 → CI 재설계로 해결(D10). 재발 방지됨.
