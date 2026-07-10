# 운영 모델 — 직원 편성과 시간표 (단일 기준)

> 등록된 AI 직원과 "언제 누가 움직이는지"를 한 곳에 정리. 사장이 보고를 오해하지 않게.
> 직원 프롬프트는 `.claude/agents/`, 앱 목록은 `ops/registry/apps.yml`이 단일 소스.

## 등록 직원 11명
| 구분 | 직원 | 주기 |
|---|---|---|
| 매일 실행(5) | ceo-orchestrator · planner · builder · inspector · recorder | 매일 |
| 매일 홍보(1) | growth-marketer | 매일(초안만, 발행은 사람) |
| 주간(3) | supervisor · upgrader · release-manager | 주 1회(월) |
| 월간(2) | strategist · architect | 월 1회 |

## 시간표 (KST)
| 시각 | 워크플로 | 하는 일 |
|---|---|---|
| 08:00 매일 | daily-kakao-report + 8시 보고 루틴 | 열린 draft PR 현황을 카카오·슬랙·노션으로 |
| 09:00 매일 | daily-company-run | 제품개선 5명 → 앱1·목표1·draft PR1 |
| 09:30 매일 | daily-marketing | 홍보 콘텐츠 초안(보류 가능) |
| 09:00 월요일 | weekly-review | 주간 3명(감독·R&D·릴리즈) |
| 매월 1일 09:00 | monthly-board-run | 월간 2명(전략·설계) |
| 상시(PR마다) | guardrails + ci-<app> | 안전 레일 + 앱별 검사 |

## 원칙
- 하루 = 앱1 · 목표1 · PR1 · 실행팀 ≤ 5.
- 조직도는 커도 매일 부르는 직원은 적게(토큰 비용).
- 직원 승격/강등은 supervisor 주간 평가로 판단.
