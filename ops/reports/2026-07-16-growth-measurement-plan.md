# 2026-07-16 개인정보 최소 성장 측정 계획

## 결정

- 앱은 provider-neutral `FamilyAnalytics` adapter만 호출한다.
- endpoint가 없거나 consent가 없으면 네트워크 요청은 0이다.
- raw event는 public GitHub에 저장하지 않는다.
- 초기 provider는 비공개 HTTPS 집계 endpoint를 기본으로 하고, Umami·PostHog는 실제 운영 credential·보관 정책·bundle 비용을 비교한 뒤 교체 가능하게 둔다.
- 합성 집계로 report generator를 검증하되 실제 사용자 통계로 표현하지 않는다.
- 집계 입력 계약과 주간·월간 보고 실행은 비공개 `robom-labs/robom-growth`가 소유하며 public 저장소에는 원시·집계 사용자 데이터를 커밋하지 않는다.

## 금지 데이터

정확한 좌표·주소, 이메일·전화번호, 청약 조건, 일정 제목, 병원·약·복용 기록, 가족 이름, 검색어·설문 원문, OAuth token, push endpoint, API key를 전송하지 않는다. 앱 이벤트는 활동·권역·시험 분야처럼 사전 정의된 coarse category만 허용한다.

## 공통 funnel

`family_home_viewed → app_card_viewed → app_install_landing_viewed → qr/store/pwa/web action → first_open → app activation → D7 return`

스토어 console과 first open을 연결할 수 없는 기간에는 설치 수를 추정하지 않고, 설치 랜딩의 측정 가능한 행동까지만 보고한다.

## 앱 activation

| 앱 | activation |
|---|---|
| 야외봄 | 첫 활동 판단 확인 |
| 청약봄 | 공고 상세 또는 관심 알림 |
| 러닝봄 | 공식 접수처 이동 또는 알림 |
| 캘린더봄 | 일정과 알림 첫 저장 |
| 자격증봄 | 추천 완료 또는 관심 시험 저장 |

## 자동 보고

- 월요일 주간 보고와 매월 1일 월간 보고 workflow를 제공한다.
- credential이 없으면 실패시키거나 public sample을 실제 데이터처럼 쓰지 않고 `BLOCKED_EXTERNAL`을 Actions summary에 남긴다.
- 보고서는 active user, activation, D7, 설치 행동, 알림 전환, error·stale, cross-app, 많이 쓴 기능 3개와 다음 실험 3개를 포함한다.
- cohort 30 미만은 방향성만 기록하고 인과 결론을 내리지 않는다.
- 접근성·알림 신뢰도·개인정보 범위는 실험 대상에서 제외한다.

## 검증

- `ops/family/analytics/sample-aggregate.json`은 `synthetic: true`인 합성 데이터다.
- 비공개 `robom-labs/robom-growth` 생성기가 금지 필드와 최소 cohort 30명 정책을 강제하고 deterministic 주간·월간 보고서를 생성하는지 검사한다.
- private endpoint credential 연결 후에는 비공개 `robom-labs/robom-growth`의 30일 제한 Actions artifact에만 결과를 보관한다.
