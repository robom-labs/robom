# 운영 프로토콜

## GitHub가 정본인 항목

- 회의 목표, 프롬프트, 제품 기준, 코드, 결정된 문서, PR과 배포 기록은 GitHub에서 읽고 GitHub에 올린다.
- 기준 조직은 `robom-labs`이고 저장소는 `robom`, `outbom`, `homebom`, `runningbom`이다.
- AI는 영구 로컬 코드 폴더를 기준으로 삼지 않는다. 확인은 `gh api` 또는 GitHub URL로 하고, 빌드가 필요할 때만 임시 폴더에 얕은 복제본을 만든 뒤 작업 후 제거한다.
- 코드·문서 변경은 대상 저장소에서 `agent/<작업>` 브랜치, 검증, push, draft PR 순서로 진행한다. `main`에 직접 push하지 않는다.

## GitHub 회의록

- 두 AI가 수시로 이어 읽을 사용자 대화와 최종 답변은 `robom-labs/robom`의 `ai-meeting-logs` 브랜치 `ops/ai-meetings/logs/<회의실>/`에 새 Markdown 파일로 저장한다.
- 이 로그 브랜치는 회의록 전용이다. 코드·운영 설정 변경은 계속 대상 저장소의 작업 브랜치와 draft PR로만 올린다.
- 파일명은 `YYYYMMDDTHHMMSS-KST-<codex|claude>-<고유값>.md`로 한다. 새 파일만 추가하며 기존 회의록은 수정·삭제하지 않는다.
- 비밀값, 개인정보, 내부 추론, 터미널 원문은 회의록에 기록하지 않는다.

## 답변 순서

1. GitHub의 이 `PROTOCOL.md`와 해당 회의실 프롬프트를 읽는다.
2. GitHub 로그 브랜치의 `ops/ai-meetings/logs/<회의실>/`에서 상대 AI가 만든 새 기록과 질문 관련 과거 기록을 읽는다.
3. GitHub의 실제 코드·운영 문서·PR 상태를 확인한다.
4. 상대 AI 의견을 반영해 독립적인 답변을 만든다.
5. 답변 직전에 이번 사용자 메시지와 최종 답변을 GitHub 로그 브랜치에 새 회의록 파일로 기록한다.

큰 변경은 사용자 승인 전에는 제안으로만 표현한다. 사용자 승인 뒤에만 GitHub PR을 만들거나 병합한다.
