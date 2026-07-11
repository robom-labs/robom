# 출시 준비 작업 체크리스트

## 완료 (2026-07-10)
- [x] GitHub 최신 main과 실제 배포 상태 점검
- [x] zoopzoopcall 출시 보완 PR #8 생성 → **머지·배포 완료** (배포 번들 = main 일치 검증)
- [x] runningcall 출시 보완 PR #5 생성 → **머지 완료**
- [x] pushrun 출시 보완 PR #4 생성 → **머지·배포 완료** (gh-pages = main 일치 검증)
- [x] holdings vendored 사본과 registry를 릴리스 버전에 동기화
- [x] 앱별 타입·테스트·빌드·정적 데이터 검증
- [x] 출시 심사(전수 리뷰) + 외부 자문 교차 검증

## 진행 중 (출시 강화 라운드)
- [ ] 앱 출시 강화 PR 3개 회장 승인·머지
      (zoopzoopcall 0.1.4 / runningcall 0.13.4 / pushrun 0.6.9 — 각 원본 저장소)
- [ ] holdings 운영 개편 PR 회장 승인·머지 (자가개선 자동화·본부장 보고·드리프트 감시)
- [ ] 앱 PR 머지 후 사본 동기화 PR (본부장 후속)

## 회장님 작업 (ops/HUMAN-TASKS.md 상세)
- [ ] ANTHROPIC_API_KEY 등록 (4개 저장소) — 자동화 가동 조건
- [ ] main 브랜치 보호 (4개 저장소)
- [ ] 러닝콜 Vercel Kakao 키 확인 — 검색 복구의 마지막 조각
- [ ] 과거 GitHub 토큰 폐기 확인 + secret scanning
- [ ] 줍줍콜 Supabase 함수 재배포 (PR 머지 후)
- [ ] 실제 모바일 PWA 설치·알림 권한·배포 화면 확인
