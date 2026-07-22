# ROBOM HQ 결정론적 health 엔진 (v2.1.0 — 진단률 100%)

AI 없이(규칙만으로) 회사 앱들의 실제 신호를 읽고 **정상 / 확인 필요 / 장애 / 점검 불가**를 판정한다.
v2.1.0부터 업로드 지침(PART 07~12)의 계약이 **전부 machine-readable 정본으로 정의**되고(정의 진단률 100%),
프로그램 안의 계약 엔진이 실제로 실행한다. 실행기는 **오로지 Codex 단일**이다.

## 2층 구조
1. **심층 계약 엔진** `lib/contract-engine.mjs` + 카탈로그 `lib/contract-catalog.mjs`
   - 계약 257개(회사 전역 8 · 앱 공통 22종×6 · 앱 전용 심층 · robom.kr 23 · HQ 자체 25)를
     evaluator allowlist(약 25종: http/html/json·surface marker·TLS·DNS·manifest·SW·GitHub·sitemap·SEO·
     UA parity·데이터 검증기·HQ 런타임·브라우저 smoke)로 실행한다.
   - 판정은 오직 구조화된 config + 형식 검증된 assertion 연산(`lib/contract-assert.mjs`)으로만 한다.
     `eval`·shell·자연어 해석·LLM 판정 금지.
   - 정본 산출물: `ops/health-contracts/*.json` (`build-health-contracts.mjs`로 생성, 직접 수정 금지).
2. **판정·사건 엔진** `lib/health-engine.mjs`
   - anti-flap(critical 1회·warn/error 연속 2회·회복 연속 2회 PASS), incident/회복, 결재 상신.
   - 심층 계약 결과가 레거시 스냅샷 판정(production/ci/pr)을 대체해 중복 상신을 막는다.

## 실행 계층(§6)과 주기
- **cheap·standard**: 자동 점검 주기마다(기본 감시기 10분 흐름 안에서) 전부 실행.
- **deep**(브라우저 렌더 smoke·저장 fixture): 60분 TTL — 데스크톱에서는 **Electron 숨김 창(sandbox·메모리 세션)**,
  개발·CI에서는 Playwright로 실행. 브라우저가 없으면 그 계약만 `점검 불가(browser_missing)`로 정직 표기하고
  HTTP 계약은 계속 실행한다.
- run planner: 동일 URL 요청 병합(fetch 캐시), GitHub는 ETag 캐시(304는 rate limit 미소모),
  예산 초과 시 남은 계약은 `budget_exhausted` UNAVAILABLE(몰래 SKIP 금지).

## 심층으로 실측하는 것(예)
- **청약봄**: 공고 probe 200/JSON, `x-verified-at` 신선도·미래 skew·단조 증가, `x-data-stale` 정직 강등,
  필수 필드·stable id 중복 0·날짜 순서·`&amp;` 잔존, CORS expose, refresh 인증(코드 감사), 파이프라인 워크플로.
- **러닝봄**: races.json 심층(중복·날짜·접수 순서·상태-날짜 모순·미래 접수·종료 비율), data_version parity,
  ASSET_VERSION↔SW 정합, 공식 링크 회전 표본(403은 정책으로 구분).
- **자격증봄**: source registry 무결(중복 id·HTTPS·parserVersion·lastVerifiedAt), 수집 워크플로 36h 하트비트,
  Q-Net 키 번들 노출 0.
- **robom.kr**: robots/sitemap 전수 200, 앱별 3라우트(/apps·/get·/privacy) 전수, JSON-LD, Yeti UA parity,
  네이버 인증 meta, 내부 링크 404 0, 360/390/412 넘침 smoke.
- **HQ 자체**: 스냅샷 존재/나이/앱 수 parity, 대기열 무결, 권한 정본, 디스크·백업·증거 용량,
  버전 삼중 일치, redaction 자가 검사, 원격 opt-in, Codex 연결(단일 실행기), monitor-the-monitor.

## 아직 실측 불가 — `need_new_source`(§18, 숨기지 않음)
각각 `source_needed / why_needed / privacy_risk / free_implementation_option / fallback_status`를 계약에 명시했다.
- 야외봄 forecast probe URL(registry 선언 필요 — 추측 URL로 거짓 PASS 금지)
- 청약봄 수집 통계(fetched·published·preserved) read-only 신호
- 자격증봄 source 문서 hash 변경 감지
- HQ 로그인 항목 실제 상태(desktop API 노출 필요)
앱 쪽 신호가 생기면 계약이 자동으로 실측으로 전환된다. 반복 상신은 하지 않고 화면에만 표시한다.

## 증거·프라이버시(§7)
`runtime/health/`에 저장: `latest.json`(판정)·`contracts-latest.json`(심층 결과·coverage)·`incidents.jsonl`·
`recoveries.jsonl`·`source-cache/`(GitHub ETag). secret·본문 원문·개인 데이터는 저장하지 않으며
redaction 자가 검사가 매 run 돈다(실패 시 보안 계약 FAIL).

## 알림 예산(§8.1)
critical·error 무제한, warning은 run당 10건까지만 결재 상신, info는 기록만(스팸 방지). 저장은 전부 한다.
