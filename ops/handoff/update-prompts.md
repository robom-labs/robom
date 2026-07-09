# 앱 업데이트 핸드오프 프롬프트

zoop-holdings 전수 진단(2026-07-09) 결과를 각 앱 저장소의 AI에게 넘기는 프롬프트.
각 앱의 Claude Code 세션에 **아래 블록을 그대로 붙여넣기**. (각 세션은 holdings 접근이 없으므로 자체 완결형으로 작성됨.)

사용 순서: 붙여넣기 → AI가 코드 확인 + 의견 제시 → 합의된 안전 항목부터 PR로 실행.

---

## 공통 규칙 (모든 프롬프트에 포함됨)
- 프로덕션 배포(Vercel/Pages)를 절대 깨지 않는다. 배포 설정·비밀키·prod 데이터 변경은 사람 승인.
- main 직접 push 금지. 작은 단위로 브랜치 → 테스트 → **PR**. 각 PR에 CHANGELOG/버전 반영.
- 먼저 "의견"을 내고(무엇을 왜, 위험도, 진단이 놓친 것), 그 다음 안전한 것부터 구현.
- 애매하거나 큰 리팩토링/보안 변경은 착수 전 확인.

---

## ▶ runningcall (러닝콜) 프롬프트

```
너는 이 저장소(runningcall / running-day-score, Next.js 16 + React 19, Vercel 배포)의 시니어 엔지니어다.
zoop-holdings(지주회사) 차원에서 3개 앱 전수 진단을 했고, 이 앱의 진단 결과는 아래와 같다.
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
- (P0·HIGH·정확성/2차감사) app/page.tsx 의 한글 동네명 정규식 `/[가-힣0-9]+(?:동|읍|면|리|가)\b/g` 이
  ASCII `\b`를 써서 한글 뒤에서 절대 매치되지 않는다("성수동"·"독산1동"·"연남동" 전부 null). 그 결과 hike 외
  모든 활동에서 runSearch 가 항상 "동네명까지 입력" 으로 조기 리턴 → **위치검색 전면 차단**. 플레이스홀더 예시(성수동)조차 실패.
  → 트레일링 `\b` 를 한글 인식 부정 룩어헤드 `(?![가-힣])` 로 교체(성수동/독산1동/종로1가 매치, 강남역/추가하기 거부 확인).
- (P1·MED/2차감사) lib/insights.ts getDayParts: isToday 일 때 과거 슬롯이 피크면 남은 유효 슬롯이 있어도 카드 전체를 past 처리·best=null.
  → isToday면 후보를 `hour >= nowHour` 로 먼저 필터한 뒤 peak 선택. (getDayParts 테스트는 빈 슬롯이라 안 깨짐)
- (P1·MED/2차감사) app/page.tsx '내일' 탭이 forecast.sunrise/sunset(오늘값)을 그대로 표시. weather.ts 의 sunriseTomorrow/sunsetTomorrow 미사용.
  → isTomorrow 분기해서 *Tomorrow 값 사용.

[포트폴리오 방향] 3개 앱이 KST 시간/D-day/알람 오프셋/알림 로직을 각자 재구현 중이다.
앞으로 공유 core 패키지로 통합할 계획이니, 신규 코드는 그 방향과 충돌하지 않게.

[규칙] 프로덕션(Vercel) 무손상. 비밀키 서버 보관 유지. main 직접 push 금지, PR로. 각 PR에 CHANGELOG/버전 반영.
P0(API 보호)부터. 큰 리팩토링·보안 변경은 착수 전 요약 확인.
```

---

## ▶ pushrun (PushRun) 프롬프트

```
너는 이 저장소(pushrun, 정적 사이트 — outputs/pushrun-site/, GitHub Pages+Vercel)의 시니어 엔지니어다.
zoop-holdings 차원 전수 진단 결과는 아래와 같다. 실제 코드로 검증하고, 의견을 낸 뒤, 안전한 것부터 PR로 구현하라.

[진단 결과]
- (데이터·mixed-content) races.json 의 registrationUrl 다수가 http:// (예: mara1080.com 등). 사이트는 HTTPS라 혼합콘텐츠 경고/차단 위험.
  → 호스트가 https 지원하면 https:// 로 정규화(각 호스트 확인 필요).
- (캐시버스트 드리프트) 버전이 3곳에 손동기화: app.js:4 APP_VERSION, index.html 의 ?v=20260708-9, app.js 의 ASSET_VERSION.
  → 단일 소스화(한 곳에서 파생 또는 배포시 주입) — 스테일 캐시 배포 방지.
- (접근성) #alertModal/#permissionModal/#batteryModal 에 focus-trap·Esc 닫기·포커스 복귀 없음.
  → 모달 키보드/스크린리더 접근성 보강. (toast 는 aria-live 있음 — 양호)
- (데이터 검증) races.json 이 앱 전체를 구동하는데 스키마 가드가 없다.
  → 필수 필드/ISO 날짜/URL 형식 검증 스크립트 추가(배포 전).
- (개발환경) 개발서버가 PowerShell 전용(serve-pushrun.ps1). → `npx serve` 등 이식성 있는 방법 추가.
- (참고·양호) 모든 innerHTML 보간에 escapeHtml 일관 적용, JSON.parse try/catch — XSS 방어 잘 됨.
- (P0·HIGH·정확성/2차감사) app.js 알림 관련 3건 — 이 앱의 핵심 가치(대회 접수 알림)를 조용히 깨뜨림:
  (a) 모달 열려있는 동안 ticker(1s)가 renderModal 을 매초 호출 → #modalPresetGrid 를 defaults(20/10/0)로 재생성.
     사용자가 체크박스를 바꿔도 1초 안에 되돌아감. → 카운트다운 갱신과 프리셋 그리드 재생성을 분리(ticker는 카운트다운만).
  (b) scheduleBrowserTimers 가 `delay > 2147483647`(≈24.8일) 이면 그냥 return → 8·9월 대회 알림이 아예 예약 안 됨.
     → 드롭 대신 MAX 후 재무장(setTimeout(scheduleAllBrowserTimers, MAX)) 1회 스케줄.
  (c) 스케줄피드 id 가 `schedule-${index}-${date}` (배열 index) → 피드 재정렬/삽입 시 id 변동, localStorage 저장 알림 전부 고아화.
     → 내용 기반 안정 id(raceIdentity 방식)로.
- (MED/2차감사) index.html 에 #raceDetail 요소가 없어 renderDetail 이 영구 no-op(상세 기능·관련 CSS 대량 dead).
  선택 시 selectRace 가 전체 render() 호출. → 상세 컨테이너 복원하거나, 리스트-only 의도면 renderDetail 제거+selectRace 는 리스트만 갱신.

[포트폴리오 방향] 3개 앱 공통 로직(D-day/알람/알림) 공유 패키지화 예정. 신규 코드는 그 방향 고려.

[규칙] 프로덕션 배포(Pages/Vercel) 무손상. main 직접 push 금지, PR로. 각 PR에 CHANGELOG/버전 반영.
mixed-content(https 정규화)와 캐시버스트 단일화부터. 데이터 대량 변경은 착수 전 요약 확인.
```

---

## ▶ zoopzoopcall (줍줍콜) 프롬프트

```
너는 이 저장소(zoopzoopcall / 줍줍콜, Vite+React PWA, GitHub Pages `/zoopzoopcall/`)의 시니어 엔지니어다.
zoop-holdings 차원 전수 진단 결과는 아래와 같다. 실제 코드로 검증하고, 의견을 낸 뒤, 안전한 것부터 PR로 구현하라.

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
- (P0·HIGH·정확성/2차감사) apps/web/src/notify/scheduler.ts check() 가 showAppNotification 이전에 markFired 를 호출한다.
  권한이 default/denied 면 showAppNotification 은 조용히 early-return 하는데 alert.id 는 이미 fired 집합에 들어가
  **영구 억제** → 나중에 권한을 켜도 그 알림은 다시 안 온다(앱 핵심 목적 실패). → check() 상단에서
  `if (notificationSupport() !== "granted") return;` 하거나 showAppNotification 이 성공 boolean 을 반환해 성공 시에만 markFired.
- (MED/2차감사) useNotices.ts 가 응답을 `as Notice[]` 로 캐스팅만(Array.isArray 만 검사). receiptEnd 불량이면
  Date.parse=NaN → getNoticeStatus 가 조용히 "마감" 처리해 라이브 공고가 사라진다. 또 fetch 에 타임아웃/AbortController 가 없어
  엣지펑션 지연 시 무한 "불러오는 중". → 파싱 불가 항목 필터 + 15s 타임아웃.
- (MED·a11y/2차감사) DetailScreen 알림 마스터 토글(role="switch")에 접근가능한 이름이 없다(장식 span만). → aria-label="알림 받기".

[★ 절대 금지] apps/web/vite.config.ts 의 base "/zoopzoopcall/" 변경 금지(배포 URL이 깨진다). manifest/sw 경로도 유지.

[포트폴리오 방향] 이 앱의 packages/core 를 3개 앱 공유 패키지로 승격하는 게 지주회사 핵심 목표.
정규화 단일화 작업 시 이 방향(공유 가능한 형태)으로.

[규칙] 프로덕션(Pages) 무손상, base path 불변. main 직접 push 금지, PR로. 각 PR에 CHANGELOG/버전 반영.
P0(정규화 중복 제거)부터. 큰 변경은 착수 전 요약 확인.
```
