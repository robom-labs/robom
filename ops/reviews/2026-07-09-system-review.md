# 전수 리뷰·최적화 리포트 — 2026-07-09 (시스템 v0.2.8)

> 요청: "보완할 거 싹 다 — 직원 인원수·팀배치·디자인·프로그램·오류수정·최적화."
> 범위: **관제 레이어는 이 PR에서 직접 수정**, **앱 코드는 백로그+핸드오프**(D11 준수 — vendored 사본은 배포에 안 닿아 드리프트만 커짐. 사장 확인 완료).
> 방법: 4개 병렬 감사(zoopzoopcall·runningcall·pushrun 코드 + 관제 문서/직원 정합성).

---

## 1. 직원 인원수·팀배치 (요청 핵심) → D13으로 확정

- **진단**: DESIGN v0.4.0은 "v1 실동 6명"을 권장했으나 회사가 3앱+매일홍보로 성장. 직원 파일은 11개인데
  그중 **strategist·architect(월간)는 부르는 워크플로가 없어 정의만 되고 실행 불가**였다(가장 큰 편성 갭).
- **확정(D13)**: 매일 5(마스터+실행4팀) · 매일 홍보 1 · 주간 3(supervisor·upgrader·release) · 월간 2(strategist·architect).
- **수정 적용**:
  - `monthly-board-run.yml` 신설 → strategist·architect 실제 호출 경로 확보.
  - 역할 중복(planner/upgrader/strategist가 모두 ROADMAP에 투입) → 중재 규칙 명문화(월간→주간→매일, 위에서 아래로).
  - 승격/강등 트리거 유지: 앱6개↑→architect 상시화, 릴리스 주2회↑→release 상시화, DAU 유의미→analytics.

## 2. 관제 레이어 오류·드리프트 수정 (이 PR에서 직접)

| 항목 | 문제 | 수정 |
|---|---|---|
| 버전 5중 불일치 | VERSION 0.2.6 / CHANGELOG 0.2.7 / README 0.1.0 / AGENTS 0.2.0 / state 0.2.3 | 전부 **0.2.8**로 통일(이번 릴리스) + "단일 소스=VERSION+CHANGELOG, 손기입 금지" 명시 |
| inspector.md (반복 CI실패 원인) | 루트 `pnpm -r`(워크스페이스 없음)·base-path 경로 오타 | 앱별 registry 명령 + `apps/<app>/` 접두사 + 앱별 pnpm 버전 |
| builder.md / release-manager.md | zoopzoopcall 전용 경로가 접두사 없이 → 3앱에 오적용 | 앱별 구조 인식 + 경로 접두사 + vendored 사본 주의 |
| "stub" 오표기 | app-priority·ROADMAP이 runningcall/pushrun을 stub 취급(우선순위 오판) | 3앱 모두 live(D7) 반영 |
| 누락 참조 파일 | agent-performance.md·rollback.md·new-app-onboarding.md·security-boundaries.md 부재(주간/월간 루프 잠재 실패) | 4개 실제 생성 |
| STRUCTURE.md | "블루프린트" 서술 + 없는 파일 나열 | 실제 저장소 구조로 갱신 |
| D-번호 충돌 | DECISIONS D7~D9 ↔ DESIGN D7~D9 의미 다름, D6 결번 | 네임스페이스 분리 명시 |
| 낡은 서술 | README "zoopzoopcall만", growth-marketer "runningcall/pushrun 초기" | 3앱 live로 갱신 |

## 3. 앱 코드 — 심층 감사 발견 (D11: 각 원본 저장소에서 수정, handoff/update-prompts.md + ROADMAP P0-신규)

**공통 주제: 세 앱 모두 "알림"이 핵심인데 알림이 조용히 안 가는 HIGH 버그가 있다(R11).**

- **zoopzoopcall** — `scheduler.ts`: 권한 미허용 시에도 `markFired` 선행 → 알림 **영구 억제**(권한 나중에 켜도 안 옴). + useNotices 응답 미검증(불량→"마감") + fetch 타임아웃 없음 + 토글 aria-label 없음.
- **runningcall** — `page.tsx` 한글 동네명 정규식 `\b`가 한글 뒤 미매치 → **위치검색 전면 차단**(성수동 등 전부 실패). + getDayParts 과거슬롯로 카드 전체 폐기 + "내일" 탭이 오늘 일출/일몰.
- **pushrun** — `app.js`: (a) 모달이 매초 체크박스 리셋해 편집 유실, (b) setTimeout 24.8일 초과 알림 미예약(**8·9월 대회 대부분 알림 안 옴**), (c) 스케줄피드 배열-index ID로 데이터 갱신 시 저장 알림 유실. + #raceDetail 부재로 상세 기능 dead.

> 이미 진행된 앱 작업(참고): runningcall API 레이트리밋(PR#2), zoopzoopcall 테스트 실연결(PR#3), pushrun 모달 Esc(PR#2) — 전부 draft, 사람 머지 대기.

## 4. 사장 결정 대기 (구조/MAJOR — 코드 아님, 제안만)

- **D-open-4 (권장)**: vendored 사본 → git submodule 전환. R2(드리프트)의 근본 해소. 현재 apps/* 수정이 배포에 안 닿는 구조적 모순을 없앤다.
- **D-open-1**: 배포를 holdings로 이관할지(모델 C). 하면 base path 전략 재확정 필요 → MAJOR 제안서 선행.
- **R10/R3**: zoopzoopcall `packages/core`를 3앱 공유 패키지로 승격(공통 KST/알람/알림 1벌화) — 지주회사 최대 레버리지.
- **branch protection + CODEOWNERS**(R7): main 직접 push 물리 차단. PR-only 정책의 완성 조건(사장 설정).

## 5. 안 건드린 것 (의도적)
- 앱 코드 직접 수정 안 함(D11). base path·secret·prod DB·배포 워크플로 무변경(CLAUDE.md 금지작업).
- guardrails 로직·카카오 워크플로 무변경(정상 동작 중).
