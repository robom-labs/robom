# 로봄

`robom-labs/robom`은 로봄 지주회사의 운영 본부이자 통합 홈페이지 저장소입니다.

## 포트폴리오

| 서비스 | 영문 ID | 역할 | 저장소 |
|---|---|---|---|
| 야외봄 | OutBom | 야외활동 컨디션과 추천 시간 | `robom-labs/outbom` |
| 청약봄 | HomeBom | 청약 공고와 접수 알림 | `robom-labs/homebom` |
| 러닝봄 | RunningBom | 러닝 대회 탐색과 접수 알림 | `robom-labs/runningbom` |

각 앱은 독립 저장소에서 개발·검증·배포합니다. 이 저장소에는 앱 소스 사본을 두지 않습니다.

## 이 저장소가 담당하는 것

- `site/`에서 `robom.kr` 통합 홈페이지를 관리합니다.
- `ops/`에서 앱 목록, 현재 상태, 결정, 리스크와 로드맵을 관리합니다.
- `.claude/agents/`와 `.github/workflows/`에서 포트폴리오 운영 규칙을 관리합니다.
- 앱 변경은 해당 앱 저장소의 PR로만 진행합니다.

## 시작하기

운영 구조는 `AGENTS.md`, 앱 목록은 `ops/registry/apps.yml`, 홈페이지 실행법은 `site/README.md`를 확인합니다.
