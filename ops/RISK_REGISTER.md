# RISK REGISTER

| # | 위험 | 영향 | 방어 | 상태 |
|---|---|---|---|---|
| R1 | `/zoopzoopcall/` 배포 URL 깨짐 | 사용자 링크 전부 사망 | 배포는 원본에서만 + base-path CI + CODEOWNERS(추가됨, `.github/CODEOWNERS`) | 방어중 |
| R2 | 복사본 ↔ 원본 갈라짐 | 코드 표류 | 사본=읽기 전용 미러(D16, apps/README.md) + `drift-check.yml` 매일 원본↔registry↔사본 대조 | 방어중 |
| R3 | core ↔ supabase 정규화 중복 | 조용한 버그 | 공유 스냅샷 테스트(예정) | 열림 |
| R4 | 홍보 자동게시로 계정 밴 | 브랜드 손상 | 초안만 자동, 게시는 사람 | 방어됨 |
| R5 | secret 노출 | 보안사고 | gitleaks + .env 커밋 금지 | 방어중 |
| R6 | AI가 범위 밖 파일 수정 | 예측불가 변경 | 범위 선언 + inspector 검사 | 방어중 |
| R7 | main 직접 push | 무결재 반영 | CODEOWNERS 추가됨 · **branch protection은 사장이 켜야 실제 강제** — 1인 회사용 권장 설정은 ops/HUMAN-TASKS.md 2번(승인 수 0, D19) | 열림(사장) |
| R12 | 자동화가 조용히 죽음(secret 미등록) | AI 회사 정지 | 4개 Claude 워크플로 fail-fast preflight(D18) + HUMAN-TASKS 1번 | 완화중(사장) |
| R8 | 토큰 비용 폭주 | 비용 | 매일 5팀 상한 + state 요약 | 방어중 |
| R9 | runningcall /api/* 직접 호출 → Kakao 유료키 소진 | 비용/쿼터 고갈 | same-origin 강화·좌표검증·캐시(PR #5). 서버리스 공유 제한과 Kakao 키 등록은 사람 확인 | 완화중(사장) |
| R10 | 3개 앱 공통로직 3벌 중복(KST·알람·알림) | 표류·버그 | 공유 core 패키지화 | 열림(P1) |
| R11 | 브라우저 종료 후 예약 알림 불가 | 사용자 이탈 | 조용한 실패 수정·동작범위 고지(PR #8/#5/#4). 완전한 백그라운드는 서버 Web Push RFC 필요 | 열림(MAJOR) |
