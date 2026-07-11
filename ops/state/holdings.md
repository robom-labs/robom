# state: holdings (본사)

## 현재 상태
- 시스템 버전: 루트 `VERSION` 파일 참조(단일 소스, 여기 숫자 복제 안 함)
- 단계: 출시 강화 라운드 — holdings v0.4.0(#13)·줍줍콜 0.1.4(#10)·PushRun 0.6.9(#6) 머지 완료, 러닝콜 0.13.4(#7)·사본 동기화 PR 승인 대기
- 저장소: github.com/runnerpyrri-lgtm/Zoop-holdings (main)

## 방금 한 일 (최근)
- 2026-07-10(밤): **출시 심사 전수 리뷰 + 외부 자문 교차 검증 → 운영 체계 개편(v0.4.0)**
  - 판정: 줍줍콜 정식 공개 가능 / 러닝콜 보류(검색 3겹 결함+사람 확인 2건) / PushRun 제한 베타.
  - 자동화 실패 원인 확정: ANTHROPIC_API_KEY 미등록 → OIDC 폴백 실패(로그 확인: daily-company-run·daily-marketing).
  - 개편: 자가개선을 각 원본 저장소 `daily-self-improve.yml`(하루 2회)로 이전(D16), 본부장 보고 체계(D17),
    4개 Claude 워크플로 fail-fast(D18), drift-check 신설, apps/ 사본 읽기 전용 미러화, HUMAN-TASKS 단일화,
    Web Push RFC-001(줍줍콜 선검증). 앱 강화 PR 3개(0.1.4/0.13.4/0.6.9) 동시 상신.
- 2026-07-10(낮): 세 앱 출시 준비 PR(#8/#5/#4) **머지 완료**. 줍줍콜·PushRun은 배포본=main 일치까지 검증.
- 2026-07-10: 중복 PR 정리 + 통합(v0.3.1), 전체 코드리뷰 정합화(v0.3.0).
- 2026-07-09: 회사 착수, 3개 앱 편입, 첫 콘텐츠팩.

## Next
- [ ] **회장**: ops/HUMAN-TASKS.md 1~4번 (API 키 4곳, 브랜치 보호 4곳, Vercel Kakao 키, 토큰 폐기)
- [ ] **회장**: 앱 강화 PR 3개 + holdings 개편 PR 승인
- [ ] 본부장: 앱 PR 머지 후 사본·registry 동기화 PR
- [ ] 자동화 첫 가동 확인(키 등록 후 daily-company-run 수동 1회 시범)
- [ ] Web Push RFC-001 회장 검토 → 승인 시 상세 설계

## Blocked
- 자동화 가동: ANTHROPIC_API_KEY 등록 전까지 preflight에서 명시적으로 정지(D18 — 조용한 실패는 제거됨)

## 최근 실패
- 2026-07-10: daily-company-run·daily-marketing 첫 스케줄 실행 실패(secret 미등록 → OIDC 폴백). D18로 fail-fast화.
