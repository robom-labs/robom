# FINAL-TRACEABILITY-V7 — 감사 보완 추적표 (v0.3.0)

이 표가 V6 추적표를 대체한다(감사 재분류 반영). 증거 없는 PASS 금지.
증거 표기: 코드(파일) / U(단위 테스트 이름) / E(E2E 체크 문구) / S(스크린샷) / M(수동 확인).
실행 명령: `npm run test:all` (단위 33 + 정적 검증 + E2E Chromium ~81항목, 2026-07-15). WebKit은 CI에서 실행.

## GATE A

| ID | 요구 | 증거 | 상태 |
|---|---|---|---|
| A-01 | 충돌 없는 난수 ID·기존 ID 유지·중복 v2 dedupe·동명이인 | schedule-core newId/normalizeData · U "A-01…" 2건 · E "v1→v3 마이그레이션" | PASS |
| A-02 | persist 트랜잭션·rollback·시트 유지·성공 문구 금지 | app.js commit() · E "A-02" 4건(setItem throw 주입) | PASS |
| A-03 | 손상 raw 보존·빈 덮어쓰기 금지·v1 부활 방지·LKG·복구 선택 | app.js loadData/renderRecoveryBanner · E "A-03" 4건 | PASS |
| A-04 | 약 once 존중·daily/weekly/until 보존 | buildSeriesList · U "A-04" · E "A-04: 이번만 약은 once" | PASS |
| A-05 | 사전 알림 horizon(7/14/30일·월·연 경계) | schedule-core maxReminderLeadDays/upcomingFires · U "A-05" (7일·30일·연 경계) | PASS |
| A-06 | allDayReminders[] 최대 3·중복 제거·요약 표시·이전 흡수 | normalizeSeries · U "A-06" · 확인 패널 복수 토글(코드) | PASS |
| A-07 | 약 슬롯별 수정(라벨·시간·범위)·orphan 정리·reload 보존 | overrides.times · U "A-07" · E "A-07 저녁만 바뀌고 아침 유지" | PASS (슬롯 개수 변경은 전체 [수정]에서 — 오늘만 범위는 시간 변경에 한정, 코드 주석·아래 한계 참조) |
| A-08 | 전체 백업(statuses·settings·recents)·합치기/교체·fingerprint | exportJSON/importParsed/openImportChoice · U "A-08 왕복"·"B-10 지문" · E "A-08 업로드→합치기→중복 방지" 3건(setInputFiles) | PASS (교체 경로는 코드+수동 확인 M — 교체 전 자동 백업 내려받기 포함) |
| A-09 | 권한별 저장 문구·첫 알람 안내·일정 보존 | saveDraft · E "A-09" 3건(granted 스텁+denied 실측) | PASS (granted 는 헤드리스 한계로 permission 값 스텁 — 실기기 확인은 사람 작업) |
| A-10 | 전달 후 notified·스누즈 정리·delivery/completion 구분 | fireAlarm(async) · 코드 + U 스누즈 발화 | PASS (브라우저 알림 표시 실측은 헤드리스 불가 — M/BLOCKED 각주) |

## GATE B

| ID | 요구 | 증거 | 상태 |
|---|---|---|---|
| B-01 | 전체 visible 큰 선택 ≤6·다른 일정 1단계 | renderHomeMode · E "B-01" 2건(offsetParent 실측) | PASS |
| B-02 | 관계 선택 사항·피커 ≤6·동명이인·수정/삭제·연결 일정 안내 | RELATIONS/personChips/사람 관리 카드 · E "B-02" 2건 · U 동명이인 | PASS |
| B-03 | 관계별 추천 최대 4 + 모든 종류 개방 | annTypesFor · E "B-03 처음 만난 날" | PASS |
| B-04 | 기준일 [바꾸기]·나 선택 | data-ann-base·data-ann-me · E "B-04" 2건 | PASS |
| B-05 | 같은 계산 날짜 병합 + 안내 문구 | saveDraft byDate 병합 · E "B-05" | PASS |
| B-06 | 라벨-시간 일치·예시 시간·최근 시간·종료일(추가 설정) | slotLabelForTime·medUntil·lastMedSlots · U "B-06" · E "예시 시간" | PASS |
| B-07 | 미래 예정·기록 버튼 없음·건너뜀 문구·멱등 | medDayRow/alertCard · E "B-07" 2건 | PASS (행 단위 접기 대신 미래 숨김+행별 버튼 유지 — 한 줄 이내라 과밀 없음, S 05) |
| B-08 | 다음 일정 중복 제거·약 날짜 묶음 | renderAlerts · E "B-08" | PASS |
| B-09 | 전체 편집(날짜·제목·시간·장소·메모·대상) + 반복 범위 | edit-full+확인 패널 편집 행 · E "B-09 제목 변경" | PARTIAL — 반복 전체 교체만 지원(2회 저장 확인), '오늘만/앞으로' 전체-필드 편집은 시간 변경 경로로 한정. 기념일은 삭제 후 재생성 안내 |
| B-10 | copy/recent/next 의미 분리·fingerprint dedupe·이 날짜만 복사 | snapshotOfSeries(mode)·pushRecent·copy-once · U "B-10" · E "B-10 이 날만 복사" 3건(once 저장·원본 반복 유지) | PASS |
| B-11 | 0단계 초안·schema·이어서/새로 시작·24h 폐기 | closeDaySheet/openDaySheet · E "B-11" 2건 | PASS |
| B-12 | 공유: 약 전체 시간·반복 요약·슬롯별 ICS UID | shareText/share-ics · E 공유 + 코드 | PASS |
| B-13 | 생활 일정은 기존 단계 안에서(공과금 매월 제안) | TODO_PRESETS+monthly · 코드 | PASS (여행·기간 일정 DEFERRED 유지) |

## GATE C

| ID | 요구 | 증거 | 상태 |
|---|---|---|---|
| C-01 | 실측 터치: 일반 48px+·날짜 셀 44px+(320px) | CSS+E "C-01" boundingBox 2건(45×64 실측) | PASS (7열 특성상 48px 불가 — 44px+높이 64px으로 확보, 예외 정직 기록) |
| C-02 | 달력 semantics(단순 버튼 grid·aria-current/pressed) | renderCalendar/switchView · 코드+M | PASS |
| C-03 | focus trap·restore·targeted announce | keydown 트랩·announcer · E "C-03 포커스 복원"·키보드 2건 | PASS |
| C-04 | validation 인라인 오류·announce·focus | showFieldError · E "C-04" | PASS (제목·숫자 입력도 동일 헬퍼 — 사람 이름 E2E 실측) |
| C-05 | 상황별 알림 문구·딥링크·가짜 action 금지 | alarmCopy·?open= deep link · E "C-05" · action 버튼 없음 | PASS |
| C-06 | 복용 기록 보관(7/30/90/직접)·전체 삭제(백업)·개인정보 갱신 | doseRetentionGrid·deleteAllButton·purge · E "C-06" 2건 · PRIVACY/site 갱신 | PASS |
| C-07 | 65세+ 실사용 미실시 → BLOCKED 정직 | REAL-USER-TEST-PLAN.md | BLOCKED(사람 작업) |

## §6 ICS·PWA / §7 CI

| 항목 | 증거 | 상태 |
|---|---|---|
| ICS 1년 multi-slot 잘림 제거 | exportIcs slice 제거 · 코드 | PASS |
| UTC Z 경고 | import Z regex 토스트 · 코드 | PASS (변환은 안 함 — 왜곡 대신 경고, 정직) |
| alarm-core·구 time-picker CSS 제거 | 파일 삭제 + validate 규칙 | PASS |
| SW 새 버전 준비 안내 | updatefound 토스트+SKIP_WAITING | PASS(M) |
| 알림 딥링크 | ?open= 처리 · E | PASS |
| Playwright 고정·lockfile·전역 fallback 제거 | package.json/lock·e2e require | PASS |
| E2E 서버 수명주기·시계 고정 | e2e.mjs spawn+clock.setFixedTime | PASS |
| Chromium+WebKit | 로컬 Chromium 통과 · WebKit은 PR #52 CI 통과(run 29407643444 job 87326883276) | PASS |
| app 테스트 = Pages 배포 게이트 | deploy-site-pages.yml verify-calendarbom → build needs | PASS |
| 실패 artifact 업로드 | workflow upload-artifact | PASS |

## §9·§10

- 버전 동기화 0.3.0(패키지·APP_VERSION·CACHE_NAME·캐시버스트 03·README·CHANGELOG·registry·state·site 카드): validate-static + site 테스트가 강제 — PASS
- license: 저장소 승인 라이선스 결정 기록이 없어 `UNLICENSED`로 변경, 근거는 V020-AUDIT-REMEDIATION.md — PASS
- 로그인·클라우드·네이티브 알람·위젯: 자격정보 없음 — BLOCKED(가짜 버튼 없음 유지)

## 요약

PASS 33 · PARTIAL 1 (B-09 반복 범위 전체 한정) · DEFERRED 1 (기간 일정) · BLOCKED 2 (65+ 실사용, 로그인·네이티브).
후속 해소(2026-07-15): "이 날짜만 복사"와 "가져오기 파일 업로드 E2E"는 구현·검증 완료로 DEFERRED 에서 제외.
