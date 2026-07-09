# CHANGELOG — zoop-holdings 시스템

이 회사의 **운영 방식/자동화** 변경 이력. [SemVer](https://semver.org/lang/ko/).
(앱 자체 변경은 각 `apps/<app>/CHANGELOG.md` 참조.)

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

## [0.2.0] - 2026-07-09

### 추가
- runningcall(v0.13.1, Next.js/Vercel), pushrun(v0.6.6, 정적/Pages) 를 회사에 편입 → 3개 앱 관리.
- registry/apps.yml 을 실제 스택·배포·버전으로 갱신(이종 앱 대응).
- 앱별 가드레일 원칙 확정(D8), 편입 방식 결정(D9).
- AGENTS.md 추가(모든 AI 온보딩·업데이트내역 안내), guardrails 3개 앱 대응(앱별 검사 + registry 정합성).

## [0.2.1] - 2026-07-09

### 추가 (첫 daily 사이클 · 홍보)
- 홍보팀: zoopzoopcall 다채널 콘텐츠팩 생성 → `ops/content/2026-07-09/zoopzoopcall/`
  (youtube-shorts / instagram / blog-seo / community-replies). 상태=게시대기, 외부 게시는 사람 승인.
- 기록팀: state·changelog 갱신. 성장 루프 첫 산출물 기록.

## [0.2.2] - 2026-07-09

### 변경 (CI 자기수정)
- guardrails 를 범용 검사만 남기고, 앱별 CI를 ci-zoopzoopcall/ci-runningcall/ci-pushrun 로 분리(path 필터).
- runningcall CI pnpm 10 으로 교정(워크스페이스 문법 일치). 콘텐츠/문서 PR은 앱 빌드 스킵.

## [0.2.3] - 2026-07-09

### 추가 (포트폴리오 홍보 완성)
- 홍보팀: runningcall·pushrun 다채널 콘텐츠팩 생성 → ops/content/2026-07-09/{runningcall,pushrun}/.
  → 3개 앱 전부 첫 홍보 콘텐츠 확보. 상태=게시대기(외부 게시는 사람 승인).
- 기록팀: runningcall·pushrun state 갱신.

## [0.2.4] - 2026-07-09

### 변경 (전체 점검·최적화 1차 — 관제 레이어)
- .gitignore 확장(Next.js/빌드 산출물), state(holdings) 최신화.
- claude-code-action 워크플로 3종: --max-turns 비용 상한 + issues:write 권한(GA @v1 인터페이스 확인).
- 문서 정리: REPO-SETUP 완료표시, STRUCTURE→AGENTS.md 정본 안내.
- 점검 결과: 커밋에 secret/빌드산출물 없음(clean). 앱 코드 최적화는 각 앱 저장소에서(D11).

## [0.2.5] - 2026-07-09

### 추가 (전수 진단 결과 반영)
- ROADMAP 앱 최적화 백로그(P0~P2), RISK_REGISTER R9(러닝콜 API키)·R10(공유코드 중복).
- ci-pushrun: races.json 검증(JSON 파싱 + http:// mixed-content 경고).
- DECISIONS D12(진단 요약).

## [0.2.6] - 2026-07-09

### 추가
- ops/handoff/update-prompts.md — 각 앱(runningcall/pushrun/zoopzoopcall) 저장소 AI에게
  진단 결과+업데이트 지시를 넘기는 자체완결 프롬프트(의견 요청 → 안전 항목 PR 실행).

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
