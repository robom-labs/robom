# 자율 Loop OS — 남은 3개 항목 구현 설계 (맥 Codex 연결 시 즉시 실행)

이 문서는 실제 Codex CLI·라이브 환경이 필요해 이 작업환경에서 안전 검증이 불가한 3개 항목의
**바로 실행 가능한 구현 설계**다. 회장님 맥에서 `codex login`이 되는 순간 이 설계대로 구현·검증한다.

---

## 1. §10.1 worktree 격리 실행 (codex-runner.mjs)

**목표**: 한 작업이 대상 저장소를 직접 오염시키지 않도록 격리된 git worktree에서 Codex를 실행한다.

**구현**:
- `codex-runner.mjs`의 `runOne()`에서 `resolveWorkdir` 뒤에 `prepareWorktree(repoDir, taskId)` 추가:
  1. `git -C <repoDir> worktree add --detach <TMP>/robom-wt-<taskId> HEAD` (또는 새 브랜치 `robom/loop-<taskId>`).
  2. `codex exec --cd <worktree>` 로 실행(현재 인자 유지 + model/effort).
  3. 성공 시: 워크트리 브랜치를 main에 fast-forward/merge하고 push(기존 배포 파이프라인). 실패 시 워크트리 폐기.
  4. `finally`에서 `git worktree remove --force <worktree>` 로 정리.
- **검증(맥)**: 더미 작업으로 worktree add→exec→remove가 저장소를 더럽히지 않는지 확인. 병렬 2건이 충돌 없이 도는지.
- **안전**: worktree 경로는 항상 `mkdtemp` 아래. 실패해도 원본 저장소 unchanged.

**테스트**: `prepareWorktree`/`cleanupWorktree`를 순수 함수로 분리해 경로 조립·명령 인자를 단위 테스트(spawn mock).

---

## 2. §11 즉시 webhook 이벤트 (serve.mjs)

**현황**: 감시기(watchdog)가 10분마다 반응 → 준실시간. 즉시성만 부족.

**구현**:
- `serve.mjs`에 `POST /api/events` 로컬 엔드포인트(토큰 인증) 추가: GitHub Actions/배포 훅이 상태 변화를 통지.
- 수신 이벤트 종류: `ci_completed`, `deploy_completed`, `push`, `pr_merged`.
- 처리: 해당 앱의 계약을 즉시 재점검(`runDeepContracts({ only: appId })`) → `runDailyReviewIfDue({ force: true })` 로 origin 재검증·Loop 전이를 바로 수행.
- GitHub 쪽: 각 앱 저장소 배포 워크플로 마지막에 `curl $ROBOM_HQ_EVENT_URL`(회장 맥의 Tailscale 주소) 한 줄 추가(선택).
- **안전**: 엔드포인트는 로컬/토큰 전용(기존 mobile-access 토큰 패턴 재사용). 외부 미설정 시 기존 10분 감시기로 그대로 동작(무해).

**테스트**: 이벤트 파서·디바운스(같은 앱 5초 내 중복 무시) 단위 테스트.

---

## 3. §16 별도 red-team 단계 (loop-engine + serve)

**현황**: verifier(원래 계약 2회 재검증 + 회귀 감사)는 있음. 완료를 **깨뜨리려는** 독립 단계가 없음.

**구현(결정론 red-team, 2차 AI 없이도 가능한 범위)**:
- Loop가 종료 직전 `RED_TEAM_AUDIT` 상태를 거치게 한다.
- red-team 체크(모두 결정론):
  1. **인접 계약 회귀**: 대상 앱의 *모든* 계약을 재실행(원래 것만이 아니라) → 하나라도 새로 FAIL이면 종료 거부(현재 회귀 감사의 강화판).
  2. **캐시 의심**: origin 재검증이 캐시된 과거 PASS가 아니라 이번 사이클 실측인지 `checkedAt` 신선도 확인.
  3. **증거 완전성**: acceptance_criteria의 required 항목에 evidence가 다 있는지.
- 셋 다 통과해야 CLOSED. 하나라도 실패 → openIteration.
- (2차 AI red-team은 맥의 Codex로 별도 프롬프트 실행 — 실제 실행자 연결 후.)

**테스트**: red-team 판정 함수(인접 회귀·캐시 신선도·증거 완전성) 단위 테스트.

---

## 실행 순서(맥 연결 후)
1. worktree(격리) → 러너 안정성 확보 → 실측 검증.
2. red-team 결정론 단계 → 종료 엄격화.
3. webhook 즉시 이벤트 → 반응성.
각 항목: 구현 → 단위 테스트 → 패키지 빌드 검증 → 릴리스 → 세 차례 반박 감사(§17).
