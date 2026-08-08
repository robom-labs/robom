# state: certbom (자격증봄)

## 현재 상태

- 운영 버전: 0.8.3.
- 상태: live.
- 저장소: `robom-labs/certbom`.
- 운영 배포: https://certbom.vercel.app/.
- 배포 방식: Vercel Git production.
- 운영 main: `d3035581a6864ad8b70314c0a9f1b2a9122dcb94`.
- PWA 캐시: `certbom-0.8.3-d303558`.
- Google Play Alpha: versionCode 9, `0.8.3`, 테스터 제공 상태.
- 핵심 기능: 시험 104개와 확정 일정 보유 시험 70개 탐색, 현재 접수 우선 정렬, 약칭 검색, 상태·분야 필터, 질문 5개 기반 추천 3+7, 관심 시험·준비 체크·다가오는 순서의 내 일정, ICS·Google Calendar·공유, PWA 오프라인 셸.
- 데이터 원칙: 공식 출처 8곳의 일정 내용 검토 시각과 자동 연결 점검 시각을 분리해 표시하며 확인되지 않은 시험 시각이나 접수일을 추정하지 않는다. 2026-08-08 연결 점검은 8곳 모두 정상이며, 일정 내용 검토 시각은 2026-07-24로 별도 유지한다. Q-Net 공공데이터 운영 키 등록 전에는 API 연결로 표시하지 않는다.

## 검증 기준

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`.
- 320×568, 390×844, 1280×800 화면과 Chromium·WebKit을 확인한다.
- 운영 주소의 manifest, service worker, robots, sitemap과 오프라인 재실행을 확인한다.
- 104개 카탈로그, 70개 일정 보유, 현재 접수 우선 정렬과 12개씩 더 보기를 확인한다.
- 패밀리 1.1 설정·4앱 목록·기기 저장 범위·설치 안내와 Android·iPhone 알림 기반을 확인한다.

## 다음 작업

- [x] Q-Net 현재·다음 연도 pagination·schema·totalCount·anomaly gate·400일 시간 이동과 일일 source workflow를 배포했다.
- [ ] data.go.kr 서비스 키를 Actions secret에 연결해 첫 API 스냅샷을 공식 공고와 대조한 뒤 last-known-good 자동 갱신을 활성화한다.
- [ ] Supabase 프로젝트와 소셜 OAuth를 연결한 뒤 기기 간 동기화를 별도 출시한다.
- [ ] VAPID 키와 알림 동의 UX를 준비한 뒤 웹 푸시를 별도 출시한다.
