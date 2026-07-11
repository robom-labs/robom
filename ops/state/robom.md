# state: robom

## 현재 상태

- 역할: 로봄 지주회사 운영 본부와 `robom.kr` 통합 홈페이지.
- 목표 저장소: `robom-labs/robom`.
- 홈페이지 소스: `site/`.
- 앱 소스는 본사에 복사하지 않고 각 독립 저장소에서 관리한다.

## 방금 한 일

- 2026-07-11: 로봄 포트폴리오 구조를 `robom`, `outbom`, `homebom`, `runningbom` 네 독립 저장소로 재편했다.
- 기존 별도 홈페이지 프로젝트를 `site/`로 이관했다.
- vendored 앱 사본과 중복 앱 CI를 제거하고 원본 저장소 중심 관리로 전환했다.

## Next

- [ ] `robom-labs` GitHub 조직 생성과 네 저장소 이전을 완료한다.
- [ ] 앱별 브랜딩 PR을 검토하고 merge한다.
- [ ] 새 Pages URL과 Vercel 연결을 확인한 뒤 registry 상태를 `live`로 갱신한다.

## Blocked

- GitHub 조직 생성은 로그인된 웹 세션에서 1회 설정이 필요하다.
