# v1.7.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-18 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 62종 | PASS | node --test 전체 통과 |
| 오늘 KPI 4장 클릭 이동(대기→업무·작업중→자동화·확인→결재·막힘→앱) | PASS | Playwright 클릭 시 #/records/approvals 이동 확인 |
| 전체 화면 밀도 약 2/3 축소(데스크톱) | PASS | --ui-zoom .72 + 뷰포트 보정, 1440/1920 가로 넘침 0 |
| 모바일은 축소하지 않음(원본 크기) | PASS | 390px에서 --ui-zoom:1, KPI 가독성 유지 스크린샷 |
| 자동 점검 하루 N회 설정 가능(기본 4회: 6·11·16·21시) | PASS | REVIEW_HOURS + currentReviewSlot(시각 리스트) + hq-status.reviewHours |
| 완전 자동 러너 관리·2회→N회 점검(v1.6 유지) | PASS | 회귀 없음 |
| 밝은 상아·금테 결재판·명조·낙관 도장(v1.5 유지) | PASS | 회귀 없음 |
| 데스크톱 .dmg/.exe 빌드·릴리스 | 진행 | Actions → Release hq-v1.7.0 |
| 서명·공증 | NOT_CONNECTED | ad-hoc 서명 배포 |

## 자동 점검 빈도 (v1.7.0)
- 기본 하루 4회(서울 06·11·16·21시). 점검은 로컬·무료(추가 비용 0)라 자주 돌려도 안전.
- 시각 조정: 환경변수 `ROBOM_HQ_REVIEW_HOURS`(예 "6,10,14,18,22" = 5회, 최대 12회).
- GitHub 무료 REST만 사용하며 한도 초과 시 로컬 git으로 정직하게 저하(연출 없음).
