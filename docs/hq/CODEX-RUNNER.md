# v1.2.0 _ Codex 실행기 — 구독 CLI로 대기열을 실제 실행

## 원칙 (v1.2 §10)

- OpenAI API 키 금지. **`codex` 구독 CLI 로그인만** 사용. 미지원 기능을 되는 것처럼 표시하지 않는다.
- Codex는 화면을 클릭하지 않는다. `runtime/queue/pending/*.json` 작업 패킷을 읽는다.
- 실행 증거가 없으면 "작업 중"으로 표시하지 않는다(러너가 잡은 순간에만 in_progress).

## 흐름

```
회장 요청(6질문) → POST /api/tasks → tasks 기록 + queue/pending/<id>.json
→ codex-runner가 lease 잠금(45분 TTL·heartbeat) → codex exec --cd <저장소> <패킷 프롬프트>
→ 성공: done/ + 기록 '검토 중'(사람 확인 후 완료) · 실패: failed/ + '막힘'
→ 로그: runtime/runs/<id>.log
```

## 실행

```
codex login                                        # 1회
node scripts/control-center/codex-runner.mjs        # 상주(30초 폴링)
node scripts/control-center/codex-runner.mjs --once # 1건만
```

- 대상 저장소: robom은 이 저장소, 앱은 형제 폴더 `../<repo명>`(클론돼 있어야 함. 없으면 '막힘' 처리).
- 일시정지: 화면·트레이의 [모든 자동작업 일시정지] → 러너가 새 작업을 잡지 않음.
- 타임아웃: `ROBOM_HQ_TASK_TIMEOUT_MINUTES`(기본 40분) 초과 시 실패 처리.
- 미연결: 정직하게 `blocked`(NOT_CONNECTED)로 되돌리고 화면에 미연결 표시.

## 검증 상태

- 미연결 경로(blocked)·lease·stale 복구·일시정지: **PASS** (자동 테스트 + 실서버 E2E).
- `codex exec` 실제 실행: 이 개발 환경에 CLI 없음 → **NOT_VERIFIED**. 맥북에서 안전한 소작업 1건으로 증명할 것.
