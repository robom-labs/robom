# 2026-07-17 최종 추적표

상태는 `PASS`, `BLOCKED_EXTERNAL`, `NOT_APPLICABLE`, `FAIL`만 사용한다.

| 요구사항 | 소유 저장소 | 구현 파일 | 테스트 | 운영 증거 | 감사 1 | 감사 2 | 감사 3 | 상태 |
|---|---|---|---|---|---|---|---|---|
| 자격증봄 준비물 공백 제거 | certbom | core preparation, DetailScreen, storage | unit·Chromium·WebKit | certbom 0.7.0 직접 클릭 | PASS | PASS | PASS | PASS |
| 준비물 신뢰 수준·전체·체크 격리 | certbom | preparation model·UI·migration | migration·새로고침 E2E | 일반 안내 7개 전체 노출 | PASS | PASS | PASS | PASS |
| 자격증봄 독립 시험 달력 | certbom | CalendarScreen·route·BottomNav | 월·날짜·그룹·뒤로 E2E | Production 달력·그룹 | PASS | PASS | PASS | PASS |
| 캘린더 날짜 선택과 편집 분리 | calendarbom | app.js·index.html | Chromium·WebKit E2E | Production 날짜 탭·CTA | PASS | PASS | PASS | PASS |
| 캘린더 시간 미정·직접 시각 | calendarbom | app.js·schedule core | unit·E2E | Production 편집 질문 | PASS | PASS | PASS | PASS |
| 캘린더 키보드·전체 화면 편집기 | calendarbom | styles.css·VisualViewport | 390px·200%·WebKit | Production 전체 화면 | PASS | PASS | PASS | PASS |
| 600px 소형 태블릿 두 칸 | calendarbom | styles.css·e2e | 600×960·무가로스크롤 | Production CSS 실측 | PASS | PASS | PASS | PASS |
| 5앱 native 회전·태블릿 | 5앱 | apps/mobile app.json·layout | config·type·Android/iOS export | store binary 전 단계 | PASS | PASS | PASS | PASS |
| 5앱 version·native build 정합 | 5앱 | package·Expo config·verifier | CI·native check | 운영 version·SHA | PASS | NOT_APPLICABLE | PASS | PASS |
| 단일 registry 최신화 | robom | apps.yml·compatibility·generated data | drift·remote version | watchdog 5앱 PASS | PASS | NOT_APPLICABLE | PASS | PASS |
| 공통 wordmark·nav·settings·state | robom+5앱 | family contracts·generated assets | family CI·surface E2E | 5앱 운영 화면 | PASS | PASS | PASS | PASS |
| 광고 OFF·placeholder·SDK 0 | robom+5앱 | feature flags·ad contract | static·render | 운영 화면 빈 슬롯 0 | PASS | PASS | PASS | PASS |
| 금지 PII·consent OFF | robom+5앱 | analytics contract·scrubber | forbidden field CI | provider 없음 network 0 | PASS | NOT_APPLICABLE | PASS | PASS |
| 자격증 source 400일 simulation | certbom | source-operations·registry | ops tests·simulate | source heartbeat PASS | PASS | NOT_APPLICABLE | PASS | PASS |
| 다섯 앱 main·deploy·smoke | 5앱 | release workflows | CI·Pages/Vercel·watchdog | 최신 5개 SHA PASS | PASS | PASS | PASS | PASS |
| robom release gate·Pages preview | robom | site·family generator·workflow | Guardrails·Chromium·WebKit | Pages run `29538883236` | PASS | PASS | PASS | PASS |
| robom.kr Sites 최신 2.1.6 | Sites 계정·connector | `.openai/hosting.json` | watchdog marker | 2.1.6·15902d0 미검출 | PASS | NOT_APPLICABLE | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL |
| 앱별 독립 rollback | 전 저장소 | git history·release workflow | 임시 clone revert dry-run | provider 이전 배포 보존 | PASS | NOT_APPLICABLE | PASS | PASS |
| store 10개 signing·submit | 계정 소유자 | mobile projects·metadata | unsigned export | listing 미출시 | BLOCKED_EXTERNAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL |
| Kakao·Google·Apple 실제 OAuth | 계정 소유자 | auth contract·fallback | guest flow | credential 미연결 | BLOCKED_EXTERNAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL |
| Q-Net 운영 key·첫 baseline 공개 | 계정 소유자+certbom | source adapter·anomaly gate | key 없는 LKG 흐름 | source issue·heartbeat | BLOCKED_EXTERNAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL |
| 실제 private 성장 보고 | private infra 소유자 | analytics contract·report generator | synthetic pipeline | endpoint credential 없음 | BLOCKED_EXTERNAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL |

