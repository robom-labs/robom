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
