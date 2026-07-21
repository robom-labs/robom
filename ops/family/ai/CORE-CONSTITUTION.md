<!-- 생성: ROBOM Context & Family OS v1.0.0 · L0 헌법 캡슐 -->
<!-- 이 파일은 매 작업에 항상 로드하는 최소 규칙(doc-03 §6 L0)이다. -->
<!-- 정본이 아니라 정본에서 뽑은 캡슐이다. 원 정본: AGENTS.md · CLAUDE.md · ops/company-os/* -->

# 로봄 L0 헌법 (항상 로드 · 최소 규칙)

## 지침 우선순위
1. 사용자의 현재 명시적 요청
2. `ops/company-os/ROBOM_ULTIMATE_COMPANY_OS.md` · `VERSION` · `COMPATIBILITY.yml`
3. 가까운 저장소 규칙(`CLAUDE.md`/`AGENTS.md`/앱 지침)
4. 과거 보고서·회의록

사실(앱 수·버전·SHA·배포·동작)은 문서 과거값보다 최신 `main`·runtime·Production·CI를 우선한다.

## 비용 0원
추가 월 유지비 0원. 사용자가 이미 쓰는 Claude Code·Codex CLI·로컬 컴퓨터·Node·Git·rg·GitHub 무료 범위만 사용한다. 별도 유료 API 키·벡터DB·유료 서버 금지.

## 저장소 경계
- 본사·홈페이지·운영 장부·공통 정책만 `robom-labs/robom`.
- 앱 코드는 각 앱 저장소에서만 수정. `robom`에 앱 코드 복사·미러링 금지.
- 앱 수는 `ops/registry/apps.yml`에서 동적으로 읽고 하드코딩하지 않는다.

## 동시 작업 보호
- 다른 AI(Codex 등)가 작업 중인 코드·branch·PR·dirty worktree를 되돌리지 않는다.
- `git reset --hard`·무단 `git clean`·force push 금지.
- 기존 체계 위에 같은 목적의 병렬 체계를 새로 만들지 않는다(확장·병합).
- 변경 전 최신 remote·dirty·열린 PR·lease를 확인한다.

## 비밀·개인정보
production/OAuth secret·운영 DB·사용자 개인정보를 읽거나 표시하지 않는다. context receipt에도 기록하지 않는다.

## 승인 경계
01~03 총괄팀 실행형 요청은 조사·구현·검증·`main` 반영·배포·롤백까지 승인된 것으로 본다. 새 유료 지출, 계정·청구·권한 변경, 비밀값 변경·공개, 백업 없는 대량 삭제, 복구 불가 마이그레이션, 법적·스토어 계약, 본인인증 필요 외부 행위는 항상 사람 확인.

## 실제 증거 원칙
- 테스트 실패 상태로 배포·릴리스하지 않는다.
- 실행하지 않은 일을 완료로 보고하지 않는다. 컴퓨터가 꺼져 있으면 실행했다고 표시하지 않는다.
- 정확한 reset 시간이 없으면 추측하지 않는다.

## 단계적 확장
관련 현재 코드·규칙·테스트만 먼저 읽고, 위험·불확실성이 있을 때만 범위를 넓힌다(L0→L4). 작은 UI·문구·단일 테스트에 전수 감사(L4) 금지.
