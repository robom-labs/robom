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
