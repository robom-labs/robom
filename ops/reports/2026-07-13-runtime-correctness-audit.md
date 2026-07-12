# 2026-07-13 런타임 정확성 2차 점검

## 결론

첨부 진단을 최신 main에 다시 대조해 이미 해결된 제안은 제외하고 실제 재현된 결함만 수정했다. 최우선 위험은 야외봄 서비스워커 구문 오류, 러닝봄 기기 시간대 의존, 청약봄 stale 응답 오표시였다.

## 적용 결과

| 대상 | 이전 | 적용 후 |
|---|---|---|
| 야외봄 | 서비스워커 구문 실패, 기기 시간대 사용, 24시간 이후 알림 미재무장 | SW 구문·CI 통과, 예보 지역 시간대 계산, 하루 단위 재무장, 핵심 결측 시간 제외 |
| 청약봄 | stale 응답도 공식으로 표시, 모든 화면 eager 로드 | 확인 지연·마지막 확인 안내, Supabase v4 헤더, 상세·알림·설정 lazy chunk |
| 러닝봄 | 카드·알림·캘린더 일부가 로컬 Date API 사용 | KST 전용 코어, Seoul·UTC·New York 동일 결과, Dawn Track PWA 색 통일 |
| robom.kr | 2.6MB OG, PWA·검색 메타 부족, 로컬 SVG에도 이미지 런타임 | 140KB 1200×630 OG, manifest·robots·sitemap·JSON-LD·skip-link, image client chunk 제거 |

## 수치

- 야외봄: 80 tests, 타입 검사, SW 구문 검사, Next 운영 빌드 통과.
- 청약봄: core 64 + web 23 tests, 초기 JS 200.50KB에서 191.76KB, gzip 65.89KB에서 63.67KB.
- 러닝봄: 세 실행 시간대에서 각각 25 tests, 정적 데이터·캐시·버전·로컬 Date API 검사 통과.
- robom.kr: OG 2,683,918 bytes에서 144,028 bytes, client 변환 모듈 112개에서 66개, image client chunk 제거.

## 보존·유보

- 이미 반영된 공고 ID·URL·날짜 매핑·캘린더 이벤트 로직은 다시 변경하지 않았다.
- 야외봄의 거대한 가챠 CSS·컴포넌트 삭제와 러닝봄 과거 테마 CSS 대량 삭제는 DOM coverage·시각 회귀 근거 없이 진행하면 위험해 유보했다.
- 서버 Web Push, 데이터 자동 수집, 공통 Playwright와 상태 감시는 다음 단계로 유지한다.
