# ROBOM HQ 결정론적 health 엔진 (v1.9.0)

AI 없이(규칙만으로) 회사 앱들의 실제 신호를 읽고 **정상 / 확인 필요 / 장애 / 점검 불가**를 판정한다.

## 어떻게 도는가
- 신호 수집은 기존 `build-snapshot.mjs`(운영 watchdog·git·GitHub 무료 REST)가 이미 한다.
- `lib/health-engine.mjs`는 그 스냅샷 위에 **결정론적 판정 + 연속 실패/회복(anti-flap) + incident/회복 + 전역 네트워크 선행**만 얹는다.
- 자동 점검 주기마다(회장이 설정) 서버가 엔진을 실행하고, **확정된 incident만 결재(approvals)로 상신**한다.
- Codex·LLM 없이도 동작한다. Codex는 결재 승인 후 코드 수정에만 쓰인다.

## 판정 규칙 (요약)
- **critical**(운영 사이트 FAIL 등): 1회로 확정.
- **warning/error**(데이터 STALE·CI 실패·오래된 PR): 연속 2회에서 확정(일시적 오류 오탐 방지).
- **회복**: 연속 2회 PASS에서 사건 자동 종료.
- **전역 네트워크 장애**: 여러 앱 운영 점검이 동시에 실패하면 앱별 critical 스팸 대신 **회사 사건 1건** + 앱은 `점검 불가`로 강등.
- **같은 문제 반복 상신 금지**: 이미 열린 결재/사건은 다시 만들지 않는다.
- **점검 불가를 정상으로 위장 금지**: 신호가 없으면 PASS가 아니라 `UNAVAILABLE`.

## 지금 판정하는 것 (registry·운영 URL·GitHub·로컬만으로 가능한 것)
앱별: 운영 응답(Production), 배포/버전 신선도(STALE), 자동 검사(CI) 실패, 오래된 열린 PR, 다음 개선 행동.
회사/HQ: 전역 네트워크 선행, 스냅샷 신선도, 예시(fallback) 스냅샷 표시, 관리 러너 상태.
증거는 `runtime/health/`(latest.json·history·incidents.jsonl·recoveries.jsonl)에 비밀·원문 없이 숫자·상태만 저장한다.

## 아직 판정하지 못하는 것 — `need_new_source`
업로드된 상세 계약(스토리지 스키마·알림 fixture·브라우저 smoke·모델 checksum 등 앱 내부 동작)은
**각 앱 저장소 소스 또는 앱이 내보내는 비식별 진단 신호**가 있어야 기계적으로 판정할 수 있다.
현재 HQ 세션은 `robom-labs/robom`만 접근하므로 이들은 정직하게 "새 신호 필요"로 남겨 두고,
추측한 URL·경로로 거짓 PASS 처리하지 않는다. 앱별 진단 endpoint·health header가 준비되면 계약을 확장한다.

향후 확장: 앱이 동의 기반으로 내보내는 read-only `/health`(숫자·verifiedAt·fingerprint만)를 registry에 선언 →
`http_json_contract` 계열 평가기로 데이터 신선도·저장·알림 정확성까지 결정론적으로 판정.
