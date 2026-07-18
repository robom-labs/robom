# v1.9.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-19 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 70종 | PASS | node --test 전체 통과(health 엔진 6 + 계약/스토어/큐 등) |
| 결정론적 health 엔진(AI 없이) | PASS | runHealthEngine 단위 6종 + 직접 E2E(critical 1회 incident·evidence 파일·비밀 없음) |
| 서버 연결(review→엔진→결재→hq-status.health) | PASS | 라이브 서버에서 27계약 판정·health 요약 노출·서버 무중단 실측 |
| incident만 중복 없이 결재 상신(건강/CI/PR은 엔진, 성장/보안만 제안기) | PASS | dedup 필터(:next/:security)·proposalKey=contractId |
| anti-flap(critical 1회·warn/error 연속2·회복 연속2) | PASS | 단위 테스트 |
| 전역 네트워크 선행(앱별 critical 스팸 억제) | PASS | 단위 테스트(company:network + 앱 UNAVAILABLE 강등) |
| 증거 저장(비밀·원문 없이 상태/영향만) | PASS | incidents.jsonl 키 검사 |
| 앱 내부 deep 계약은 need_new_source로 정직 처리 | PASS | docs/hq/HEALTH-ENGINE.md(앱 저장소 세션 범위 밖) |
| 데스크톱 .dmg/.exe 빌드·릴리스 | 진행 | Actions → Release hq-v1.9.0 |
| 서명·공증 | NOT_CONNECTED | ad-hoc 서명 배포 |

## health 엔진 (v1.9.0)
- 기존 스냅샷 신호(운영 응답·버전·CI·PR·데이터 신선도) 위에 결정론적 판정만 얹음. Codex 없이 동작.
- 확정 incident만 결재로 상신, 같은 문제 반복 상신 없음, 회복 시 자동 종료.
- 앱 내부(스토리지·알림·브라우저 fixture 등)는 앱 저장소/진단 신호 필요 → need_new_source로 남김(거짓 PASS 금지).
