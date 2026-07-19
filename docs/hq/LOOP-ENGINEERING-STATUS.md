# ROBOM HQ 자율 Loop Engineering OS — 구현 현황 (v3.1.0 지침 대비)

실행 프롬프트 `ROBOM_HQ_AUTONOMOUS_LOOP_ENGINEERING_OS_PROMPT_v3.1.0`에 대한 **정직한** 구현 현황이다.
"1년·10년 자율 운영"은 한 번에 완성되는 제품이 아니라 계속 자라는 구조이므로, 아래는 뼈대·핵심부터
단계별로 실제 배포한 내용과 남은 항목을 구분해 기록한다(가짜 완료율 금지 — 지침 §2·§20).

## 배포 완료 (실제 동작·테스트 통과·릴리스)

| 지침 | 구현 | 릴리스 |
|---|---|---|
| §9·§15 분류(self_heal/codex/human) | `lib/incident-fix.mjs` — 계약 계열·텍스트 기반 결정론 분류 | hq-v2.5.0 |
| §2 자동/사람 경계 정직 표기 | 문제 처리 현황 보드(자동/Codex/회장) + 감지 시각·해결방안 | hq-v2.5.0 |
| §5 Codex 실패 구분 | 실행기 quota·auth·code 실패 구분, "용량 소진" 정직 표시 | hq-v2.5.0 |
| §9 실행기 설정 | 회장이 모델·추론 강도 선택 → codex exec 전달 | hq-v2.5.0 |
| §6 Loop 객체 | `lib/loop-engine.mjs` — 목표·합격기준·담당·검증자·iteration·증거 | hq-v2.6.0 |
| §7 상태기계 | 23개 상태·전이 검증·종료 후 재개 금지·이벤트 저장소 | hq-v2.6.0 |
| §5·§7 **원래 계약 자동 재검증** | Codex exit 0 ≠ 해결. 원래 실패 계약이 다시 PASS해야 CLOSED | hq-v2.6.0 |
| §10.2 iteration | 실패 시 같은 수정 반복 대신 새 iteration으로 접근 변경 | hq-v2.6.0 |
| §7 회복 자동 종료 | 신호 회복 시 결재·Loop 동시 CLOSED | hq-v2.5.0/2.6.0 |
| §18 Loop 화면 | 자율 개선 Loop 보드(목표·기준·상태·증거·다시 시도) | hq-v2.6.0/2.8.0 |
| §14 Meta Loop | 멈춘 Loop·재시도 폭주·담당 누락 자가 점검 | hq-v2.8.0 |
| §13 성장 Loop | 개선 제안도 목표·기준을 갖춘 닫힌 Loop로 관리 | hq-v2.9.0 |
| §0 하드코딩 금지 | 과거 계약 수(257) 제거 → 카탈로그 동적 집계 | hq-v2.5.0 |
| (별건) 자동 재실행 오류 | 창 닫으면 완전 종료·레거시 KeepAlive 매 실행 제거 | hq-v2.7.0 |

## 이미 존재해 Loop에 연결한 기반 (지침 §4)

health contract 엔진·anti-flap·incident/recovery·task queue·lease·heartbeat·Codex runner·
막힘 자동 재큐·회사 모드(RUNNING/MONITOR_ONLY/PAUSED 등)·수석부회장 전결·조직도·인력.

## 남은 단계 (후속 배포 예정)

- §17 세 차례 반박 감사 자동화(요구사항·기술·장기운영) — 현재는 원래 계약 재검증(verifier)까지. red-team 단계 자동화 추가 예정.
- §10.1 worktree 격리 실행 — 현재는 대상 저장소 직접 작업. 병렬 안전을 위한 격리 예정.
- §11 완전 event-driven 트리거 — 현재는 감시기 주기(watchdog) + 이벤트 일부. git/CI/deploy webhook 확대 예정.
- §12 유지보수 Loop 심화(dependency·TLS·secret expiry·backup age) — 일부 health contract로 존재, 전용 Loop 확대 예정.
- §16 red-team/verifier 에이전트 실제 분리 — Loop에 필드는 있으나 단일 executor. 단계 분리 강화 예정.

## 원칙

- 시스템이 직접 확인 못 하는 외부 항목(로그인·구독 한도·비밀키·결제·법적 동의·스토어 제출·복구 불가 삭제)은
  거짓 PASS하지 않고 회장 확인(human) 또는 BLOCKED로 표시한다.
- 계약 수·앱 수·직원 수 등은 항상 최신 registry·catalog·runtime에서 동적 계산한다.
