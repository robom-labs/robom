# state: pushrun (PushRun)

## 현재 상태
- 버전: main 0.6.8(머지·배포됨) / draft PR #5 대기 중 0.6.9
- 상태: live — PR #4가 이미 머지되어 Pages/Vercel 자동 배포 완료(이전 state의 "대기"는 stale 정보였음, 2026-07-10 확인)
- 스택: 정적 PWA(HTML/CSS/JS, 데이터 검증 있음)

## 방금 한 일 (최근)
- 2026-07-10 daily#3(코드): 검색창 Enter 키로 필터 즉시 적용(기존 applyFilters 재사용, 순수 추가). HTTP→HTTPS 178개·races.json 최신화·app.js 모듈분리는 재조사 후 재차 보류(사유는 ROADMAP 참고). 캐시버스트 20260710-1→2, v0.6.8→0.6.9. node --check·npm test 통과. PR #5(draft): https://github.com/runnerpyrri-lgtm/pushrun/pull/5
- 2026-07-10: PR #4 머지 완료 — 알림 한계 고지, PWA manifest/SW/icon, 서비스워커 알림 표시, 모달 focus-trap, 100개 대회 데이터 검사와 배포 전 CI. node check·npm test 통과.
- 2026-07-09 daily#2(코드): 모달(alertModal/permissionModal/batteryModal) Esc 키 닫기 추가(`outputs/pushrun-site/app.js`). P2 후보 3개 중 races.json http→https / 버전·캐시버스트 단일화는 하루 범위 초과(링크 깨짐/구조변경 위험)로 보류하고 가장 작고 안전한 항목만 실행. grep 리스너 확인 + node --check 문법 검증 통과(정적 사이트, 빌드/테스트 없음 — 사람 최종 브라우저 확인 권장). PR #2(draft): https://github.com/runnerpyrri-lgtm/pushrun/pull/2
- 2026-07-09 daily#1: 홍보 다채널 콘텐츠팩 생성(ops/content/2026-07-09/pushrun/). 게시대기.
- 2026-07-09: holdings에 federated 편입.

## Next
- [ ] 콘텐츠팩 검수 → 게시 → 반응 측정
- [ ] PR #5 검수·머지(검색 Enter 키)
- [ ] HTTP 외부 링크 178개를 도메인별 HTTPS 지원 확인 후 점진 교체
- [ ] races.json 대회 데이터 실제 최신 일정으로 교체(2026-07-10: 화면 노출은 필터링돼 버그 아님 확인, 데이터 자체 최신화는 외부 검증 필요)
- [ ] app.js를 순수함수/DOM 바인딩으로 분리(테스트 가능하게) — 구조 변경, 별도 제안서 검토

## Blocked
- 없음

## 최근 실패
- 없음

## 홍보 성과 (성장 루프)
- 2026-07-09: 콘텐츠팩 4채널 초안 생성(게시 전).
