# 실시간 연동 어댑터 — 코덱스·클로드·Actions가 일하면 오피스에서 캐릭터가 움직이게

로봄 본부 오피스는 `ops/control-center/events/*.jsonl`(작업 이벤트)를 읽어 캐릭터를 움직인다.
아래 어댑터를 연결하면, 실제 세션/워크플로가 일할 때 그 직원 캐릭터가 자리에서 일/검증/막힘/회의로 실시간 반응한다.
(연결 전에는 오토파일럿으로 자동 이동. 연출 금지: 실제 이벤트가 있을 때만 '일하는 중'.)

## 1) Claude Code 훅

`.claude/settings.json`(또는 프로젝트 `.claude/settings.local.json`)에 훅을 추가:

```jsonc
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node scripts/control-center/adapters/claude-hook.mjs session-start" }] }],
    "PreToolUse":   [{ "hooks": [{ "type": "command", "command": "node scripts/control-center/adapters/claude-hook.mjs pretool" }] }],
    "PostToolUse":  [{ "hooks": [{ "type": "command", "command": "node scripts/control-center/adapters/claude-hook.mjs posttool" }] }],
    "Stop":         [{ "hooks": [{ "type": "command", "command": "node scripts/control-center/adapters/claude-hook.mjs stop" }] }],
    "Notification": [{ "hooks": [{ "type": "command", "command": "node scripts/control-center/adapters/claude-hook.mjs notification" }] }]
  }
}
```

- 회의실별로 누가 일하는지 구분하려면 세션 환경변수로 직원 지정: `ROBOM_HQ_AGENT=room-01`(또는 room-02/03).
- 훅은 코드 수정 → `implementing`, 테스트/빌드 → `verifying`, 종료 → `completed`, 입력대기 → `blocked` 로 매핑한다.
- cwd에 앱 이름(outbom/homebom/…)이 있으면 그 앱으로 자동 태깅 → 같은 앱 2명↑이면 오피스에서 회의 소집.

## 2) Codex 어댑터

Codex 실행 래퍼(또는 후처리)에서 동일하게 `emit-event`를 호출한다:

```bash
node scripts/control-center/emit-event.mjs --run "$CODEX_RUN" --agent room-02 --app runningbom \
  --type implementation_started --status implementing --message "카드 리팩터"
```

훅 인터페이스가 없으면, 작업 시작/테스트/PR/종료 지점에서 위 명령을 남기도록 스크립트에 심는다.

## 3) GitHub Actions 어댑터

배포·CI 워크플로 step에 추가(본부 저장소 체크아웃이 있는 잡에서):

```yaml
- name: robom-hq event (deploy start)
  run: bash scripts/control-center/adapters/actions-emit.sh deploy_started deploying release-manager runningbom "Pages 배포 시작"
# ... 배포 후 ...
- name: robom-hq event (deploy done)
  if: success()
  run: bash scripts/control-center/adapters/actions-emit.sh deploy_completed completed release-manager runningbom "배포 성공"
```

## 4) heartbeat / 상태 만료

장시간 작업은 주기적으로 `--type heartbeat`를 남긴다(예: 5분마다). 마지막 활동이 30분을 넘으면 본부가 자동으로 "상태 확인 필요"로 바꾼다(연출 방지).

## 주의

- 이벤트에 프롬프트 원문·비밀값·개인정보·전체 로그를 넣지 않는다(요약·증거만).
- `events/*.jsonl`·`snapshots/latest.json`은 `.gitignore`(내부 데이터, 커밋 금지).
- 직원 id는 `agents.yml`·`office.js` 로스터와 일치해야 캐릭터에 매핑된다(없으면 `OFFICE-UPDATE.md`대로 로스터에 추가).

## 5) 오피스 게임 실제 검증 절차

아래 상태를 로컬에서 `emit-event.mjs`로 주입한 뒤 `build-snapshot.mjs`와 `office.html`을 대조한다. 이 이벤트 파일과 `snapshots/latest.json`은 모두 `.gitignore` 대상이며 검증 후 제거한다.

- `implementing`은 해당 직원의 자리 작업과 직원 상세 패널에 표시된다.
- 같은 앱에서 서로 다른 직원 2명 이상이 활성화되면 대회의실로 이동한다.
- `blocked`, `approval_pending`, `deploying` 전이에서 토스트가 한 번만 표시된다.
- 마지막 heartbeat가 30분을 넘으면 `needs_check`로 변환돼 상태 확인이 필요함을 표시한다.
- 이벤트가 없을 때 업무·회의·배포 숫자는 0이며 캐릭터는 대기·휴식·식사·순찰만 한다.
