# RISK REGISTER

| # | 위험 | 영향 | 방어 | 상태 |
|---|---|---|---|---|
| R1 | `/zoopzoopcall/` 배포 URL 깨짐 | 사용자 링크 전부 사망 | 배포는 원본에서만 + base-path CI + CODEOWNERS(추가됨, `.github/CODEOWNERS`) | 방어중 |
| R2 | 복사본 ↔ 원본 갈라짐 | 코드 표류 | 원본 동결, 신규는 holdings에서 | 관찰 |
| R3 | core ↔ supabase 정규화 중복 | 조용한 버그 | 공유 스냅샷 테스트(예정) | 열림 |
| R4 | 홍보 자동게시로 계정 밴 | 브랜드 손상 | 초안만 자동, 게시는 사람 | 방어됨 |
| R5 | secret 노출 | 보안사고 | gitleaks + .env 커밋 금지 | 방어중 |
| R6 | AI가 범위 밖 파일 수정 | 예측불가 변경 | 범위 선언 + inspector 검사 | 방어중 |
| R7 | main 직접 push | 무결재 반영 | CODEOWNERS 추가됨 · **branch protection은 사장이 GitHub 설정에서 켜야 실제 강제**(미설정 시 PR-only 무력) | 열림(사장) |
| R8 | 토큰 비용 폭주 | 비용 | 매일 5팀 상한 + state 요약 | 방어중 |
| R9 | runningcall /api/* 무인증 → Kakao 유료키 소진 | 비용/쿼터 고갈 | 레이트리밋·오리진 제한(앱 저장소 작업) | 열림(P0) |
| R10 | 3개 앱 공통로직 3벌 중복(KST·알람·알림) | 표류·버그 | 공유 core 패키지화 | 열림(P1) |
| R11 | 3개 앱 "알림"이 조용히 안 감(핵심기능 무력) | 사용자 이탈 | 각 원본 저장소에서 수정(핸드오프/백로그, D11) | 열림(앱·HIGH) |
