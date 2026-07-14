# 캘린더봄 출시 회의록 (01 총괄)

## 2026-07-15 05:00~ KST — v0.1.0 신규 출시 (실행형, 무중단 위임)

- 지시: 첨부 프롬프트(안드로이드 Codex용) 기반으로 캘린더봄을 만들되, 실행자 판단을 반영해
  "기존 앱들과 같은 형태의 실행 주소"로 배포까지 완료. 새벽 5시 시작, 10시간 무인 진행.
- 판단 1 (플랫폼): 인수 기준이 웹 주소이므로 1차는 로봄 표준 정적 PWA(러닝봄 구조)로 구현.
  안드로이드 요구사항은 `apps/calendarbom/docs/ROADMAP-ANDROID.md`에 보존. (결정 기록
  `apps/calendarbom/docs/DECISIONS/0001-web-pwa-first.md`)
- 판단 2 (배포 경로): `robom-labs/calendarbom` 저장소 생성이 권한(403)으로 불가.
  대안으로 본사 Pages 아티팩트에 `/calendarbom/`을 포함해 즉시 운영 주소를 확보:
  https://robom-labs.github.io/robom/calendarbom/ — 정식 저장소 생성 후 이전 절차는
  `ops/HUMAN-TASKS.md`에 등록. 소스 정본은 `apps/calendarbom` 한 곳(복제 없음).
- 구현: 큰 월간 달력 → 날짜 시트(내용 칩 → 오전/오후·시·분 → 알람 → 저장, 키보드 없는 4단계),
  자연어 확인 문장, 알림 탭(D-day·시각순), 글자 크기 3단계, JSON/ICS 보관·이동,
  페이지 열림 중 알람(정직한 한계 안내), 패밀리 정본 UI(라벤더).
- 검증: 코어 테스트 19개, 정적 검증(버전·캐시버스트·패밀리 규격), Playwright E2E 11항목,
  320~1280px 무가로스크롤 스윕 전부 통과. 본사 사이트 v1.9.0 렌더 테스트 갱신(네 앱).
- 본사 연동: 허브 4앱 카피·카드, /apps/calendarbom, /privacy/calendarbom, 아이콘·브랜드 SVG,
  sitemap, 레지스트리 등록, 배포 워크플로 경로 트리거 확장.
