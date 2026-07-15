# state: calendarbom (캘린더봄)

## 현재 상태

- 버전: 0.3.0
- 상태: live (본사 Pages 임시 경로)
- 최근 배포: 2026-07-15
- 역할: 고령 사용자용 큰 달력·쉬운 알람. 키보드 없이 버튼만으로 일정과 알람 저장.
- 소스 위치: `apps/calendarbom` (임시 — 목표 저장소 `robom-labs/calendarbom` 생성 대기)
- 현재 배포: https://robom-labs.github.io/robom/calendarbom/
- 목표 배포: https://robom-labs.github.io/calendarbom/

## 방금 한 일 (최근 3개)

- 2026-07-15: v0.3.0 배포 완료(DEPLOYED) — PR #52 병합(squash 64caef0), "Deploy robom site to Pages" run 29428590429 전 job 성공(verify-calendarbom 게이트 → build → deploy → 배포 후 verify). 배포 후 verify가 러너에서 공개 sw.js `CACHE_NAME=calendarbom-v0.3.0` 마커 확인. portfolio-structure 가드에 apps/calendarbom 임시 호스팅 예외 반영(사용자 승인, registry 4앱). 2차 감사(V7.1) 보완: 트랜잭션 저장·손상 복구·UUID ID·알림 horizon·슬롯별 수정·전체 백업·권한별 문구·전체 편집·이 날만 복사·터치 실측 44px+. 단위 33+E2E 81(Chromium)+WebKit(CI) 통과.
- 2026-07-15: v0.2.0 — V6 업그레이드(아코디언 시트·사람·반복·약 슬롯·기념일 계산·한 건 공유·되돌리기·v1→v2 마이그레이션).
- 2026-07-15: v0.1.0 첫 출시 + 본사 허브 네 앱 체제 편입(site 1.9.0).
- 2026-07-15: 임시 배포 경로 구성(prerender가 apps/calendarbom/app 복사).

## Next (다음에 할 일)

- [ ] `robom-labs/calendarbom` 저장소 생성 후 소스 이전·정식 URL 전환 (ops/HUMAN-TASKS.md 절차)
- [x] 반복 일정·약 슬롯·기념일 엔진 (v0.2.0)
- [ ] 65세 이상 실제 사용자 테스트 (docs/REAL-USER-TEST-PLAN.md — 사람 작업)
- [ ] 안드로이드 네이티브 2차 단계 (apps/calendarbom/docs/ROADMAP-ANDROID.md)

## Blocked

- 정식 저장소 생성: AI 실행 환경의 GitHub App 권한(403)으로 사람 확인 필요. (임시로 guardrails portfolio-structure에 apps/calendarbom 예외 반영 — 이전 완료 시 예외 제거하고 registry 3앱으로 원복)
- 65세+ 실사용 테스트: 사람 작업(docs/REAL-USER-TEST-PLAN.md).

## 최근 실패

- (없음)

## 홍보 성과 (성장 루프용)

- 마지막 게시 채널 / 반응: 아직 없음 (출시 직후)
