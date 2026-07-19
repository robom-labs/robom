# v2.1.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-19 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium
- 참고: 이 컨테이너는 외부 운영 호스트(github.io·vercel·supabase)가 프록시로 차단되어
  해당 계약은 FAIL/UNAVAILABLE로 나타난다(엔진이 정직하게 보고함을 오히려 실증). 회장 맥에서는 실측된다.

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 93종 | PASS | node --test 전체 통과(assert 5 + 카탈로그 7 + 엔진 7 신규 포함) |
| 계약 정본 257개 생성(진단률 100% 정의) | PASS | build-health-contracts.mjs → ops/health-contracts/*.json · 타깃 9개 최소 수 게이트 |
| 프롬프트 최소 계약 수(§9~§17) | PASS | outbom 29≥18 · homebom 38≥22 · runningbom 30≥20 · calendarbom 30≥22 · certbom 31≥24 · notebom 32≥26 · site 21≥20 · HQ 24≥20 |
| evaluator allowlist(±25종)·id 중복 0·주관 threshold 0·mutating probe 0 | PASS | 카탈로그 게이트 테스트 |
| 심층 엔진 라이브 실행 | PASS | /api/health-run → 243계약 84요청 4.8초 실행·contracts-latest.json 증거 저장 |
| fetch 병합·예산(budget_exhausted 명시)·GitHub ETag/401 폴백 | PASS | 엔진 테스트 + 라이브(잔여 rate limit 표시) |
| 전역 선행조건(네트워크·DNS·GitHub·시계·포털·공동 host) | PASS | company 8계약 라이브 PASS |
| anti-flap·incident 연결(심층→기존 판정 엔진 병합, 레거시 대체) | PASS | mergeExtraResults 테스트 + 라이브 hq-status.health.contracts |
| 알림 예산(warning 10/run·info 상신 금지·critical/error 무제한) | PASS | 코드 경로 + 라이브에서 결재 폭주 없음 |
| need_new_source 7건 §18 메타데이터 완비·반복 상신 금지 | PASS | 카탈로그 테스트 + contractResultsToRaw 필터 테스트 |
| redaction 자가 검사(secret 제거) | PASS | 단위 + 라이브 계약 PASS |
| 브라우저 심층 smoke(Electron 데스크톱/Playwright 개발) | PASS | 드라이버 등록·browser_smoke 실행(컨테이너에서는 프록시 차단이 정직하게 FAIL로 보고됨) |
| HQ 런타임 계약(버전 삼중 일치·디스크·백업·조직 정본·원격 opt-in 등 24종) | PASS | 라이브 robom-hq 18 PASS·0 FAIL |
| 실행기 코덱스 단일화(연결 화면·스냅샷·계약) | PASS | claudeCode 항목 제거·codex 단일 표기·c:robom-hq:codex-cli 계약 |
| UI 진단률 패널(자동화)·회사 화면 심층 진단 행·재점검 버튼 | PASS | Playwright 스크린샷 v21-automation.png·v21-company.png |
| 버전 삼중 일치 2.1.0 + SW 캐시 v6.1.0 | PASS | version-triad 계약 라이브 PASS |
