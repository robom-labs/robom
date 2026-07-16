# 2026-07-17 Claude 3회차 독립 검토 — 운영·복구·교차 영향

## 검토 방식

- Claude Code 2.1.201에 최신 여섯 저장소와 두 요구 문서를 읽기 전용으로 제공했다.
- Claude의 완료 판단을 그대로 사용하지 않고 Codex가 코드, E2E, CI, Production으로 재검증했다.
- 검토 축은 기능·모바일·운영 세 영역이었고 P0·P1·P2로 분류했다.

## 독립 의견과 리드 판단

| 의견 | 코드 근거 | 사용자 영향 | 난이도·회귀 위험 | 판단 |
|---|---|---|---|---|
| 자격증봄 준비물 fallback·시험 달력·저장 migration은 요구를 충족한다 | `packages/core/src/preparation.ts`, `apps/web/src/screens/ExamCalendarScreen.tsx`, storage tests | 준비물 공백과 월별 일정 탐색 문제 해소 | 이미 unit·E2E가 있어 낮음 | 채택 |
| 캘린더봄 `시간 미정`과 모바일 전체 화면 편집기는 기존 임의 시각·키보드 가림을 줄인다 | `app/app.js`, `app/styles.css`, `scripts/e2e.mjs` | 일정 입력 단계와 오입력 감소 | storage schema는 유지해 낮음 | 채택 |
| 캘린더봄 두 칸 배치가 760px부터라 600×960 소형 태블릿 요구를 놓친다 | 당시 `@media (min-width: 760px)` | Galaxy Tab·소형 iPad 계열에서 넓은 빈 공간과 긴 스크롤 | CSS와 E2E의 수술식 수정으로 낮음 | 채택 후 수정 |
| 큰 공통 리팩터링이나 새 UI 라이브러리는 필요하지 않다 | 각 앱이 독립 stack과 family generated assets를 유지 | 번들·배포 결합 증가를 피함 | 도입 시 회귀 위험이 큼 | 기각 |

## 반영 결과

- 캘린더봄 breakpoint를 600px로 낮췄다.
- 두 열 모두 `minmax(0, …)`를 사용해 200% 확대와 긴 내용에서 가로 넘침을 막았다.
- 600×960 두 칸 회귀검사와 600px 가로 스크롤 검사를 추가했다.
- 웹·Android·iOS 버전을 0.6.1로 맞추고 PWA cache와 native build를 함께 올렸다.

## 재검증

- CalendarBom unit 33개, static validation, Chromium E2E, WebKit E2E, 600×960 두 칸, 200% 확대 무가로스크롤을 통과했다.
- Android·iOS Expo 공개 설정·타입 검사·export가 통과했다.
- Production release와 build marker는 최종 운영 감사 문서에 연결한다.

