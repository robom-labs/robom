# v1.2.0 _ 백업·복구

## 무엇을

- 회사 기록(회의·결재·업무·장애 등 9종 JSONL 이벤트 스트림) + audit 로그 + 상태 스냅샷 → `runtime/backups/company-backup-*.json.local`.
- 업무 대기열·실행 로그: `runtime/queue/`·`runtime/runs/` (백업 파일에 미포함 — 필요 시 폴더째 복사).

## 어떻게

- 화면: 기록·설정 → 백업 → [지금 백업]. JSON 내보내기는 [내보내기].
- 데스크톱 앱 데이터 위치: 맥 `~/Library/Application Support/robom-hq/runtime/`, 윈 `%APPDATA%/robom-hq/runtime/`. 저장소 실행은 `ops/control-center/runtime/`(.gitignore).
- 복구: 백업 JSON의 `eventStreams.<collection>` 배열을 `runtime/records/<collection>.jsonl.local`에 줄 단위로 되살린다(append-only라 순서 보존이 곧 상태 보존).

## 원칙

백업 없는 대량 삭제 금지 · 손상 JSONL은 CORRUPT_RUNTIME으로 즉시 드러남(조용한 유실 없음) ·
runtime은 어떤 형태로도 커밋 금지 · 앱 6개의 운영은 HQ와 독립(HQ 장애≠앱 장애).
