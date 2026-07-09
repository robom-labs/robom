> 이 문서는 파일구조 참고용. **회사 전체 파악은 AGENTS.md 를 먼저 읽으세요(정본).**

# zoop-holdings — 실제 파일 구조 (현행)

> 모델 A(관제 저장소): 앱 코드는 각자 원본 저장소에서 배포되고, holdings는 운영·자동화·기록만 담당.
> 앱이 3개든 30개든 이 구조는 그대로. 아래는 **현재 저장소에 실제로 있는 것**을 반영한다(블루프린트 아님).

```
zoop-holdings/
├─ VERSION                         # 시스템 버전 (단일 소스: 이 파일 + CHANGELOG.md)
├─ CHANGELOG.md                    # 회사 운영방식/자동화 변경 이력
├─ README.md                       # 회사 소개(사람용)
├─ AGENTS.md                       # ★ 모든 AI 온보딩 정본
├─ CLAUDE.md                       # 절대 규칙 / 금지작업
├─ STRUCTURE.md  REPO-SETUP.md     # 구조/셋업 이력
│
├─ .claude/agents/                 # AI 직원 프롬프트 (현재 11개 정의 — 편성은 D13)
│   ├─ ceo-orchestrator.md planner.md builder.md inspector.md recorder.md   # 매일(마스터+실행4팀=5)
│   ├─ growth-marketer.md          # 매일(별도 워크플로)
│   ├─ supervisor.md upgrader.md release-manager.md                          # 주간(3)
│   └─ strategist.md architect.md                                            # 월간(2)
│
├─ .github/workflows/
│   ├─ daily-company-run.yml       # 매일 09:00 KST: 실행 4팀 → draft PR
│   ├─ daily-marketing.yml         # 매일 09:30: 홍보 콘텐츠팩 → draft PR
│   ├─ weekly-review.yml           # 주간(월): 감독·개선·릴리즈
│   ├─ monthly-board-run.yml       # 월간(1일): 전략·설계
│   ├─ guardrails.yml              # 상시(PR마다): base-path/registry/lockfile/secret
│   ├─ ci-zoopzoopcall.yml ci-runningcall.yml ci-pushrun.yml                 # 앱별 CI(path 필터)
│   └─ daily-kakao-report.yml      # 매일 08:00: draft PR 현황 카카오 알림
│
└─ ops/                            # 경영기획실 / 운영 장부
    ├─ DESIGN.md DECISIONS.md ROADMAP.md RISK_REGISTER.md
    ├─ registry/apps.yml           # ★ 앱 목록 단일 소스
    ├─ state/                      # 앱별 인수인계: _TEMPLATE, holdings, zoopzoopcall, runningcall, pushrun
    ├─ changelog/                  # 앱별 변경 이력(holdings 관점)
    ├─ content/YYYY-MM-DD/<app>/   # 홍보팀 산출물(게시대기): youtube-shorts/instagram/blog-seo/community-replies
    ├─ scorecards/                 # app-priority.md, agent-performance.md
    ├─ handoff/update-prompts.md   # 앱 버그를 각 원본 저장소 AI에게 넘기는 프롬프트
    └─ playbooks/                  # base-path-check, marketing-channels, rollback,
                                   #   new-app-onboarding, security-boundaries
```

## 앱이 늘어날 때 (3개 → N개) — playbooks/new-app-onboarding.md 게이트 참조
1. `ops/registry/apps.yml` 에 앱 한 블록 추가
2. `ops/state/<app>.md` + `ops/changelog/<app>.md` 생성 (`_TEMPLATE.md` 복사)
3. 앱별 CI 필요하면 `ci-<app>.yml`(path 필터). 팀·중앙 워크플로는 **손대지 않는다.**

## 실행 주체
- **매일 09:00** `daily-company-run` → 마스터 + 실행 4팀(총 5명)이 앱 1개 개선 → draft PR
- **매일 09:30** `daily-marketing` → 홍보 콘텐츠팩 → draft PR
- **주 1회(월)** `weekly-review` → 감독·개선·릴리즈
- **월 1회(1일)** `monthly-board-run` → 전략·설계
- **상시** `guardrails` + 앱별 `ci-*` → PR마다 안전검사
- **사람(사장)** → PR 승인·merge, 홍보 콘텐츠 실제 게시
