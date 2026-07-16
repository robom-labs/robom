# 2026-07-16 최종 감사 2 — 모바일·시각·접근성·성능

## 결론

`robom.kr`과 다섯 앱을 실제 운영 주소에서 Chromium·WebKit으로 다시 렌더링했다. 6개 표면 × 9개 viewport × 2개 브라우저의 108개 렌더와 12개 200% 글자 확대 검사가 통과했다. 가로 스크롤·겹침·핵심 문구 잘림·하단 메뉴 가림·48px 미만 주 행동·콘솔 오류는 0건이었다.

## 화면 범위

- viewport는 320×568, 360×800, 375×667, 390×844, 412×915, 430×932, 768×1024, 1024×768, 1440×1000이다.
- reduced motion, 200% 글자 확대, 모바일 하단 safe area, 설정의 5앱 목록, 고정 하단 메뉴와 첫 주 CTA를 검사했다.
- 390×844 Chromium·WebKit 운영 캡처는 `site/screenshots/family-surfaces/<browser>/`에 남겼다.
- axe-core WCAG 2 A·AA 검사는 6개 운영 표면 × 2개 브라우저에서 위반 0건이다.

## 운영 성능 표본

동일한 운영 감사 스크립트의 9개 viewport 중 가장 큰 값을 기록했다. INP는 Chromium에서 실제 하단 메뉴 또는 설치 CTA 한 번을 눌러 Event Timing으로 측정한 lab 값이다.

| 제품 | Chromium LCP 최대 | Chromium lab INP | Chromium CLS 최대 | WebKit LCP 최대 | WebKit CLS 최대 | 상태 |
|---|---:|---:|---:|---:|---:|---|
| robom.kr | 544ms | 16ms | 0 | 319ms | 0 | PASS |
| 야외봄 | 932ms | 40ms | 0.0216 | 598ms | 0 | PASS |
| 청약봄 | 400ms | <16ms | 0 | 856ms | 0 | PASS |
| 러닝봄 | 544ms | 40ms | 0.0149 | 510ms | 0 | PASS |
| 캘린더봄 | 496ms | 40ms | 0.0702 | 477ms | 0 | PASS |
| 자격증봄 | 132ms | 48ms | 0 | 193ms | 0 | PASS |

실사용 field Core Web Vitals 표본은 아직 수집하지 않으므로 lab 수치를 실제 사용자 분포로 확대 해석하지 않는다.

## 번들 변화

| 제품 | JS gzip 전→후 | CSS gzip 전→후 | 판단 |
|---|---:|---:|---|
| robom.kr | 91,204→94,267B | 7,116→8,679B | 설치 허브·PWA·분석 adapter와 보안 빌드 도구 갱신 범위 안 | PASS |
| 야외봄 | 312,890→324,886B | 11,816→12,142B | 패밀리 설정·네이티브 연결 범위 안 | PASS |
| 청약봄 | 80,918→85,735B | 7,542→7,721B | 패밀리 설정 lazy chunk 포함 | PASS |
| 러닝봄 | 30,300→35,182B | 12,300→13,187B | vanilla family shell·아이콘 포함 | PASS |
| 캘린더봄 | 41,297→44,824B | 6,305→6,857B | local-first 기능과 family shell 포함 | PASS |
| 자격증봄 | 85,460→89,563B | 4,786→5,211B | install·family shell 포함 | PASS |

광고 SDK는 비활성 상태에서 0B이며 QR·store 코드는 홈페이지 설치 표면에만 있다.

## 모바일 판단에 영향을 준 교차 검토

- 독립 모바일 감사에서 중앙 홈페이지와 앱별 보조색 대비, 캘린더 ARIA, 러닝 초기 CLS, 중앙 가로 feature row의 키보드 초점을 지적했다.
- 채택한 내용은 대비 상향, 올바른 button group semantic, 레이아웃 예약 공간, focusable horizontal region과 실제 axe 검사다.
- 장식 확대와 거대한 공통 React package는 번들·앱 고유 정보 위계를 해치므로 제외했다.
- 하단 메뉴를 무조건 동일 탭으로 만들지 않고 높이·선·safe area·48px만 통일했다.

## 합격표

| 검사 | 결과 | 상태 |
|---|---|---|
| 가로 스크롤·겹침·잘림 | 0건 | PASS |
| 하단 메뉴·설치 CTA 터치 | 48px 이상 | PASS |
| 200% 글자 확대 | 6표면 × 2브라우저 overflow 0 | PASS |
| WCAG A·AA 자동 위반 | 0건 | PASS |
| console error·unhandled page error | 0건 | PASS |
| LCP 2.5s·INP 200ms·CLS 0.1 목표 | 모든 lab 표본 목표 이내 | PASS |
| 70대 캘린더봄 실제 사용자 과업 테스트 | 참여자와 실제 기기가 필요한 별도 검증 | BLOCKED_EXTERNAL |
