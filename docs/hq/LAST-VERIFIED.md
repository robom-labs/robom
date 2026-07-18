# v1.5.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-18 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 60종 | PASS | node --test (store·ops·events·sources·queue·proposals·ui·office·autostart) |
| v1.5 UI 계약(밝은 상아 테마·금테 결재판·명조체·낙관 도장) | PASS | company-ui.test.mjs |
| 밝은(light) 테마 전면 전환 | PASS | color-scheme:light, theme-color #f5f0e6, 상아·금선 토큰 + 스크린샷 |
| 결재 = 금테 결재판 + Nanum Myeongjo 제목 + 붉은 낙관 도장 | PASS | 실제 상신→승인→도장 렌더 스크린샷 |
| 회의·결정(순수 수동) 제거 → 아이디어 메모장 대체 | PASS | 앱 선택+메모 저장 실호출(POST /api/records/notes) + 스크린샷 |
| Pretendard(본문)+Nanum Myeongjo(명조) 번들, 둘 다 OFL | PASS | 실파일 + LICENSE 2종 + 계약 테스트 |
| sw 오프라인 셸 v5 + 명조 폰트 포함 | PASS | sw.js SHELL |
| 해시 라우터·⌘K 팔레트·6앱 매트릭스·표적 폴링 | PASS | v1.4 계약 유지 + 스크린샷 |
| 모바일 390px 가로 넘침 0 | PASS | scrollWidth=390 실측(오늘·결재) |
| example.json = registry 정본 6앱+본사 | PASS | build-example-snapshot.mjs + 테스트 |
| 데스크톱 .dmg/.exe 빌드·릴리스 | 진행 | Actions → Release hq-v1.5.0 |
| codex exec 실제 실행 | VERIFIED(회장 맥북) | v1.3.x 연결 '대기 중' 확인 |
| 서명·공증 | NOT_CONNECTED | ad-hoc 서명 배포 — Gatekeeper 안내 문서 유지 |
