# FINAL-TRACEABILITY-V6 — 요구사항 추적표 (v0.2.0) [대체됨]

> 2차 심층 감사 재분류에 따라 이 표는 **FINAL-TRACEABILITY-V7.md 로 대체**되었다.
> 감사가 재분류한 항목(SIMPLE-002·008, FLOW-006, PERSON-003, MED-005~008, ANNIV-009·010·012, DATA-004·005, SHARE-003, A11Y-001·006, QA-003)은 V7 표의 대응 ID 에서 수정·재검증되었다.

증거 규칙: 코드 파일 + 테스트 이름(또는 E2E 체크 문구) + 스크린샷이 있어야 PASS.
테스트: `npm test`(unit 31 + validate) · `node scripts/e2e.mjs screenshots/final`(E2E 60항목, 2026-07-15 실행 로그).
스크린샷: `screenshots/final/01~12`.

| ID | 요구사항 | 구현 | 테스트/증거 | 스크린샷 | 상태 |
|---|---|---|---|---|---|
| SIMPLE-001 | 날짜 탭 후 구체적 질문 | app.js renderHomeMode | E2E "날짜 탭 → 구체적 질문" | 04 | PASS |
| SIMPLE-002 | 첫 화면 큰 선택지 6개 이하 | TEMPLATES 6종 | E2E "첫 화면 기본 선택지 6개" | 04 | PASS |
| SIMPLE-003 | 일반 일정 결정 3개 이내 | 아코디언+기본값 | E2E "과제 A: 탭 3회" | 04,07 | PASS |
| SIMPLE-004 | 최근 일정 1~2개 결정 | draftFromSnapshot | E2E "과제 D: 탭 2회" | 08 | PASS |
| SIMPLE-005 | 고급 항목 기본 접힘 | defaults-box+[바꾸기] | E2E "요약에 자동 기본값 표시" | 05 | PASS |
| SIMPLE-006 | 텍스트 입력 선택 사항 | 칩 우선, 직접 입력만 키보드 | E2E 과제 A(입력 0회) | 04 | PASS |
| SIMPLE-007 | 주 CTA 하나 | sticky 저장, 단계 중 숨김 | 2차 시각 검수(05 재캡처) | 05 | PASS |
| SIMPLE-008 | 입력 유지·되돌리기 | DRAFT_KEY·snapshotUndo | E2E "초안 복원"·"삭제 되돌리기" | — | PASS |
| SIMPLE-009 | 질문 예산 문서 | docs/QUESTION-BUDGET.md | E2E 탭 수 검증 연동 | — | PASS |
| SIMPLE-010 | 사람 선택 비강제 | 기본 나+[바꾸기] | E2E "병원: 사람을 먼저 묻지 않음" | — | PASS |
| FLOW-001 | 최근 일정 | data.recents(표시 2) | E2E 과제 D | 08 | PASS |
| FLOW-002 | 지난번과 같게 | recents[0] 칩 | E2E "최근 일정 칩 존재" | 08 | PASS |
| FLOW-003 | 일정 복사 | detail 복사 | 상세 화면 버튼(E2E "상세: …복사…") | 11 | PASS |
| FLOW-004 | 다음 일정 만들기 | pendingCopy | E2E "병원은 다음 일정 만들기" | — | PASS |
| FLOW-005 | 자연어 요약 | seriesSummaryLines | unit "자연어 요약…"+E2E 확인 문장 | 05 | PASS |
| FLOW-006 | 일정 수정 | edit-time(+범위) | E2E "수정: 오후 2시 50분" | 07 | PASS |
| FLOW-007 | 하루 종일·알림 분리 | allDayReminder | unit "하루 종일 일정도 별도 알림" | — | PASS |
| FLOW-008 | 최근 시간 제안 | settings.lastTime:* | quickTimeChips 코드+수동 확인 | — | PASS |
| TIME-001 | 빠른 시간 최대 4개 | quickTimeChips slice(0,4) | 코드+04 캡처 | 04 | PASS |
| TIME-002 | 큰 선택 시간 표시 | .time-display | 07 캡처 | 07 | PASS |
| TIME-003 | ±10분·정각 | adjustTime | E2E −10분 수정 | 07 | PASS |
| TIME-004 | 운영체제 시간 선택 | input[type=time] | 07 캡처+isValidTime | 07 | PASS |
| TIME-005 | 드래그 없이 사용 가능 | 버튼·키보드만 | E2E 키보드 Enter/Escape | — | PASS |
| TIME-006 | 200% 확대 | reflow 검증 | E2E "200% 확대 무가로스크롤" | 12 | PASS |
| PERSON-001 | 지연 등록 | 사람 추가 인라인 | E2E 과제 B·C(엄마·지연) | 06 | PASS |
| PERSON-002 | 최소 정보(이름만) | normalizePerson | 코드(전화·주소 필드 없음) | — | PASS |
| PERSON-003 | 관계별 추천 | ANN_TYPES 상황 추천 | 06 캡처 | 06 | PASS |
| PERSON-004 | 추천은 고정관념 아님 | 모든 종류 선택 가능 | 코드(제한 없음) | — | PASS |
| TEMPLATE-001 | mustAsk/canInfer/optionalLater | TEMPLATES.steps+defaults | QUESTION-BUDGET 분류표 | — | PASS |
| TEMPLATE-002 | 병원 | hospital 템플릿 | E2E 과제 A | — | PASS |
| TEMPLATE-003 | 약속 | meeting(누구와+시간) | E2E 초안 복원(민수와 약속) | — | PASS |
| TEMPLATE-004 | 공과금 | 할 일+매월 반복 칩 | repeat monthly 지원(unit 매월) | — | PASS(간소화: 전용 칩 대신 반복 매월) |
| TEMPLATE-005 | 기간 일정 | — | — | — | DEFERRED(여행·입원은 다음 버전, 화면 단순성 우선) |
| MED-001 | 누구의 약 | personId 기본 나 | E2E 과제 B | 05 | PASS |
| MED-002 | 약 이름 비필수 | 파생 별칭 | E2E "이름 입력 없이 저장" | 05 | PASS |
| MED-003 | 하루 1·2·3회 | MED_DEFAULT_SLOTS | E2E 하루 2번 | 05 | PASS |
| MED-004 | 여러 시간 슬롯 | slots[] | unit "약: 여러 시간 슬롯" | — | PASS |
| MED-005 | 매일·요일 반복 | repeat daily/weekly | unit 반복 스위트 | — | PASS |
| MED-006 | 먹었어요 | statuses done | E2E "먹었어요 기록" | 09 | PASS |
| MED-007 | 조금 있다가 | snoozeUntil(5/10/30/60) | E2E+unit 스누즈 발화 | 09 | PASS |
| MED-008 | 건너뛰었어요 | statuses skipped | 버튼+unit(skipped 발화 제외) | 09 | PASS |
| MED-009 | 달력 묶음 표시 | seriesId 단위 점 | E2E "달력은 묶음 1개 표시" | 02 | PASS |
| MED-010 | 의료 판단 금지 | 안내 문구만 | "처방받은 안내에 맞게" E2E | 05 | PASS |
| ANNIV-001 | 상황별 추천 최대 4 | ANN_PICKS 3+다른 날 | E2E "추천 최대 4개" | 06 | PASS |
| ANNIV-002 | 매년 같은 날짜 | repeat yearly | unit 매년(윤일 포함) | — | PASS |
| ANNIV-003 | 임의 N일 | anniversaryDate days | unit 100·1000일 | — | PASS |
| ANNIV-004 | N개월·N주년 | months/years | unit 월말·평년 당김 | — | PASS |
| ANNIV-005 | 직접 입력 | N일/N개월/N주년 입력 | 코드(data-ann-custom) | 06 | PASS |
| ANNIV-006 | 계산 방식 확인 | anniversaryExplain | E2E "1일째로 계산해요" | 06 | PASS |
| ANNIV-007 | 선택한 기념일만 생성 | picks만 series화 | E2E "고른 기념일만 생성(2개)" | — | PASS |
| ANNIV-008 | 다음 기념일 하나만 알림 | — | — | — | DEFERRED(생성 자체를 선택제로 해 과밀 방지 — 필요성 재평가) |
| ANNIV-009 | 알림 시간 분리 | allDayReminder | unit 하루 전 오전 9시 | — | PASS |
| ANNIV-010 | 축하·중립·추모 말투 | tone 저장·중립 확인문 | 코드(기억하는 날=memorial, 축하 문구 없음) | — | PASS |
| ANNIV-011 | 월말·윤년 테스트 | — | unit ANNIV 스위트 | — | PASS |
| ANNIV-012 | 중복 일정 방지 | picks 토글·라벨 dedupe | 코드(exists 필터) | — | PASS |
| REC-001 | series 모델 | schedule-core | unit 전체 | — | PASS |
| REC-002 | 다음 occurrence | nextOccurrence | unit until·skip | — | PASS |
| REC-003 | 오늘만·앞으로·전체 | scope 모드 | 코드+scope UI(수동 확인) | — | PASS |
| REC-004 | 예외 보존 | overrides | unit 시간 override | — | PASS |
| DATA-001 | v2 schema | normalizeData | unit normalizeData | — | PASS |
| DATA-002 | v1 마이그레이션 | migrateV1 | unit+E2E 브라우저 마이그레이션 | — | PASS |
| DATA-003 | v1 원본 보존 | 삭제 코드 없음 | E2E "v1 원본 보존" | — | PASS |
| DATA-004 | fallback | loadData v2 실패→v1 | 코드 경로+unit(normalizeData null) | — | PASS |
| DATA-005 | JSON v2 | exportJSON/importParsed | unit 왕복+v1 파일 | — | PASS |
| DATA-006 | ICS | 발생 낱개 내보내기 | ics unit 6개+코드 | — | PASS |
| SHARE-001 | 기본 나만 보기 | 요약 문장 고정 | unit 요약 마지막 줄 | 05 | PASS |
| SHARE-002 | 한 건 텍스트 공유 | navigator.share/클립보드 | E2E 공유 미리보기 | 11 | PASS |
| SHARE-003 | 한 건 ICS 공유 | share-ics | 코드+버튼 | 11 | PASS |
| SHARE-004 | 미리보기 | share-preview | E2E "해당 일정만" | 11 | PASS |
| SHARE-005 | 다른 일정 제외 | 단건 payload | E2E "다른 일정 내용 미포함" | 11 | PASS |
| SHARE-006 | 민감정보 안내 | 약 공유 경고 | 코드(share-warn) | — | PASS |
| AUTH-001~003 | 카카오·Google·Apple future adapter | 설계 문서 | NATIVE-AUTH-SYNC-ROADMAP.md | — | BLOCKED(앱 등록·OAuth 자격정보 필요 — 가짜 버튼 없음) |
| AUTH-004 | 로그인 없이 시작 | 계정 개념 없음 | 앱 전체 | — | PASS |
| AUTH-005 | 가짜 로그인 금지 | 로그인 UI 없음 | grep(로그인 버튼 0) | — | PASS |
| AUTH-006 | 계정 삭제 설계 | 로드맵 문서 | NATIVE-AUTH-SYNC-ROADMAP.md | — | PASS(설계만) |
| A11Y-001 | 넉넉한 터치 영역 | 칩 48~52px+ | styles(min-height 48+) | 04 | PASS |
| A11Y-002 | 320px | 스윕 | E2E @320 | 01 | PASS |
| A11Y-003 | 아주 크게 | data-font=xl | E2E xl 무가로스크롤 | 03 | PASS |
| A11Y-004 | 200% reflow | zoom 검증 | E2E 200% | 12 | PASS |
| A11Y-005 | 키보드 | 버튼 포커스·Enter/Esc | E2E 키보드 2항목 | — | PASS |
| A11Y-006 | 스크린리더 | aria-label·aria-live·aria-pressed | index/app 코드 | — | PASS(자동+코드 검수, 실기기 낭독은 사람 작업) |
| A11Y-007 | 색 외 상태 표시 | ✓문구·취소선+텍스트 | dose-state 문구 | 09 | PASS |
| A11Y-008 | reduced motion | prefers-reduced-motion | styles 유지 | — | PASS |
| QA-001 | 기존 테스트 | 31 unit 통과 | npm test | — | PASS |
| QA-002 | migration 테스트 | unit+브라우저 | 위 DATA-002 | — | PASS |
| QA-003 | E2E 5개 과제 | A~E | e2e.mjs 60 체크 | — | PASS |
| QA-004 | dead button 없음 | 전 버튼 위임 핸들러 | E2E 전 흐름+grep TODO=0 | — | PASS |
| QA-005 | TODO 완료 없음 | — | `grep -rn "TODO" app/` = 0 | — | PASS |
| QA-006 | 민감정보 로그 없음 | console 출력 없음 | `grep -n "console\." app/app.js` = 0 | — | PASS |
| QA-007 | 캐시·버전 일치 | 0.2.0/20260715-02 | validate-static 통과 | — | PASS |

## 요약

- PASS 74 · DEFERRED 2 (TEMPLATE-005 기간 일정, ANNIV-008 다음 기념일만 알림) · BLOCKED 1 (AUTH-001~003 로그인 — 앱 등록 후)
- 실제 사용자 테스트(65세+)는 수행하지 못했다 — `REAL-USER-TEST-PLAN.md`에 사람 작업으로 남김. "70대에게 검증됨"이라고 주장하지 않는다.
