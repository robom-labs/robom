# DECISIONS — 확정 결정 로그

착수하며 내(마스터/설계리드)가 판단해 확정한 결정. "왜 이렇게 했지"를 나중에 없애기 위함.

## 2026-07-09 · 착수 결정

### D1. 코드 물리 위치 = 관제 저장소(모델 A) + 개발용 앱 복사
- **결정**: holdings는 관제(운영·자동화) 저장소. 앱 코드(`apps/zoopzoopcall`)는 **개발·기록용으로 복사**해 둔다.
- **단, 배포는 원본 저장소에서만.** holdings는 앱을 배포하지 않는다.
- **이유**: 사용자 요구("폴더 복사해서 새 곳에서 전부 시작")를 지키면서, `/zoopzoopcall/` 라이브 URL을 깨지 않기 위함. holdings가 배포 주체가 아니므로 URL을 바꿀 방법이 없다.
- **트레이드오프**: 복사본과 원본이 갈라질 수 있음 → 당분간 **원본은 동결(freeze)**, 신규 개발은 holdings에서. 실제 배포 이관은 별도 결정(ROADMAP)으로 미룸.

### D2. 루트 pnpm-workspace 두지 않음 (federated)
- **블로커**: "모노레포 안 모노레포" — 루트에 워크스페이스를 만들면 `apps/zoopzoopcall`의 자체 워크스페이스와 충돌.
- **결정**: holdings 루트에 `pnpm-workspace.yaml`/`package.json`을 두지 않는다. 각 앱은 자기 폴더에서 독립 관리.
- **효과**: 앱이 늘어도 서로 간섭 없음. 앱마다 자기 pnpm/lock 유지.

### D3. 가드레일 검사 경로 교정
- **블로커**: `pnpm -r test`는 holdings 루트에서 동작 안 함(루트 워크스페이스 없음). base-path 경로도 한 단계 깊어짐.
- **결정**: `guardrails.yml`의 test/build 잡은 `apps/zoopzoopcall`을 working-directory로. base-path 검사 경로는 `apps/zoopzoopcall/apps/web/vite.config.ts`.
- 앱이 늘면 앱별 매트릭스로 확장(ROADMAP).

### D4. 홍보 = 매일·다채널, 외부 게시는 사람 승인
- 자동 대량 게시(유튜브/인스타/커뮤니티 봇 댓글)는 스팸정책 위반·밴 위험 → 금지.
- 콘텐츠는 매일 `ops/content/`에 초안으로 생성, 발행은 사장 승인.

### D5. 버전 관리 방식
- 시스템 버전: 루트 `VERSION` + `CHANGELOG.md`. 운영/자동화 변경 시 bump.
- 앱 버전: `apps/<app>/package.json` + 앱 CHANGELOG.
- 매 작업은 PR로 저장, 버전 올리며 진행.

## 열린 결정 (사장 확인 필요)
- D-open-1: 나중에 배포를 holdings로 이관할 것인가? (이관 시 base path 전략 재확정 필요)
- D-open-2: PATCH 자동 merge 도입 시점(4주 데이터 후 재검토).

## 2026-07-09 · 3개 앱 실측 반영

### D7. 3개 앱은 실제 서비스 중이며 스택이 제각각 (stub 아님)
- runningcall = Next.js 16 + React 19, **Vercel** 배포, v0.13.1 (활동 컨디션 PWA).
- pushrun = **정적 사이트**(빌드 없음), Pages+Vercel, v0.6.6 (러닝대회 알림).
- zoopzoopcall = Vite+React PWA, Pages `/zoopzoopcall/`, v0.1.0.
- 결론: 회사는 **이종(heterogeneous) 앱**을 관리한다. registry의 test/build/deploy 를 앱별로 다르게 명시.

### D8. 가드레일은 앱별로 (공통 강제 불가)
- base-path-guard 는 zoopzoopcall 에만. runningcall/pushrun 엔 해당 없음.
- test/build 게이트는 앱별 명령(registry.test/build)으로. pushrun 은 정적이라 test 없음 → 링크/HTML 검증으로 대체 예정.
- 각 앱 CI는 원칙적으로 각 앱 저장소에 둔다(모델 A). holdings CI는 secret-scan + registry 정합성 중심.

### D9. 앱 편입 방식 = 당분간 vendored 복사, 추후 submodule 검토
- 지금은 개발/기록용 복사(freeze 원칙). 3개 앱 모두 독립 배포 중이라 **배포 소스는 각 원본 저장소**.
- 드리프트 위험(R2) 있으므로, 실제 운영 전 git submodule 전환을 D-open-4 로 검토.

## 2026-07-09 · 첫 CI 실패에서 배운 것 (자기수정)

### D10. 앱별 CI는 path 필터로 분리 + 앱별 pnpm 버전
- 증상: daily#1(홍보 콘텐츠만 변경) PR에서 runningcall-ci 실패 — `pnpm install: packages field missing`.
- 원인: (1) 앱 안 건드린 PR인데 3개 앱 빌드를 다 돌림 (2) runningcall 워크스페이스가 pnpm10 문법인데 CI가 pnpm9.
- 결정:
  - guardrails.yml = 범용 검사만(base-path/registry/lockfile/secret), 항상 실행.
  - 앱별 CI를 ci-<app>.yml 로 분리, `on.pull_request.paths` 로 그 앱 변경 시에만 실행.
  - runningcall CI는 pnpm 10 사용(스택 일치). pushrun 은 정적 파일 검증만.
- 효과: 콘텐츠/문서 PR은 앱 빌드 안 돌려 빠르고 안 깨짐. 앱 변경 시에만 해당 앱 CI 작동.
- 주의: 나중에 branch protection의 required checks 지정 시, path-filter로 안 도는 체크를 required로 걸면 안 됨(pending 고착). D-open-5.

## 2026-07-09 · 전체 점검·최적화 1차

### D11. 최적화 대상 = 관제 레이어. 앱 코드 최적화는 각 앱 저장소에서.
- 이유: holdings의 apps/* 는 vendored 사본(D9). 여기서 앱 코드를 고치면 배포에 안 닿고 드리프트만 커짐.
- 결정: 이번 최적화는 관제 레이어(workflows/ops/docs/CI/gitignore)만 적용.
  앱 개선 후보는 ROADMAP '앱 최적화 백로그'로 모아 각 앱 원본 저장소에서 실행.
- 적용:
  - .gitignore 확장(.next/out/.vercel/coverage/*.tsbuildinfo) — 빌드 산출물 커밋 방지.
  - claude-code-action 워크플로에 claude_args(--max-turns) 비용 상한 + issues:write 권한.
  - 구식 문서 정리(REPO-SETUP 완료표시, STRUCTURE→AGENTS.md 정본 안내), state 최신화.
- 검증: 커밋된 파일에 node_modules/.next/dist/.env/secret 없음(clean) 확인.
- 미해결(구조): vendored 사본 드리프트 → git submodule 전환 검토(D-open-4 유지).

### D12. 전수 진단(2026-07-09) 요약
- 보안 양호(커밋 secret 없음, 키 서버보관, 입력검증, HTML 이스케이프).
- 단 1건 실사용 리스크: runningcall 무인증 /api/* → Kakao 키 소진(R9, P0).
- 최대 레버리지: 3개 앱 공통 로직 중복 → 공유 core 패키지(R10, P1).
- 실제 적용(holdings 안전범위): ci-pushrun 에 races.json 검증(mixed-content 경고) 추가.
- 앱 코드 개선은 백로그화(ROADMAP), 각 앱 저장소에서 실행.

## 2026-07-10 · 운영 규율 정합화 (코드리뷰 반영)

### D13. 시스템 버전은 VERSION 파일이 단일 소스 + 데일리 런은 시스템 VERSION을 올리지 않는다
- 문제: 시스템 버전이 5곳(CHANGELOG·VERSION·state·AGENTS·README)에서 제각각. 근본원인은
  daily-company-run 프롬프트가 매 앱 작업마다 "VERSION 갱신 필수"라고 지시해 시스템/앱 버전을 혼동시킨 것.
- 결정: (1) 숫자는 루트 `VERSION`에만 둔다(다른 문서는 "VERSION 참조"로만 표기, 복제 금지).
  (2) 앱 코드 작업은 그 앱 `package.json`만 bump. 루트 VERSION은 운영방식·자동화 변경 때만 bump(D5 재확인·강제).
- 부수 정합화: registry-sanity 가드레일이 앱명을 하드코딩하지 않고 `apps.yml`에서 읽는다(단일 소스 실천).
  agent 프롬프트(inspector/builder/release-manager)의 경로를 holdings 레이아웃(`apps/<app>/...`)에 맞게 교정.
  참조만 되고 없던 playbook(rollback·new-app-onboarding) 생성. CODEOWNERS 추가(단, branch protection은 사장 설정 필요).
- 미해결(사장): main branch protection + "Require review from Code Owners" 활성화(R7). 켜기 전엔 PR-only가 물리 강제되지 않음.

### D14. 중복 PR 정리 + 살릴 것만 통합 (PR #3·#7·#8 클로즈)
- 상황: 여러 세션이 병렬로 만든 관제 리뷰 PR 3개(#3 경영지시기록·#7 운영모델정합·#8 전수리뷰)가 열려 있었고,
  대부분 이미 머지된 #9(v0.3.0)와 겹쳤다. 그대로 두면 D-번호·버전 충돌.
- 결정: 세 PR을 **클로즈**하고, 아직 main에 없던 쓸만한 것만 이 통합 PR로 살린다.
  - 살림: `monthly-board-run.yml`(전략·설계팀 호출 갭 해소) · 버전 드리프트 방지 검사(guardrails) ·
    참조만 되고 없던 문서(agent-performance·security-boundaries·operating-model) · 앱 알림 버그 백로그(R11).
  - 버림(이미 #9에 반영): 버전 통일·inspector 경로교정·CODEOWNERS·rollback/new-app-onboarding.
- #3 governance 사실 기록: 홍보팀(daily-marketing) 보류 상태 · runningcall API 보안(R9) 착수는 유효 — state/RISK에 반영.

## 2026-07-10 · 출시 준비 점검

### D15. 실제 릴리스 게이트는 앱 원본 저장소에 둔다
- 결정: `apps/*` vendored 사본 CI는 추가 스모크일 뿐이다. 배포되는 원본 저장소의 PR CI가 타입·테스트·빌드·정적 데이터 검증의 정본이다.
- 적용: zoopzoopcall #8, runningcall #5, pushrun #4에 원본 CI와 출시 보완을 추가하고 holdings 사본을 해당 PR head와 동기화했다.
- 결정: 서버 Web Push가 없는 상태에서는 브라우저 종료 후 알림을 보장한다고 표현하지 않는다. 완전한 백그라운드 알림은 별도 MAJOR RFC와 사람 승인을 거친다.
- 머지 순서: 앱 PR 3개를 먼저 머지·배포 확인한 뒤 이 holdings PR을 머지한다.

## 2026-07-10 · 출시 심사 → 운영 체계 개편 (v0.4.0)

### D16. 앱 자가개선은 각 원본 저장소에서 — 하루 2회, PR로만
- 문제: daily-company-run이 holdings 안의 apps/ 사본을 고치게 되어 있었다. 사본 수정은 배포에 닿지 않으면서
  CI를 초록으로 만들어 "고쳐졌다"는 착시와 드리프트를 동시에 생산한다. 또한 holdings의 GITHUB_TOKEN으로는
  다른 저장소에 브랜치·PR을 만들 수 없다(외부 자문 검토에서 확인).
- 결정: (1) 각 앱 원본 저장소에 `daily-self-improve.yml`(하루 2회, KST 06:00·18:00)을 두고, 그 저장소의
  자체 토큰으로 draft PR을 만든다. 승인은 회장. (2) holdings의 apps/ 사본은 **읽기 전용 미러**로 격하
  (apps/README.md). (3) `drift-check.yml`이 매일 원본(raw.githubusercontent) ↔ registry ↔ 사본 버전을 대조한다.

### D17. 본부장 보고 체계
- 결정: daily-company-run은 코드 대신 "본부장 업무"를 한다 — 상태 점검 + 비전공자용 일일보고
  (`ops/reports/<날짜>-<회차>.md`, 틀은 `ops/reports/TEMPLATE.md`) + ops 개선 1건 + draft PR.
  사람 전용 작업은 `ops/HUMAN-TASKS.md` 한 곳에서 관리한다.

### D18. 자동화 fail-fast
- 문제: ANTHROPIC_API_KEY 미등록 상태에서 Claude 워크플로가 OIDC 폴백을 시도하다 알아보기 어려운
  에러로 죽었다 (Daily Company Run·Daily Marketing 실행 로그로 확인. Weekly·Monthly는 같은 구조라 동일 실패 예상).
- 결정: 4개 Claude 워크플로 모두 첫 스텝에서 secret 존재를 확인하고, 없으면 한국어 안내와 함께 즉시 실패한다.

### D19. 1인 회사 브랜치 보호 규칙
- 결정: "승인 1명 필수"는 1인 회사에서 본인 PR을 본인이 승인 못 해 운영이 막힌다(외부 자문 지적 수용).
  권장 설정 = PR 경유 필수 + required checks + conversation resolution + force push/삭제 차단 + **승인 수 0**
  (외부 리뷰어 합류 시 1로 상향). 상세 절차는 ops/HUMAN-TASKS.md 2번.
