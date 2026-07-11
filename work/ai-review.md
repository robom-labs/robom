<!-- 로봄 02 홈페이지·브랜드 회의실의 모바일 UX 개선 협업 기록(담당자 독립분석 + Claude Code 교차검토)을 누적한다. -->
# robom.kr 모바일 UX 개선 — AI 협업 기록

- 대상: `site/app/page.tsx`, `site/app/globals.css` (PR #20 `agent/robom-rebrand` 기준)
- 리드: Claude Code (로봄 02)
- 담당자: 기획팀(planner) · 설계팀(architect) · 검사팀(inspector)
- 문제의 출발점: 실제 robom.kr 390×844 모바일에서 전체 5,577px, 앱 상세 카드 첫 시작 2,211px, 상단 앱 링크 3개 각 46×44px(10px 폰트), 히어로 1차 CTA는 앱을 열지 않고 스크롤만. 첫 화면 대부분을 484px 장식 `.timing-board`가 차지.

---

## 라운드 1 — 담당자 독립 분석 요약

### 기획팀(planner)
- 문제/근거: 모바일에서 side-nav(`display:none`)가 사라지며 진짜 앱 링크가 통째로 소멸, 남는 진입점은 `.mobile-nav-links`의 10px 회색 텍스트 링크뿐. 히어로 primary CTA(`href="#signals"`)는 앱을 열지 않음. 첫 화면 유효 행동이 사실상 없음.
- 사용자 영향도: **상**(전환 병목/이탈 직결).
- 모바일 터치: 상단 링크가 우측 상단에 몰려 한 손 엄지 도달영역과 반대, 시각 타깃·히트영역 불일치로 오탭 위험.
- 제안: `.hero-actions` 아래 모바일 전용 3분할 "바로 앱 열기" + 상단 링크 제거. 높이 ≥48px, gap ≥8px, 라벨 ≥14px.

### 설계팀(architect)
- 문제/근거: 진입점이 tone 색·아이콘 없는 10px 텍스트로 인지 불가. 앱 카드까지 스크롤 필요. `.timing-board`는 앱 이름을 보여주나 링크가 아닌 dead-end(인지-행동 불일치).
- 권장 구조: 신규 `.hero-app-launch`(컨테이너)+`.hero-app-link`(각 앱), tone 클래스(outdoor/chance/start) 재사용, **신규 색 토큰 금지**. 기본 `display:none` + `@media max-width:780px`에서만 노출(기존 `.mobile-brand`/`.mobile-nav-links` 패턴과 동일). 1120px 블록 무수정. `signals` 배열을 4번째 소비자로 map 재사용(하드코딩 금지).
- 회귀 위험: 신규 규칙을 780px 블록 밖에 두면 데스크톱 누수 → 반드시 블록 안. reduced-motion 목록에 새 인터랙션 클래스 추가 고려.

### 검사팀(inspector)
- 가드레일: 통과(주의 1) — secret/base path/배포/lockfile 무관, PATCH~MINOR. **`signals` href 3개 절대 수정 금지**(금지선 3).
- 테스트: `tests/rendered-html.test.mjs`는 3개 앱 URL·브랜드·`timing-board`·`BrandLockup`/`SignalArtwork`·`a:focus-visible`·`prefers-reduced-motion` 존재를 검증하고 구 명칭(러닝콜/줍줍콜/PushRun)·codex-preview 부재를 검증. 정상 구현 시 PASS 유지(URL은 side-nav/signal-card에 잔존).
- 접근성: 동일 목적지 링크 중복 → aria-label로 구분. 터치 44~48px, gap 8px+. 새 `<a>`는 전역 focus-visible/reduced-motion 자동 적용.
- 검증: `npm run lint` / `npm run build`(vinext, 무거움·네트워크) / `npm test`(build 성공이 전제).

---

## 라운드 1 — Claude Code(리드) 의견

- 3인 공통(히어로 앱 런처 신설·signals 재사용·모바일 전용 display:none·tone 색 재사용·터치 규격·href 불변·데스크톱 무영향)은 전면 채택.
- 쟁점은 `.mobile-nav-links` 처리. 나는 **삭제**를 주장 — 상단 링크와 신규 런처가 같은 3개 앱을 같은 위치에서 중복 노출하는 이중 구조는 인지 부하·접근성 중복·터치 미달을 동시에 유발. "3중 네비 중 최소 1개 레이어 삭제" 원칙.
- coral 배경 흰 글씨 대신 side-nav `.app-menu-link`의 검증된 밝은 배경+톤 마크+진한 글씨 패턴을 재사용해 대비 리스크를 원천 차단하는 방향 제시.

---

## 라운드 2 — 교차 검토(다른 담당자 + 리드 의견 반영)

### 설계팀 → **반대 철회**
`.top-nav`에 `position:sticky`가 없음을 코드로 확인(globals.css:69, 780px 블록에도 없음). 그 링크는 히어로를 벗어나면 스크롤아웃되어 재진입 경로로 기능하지 못하므로 삭제가 옳다. sticky 미니냅 신설은 수술 범위 초과 → 후속 보류 동의.
- 보완(일관성): tone→색 매핑이 `.app-menu-mark`·`.board-signal>span`에 이어 **3번째 중복**이 되지 않도록, 색 선언을 공용 셀렉터로 묶거나 tone 변수 1벌로 뽑아 참조하라.

### 검사팀 → **채택 + 반대 1건**
- 커버리지 공백 보정 assert(기존 무해): `assert.match(page, /hero-app-launch/)`, `assert.doesNotMatch(page, /mobile-nav-links/)`, `assert.match(css, /hero-app-launch/)`. aria-label 정규식은 취약하니 클래스 존재/부재 중심으로.
- 반대 1건: 정적 테스트로는 "버튼이 fold 아래로 밀리는 회귀"를 못 잡는다 → `.hero-app-launch`가 `.hero-actions` 직후(1스크린 내)에 오는지 **모바일 뷰포트 수동 확인**을 체크리스트에 명시.
- 실행 리스크: `vinext build`가 네트워크로 막히면 test 불가 → build 실패 시 릴리스 제안 금지(금지선 9). lint를 build 전에 1차 실행.

### 기획팀 → **동의 + 합격기준 2건 추가**
- `.mobile-nav-links` 삭제 후 `.top-nav`에 `.mobile-brand`만 남는 정렬(육안) 확인.
- `.hero-app-launch` 대비 WCAG AA(4.5:1) 충족, 라벨 폰트 ≥14px.

---

## 제안별 판정 (리드 최종)

### A1. 모바일 전용 `.hero-app-launch`(직접 앱 열기 3버튼) 신설 — **채택**
- 문제/근거: 위 전원 확인. 첫 화면 유효 행동 부재, 앱 카드 2,211px.
- 사용자 영향도: 상. 모바일 터치: 큰 폭 개선(≥52px 타깃, 엄지 도달영역).
- 난이도: 낮음 / 회귀: 낮음(모바일 전용 격리, signals 재사용).
- 이유: 모바일 핵심 행동을 첫 화면으로 끌어올리는 최대 효과 항목.

### A2. `.mobile-nav-links`(10px 텍스트 링크) 제거 — **채택**
- 근거: top-nav 비-sticky 확인 → 재진입 가치 없음. 런처와 동일 위치·역할 순수 중복 + 44px 미달 터치.
- 하단 재진입은 signal 카드·closing CTA·footer가 이미 담당.

### A3. tone→마크 색 DRY(공용 셀렉터 그룹) — **채택**(설계팀 보완)
- 색 선언을 tone별 1곳으로 묶어 유지보수 중복 방지. 크기/모양은 컨텍스트별 유지(대규모 리팩터 회피).

### A4. 테스트 assert 3종 추가 — **채택**(검사팀 보완)
- hero-app-launch 존재(page/css) + mobile-nav-links 부재. 변경의 실질을 최소비용으로 고정.

### 보류(Hold)
- H1. sticky 미니 상단 네비(스크롤 후 지속 재진입): 수술 범위 초과, 데이터로 재검토.
- H2. 고정 하단 독(bottom dock): 화면 가림 리스크, 런처 도입 후 이탈 잔존 시 단일 CTA로 재검토.
- H3. 카드 순서 상향/`.timing-board` 축소: 구조 변경 규모 큼. 런처가 접근성 문제를 해결하므로 후순위.
- H4. 진입점별 클릭 이벤트 측정: 별도 계측 인프라 작업.

### 제외(Exclude)
- E1. URL 하드코딩/`signals` href 수정: 금지선 3 위반.
- E2. coral 배경+흰 글씨 런처: 대비 리스크 → 밝은 배경+톤 마크 패턴으로 대체.
- E3. 상단 링크 + 런처 이중 유지: 중복 구조, 기각.

---

## 최종 범위(구현)
1. `site/app/page.tsx`: `.hero-actions` 직후 모바일 전용 `.hero-app-launch`(signals.map, tone 재사용, aria-label `${signal.appName} 앱 열기`, href 불변) 추가. `.mobile-nav-links` 블록 제거.
2. `site/app/globals.css`: `.hero-app-launch` 기본 `display:none` + 780px 블록에서 노출(높이 ≥52px, gap ≥10px, 밝은 배경/톤 마크/진한 글씨). tone 색 공용 셀렉터 그룹화. `.mobile-nav-links` 규칙 제거. 신규 인터랙션 클래스 reduced-motion 목록에 추가.
3. `site/tests/rendered-html.test.mjs`: assert 3종 추가.
4. 검증: lint → build → test, 모바일 390×844 뷰포트에서 런처가 1스크린 내 노출 확인.
