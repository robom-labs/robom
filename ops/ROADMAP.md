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
- [ ] runningcall / pushrun 실구현 온보딩
- [ ] 배포 이관 여부 결정(D-open-1)
- [ ] 4주 데이터로 PATCH auto-merge 재검토(D-open-2)

## 앱별 백로그
- zoopzoopcall: `apps/zoopzoopcall/docs/ROADMAP.md`(v0.2.0 서버푸시 등) 참조
- runningcall / pushrun: stub — 최초 세팅 대기

## 앱 최적화 백로그 (2026-07-09 전수 진단 결과)
> D11: 앱 코드는 각 원본 저장소에서 실행. holdings는 우선순위만 관리.

### P0 — 앱 알림 버그 (R11, 2026-07-10 전수리뷰에서 발견 · 각 원본 저장소)
> 세 앱 모두 "알림"이 핵심인데 알림이 조용히 안 가는 HIGH 버그. 각 앱 저장소에서 수정.
- [ ] zoopzoopcall `scheduler.ts`: 권한 미허용 시에도 `markFired` 선행 → 알림 영구 억제.
- [ ] runningcall `page.tsx`: 한글 동네명 정규식 `\b`가 한글 뒤 미매치 → 위치검색 차단.
- [ ] pushrun `app.js`: setTimeout 24.8일 초과 미예약(8·9월 대회) / 모달 매초 리셋 / 배열-index ID로 저장 알림 유실.

### P0 — 보안/정확성 (먼저)
- [x] runningcall: `/api/{search-location,reverse-location,forecast}` 레이트리밋/오리진 제한 (Kakao 유료키 소진 방지) — repo:runningcall (2026-07-09 PR #2 draft, 사람 머지 대기)
- [ ] zoopzoopcall: Edge Function ↔ packages/core 정규화 중복 제거(단일 소스) — repo:zoopzoopcall (2026-07-09 조사 결과 하루 범위 초과 — Deno import 확장자 전면 수정 + 로컬 배포검증 불가. 제안서 필요, 다음 사이클에서 별도 검토)

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
