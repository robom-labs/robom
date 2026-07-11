# AGENTS.md

이 저장소는 로봄 지주회사의 본사 저장소입니다. 앱 소스 저장소가 아닙니다.

## 먼저 읽을 문서

1. `README.md`에서 회사와 포트폴리오 구조를 확인합니다.
2. `ops/registry/apps.yml`에서 앱별 저장소·배포·검증 명령을 확인합니다.
3. `ops/state/*.md`에서 최신 상태와 다음 작업을 확인합니다.
4. `ops/DECISIONS.md`, `ops/RISK_REGISTER.md`, `ops/ROADMAP.md`에서 결정과 리스크를 확인합니다.
5. 홈페이지 작업이면 `site/README.md`와 `site/.openai/hosting.json`을 확인합니다.

## 저장소 경계

- 본사·홈페이지 변경은 `robom-labs/robom`에서 작업합니다.
- 야외봄 변경은 `robom-labs/outbom`에서 작업합니다.
- 청약봄 변경은 `robom-labs/homebom`에서 작업합니다.
- 러닝봄 변경은 `robom-labs/runningbom`에서 작업합니다.
- `robom`에 앱 코드를 복사하거나 미러링하지 않습니다.

## 작업 규칙

- 모든 변경은 목적별 브랜치와 PR로 진행합니다. `main`에 직접 push하지 않습니다.
- 앱 작업은 `ops/registry/apps.yml`의 해당 저장소와 검증 명령을 사용합니다.
- 본사 변경은 `CHANGELOG.md`, `VERSION`, 관련 `ops/state`를 함께 갱신합니다.
- 앱 변경은 해당 앱 저장소의 CHANGELOG와 테스트를 갱신합니다.
- 비밀키, 운영 DB, 결제, 외부 게시와 배포 권한 변경은 사람 확인 없이 진행하지 않습니다.
- 기존 사용자 호환을 위한 저장 키와 내부 ID는 별도 마이그레이션 없이 바꾸지 않습니다.

## 로컬 표준 구조

```text
/Users/runner706/Developer/로봄/
  robom/
  야외봄/
  청약봄/
  러닝봄/
```
