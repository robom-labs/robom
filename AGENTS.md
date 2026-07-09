# AGENTS.md — 이 저장소에서 일하는 모든 AI가 가장 먼저 읽는 문서

> 목적: 어떤 AI가 이 저장소를 처음 열어도 **5분 안에 전체 그림과 최신 상태를 파악**하고, 규칙을 어기지 않고 이어서 일할 수 있게 한다. 사람도 이걸 먼저 읽으면 된다.

---

## 0. 이게 뭐야 (3줄 요약)
- `zoop-holdings`는 **1인 지주회사** — 여러 앱을 매일 조금씩 자동으로 개선·홍보하는 AI 운영 회사다.
- **본사(관제)** = 이 저장소 루트(`ops/`·`.claude/`·`.github/`). **제품** = `apps/` 아래 3개 앱.
- **모든 변경은 PR로.** main 직접 push 금지. 배포·비밀키·큰 변경은 **사람(사장) 승인** 필수.

## 1. 새 AI는 이 순서로 읽어라 (딱 5개)
1. **이 파일(AGENTS.md)** — 규칙과 지도
2. **`CHANGELOG.md`** — 회사 시스템 업데이트 내역(무엇이 언제 바뀌었나)
3. **`ops/DECISIONS.md`** — 왜 이렇게 만들었나(확정 결정 D1~D13, D6 결번, 열린 결정 D-open)
4. **`ops/state/*.md`** — 각 앱의 현재 상태·다음 할 일·인수인계 (가장 최신 실황)
5. **`ops/registry/apps.yml`** — 앱 목록 단일 소스(스택·배포·버전)

그 다음 깊이 파려면: `ops/DESIGN.md`(전체 설계서), `CLAUDE.md`(금지작업), `ops/ROADMAP.md`(할 일).

## 2. 업데이트 내역은 어디에 있나 (★ 다른 AI가 헷갈리지 않게)
| 무엇을 바꿨나 | 어디에 기록하나 | 버전 |
|---|---|---|
| 회사 운영방식·자동화·agent·워크플로 | 루트 `CHANGELOG.md` + `VERSION` | 시스템 SemVer |
| 특정 앱의 기능/버그/UX | `apps/<app>/CHANGELOG.md` + 그 앱 `package.json` | 앱별 SemVer |
| 구조/정책 결정 | `ops/DECISIONS.md` (추가만, 삭제 금지) | — |
| 그날 한 일·다음 할 일·막힌 것 | `ops/state/<app>.md` (짧게 유지) | — |
| 리스크 | `ops/RISK_REGISTER.md` | — |
**규칙: 작업하면 반드시 위 표대로 기록을 남긴다. 기록 없는 변경 = 다음 AI가 맥락을 잃음 = 금지.**

## 3. 전체 구조 지도
```
zoop-holdings/
  AGENTS.md          ← 지금 이 문서 (AI 온보딩)
  CLAUDE.md          ← 절대 규칙 / 금지작업
  VERSION            ← 시스템 버전 (현재 0.2.8 — 단일 소스는 VERSION+CHANGELOG)
  CHANGELOG.md       ← 시스템 업데이트 내역
  README.md          ← 사람용 소개
  STRUCTURE.md       ← 파일구조 설명
  REPO-SETUP.md      ← 저장소 셋업 이력
  .claude/agents/    ← AI 직원 11명(프롬프트). 마스터가 이들을 호출
  .github/workflows/ ← daily-company-run / daily-marketing / weekly-review / guardrails
  ops/
    DESIGN.md  DECISIONS.md  ROADMAP.md  RISK_REGISTER.md
    registry/apps.yml         ← 앱 목록 단일 소스
    state/<app>.md            ← 앱별 실황(인수인계)
    changelog/<app>.md        ← 앱별 이력(holdings 관점)
    scorecards/app-priority.md← 오늘 어느 앱? 점수표
    playbooks/                ← 실행 규칙(마케팅·base-path·보안 등)
    content/<날짜>/<app>/     ← 홍보팀 산출물(게시 대기)
  apps/
    zoopzoopcall/  runningcall/  pushrun/   ← 독립 앱 3개(각자 스택)
```

## 4. 지금 관리 중인 앱 3개 (2026-07-09 기준)
| 앱 | 정체 | 버전 | 스택 | 배포 | 특이사항 |
|---|---|---|---|---|---|
| **zoopzoopcall** | 줍줍콜(청약 무순위 알림) | 0.1.0 | Vite+React PWA | GitHub Pages `/zoopzoopcall/` | base path 변경 금지 |
| **runningcall** | 러닝콜(야외활동 컨디션) | 0.13.1 | Next.js16+React19 | Vercel | 러닝 골든마스터 테스트 |
| **pushrun** | PushRun(러닝대회 알림) | 0.6.6 | 정적 사이트 | Pages+Vercel | 빌드 없음(outputs/pushrun-site) |
> 앱 코드는 각자 원본 저장소에도 존재하고 **거기서 배포된다.** 여기 `apps/`는 관제·개발 사본(D1/D9). 원본 배포는 건드리지 않는다.

## 5. 어떻게 일하나 (하루 사이클)
1. 마스터(`.claude/agents/ceo-orchestrator.md`)가 `app-priority.md`로 **오늘 앱 1개** 선택
2. 실행 4팀 호출: `planner`→`builder`→`inspector`→`recorder`
3. 홍보팀(`growth-marketer`)이 오늘 앱의 다채널 콘텐츠 초안을 `ops/content/`에 생성
4. **하루 = 앱1·목표1·PR1.** 브랜치 `claude/daily-YYYY-MM-DD` → **draft PR** → 사람 merge
5. 주간: `supervisor`(직원 평가·프롬프트 개선)·`upgrader`·`release-manager` / 월간: `strategist`·`architect`

## 6. 절대 규칙 (자세한 건 CLAUDE.md)
- **사장님은 비전문가 → 보고·질문은 초등학생도 알아듣게 쉬운 말로. 전문용어 금지(쓰면 괄호로 뜻 붙이기), 질문은 선택지로.** (CLAUDE.md 최상단 규칙)
- main 직접 push ✗ / PR만 ✓
- secret·OAuth·prod DB·배포설정 변경 ✗ (사람만)
- `/zoopzoopcall/` base path 변경 ✗ (guardrails가 차단)
- 외부 채널(유튜브·인스타 등) **자동 게시 ✗** — 콘텐츠는 만들되 발행은 사람
- 테스트 실패 상태 릴리스 ✗ / lockfile 대량 변경 ✗
- 의심되면 실행 말고 물어본다.

## 7. 작업 끝내기 전 체크리스트 (모든 AI 공통)
- [ ] 변경을 선언한 파일 범위 안에서만 했는가
- [ ] `apps/<app>/CHANGELOG.md` 또는 루트 `CHANGELOG.md` 갱신했는가
- [ ] `ops/state/<app>.md`의 "방금 한 일 / Next" 갱신했는가
- [ ] 버전 bump 했는가(시스템 or 앱)
- [ ] draft PR로 올렸는가(main 직접 push 안 함)
- [ ] 새 결정을 했으면 `ops/DECISIONS.md`에 추가했는가

---
*이 문서는 회사가 바뀌면 같이 갱신한다. 마지막 갱신: 2026-07-09 (시스템 v0.2.8, 관제 레이어 전수 점검·정합화).*
