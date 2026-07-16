# 성장 분석 공급자 결정

초기 기본값은 SDK가 없는 provider-neutral HTTPS adapter입니다. 동의가 없거나 endpoint가 비어 있으면 요청을 한 건도 보내지 않습니다.

## 비교 결과

| 후보 | 장점 | 비용·위험 | 현재 판단 |
|---|---|---|---|
| Umami | 가벼운 공개 SDK, self-host, custom event | 별도 DB·운영 필요 | 비공개 endpoint 후보 |
| PostHog | funnel·cohort·feature flag가 강함 | 웹 SDK와 운영 표면이 큼 | 데이터가 쌓인 뒤 재검토 |
| 자체 집계 endpoint | 번들 0, 금지 필드와 집계 단위를 직접 통제 | 수집·dashboard 운영 필요 | 현재 adapter 계약 |

앱이 공급자에 종속되지 않도록 이벤트 계약과 scrubber를 먼저 적용합니다. 실제 공급자는 비공개 인프라 credential과 개인정보 고지가 준비된 뒤 연결합니다.
