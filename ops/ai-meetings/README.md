# 로봄 AI 합동회의

이 폴더는 GitHub `robom-labs/robom` 안의 회의 설정 정본이다. Codex와 Claude Code는 이 파일과 각 회의실 프롬프트를 GitHub에서 읽고, 코드 변경은 대상 저장소의 브랜치와 PR로만 올린다.

| 번호 | Codex 채팅 제목 | Claude 채팅 제목 | GitHub 코드 범위 | GitHub 로그 경로 |
| --- | --- | --- | --- | --- |
| 01 | 로봄 01 \| 포트폴리오·출시 | 로봄 01 \| 포트폴리오·출시 \| Claude | `robom`, `outbom`, `homebom`, `runningbom` | `ops/ai-meetings/logs/01-portfolio-release/` |
| 02 | 로봄 02 \| 홈페이지·브랜드 | 로봄 02 \| 홈페이지·브랜드 \| Claude | `robom/site` | `ops/ai-meetings/logs/02-web-brand/` |
| 03 | 로봄 03 \| 야외봄 | 로봄 03 \| 야외봄 \| Claude | `outbom` | `ops/ai-meetings/logs/03-outbom/` |
| 04 | 로봄 04 \| 청약봄 | 로봄 04 \| 청약봄 \| Claude | `homebom` | `ops/ai-meetings/logs/04-homebom/` |
| 05 | 로봄 05 \| 러닝봄 | 로봄 05 \| 러닝봄 \| Claude | `runningbom` | `ops/ai-meetings/logs/05-runningbom/` |

대화 로그는 GitHub `ai-meeting-logs` 브랜치에만 둔다. 앱 코드와 운영 설정은 기존처럼 작업 브랜치와 draft PR 흐름을 따른다.

각 새 채팅에는 해당 회의실의 `PROMPT-CODEX.md` 또는 `PROMPT-CLAUDE.md` 전체를 붙여넣는다.
