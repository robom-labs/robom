# changelog: runningbom (러닝봄)

- 2026-07-14: 0.16.0. 대회 찾기 홈을 검색·지역·거리·접수 상태·정렬과 세로형 대회 카드 중심으로 전면 재설계했다.
- 2026-07-14: 0.15.1. 전수 감사 수정 — 마감 지난 대회 접수중 오표시·알림 슬롯 리셋 수정, safe-area·아이콘 규격 정리.
- 2026-07-13: 0.11.2. 기존 커스텀 `봄` 트레이드마크를 복원하고 중복 테마 토큰과 미사용 웹폰트 지정을 정리했다.
- 2026-07-13: 0.11.1. 검색 우선 홈, 간결한 대회 카드, 공식 접수·알림 분리와 기존 PWA 캐시 갱신을 반영했다.
- 2026-07-13: 0.10.0. 검색·필터를 상단으로 이동하고 일정 중심 카드와 모바일 필터를 개선했다.
- 2026-07-11: PushRun에서 러닝봄으로 브랜드 전환 착수.

> 앱 상세 이력은 원본 저장소 CHANGELOG. 여기는 holdings 관점 요약.

## 2026-07-10 (출시 준비 RC)
- 앱 종료 후 알림을 보장하지 않는다고 명시하고 manifest·service worker·아이콘을 추가했다.
- 장기 타이머 재예약, 모달 focus-trap, 알림 실패 폴백을 보강했다.
- 100개 대회 데이터·PWA 자산·버전/캐시버스트를 검사하는 원본 CI를 추가했다.
- 검증: JavaScript 문법 검사, 정적 데이터 검사 통과.
- PR #4(draft): https://github.com/runnerpyrri-lgtm/pushrun/pull/4

## 2026-07-09
- holdings에 federated 편입. 코드 변경 없음.

## 2026-07-09 (daily #1 · 홍보)
- 다채널 홍보 콘텐츠팩 초안 생성(게시대기). 코드 변경 없음.

## 2026-07-09 (daily #2 · 코드) — PATCH 후보
- 모달(alertModal/permissionModal/batteryModal) Esc 키 닫기 추가(`outputs/pushrun-site/app.js`).
- 이유: P2 후보 3개(races.json http→https, 버전/캐시버스트 단일화, focus-trap) 중 다른 둘은 하루 범위를
  넘는 위험(링크 깨짐/구조변경)이 있어, 가장 작고 안전한 Esc 키 처리만 분리해 실행.
- 검증: grep으로 리스너 확인, node --check 문법 검증 통과. 정적 사이트라 빌드/테스트 없음(사람 최종
  브라우저 확인 권장).
- PR #2(draft): https://github.com/runnerpyrri-lgtm/pushrun/pull/2
- races.json http→https 정규화, 버전/캐시버스트 단일화, focus-trap 전체(Tab 순환)는 보류.
