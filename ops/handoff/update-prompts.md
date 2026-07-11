# 앱 업데이트 핸드오프 프롬프트

robom 전수 진단(2026-07-09) 결과를 각 앱 저장소의 AI에게 넘기는 프롬프트.
각 앱의 Claude Code 세션에 **아래 블록을 그대로 붙여넣기**. (각 세션은 holdings 접근이 없으므로 자체 완결형으로 작성됨.)

사용 순서: 붙여넣기 → AI가 코드 확인 + 의견 제시 → 합의된 안전 항목부터 PR로 실행.

---

## 공통 규칙 (모든 프롬프트에 포함됨)
- 프로덕션 배포(Vercel/Pages)를 절대 깨지 않는다. 배포 설정·비밀키·prod 데이터 변경은 사람 승인.
- main 직접 push 금지. 작은 단위로 브랜치 → 테스트 → **PR**. 각 PR에 CHANGELOG/버전 반영.
- 먼저 "의견"을 내고(무엇을 왜, 위험도, 진단이 놓친 것), 그 다음 안전한 것부터 구현.
- 애매하거나 큰 리팩토링/보안 변경은 착수 전 확인.

---

## ▶ outbom (야외봄) 프롬프트

```
너는 이 저장소(outbom / running-day-score, Next.js 16 + React 19, Vercel 배포)의 시니어 엔지니어다.
robom(지주회사) 차원에서 3개 앱 전수 진단을 했고, 이 앱의 진단 결과는 아래와 같다.
먼저 실제 코드로 하나씩 검증하고, 네 의견(동의/이견/우선순위/진단이 놓친 것)을 제시한 뒤,
합의되는 안전한 항목부터 순서대로 PR로 구현하라.

[진단 결과]
- (P0·보안) app/api/{search-location,reverse-location,forecast}/route.ts 가 무인증·무레이트리밋 공개 프록시다.
  특히 search-location/reverse-location 은 서버의 KAKAO_REST_API_KEY 를 쓰므로, 외부에서 호출하면 유료 쿼터가 소진된다.
  → 레이트리밋(IP/세션), 오리진 제한, 짧은 캐시 중 하나 이상 도입. (SSRF는 아님 — 좌표는 Number.isFinite 검증됨)
- (P2·품질) ESLint 설정과 lint 스크립트가 없다. gacha.tsx 에 react-hooks/exhaustive-deps disable 이 3곳(639,646,875) 숨어있다.
  → ESLint + "lint" 스크립트 추가, CI에 연결.
- (P2·구조) app/page.tsx(≈2,180줄, useState 30여개)·app/gacha.tsx(≈953줄) 단일 거대 클라이언트 컴포넌트.
  → 위치/알람/검색/예보 등 기능별 컴포넌트+커스텀 훅으로 점진 분해(동작 보존). 큰 작업이므로 나눠서.
- (P2·테스트) lib/insights.ts(≈1,049줄, 사용자 문구 생성 핵심)가 무테스트. lib/ 는 vitest 골든마스터 있음.
  → insights 핵심(헤드라인/시간대/랭킹 윈도우)에 테스트 추가.
- (P2·빌드) build 스크립트가 `next build --webpack`(Turbopack 옵트아웃). 의도면 사유 주석/이슈로 남기고, 아니면 재검토.
- (참고·양호) 좌표 검증, AbortController 타임아웃(4.5~9s), 프로덕션에서만 SW 등록 — 잘 되어 있음.

[포트폴리오 방향] 3개 앱이 KST 시간/D-day/알람 오프셋/알림 로직을 각자 재구현 중이다.
앞으로 공유 core 패키지로 통합할 계획이니, 신규 코드는 그 방향과 충돌하지 않게.

[규칙] 프로덕션(Vercel) 무손상. 비밀키 서버 보관 유지. main 직접 push 금지, PR로. 각 PR에 CHANGELOG/버전 반영.
P0(API 보호)부터. 큰 리팩토링·보안 변경은 착수 전 요약 확인.
```

---

## ▶ runningbom (러닝봄) 프롬프트

```
너는 이 저장소(runningbom, 정적 사이트 — outputs/runningbom-site/, GitHub Pages+Vercel)의 시니어 엔지니어다.
robom 차원 전수 진단 결과는 아래와 같다. 실제 코드로 검증하고, 의견을 낸 뒤, 안전한 것부터 PR로 구현하라.

[진단 결과]
- (데이터·mixed-content) races.json 의 registrationUrl 다수가 http:// (예: mara1080.com 등). 사이트는 HTTPS라 혼합콘텐츠 경고/차단 위험.
  → 호스트가 https 지원하면 https:// 로 정규화(각 호스트 확인 필요).
- (캐시버스트 드리프트) 버전이 3곳에 손동기화: app.js:4 APP_VERSION, index.html 의 ?v=20260708-9, app.js 의 ASSET_VERSION.
  → 단일 소스화(한 곳에서 파생 또는 배포시 주입) — 스테일 캐시 배포 방지.
- (접근성) #alertModal/#permissionModal/#batteryModal 에 focus-trap·Esc 닫기·포커스 복귀 없음.
  → 모달 키보드/스크린리더 접근성 보강. (toast 는 aria-live 있음 — 양호)
- (데이터 검증) races.json 이 앱 전체를 구동하는데 스키마 가드가 없다.
  → 필수 필드/ISO 날짜/URL 형식 검증 스크립트 추가(배포 전).
- (개발환경) 개발서버가 PowerShell 전용(serve-runningbom.ps1). → `npx serve` 등 이식성 있는 방법 추가.
- (참고·양호) 모든 innerHTML 보간에 escapeHtml 일관 적용, JSON.parse try/catch — XSS 방어 잘 됨.

[포트폴리오 방향] 3개 앱 공통 로직(D-day/알람/알림) 공유 패키지화 예정. 신규 코드는 그 방향 고려.

[규칙] 프로덕션 배포(Pages/Vercel) 무손상. main 직접 push 금지, PR로. 각 PR에 CHANGELOG/버전 반영.
mixed-content(https 정규화)와 캐시버스트 단일화부터. 데이터 대량 변경은 착수 전 요약 확인.
```

---

## ▶ homebom (청약봄) 프롬프트

```
너는 이 저장소(homebom / 청약봄, Vite+React PWA, GitHub Pages `/homebom/`)의 시니어 엔지니어다.
robom 차원 전수 진단 결과는 아래와 같다. 실제 코드로 검증하고, 의견을 낸 뒤, 안전한 것부터 PR로 구현하라.

[진단 결과]
- (P0·정확성) supabase/functions/notices/index.ts 가 packages/core/src/notice/normalize.ts 의 정규화 로직
  (normalizeYmd/resolveType/kstDateToUtcIso/normalize 등)을 손으로 복붙 유지 중(주석도 인정). Edge Function 은 무테스트.
  → 단일 소스화(공유 import 또는 양쪽 공유 골든마스터 스냅샷)로 표류 제거.
- (테스트) apps/web 의 "test" 가 no-op(console.log). pnpm -r test 가 웹은 사실상 미검증.
  → 최소한 core 테스트로 연결하거나 웹 스모크 테스트 추가.
- (오프라인) apps/web/index.html 이 Pretendard(cdn.jsdelivr)·Gowun Batang(fonts.googleapis) 외부 폰트 로드.
  sw.js 는 동일출처만 캐시 → 오프라인 표방과 불일치. → 폰트 self-host + SW precache, 또는 font-display: optional.
- (SW) sw.js 가 install 시 앱 셸을 precache 하지 않음(런타임 캐시만) → 설치 직후 오프라인 첫 로드 누락 가능.
- (경미) NoticeCard.tsx ↔ DetailScreen.tsx 의 '정정' 배지/종료상태 로직 중복 → 공용화.
- (참고·양호) 서비스키 서버 보관(DATA_GO_KR_SERVICE_KEY), 10분 캐시, 에러 상태코드 — 잘 됨.

[★ 절대 금지] apps/web/vite.config.ts 의 base "/homebom/" 변경 금지(배포 URL이 깨진다). manifest/sw 경로도 유지.

[포트폴리오 방향] 이 앱의 packages/core 를 3개 앱 공유 패키지로 승격하는 게 지주회사 핵심 목표.
정규화 단일화 작업 시 이 방향(공유 가능한 형태)으로.

[규칙] 프로덕션(Pages) 무손상, base path 불변. main 직접 push 금지, PR로. 각 PR에 CHANGELOG/버전 반영.
P0(정규화 중복 제거)부터. 큰 변경은 착수 전 요약 확인.
```
