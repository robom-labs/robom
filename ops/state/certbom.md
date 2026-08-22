# state: certbom (자격증봄)

## 현재 상태

- 웹·PWA 운영 버전: 0.9.0.
- Android 공개 버전: 0.9.0 (versionCode 17).
- 상태: live.
- 저장소: `robom-labs/certbom`.
- 운영 배포: https://certbom.vercel.app/.
- 배포 방식: Vercel Git production.
- Google Play 공개 제품 소스: `c65359cf172f29a9ba42e10951652c47e1a4df9f`.
- PWA 캐시: `certbom-0.9.0-8cebe2b`.
- Google Play 프로덕션: `versionCode 17`, `0.9.0`, 전체 출시로 2026-08-22 공개됐다.
- 0.9.0 서명 AAB: `versionCode 17`, SHA-256 `11e213493db18f3da52ac6341524b0826280e231b30cadc2dce41d5756307bf9`이며 안정성·보안 개선 출시 노트가 운영 Store에 반영됐다.
- 핵심 기능: 시험 104개와 확정 일정 보유 시험 70개 탐색, 현재 접수 우선 정렬, 약칭 검색, 상태·분야 필터, 질문 5개 기반 추천 3+7, 관심 시험·준비 체크·다가오는 순서의 내 일정, 같은 날 시험 충돌 안내, 공식 응시자격·CBT 체험·합격자 발표·실기 준비물 바로가기, 관심 시험 전체 일정 ICS 내보내기, 원자적 기기 데이터 JSON 백업·복원, 모바일 알림 자동 복구, Google Calendar·공유, PWA 오프라인 셸.
- 데이터 원칙: 공식 출처 8곳의 일정 내용 검토 시각·콘텐츠 신선도와 자동 연결 점검 시각을 분리해 표시하며 확인되지 않은 시험 시각이나 접수일을 추정하지 않는다. 2026-08-08 연결 점검은 8곳 모두 정상이며, 일정 내용 검토 시각은 2026-07-24로 별도 유지한다. Q-Net 공공데이터 운영 키가 없으면 동기화를 성공으로 위장하지 않고 명시적으로 실패하며, 앱은 마지막 검증 스냅샷을 유지한다.

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
- [x] 320·390 휴대전화, 720 폴더블, 1024 태블릿, 200% 글자 크기에서 목록·통계·모달·하단 내비게이션을 적응형으로 검증하고 Android 16 대화면·R8 권장 조치를 반영했다.
