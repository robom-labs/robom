# CHANGELOG — 로봄 시스템

이 회사의 **운영 방식/자동화** 변경 이력. [SemVer](https://semver.org/lang/ko/). 최신 버전이 맨 위.
(앱 자체 변경은 각 독립 앱 저장소의 `CHANGELOG.md`를 참조합니다.)

## [1.1.0] - 2026-07-11

### 추가

- 모바일(780px 이하)에서 홈페이지 첫 화면을 런처형 앱 홈으로 분기했다: 따뜻한 인사 헤더(태양+시그널), 세 앱 아이덴티티 타일, 하단 고정 탭바(safe-area 대응, 44px 이상 터치).
- 타일에는 시각·D-day 같은 실시간 수치를 표기하지 않고 생활어 문구만 담아, 실제 확인은 각 앱에서 하게 했다.
- 브라우저 UI를 크림색으로 물들이는 `themeColor`와 `viewport-fit=cover`를 추가해 폰에서 앱처럼 보이게 했다.

### 변경

- 모바일에서는 편집형 히어로를 숨기고 앱 홈이 첫 화면을 대신한다. 데스크톱(780px 초과) 화면은 변경 없음.
- 검증: 빌드·렌더링 테스트 2/2·ESLint 통과, 390/360px 실측(가로 넘침 0, 탭 92×50px), 1440px 데스크톱 무변경 확인.

## [1.0.5] - 2026-07-11

### 수정

- 모바일 상단 앱 링크의 실제 터치 영역을 약 26×15px에서 최소 46×44px로 확대해 손가락 터치가 빗나가는 문제를 줄였다.
- 아이폰 화면 크기에서 상단 링크 3개와 앱 카드 3개의 터치 이동, 도착 주소, 콘솔 오류 부재를 다시 확인했다.

## [1.0.4] - 2026-07-11

### 수정

- 모바일·인앱 브라우저에서 새 창이 차단되어 앱이 열리지 않을 수 있던 문제를 막기 위해 세 앱 링크를 같은 창 이동 방식으로 변경했다.
- 야외봄·청약봄·러닝봄 운영 페이지와 필수 정적 자산의 HTTP 200 응답, 실제 브라우저 렌더링과 콘솔 오류 부재를 확인했다.

## [1.0.3] - 2026-07-11

### 변경

- 야외봄·청약봄·러닝봄 브랜딩 PR 병합과 각 운영 주소의 HTTP 200 응답을 확인했다.
- 청약봄과 러닝봄의 홈페이지 연결을 각각 `robom-labs.github.io/homebom/`, `robom-labs.github.io/runningbom/`으로 전환했다.
- 포트폴리오 registry와 앱별 상태 문서를 실제 배포 상태에 맞게 `live`로 갱신했다.

## [1.0.2] - 2026-07-11

### 변경

- 조직 저장소에서 라이선스를 요구해 실행되지 않던 `gitleaks-action@v2`를 공식 Gitleaks CLI 컨테이너 `v8.30.1`로 교체했다.
- 비밀정보 검사는 전체 Git 이력을 계속 검사하면서 별도 라이선스 없이 동작하도록 복구했다.

## [1.0.1] - 2026-07-11

### 변경

- `robom.kr` 홈페이지에서 캐릭터 중심 표현을 제거하고 야외·청약·대회 접수의 타이밍을 보여주는 추상 신호 디자인으로 교체했다.
- 홈페이지 소스를 `robom-labs/robom`의 `site/` 단일 위치에서 관리하도록 유지하고, 캐릭터 없는 파비콘·공유 이미지를 반영했다.
- 캐릭터 부재, 세 앱 연결, 접근성 메타데이터를 배포 테스트로 검증하도록 갱신했다.

## [1.0.0] - 2026-07-11

### 변경

- 지주회사 이름을 로봄으로 확정하고 목표 저장소를 `robom-labs/robom`으로 정했다.
- 앱 이름을 야외봄, 청약봄, 러닝봄으로 확정하고 독립 저장소 `outbom`, `homebom`, `runningbom`으로 분리했다.
- `apps/` vendored 사본과 본사 앱별 CI를 제거해 앱 원본 저장소를 유일한 코드 정본으로 만들었다.
- 별도 로봄 홈페이지 프로젝트를 `site/`로 이관해 본사에서 운영과 홈페이지를 함께 관리하도록 했다.
- registry, state, CODEOWNERS와 본사 guardrails를 새 포트폴리오 구조에 맞췄다.

## [0.4.1] - 2026-07-11

### 변경 (자동화 비용 구조 전환, D20 — 회장 지시)
- 하루 2회 자동화를 **유료 API 키 없이** 회장 Claude 구독 기반 본부장 루틴(Claude Code Remote
  Routine, KST 06:00·18:00)으로 전환. 루틴이 앱 개선 draft PR을 만들고 카카오톡·슬랙(#회사)·
  노션(회장보고)으로 결재 요청을 보낸다. merge는 회장.
- Actions의 Claude 워크플로 4종(daily-company-run·daily-marketing·weekly-review·monthly-board-run)
  스케줄 제거 → 수동 실행(workflow_dispatch) 예비 경로로만 유지. 앱 3개의 daily-self-improve도 동일
  (각 앱 저장소 PR로 처리).
- HUMAN-TASKS 1번(ANTHROPIC_API_KEY 등록) 불필요 처리 — 이제 등록 안 해도 자동화가 돈다.

## [0.4.0] - 2026-07-10

### 변경 (출시 심사 → 자가발전 체계 개편, D16~D19)
- **자가개선 자동화를 각 앱 원본 저장소로 이전(D16)**: 원본 3개 저장소에 `daily-self-improve.yml`
  (하루 2회, KST 06:00·18:00 — 개선 1건 → draft PR → 회장 승인) 신설을 앱 강화 PR로 상신.
  holdings의 `apps/` 사본은 읽기 전용 미러로 격하(`apps/README.md`).
- **드리프트 감시 신설**: `drift-check.yml` + `ops/scripts/check-origin-drift.sh` — 매일 원본 main ↔
  registry ↔ 사본 버전을 대조해 갈라지면 실패(R2 방어를 원본 축까지 확장).
- **본부장 보고 체계(D17)**: daily-company-run을 하루 2회 본부장 업무(상태 점검 + 비전공자용 일일보고
  `ops/reports/` + ops 개선 1건)로 재편. 사람 전용 작업은 `ops/HUMAN-TASKS.md` 단일 목록으로.
- **자동화 fail-fast(D18)**: 4개 Claude 워크플로에 ANTHROPIC_API_KEY preflight — 미등록이면 한국어
  안내와 함께 즉시 실패(OIDC 폴백으로 알아보기 어렵게 죽던 문제 제거. 실제 실패 로그로 원인 확정).
- **1인 회사 브랜치 보호 권장안(D19)**: 승인 수 0 + required checks + force push 차단
  (본인 PR을 본인이 승인 못 해 막히는 문제 회피). 절차는 HUMAN-TASKS 2번.
- 가드레일 보강: base-path-guard가 대상 파일 삭제·이동 시에도 실패. daily-kakao-report에 최소 권한
  블록 + client_id vars 이관 경로. Web Push는 RFC-001(줍줍콜 선검증안)로 문서화.
- CHANGELOG 정렬을 내림차순(최신 위)으로 통일.

### 회장 액션 필요 (ops/HUMAN-TASKS.md)
- ANTHROPIC_API_KEY 등록(4곳) · main 브랜치 보호(4곳) · Vercel Kakao 키 확인 · 과거 토큰 폐기 확인.

## [0.3.2] - 2026-07-10

### 변경 (출시 준비 정합화)
- 세 앱 원본 저장소의 출시 보완 draft PR을 생성하고 holdings 사본을 각 PR head에 동기화했다.
  - zoopzoopcall #8: 알림 표시 성공 후 발송 기록, 원본 CI, 실공고 포함 Pages 빌드.
  - runningcall #5: 위치 오답 차단, API 입력·출처·Nominatim 정책, 알림 한계, 취약점·원본 CI.
  - pushrun #4: PWA 셸, 알림 한계 고지, 모달 포커스, 100개 데이터 검증과 배포 게이트.
- registry 앱 버전을 0.1.3 / 0.13.3 / 0.6.8 RC로 갱신하고 package.json과 자동 대조하는 가드레일을 추가했다.
- PushRun CI가 실제 `featuredRaces`·`scheduleFeed`를 무시하고 0개로 세던 검사를 원본 `npm test`로 교체했다.
- 앱 원본 CI를 릴리스 게이트 정본으로 확정(D15). 서버 Web Push 없는 종료 후 알림은 별도 MAJOR 과제로 유지한다.

## [0.3.1] - 2026-07-10

### 추가 (중복 PR 정리 + 살릴 것 통합 · D14)
- 열린 중복 PR 3개(#3·#7·#8, #9와 겹침)를 정리하고, main에 없던 쓸만한 것만 통합:
  - `monthly-board-run.yml` 신설 — 월간 전략·설계팀(strategist·architect)을 실제로 부르는 경로(그동안 정의만 있고 호출 워크플로 없었음).
  - guardrails `version-single-source` 잡 + `ops/scripts/check-version-single-source.sh` — 문서 버전 하드코딩 차단(드리프트 재발 방지).
  - 참조만 되고 없던 문서 생성: `ops/scorecards/agent-performance.md`, `ops/playbooks/{security-boundaries,operating-model}.md`.
  - 앱 알림 버그 백로그 등록: RISK R11 + ROADMAP P0(zoopzoopcall/runningcall/pushrun 알림 무력화 버그, 각 원본 저장소에서 수정).
- 카카오 일일보고 자동 메시지 "시간 먼저" 통일(3채널 형식 일치).

### 앱 코드(D11 — 각 원본 저장소에서, holdings 미변경)
- runningcall: `docs/TODO.md`에 유출 `ghp_` 토큰 폐기 항목 → 실제 폐기 확인 필요(보안).
- zoopzoopcall: core↔edge 정규화 복사본이 이미 갈라짐(edge가 과거공고 필터·정렬 추가). 테스트 있는 쪽이 배포 안 됨 → dedup 시급(R3/R10).
- pushrun: PWA(manifest/SW/파비콘) 부재 → 알림이 탭 전용. 죽은 permissionModal 정리.

## [0.3.0] - 2026-07-10

### 변경 (전체 코드리뷰 → 운영 규율 정합화)
- **버전 단일화(D13)**: 시스템 버전 숫자를 루트 `VERSION` 단일 소스로. README·AGENTS·REPO-SETUP에서
  하드코딩 숫자 제거("VERSION 참조"로). 5곳 불일치(0.1.0~0.2.7) 해소.
- **근본원인 제거**: `daily-company-run.yml`이 앱 작업에도 시스템 VERSION을 올리라던 지시를 교정
  (앱은 package.json만 bump, 시스템 VERSION은 운영/자동화 변경 때만).
- **agent 프롬프트 경로 교정**: inspector/builder/release-manager가 holdings 레이아웃(`apps/<app>/...`)에서
  실제 동작하도록 수정. inspector는 registry의 앱별 test/build 명령을 그 앱 디렉터리에서 실행하도록 일반화.
- **가드레일 단일 소스 실천**: `guardrails.yml`의 registry-sanity가 앱명 하드코딩 대신 `apps.yml`에서 읽음.
- **끊긴 참조 정리**: 참조만 되고 없던 playbook `rollback.md`·`new-app-onboarding.md` 생성.
  AGENTS.md 워크플로 목록(4→8)·마지막 갱신 최신화. REPO-SETUP stale 정정.
- **방어선 정직화**: `.github/CODEOWNERS` 추가(base path·워크플로·거버넌스 파일). RISK_REGISTER R1/R7 갱신.

### 사장 액션 필요
- GitHub → Settings → Branches → main 보호 + "Require review from Code Owners" 활성화(R7). 켜야 PR-only가 실제 강제됨.

## [0.2.7] - 2026-07-09

### 추가 (첫 코드 데일리 사이클 — 3개 앱)
- runningcall: ROADMAP P0(레이트리밋/오리진 제한) 실행 — `/api/search-location`, `/api/reverse-location`,
  `/api/forecast`에 in-memory 레이트리밋(IP당 분당 20회) + same-origin 검증 추가. Kakao 유료 API 키 소진
  방지(D12/R9) 위험 종결. PR #2(draft).
- zoopzoopcall: `apps/web` 테스트를 no-op에서 실제 vitest 실행으로 전환 + `collectPendingAlerts` 단위테스트
  4개 추가. PR #3(draft). (P0 Edge Function↔packages/core 정규화 중복 제거는 조사 결과 하루 범위 초과 판단,
  미착수·제안서 필요 상태로 ROADMAP에 보류 표기)
- pushrun: 모달(alertModal/permissionModal/batteryModal) Esc 키 닫기 추가. PR #2(draft). (races.json
  http→https, 버전/캐시버스트 단일화는 위험 판단으로 보류)
- 세 저장소 모두 draft PR만 생성(main 직접 push 없음), 사람 머지 대기.

### 다음
- 3개 앱 draft PR 검수·머지(사람), zoopzoopcall P0 dedup 제안서 작성.

## [0.2.6] - 2026-07-09

### 추가
- ops/handoff/update-prompts.md — 각 앱(runningcall/pushrun/zoopzoopcall) 저장소 AI에게
  진단 결과+업데이트 지시를 넘기는 자체완결 프롬프트(의견 요청 → 안전 항목 PR 실행).

## [0.2.5] - 2026-07-09

### 추가 (전수 진단 결과 반영)
- ROADMAP 앱 최적화 백로그(P0~P2), RISK_REGISTER R9(러닝콜 API키)·R10(공유코드 중복).
- ci-pushrun: races.json 검증(JSON 파싱 + http:// mixed-content 경고).
- DECISIONS D12(진단 요약).

## [0.2.4] - 2026-07-09

### 변경 (전체 점검·최적화 1차 — 관제 레이어)
- .gitignore 확장(Next.js/빌드 산출물), state(holdings) 최신화.
- claude-code-action 워크플로 3종: --max-turns 비용 상한 + issues:write 권한(GA @v1 인터페이스 확인).
- 문서 정리: REPO-SETUP 완료표시, STRUCTURE→AGENTS.md 정본 안내.
- 점검 결과: 커밋에 secret/빌드산출물 없음(clean). 앱 코드 최적화는 각 앱 저장소에서(D11).

## [0.2.3] - 2026-07-09

### 추가 (포트폴리오 홍보 완성)
- 홍보팀: runningcall·pushrun 다채널 콘텐츠팩 생성 → ops/content/2026-07-09/{runningcall,pushrun}/.
  → 3개 앱 전부 첫 홍보 콘텐츠 확보. 상태=게시대기(외부 게시는 사람 승인).
- 기록팀: runningcall·pushrun state 갱신.

## [0.2.2] - 2026-07-09

### 변경 (CI 자기수정)
- guardrails 를 범용 검사만 남기고, 앱별 CI를 ci-zoopzoopcall/ci-runningcall/ci-pushrun 로 분리(path 필터).
- runningcall CI pnpm 10 으로 교정(워크스페이스 문법 일치). 콘텐츠/문서 PR은 앱 빌드 스킵.

## [0.2.1] - 2026-07-09

### 추가 (첫 daily 사이클 · 홍보)
- 홍보팀: zoopzoopcall 다채널 콘텐츠팩 생성 → `ops/content/2026-07-09/zoopzoopcall/`
  (youtube-shorts / instagram / blog-seo / community-replies). 상태=게시대기, 외부 게시는 사람 승인.
- 기록팀: state·changelog 갱신. 성장 루프 첫 산출물 기록.

## [0.2.0] - 2026-07-09

### 추가
- runningcall(v0.13.1, Next.js/Vercel), pushrun(v0.6.6, 정적/Pages) 를 회사에 편입 → 3개 앱 관리.
- registry/apps.yml 을 실제 스택·배포·버전으로 갱신(이종 앱 대응).
- 앱별 가드레일 원칙 확정(D8), 편입 방식 결정(D9).
- AGENTS.md 추가(모든 AI 온보딩·업데이트내역 안내), guardrails 3개 앱 대응(앱별 검사 + registry 정합성).

## [0.1.0] - 2026-07-09

### 추가 (회사 착수)
- 관제 저장소 뼈대 생성: `ops/`, `.claude/agents/`(11명), `.github/workflows/`(4개), `CLAUDE.md`.
- `apps/zoopzoopcall` 을 federated 방식으로 편입(원본 저장소 불변, `/zoopzoopcall/` base path 유지).
- 운영 장부: `registry/apps.yml`, 앱별 `state`·`changelog`, `scorecards/app-priority`, 플레이북.
- 홍보를 매일·다채널로 편성(콘텐츠 자동 생성 / 외부 게시는 사람 승인).

### 결정 (DECISIONS.md 참조)
- D1 관제 저장소 모델(A) 채택. 앱 코드는 개발/기록용으로 복사하되 **배포는 원본에서**.
- 루트 pnpm-workspace 두지 않음(모노레포 안 모노레포 충돌 회피, federated 유지).
- 가드레일 검사를 앱 워크스페이스(`apps/zoopzoopcall`) 안에서 실행하도록 교정.

### 다음 (ROADMAP.md)
- CI 실제 연결(guardrails), ANTHROPIC_API_KEY secret 등록, 첫 daily run 시범.
