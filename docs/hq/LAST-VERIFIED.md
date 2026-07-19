# v2.3.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-19 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium
- 참고: 컨테이너는 외부 운영 호스트가 프록시로 차단돼 앱 계약이 다수 FAIL/막힘으로 나타난다(엔진이 정직 보고함을 실증). 회장 맥에서는 실측된다.

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 104종 | PASS | node --test 전체 통과(workforce 8·office 11 갱신 포함) |
| 80명 정본 roster(id 고유·보고선/대직 유효·순환 0) | PASS | workforce.test + wf 자체 점검 계약 |
| 계약 소유권 배정(owner 지정·구현≠검증 분리) | PASS | assignOwnership 속성 테스트 + c:robom-company:workforce-owner-coverage |
| 직원 업무 상태 도출(계약 판정 근거·랜덤 아님·결정론) | PASS | computeWorkforce 단위(같은 입력→같은 출력) + FAIL 소유자 막힘 |
| 회사 가동 모드 6종(RUNNING/MONITOR_ONLY/DRAINING/PAUSED/SAFE_MODE/EMERGENCY_STOP) | PASS | company-authority + 회사 화면 고급 제어 |
| /api/workforce·/api/org-chart·hq-status.workforce | PASS | 라이브(80명·계약 250 배정·onDuty 25·막힘 18) |
| 회사 미션컨트롤 화면(인력 현황판·본부별 근무/계약/막힘·조직도·복지시설) | PASS | Playwright company23.png · 넘침 0 · 콘솔 오류 0 |
| 오피스 B4(실내 수영장·키즈 도서관·가족 라운지·커뮤니티홀) 렌더 | PASS | Playwright office23-b4.png |
| 오피스 인력 연동(캐릭터 밑 현재 업무 라벨·클릭 상세·업무 상태 8종·가족 생활 연출) | PASS | office23 스크린샷 · 콘솔 오류 0 |
| 공식 로봄 로고(오피스 HUD icon.svg) | PASS | c:robom-company:office-logo |
| 계약 273개(기존 257 보존 + 인력·오피스 자체 점검 16) | PASS | build-health-contracts · 진단률 정의 100% |
| 거짓 성과 금지(복지=생활 연출 비집계·홍보 STANDBY·인원≠실행기·'수정 중'=실제 실행기만) | PASS | workforce.test + 자체 점검 계약 |
| 버전 삼중 2.3.0 + SW 캐시 v6.3.0 | PASS | version-triad |

## 정직한 미완(다음 단계 — 프롬프트의 거짓 성과 금지 원칙 준수)

- 계약 500개 목표: 현재 273개. 나머지는 실측 가능한 고유 계약만 추가한다(문구만 바꾼 중복 금지 원칙). task/executor·CEO actionability·조직도 자체 점검을 단계적으로 확장.
- CompanyKernel 이벤트 버스(SSE)·ExecutorBroker(Codex/ClaudeCode adapter): 현재 Codex 단일 러너 + 폴링. 실행기는 정직하게 NOT_CONNECTED 표기.
- 오피스: 80명 전원 데스크 배치·오피스 관람 자동 카메라는 단계적 확장(현재 핵심 리드/셀 데스크 구동 + 가족·생활 인원 밀집).
