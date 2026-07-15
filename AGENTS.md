# AGENTS.md

이 저장소는 로봄 지주회사와 01·02·03 총괄팀의 GitHub 허브다. 앱 소스 저장소가 아니다.

## 자동 적용 순서

1. `ops/ai-meetings/CODEX-HUB.md`에서 휴대 허브 전체 구성을 확인한다.
2. 로봄 01·02·03, 총괄팀, 회사 모드, 새 PC 복원 요청이면 `.agents/skills/robom-company-hub/SKILL.md`를 적용한다.
3. `README.md`, `ops/registry/apps.yml`, 필요한 `ops/state/*.md`에서 회사와 앱 상태를 확인한다.
4. 회의 작업이면 `ops/ai-meetings/PROTOCOL.md`, `ops/ai-meetings/COMPANY-MODE.md`, 해당 방 프롬프트를 따른다.
5. 홈페이지 작업이면 `site/README.md`와 `site/.openai/hosting.json`을 확인한다.

## 저장소 경계

- 본사·홈페이지 변경은 `robom-labs/robom`에서 작업한다.
- 야외봄 변경은 `robom-labs/outbom`에서 작업한다.
- 청약봄 변경은 `robom-labs/homebom`에서 작업한다.
- 러닝봄 변경은 `robom-labs/runningbom`에서 작업한다.
- 자격증봄 변경은 `robom-labs/certbom`에서 작업한다.
- `robom`에 앱 코드를 복사하거나 미러링하지 않는다.
- 코드·설정·회의 기록은 GitHub를 정본으로 사용하고 영구 로컬 코드 폴더를 기준으로 삼지 않는다.

## 실행 승인

- 분석·점검·제안만 요청은 제품과 설정을 읽기 전용으로 처리한다.
- 01·02·03 총괄팀의 실행형 요청은 `ops/ai-meetings/PROTOCOL.md`에 따라 조사·구현·검증·`main` 반영·기존 배포·운영 확인·중대한 회귀 롤백까지 진행한다.
- 04·05와 일반 작업은 별도 승인 규칙을 따른다.
- 결제, 계정·소유권·청구 변경, 비밀값 변경·공개, 백업 없는 대량 삭제, 복구 불가능한 변경, 법적 동의는 자동 승인하지 않는다.

## 변경과 검증

- 대상 저장소와 관련 흐름을 읽고 요청 범위에 필요한 최소 변경만 한다.
- 사용자나 다른 작업자의 변경을 되돌리지 않는다.
- `ops/registry/apps.yml`의 해당 저장소와 검증 명령을 사용한다.
- 변경 뒤 관련 테스트·빌드·실제 동작을 확인하고 실행하지 못한 검증을 밝힌다.
- 비공개 회의록은 `PROTOCOL.md`의 append-only 규칙으로만 기록한다.
