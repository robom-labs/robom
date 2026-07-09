# ROADMAP — zoop-holdings

## 지금 (v0.1.x, 착수)
- [x] 관제 저장소 뼈대 + 앱 편입
- [ ] GitHub 저장소 생성 + 최초 push
- [ ] `ANTHROPIC_API_KEY` secret 등록 (사장)
- [ ] `guardrails.yml` 실제 동작 확인(첫 PR에서)
- [ ] 첫 `daily-company-run` 수동 실행(workflow_dispatch) 시범
- [ ] 첫 홍보 콘텐츠팩 1개 실제 생성 확인

## 다음 (v0.2.x)
- [ ] 앱별 매트릭스로 guardrails 확장 (runningcall/pushrun 준비)
- [ ] branch protection + required checks + CODEOWNERS 설정(사장)
- [ ] weekly-review 첫 회 + agent-performance 첫 기록
- [ ] 홍보 성과 측정 필드를 state에 연결(성장 루프)

## 나중 (v0.3.x+)
- [x] runningcall / pushrun 편입 (3개 앱 모두 live — D7)
- [ ] 배포 이관 여부 결정(D-open-1)
- [ ] 4주 데이터로 PATCH auto-merge 재검토(D-open-2)
- [ ] vendored 사본 → git submodule 전환 검토(D-open-4, R2 드리프트 해소)

## 앱별 백로그
- zoopzoopcall: `apps/zoopzoopcall/docs/ROADMAP.md`(v0.2.0 서버푸시 등) 참조
- runningcall: `apps/runningcall/docs/ROADMAP.md` 참조 (live v0.13.1)
- pushrun: 정적 사이트, `apps/pushrun/README.md` 참조 (live v0.6.6)

## 앱 최적화 백로그 (2026-07-09 전수 진단 결과)
> D11: 앱 코드는 각 원본 저장소에서 실행. holdings는 우선순위만 관리.

### P0 — 보안/정확성 (먼저)
- [x] runningcall: `/api/{search-location,reverse-location,forecast}` 레이트리밋/오리진 제한 (Kakao 유료키 소진 방지) — repo:runningcall (2026-07-09 PR #2 draft, 사람 머지 대기)
- [ ] zoopzoopcall: Edge Function ↔ packages/core 정규화 중복 제거(단일 소스) — repo:zoopzoopcall (2026-07-09 조사 결과 하루 범위 초과 — Deno import 확장자 전면 수정 + 로컬 배포검증 불가. 제안서 필요, 다음 사이클에서 별도 검토)

### P0-신규 — 심층 감사(2026-07-09 2차)에서 발견한 **HIGH 정확성 버그** (핸드오프 update-prompts.md에 상세)
> 세 앱 모두 "알림"이 핵심 가치인데, 알림이 조용히 안 가는 버그가 각 앱에 있다. 최우선.
- [ ] zoopzoopcall: `apps/web/src/notify/scheduler.ts` — 권한 미허용 시에도 `markFired`가 먼저 호출돼 알림이 **영구 억제**(권한 나중에 켜도 안 옴). → 권한 확인 후에만 fire. — repo:zoopzoopcall
- [ ] runningcall: `app/page.tsx` 한글 동네명 정규식 `\b`가 한글 뒤에서 안 걸려 **위치검색 전면 차단**(성수동 등 전부 실패). → 트레일링 `\b`를 `(?![가-힣])` 부정 룩어헤드로. — repo:runningcall
- [ ] pushrun: `app.js` (a) 알림 모달이 매초 오프셋 체크박스를 리셋해 사용자 편집 유실, (b) `setTimeout` 24.8일 초과 알림 미예약(8·9월 대회 대부분 알림 안 옴), (c) 스케줄피드 ID가 배열 index 기반이라 데이터 갱신 시 저장 알림 유실. — repo:pushrun

### P1-신규 — MED (동작 정확성)
- [ ] runningcall: `lib/insights.ts getDayParts` 가 과거 슬롯 때문에 남은 유효 슬롯이 있어도 시간대 카드 전체를 버림; "내일" 탭이 오늘 일출/일몰 표시(`sunriseTomorrow` 미사용). — repo:runningcall
- [ ] zoopzoopcall: `useNotices.ts` 응답 shape 미검증(불량 항목이 조용히 "마감") + fetch 타임아웃 없음(무한 로딩). — repo:zoopzoopcall
- [ ] pushrun: `#raceDetail` 요소 부재로 상세 기능이 완전 no-op(관련 CSS 대량 dead) + 카드 선택이 전체 재렌더. — repo:pushrun

### P1 — 포트폴리오 레버리지 (지주회사 핵심)
- [ ] 공유 core 패키지: zoopzoopcall `packages/core`의 KST/time·alarm/offset·notification 어댑터를
      공유 패키지로 승격 → runningcall·pushrun 가 소비(3벌 중복 → 1벌) — cross-repo

### P2 — 품질/퀵윈
- [ ] runningcall: ESLint + lint 스크립트 + CI 연결(숨은 exhaustive-deps 노출) — repo:runningcall
- [ ] runningcall: page.tsx(2,180줄)·gacha.tsx 점진적 컴포넌트/훅 분해 — repo:runningcall
- [ ] runningcall: lib/insights.ts(1,049줄) 테스트 추가, `--webpack` 사유 문서화 — repo:runningcall
- [x] zoopzoopcall: apps/web 실제 테스트 연결(현재 no-op) — repo:zoopzoopcall (2026-07-09 PR #3 draft)
- [ ] zoopzoopcall: 폰트 self-host + SW 셸 precache — repo:zoopzoopcall
- [ ] pushrun: races.json http→https 정규화, 버전/캐시버스트 단일화 — repo:pushrun
- [x] pushrun: 모달 Esc 키 닫기 (2026-07-09 PR #2 draft) — focus-trap 전체(Tab 순환)는 별도
