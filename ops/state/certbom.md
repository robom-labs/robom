# state: certbom (자격증봄)

## 현재 상태

- 운영 버전: 0.5.0.
- 상태: live.
- 저장소: `robom-labs/certbom`.
- 운영 배포: https://certbom.vercel.app/.
- 배포 방식: Vercel Git production.
- 핵심 기능: 시험 97개와 확정 일정 보유 시험 70개 탐색, 현재 접수 우선 정렬, 약칭 검색, 상태·분야 필터, 질문 5개 기반 추천 3+7, 관심 시험·체크리스트 기기 저장, ICS·Google Calendar·공유, PWA 오프라인 셸.
- 데이터 원칙: 공식 출처 8곳과 날짜 정밀도·마지막 검증일을 함께 표시하며 확인되지 않은 시험 시각이나 접수일을 추정하지 않는다. Q-Net 공공데이터 운영 키 등록 전에는 API 연결로 표시하지 않는다.

## 검증 기준

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`.
- 320×568, 390×844, 1280×800 화면과 Chromium·WebKit을 확인한다.
- 운영 주소의 manifest, service worker, robots, sitemap과 오프라인 재실행을 확인한다.
- 97개 카탈로그, 70개 일정 보유, 현재 접수 우선 정렬과 12개씩 더 보기를 확인한다.

## 다음 작업

- [ ] data.go.kr 서비스 키를 연결한 뒤 공식 공고 스냅샷과 결과를 대조하는 Q-Net 동기화를 운영 활성화한다.
- [ ] Supabase 프로젝트와 소셜 OAuth를 연결한 뒤 기기 간 동기화를 별도 출시한다.
- [ ] VAPID 키와 알림 동의 UX를 준비한 뒤 웹 푸시를 별도 출시한다.
