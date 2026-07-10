# ROADMAP — zoop-holdings

## 지금 (v0.3.x, 출시 준비)
- [x] 관제 저장소 뼈대 + 앱 편입
- [x] GitHub 저장소 생성 + 최초 push
- [ ] `ANTHROPIC_API_KEY` secret 등록 (사장)
- [x] `guardrails.yml` 실제 동작 확인
- [ ] 첫 `daily-company-run` 수동 실행(workflow_dispatch) 시범
- [ ] 첫 홍보 콘텐츠팩 1개 실제 생성 확인

## 다음
- [x] 앱별 CI로 guardrails 확장
- [ ] branch protection + required checks + CODEOWNERS 설정(사장)
- [ ] weekly-review 첫 회 + agent-performance 첫 기록
- [ ] 홍보 성과 측정 필드를 state에 연결(성장 루프)

## 나중
- [x] runningcall / pushrun 실구현 온보딩
- [ ] 배포 이관 여부 결정(D-open-1)
- [ ] 4주 데이터로 PATCH auto-merge 재검토(D-open-2)

## 앱별 백로그
- zoopzoopcall: `apps/zoopzoopcall/docs/ROADMAP.md`(v0.2.0 서버푸시 등) 참조
- runningcall: `apps/runningcall/CHANGELOG.md` 참조
- pushrun: `apps/pushrun/CHANGELOG.md` 참조

## 앱 최적화 백로그 (2026-07-09 전수 진단 결과)
> D11: 앱 코드는 각 원본 저장소에서 실행. holdings는 우선순위만 관리.

### P0 — 앱 알림 버그 (R11, 2026-07-10 전수리뷰에서 발견 · 각 원본 저장소)
> 세 앱 모두 "알림"이 핵심이다. 브라우저가 열린 동안의 조용한 실패는 고쳤고, 종료 후 알림은 서버 Web Push가 필요하다.
- [x] zoopzoopcall: 알림 표시 성공 후에만 `markFired`, 중복 전달 방지 — PR #8.
- [x] runningcall: 한글 위치검색 차단 해소, 실험적 Notification Trigger 제거, 동작범위 고지 — PR #5.
- [x] pushrun: 장기 타이머 재예약·모달 상태/안정 ID·서비스워커 알림 — PR #4.
- [ ] 세 앱 완전 백그라운드 알림용 서버 Web Push RFC·비용·개인정보 검토 — MAJOR.

### P0 — 보안/정확성 (먼저)
- [x] runningcall: API same-origin·레이트리밋·좌표검증·캐시, 위치 오답 폴백 제거 — PR #5, 사람 머지·Kakao 키 확인 대기.
- [ ] zoopzoopcall: Edge Function ↔ packages/core 정규화 중복 제거(단일 소스) — repo:zoopzoopcall (2026-07-09 조사 결과 하루 범위 초과 — Deno import 확장자 전면 수정 + 로컬 배포검증 불가. 제안서 필요, 다음 사이클에서 별도 검토)

### P1 — 포트폴리오 레버리지 (지주회사 핵심)
- [ ] 공유 core 패키지: zoopzoopcall `packages/core`의 KST/time·alarm/offset·notification 어댑터를
      공유 패키지로 승격 → runningcall·pushrun 가 소비(3벌 중복 → 1벌) — cross-repo

### P2 — 품질/퀵윈
- [ ] runningcall: ESLint + lint 스크립트 + CI 연결(숨은 exhaustive-deps 노출) — repo:runningcall
- [ ] runningcall: page.tsx(2,180줄)·gacha.tsx 점진적 컴포넌트/훅 분해 — repo:runningcall
- [ ] runningcall: lib/insights.ts(1,049줄) 테스트 추가, `--webpack` 사유 문서화 — repo:runningcall
- [x] zoopzoopcall: apps/web 실제 테스트와 원본 CI 연결 — PR #8.
- [ ] zoopzoopcall: 폰트 self-host + SW 셸 precache — repo:zoopzoopcall
- [ ] pushrun: HTTP 외부 링크 178개를 도메인별 HTTPS 지원 확인 후 점진 교체 — repo:pushrun.
- [x] pushrun: 버전/캐시버스트 정합성 검사, PWA 자산, 모달 Esc·focus-trap — PR #4.
