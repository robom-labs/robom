# 로봄 주간 성장 보고서

기간: 2026-07-06 ~ 2026-07-12
데이터: 검증용 합성 집계이며 실제 사용자 데이터가 아닙니다.


## 포트폴리오 요약

- 활성 사용자 420명, activation 46%, D7 재방문 28%.
- 설치 랜딩 310회 중 설치 행동 138회로 측정 전환은 45%.
- 오류 9건, stale 복구 18건, 패밀리 이동 31건.

## 앱별 핵심 지표

| 앱 | 활성 사용자 | activation | D7 | 많이 쓴 기능 3개 |
|---|---:|---:|---:|---|
| 야외봄 | 120 | 55% | 34% | recommendation_viewed 96, activity_selected 82, prep_item_checked 44 |
| 청약봄 | 88 | 41% | 25% | notice_opened 67, notice_filter_applied 49, alert_enabled 21 |
| 러닝봄 | 76 | 39% | 22% | race_filter_applied 61, race_opened 47, official_registration_clicked 18 |
| 자격증봄 | 74 | 43% | 24% | exam_opened 70, recommendation_completed 36, exam_saved 16 |

## 다음 우선 실험

1. 러닝봄 activation이 39%로 가장 낮습니다. 첫 핵심 행동 직전의 CTA 문구와 위치를 한 가지 variant로 검증합니다.
2. 러닝봄 D7 재방문이 22%로 가장 낮습니다. 사용자가 저장·알림을 완료한 뒤 다음 방문 이유를 한 문장으로 안내합니다.
3. 설치 랜딩→행동 전환 45%를 플랫폼별로 분리해 QR·PWA·스토어 중 실제 이탈 지점을 확인합니다.

접근성·알림 신뢰도·개인정보 수집 범위는 실험하지 않습니다.
