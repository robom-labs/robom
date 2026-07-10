# state: pushrun (PushRun)

## 현재 상태
- 버전: 0.6.8 RC
- 상태: live 0.6.7 (GitHub Pages) / 출시 준비 PR #4 대기
- 스택: 정적 PWA(HTML/CSS/JS, 데이터 검증 있음)

## 방금 한 일 (최근)
- 2026-07-10: PR #4 — 알림 한계 고지, PWA manifest/SW/icon, 서비스워커 알림 표시, 모달 focus-trap, 100개 대회 데이터 검사와 배포 전 CI. node check·npm test 통과.
- 2026-07-09 daily#2(코드): 모달(alertModal/permissionModal/batteryModal) Esc 키 닫기 추가(`outputs/pushrun-site/app.js`). P2 후보 3개 중 races.json http→https / 버전·캐시버스트 단일화는 하루 범위 초과(링크 깨짐/구조변경 위험)로 보류하고 가장 작고 안전한 항목만 실행. grep 리스너 확인 + node --check 문법 검증 통과(정적 사이트, 빌드/테스트 없음 — 사람 최종 브라우저 확인 권장). PR #2(draft): https://github.com/runnerpyrri-lgtm/pushrun/pull/2
- 2026-07-09 daily#1: 홍보 다채널 콘텐츠팩 생성(ops/content/2026-07-09/pushrun/). 게시대기.
- 2026-07-09: holdings에 federated 편입.

## Next
- [ ] 콘텐츠팩 검수 → 게시 → 반응 측정
- [ ] PR #4 검수·머지 후 Pages에서 PWA 설치·모달 포커스·알림 권한 확인
- [ ] HTTP 외부 링크 178개를 도메인별 HTTPS 지원 확인 후 점진 교체
- [ ] races.json 대회 데이터 최신화 여부 판단

## Blocked
- 없음

## 최근 실패
- 없음

## 홍보 성과 (성장 루프)
- 2026-07-09: 콘텐츠팩 4채널 초안 생성(게시 전).
