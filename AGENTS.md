# AGENTS.md

이 저장소는 로봄 지주회사와 01·02·03 총괄팀의 GitHub 허브다. 앱 소스 저장소가 아니다.

## 자동 적용 순서 (Context OS v1.1 라우터 우선)

기본 진입은 전체 정본 완독이 아니라 **요청 기반 Context Router**다. 매 작업에서 먼저:

```bash
node ops/scripts/family/route-task.mjs --request "<사용자 요청>" [--app <id>]
```

로 task profile·L0~L4·읽을 파일(read-next)·예산을 정하고, 그 pack의 read-next만 읽는다.
전체 정본(Company OS 등) 전수 읽기는 L4 조건(정본 편집·source hash 변경·충돌 해결·회장 명시 전수감사)에서만 한다.

라우터가 다루지 않는 특수 작업만 아래를 직접 확인한다.

1. 로봄 01·02·03, 총괄팀, 회사 모드, 새 PC 복원 요청이면 `.agents/skills/robom-company-hub/SKILL.md`.
2. 정본·승인·완료 계약이 필요하면 `ops/company-os/ROBOM_ULTIMATE_COMPANY_OS.md`(+`VERSION`·`COMPATIBILITY.yml`)를 heading 범위로 필요한 부분만.
3. 회의 작업이면 `ops/ai-meetings/PROTOCOL.md`·`COMPANY-MODE.md`·해당 방 프롬프트.
4. 홈페이지 작업이면 `site/README.md`·`site/.openai/hosting.json`.
5. 허브 복원이 필요하면 `ops/ai-meetings/CODEX-HUB.md`.

Company OS는 명시적 사용자 요청, 안전 정책, 더 가까운 저장소 규칙의 경계 안에서 적용한다. 분석·리뷰·점검만 요청한 경우에는 제품과 설정을 읽기 전용으로 유지한다.

## 저장소 경계 (registry 동적 — 앱 이름 하드코딩 금지)

- 본사·홈페이지 변경은 `robom-labs/robom`에서 작업한다.
- 계열사 앱 변경은 **해당 앱 원본 저장소**에서만 작업한다. 앱 목록·저장소·검증 명령은
  `ops/registry/apps.yml`에서 동적으로 읽는다. 앱 이름/개수를 지침에 하드코딩하지 않는다
  (새 앱·노트봄 같은 항목 누락 방지).
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
