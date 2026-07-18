# v1.6.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-18 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 62종 | PASS | node --test (store·ops·events·sources·queue·proposals·supervisor·ui·office·autostart) |
| 완전 자동: HQ가 codex-runner 자동 실행·감시 | PASS | ROBOM_HQ_MANAGE_RUNNER=1로 서버가 러너 자식 spawn, 종료 시 재시작 실측 |
| 러너 자식 강제 종료 → 감독기 자동 재실행 | PASS | child kill 후 새 pid 재생성 확인(크래시 루프 backoff 포함) |
| 러너 상태 정직 표시(managed·not_connected) | PASS | codex 미설치 컨테이너에서 managed:true + not_connected 실측 |
| 실제 클론 자동 탐지(ROBOM_HQ_REPO_ROOT·~/robom-labs/robom 등) | PASS | discoverRepoRoot 단위 테스트 + 서버 로그 |
| 하루 2회(아침 6시·저녁 6시) 종합 점검 슬롯 | PASS | currentReviewSlot 경계값(03=null·06=am·18=pm·23=pm) 실측 |
| 점검 종합화(장애·경고·CI 실패·다음행동·PR·보안) | PASS | propose-improvements 확장 + 기존 3 테스트 유지 |
| 데스크톱 로그인 자동 시작 기본 ON(첫 실행) + 관리 러너 | PASS | main.cjs setLoginItemSettings + ROBOM_HQ_MANAGE_RUNNER |
| 밝은 상아 테마·금테 결재판·명조·낙관 도장(v1.5 유지) | PASS | 회귀 없음 + UI 계약 테스트 |
| 데스크톱 .dmg/.exe 빌드·릴리스 | 진행 | Actions → Release hq-v1.6.0 |
| codex exec 실제 실행 | VERIFIED(회장 맥북) | v1.3.x 연결 '대기 중' 확인 |
| 서명·공증 | NOT_CONNECTED | ad-hoc 서명 배포 — Gatekeeper 안내 문서 유지 |

## 완전 자동 운영 흐름 (v1.6.0)
1. 맥 켜기 → ROBOM HQ 자동 시작(로그인 항목, 첫 실행 시 기본 ON).
2. HQ가 codex-runner를 자동 실행·감시(터미널 불필요). 죽으면 다시 켬.
3. 하루 두 번(06시·18시) 6개 앱을 종합 점검해 개선 제안을 결재로 상신.
4. 회장은 결재판에서 **재가(승인)만** 누르면 대기열에 담기고, 러너가 자동으로 실제 작업.
5. codex login은 맥에서 최초 1회만. 실제 코드 수정에는 로봄 저장소 클론 필요(HQ가 자동 탐지).
