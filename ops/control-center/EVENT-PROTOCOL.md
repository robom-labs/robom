# 작업 이벤트 프로토콜 (robom-hq)

로봄 본부가 직원을 "작업 중"으로 표시하는 **유일한 근거**. Claude Code·Codex·GitHub Actions·회의실 01/02/03이 같은 형식으로 남긴다. 이벤트가 없으면 직원은 "대기"다(연출 금지).

## 남기는 법

```bash
node scripts/control-center/emit-event.mjs \
  --run run_hb1 --agent homebom-data --department data-automation \
  --app homebom --repo robom-labs/homebom --branch r01/normalize-price \
  --type test_completed --status verifying --command "pnpm test" --result PASS \
  --message "공개 API 계약 검사 통과"
```

- `--run` 같은 값을 한 작업 내내 유지하면 그 작업의 타임라인으로 접힌다(없으면 taskId→agentId 순).
- `--json '{...}'` 로 완성된 이벤트를 직접 넘길 수도 있다.
- 파일: `ops/control-center/events/<KST날짜>.jsonl` 에 append (gitignore, 커밋 안 됨).

## 이벤트 형식

```json
{
  "eventId": "evt_...", "taskId": "task_...", "runId": "run_...",
  "agentId": "homebom-data", "departmentId": "data-automation",
  "appId": "homebom", "repo": "robom-labs/homebom",
  "branch": "r01/normalize-price", "sha": "abcdef1",
  "type": "test_completed", "status": "verifying",
  "message": "공개 API 계약 검사가 통과했습니다.",
  "evidence": { "command": "pnpm test", "result": "PASS", "pullRequest": null, "workflowRun": null },
  "createdAt": "ISO-8601"
}
```

## 이벤트 종류

`task_created` · `task_assigned` · `run_started` · `repository_read` · `scope_declared` · `implementation_started` · `file_changed` · `test_started` · `test_completed` · `test_failed` · `retry_started` · `pr_created` · `approval_requested` · `approval_received` · `deploy_started` · `deploy_completed` · `production_verified` · `rollback_started` · `rollback_completed` · `run_blocked` · `run_failed` · `run_completed` · `heartbeat`

## 상태 판정 (마지막 이벤트 기준)

| 상태 | 조건 |
|---|---|
| 검증 중 | `test_started` 이후 ~ `test_completed`/`test_failed` 이전 |
| 승인 대기 | `approval_requested` 있고 `approval_received` 없음 |
| 배포 중 | `deploy_started` 이후 ~ `deploy_completed` 이전 |
| 막힘 | `run_blocked` (사유·다음 행동 필요) |
| 실패 | `run_failed` |
| 완료 | `run_completed` |
| 상태 확인 필요 | 작업 중인데 마지막 활동이 30분 초과(heartbeat 만료) |

- `--status` 를 명시하면 그 값을 우선한다(위 표는 미지정 시 추론).
- PR만 열려 있다고 계속 "작업 중"으로 두지 않는다. CI가 끝나면 검증 결과 상태로 바꾼다.

## 금지

- 프롬프트 원문·비밀값·개인정보·전체 로그 저장.
- 실제 실행 없이 이벤트를 만들어 "일하는 것처럼" 표시.
- 하나의 세션이 여러 역할을 순차 수행했는데 동시에 여러 명이 일한 것처럼 표시.

## Claude Code / Codex 연결 (Phase 2 예정)

- Claude Code: 세션 훅(작업 시작·테스트·PR 등)에서 `emit-event` 호출.
- Codex: run 어댑터가 동일 형식으로 남김.
- 연결 전에는 대시보드 "연결 상태"에 `adapter_pending`으로 표시(흉내 내지 않음).
