# v1.2.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-18 (KST)
- 시작 SHA: `379fa42` · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 57종 | PASS | node --test (store·ops·events·sources·queue·ui·office·autostart) |
| 5탭 IA·오늘 화면 순서 | PASS | company-ui.test + 스크린샷(데스크톱·모바일 390px) |
| 업무 intake→queue 패킷 | PASS | POST /api/tasks 실호출 → pending/*.json 생성 확인 |
| 러너 미연결 정직 처리 | PASS | codex-runner --once → blocked(NOT_CONNECTED) + 기록 '막힘' |
| 긴급 일시정지/재개/접수중지 | PASS | POST /api/control 실호출 |
| stale lease 복구 | PASS | task-queue.test |
| 결정론 감시기(10분) | PASS(코드)·타이머 장기 관찰은 미수행 | serve.mjs setInterval |
| payload 단독 부팅·스냅샷 | PASS | env 리다이렉트로 fake-userData에 runtime·latest.json 생성 |
| 데스크톱 .dmg/.exe 빌드·릴리스 | PASS | Actions run 29627202088 success → Release hq-v1.2.0에 mac arm64/x64 dmg·zip + win x64 exe 4종 업로드 확인 |
| codex exec 실제 실행 | NOT_VERIFIED | CLI 부재 — 맥북 연결 후 1건 실증 필요 |
| 휴대폰 실기기 PWA | NOT_VERIFIED | 실기기 없음 — REMOTE-ACCESS.md 절차 준비됨 |
| 서명·공증 | NOT_CONNECTED | 자격정보 미등록 — 미서명 명시 배포 |
