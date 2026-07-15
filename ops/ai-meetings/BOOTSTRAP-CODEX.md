# 회사 PC용 로봄 01·02·03 Codex 전체 부트스트랩

이 문서는 새 PC의 Codex에서 로봄 총괄 작업 3개와 모든 공통 지침을 한 번에 복원하기 위한 실행 정본이다.

## 목표

- `로봄 01 | 총괄 부서 1팀`
- `로봄 02 | 총괄 부서 2팀`
- `로봄 03 | 총괄 부서 3팀`

세 작업에 루트 `AGENTS.md`, `robom-company-hub` 스킬, 휴대 사용자 지침, 운영 프로토콜, 회사 모드, 각 방 프롬프트, 앱 등록부, 비공개 회의록 연결을 적용하고 사이드바에 고정한다.

## 회사 PC 복붙용 실행 프롬프트

회사 PC의 Codex에서 새 채팅 하나를 만들고 아래 내용을 한 번 붙여넣는다.

```text
회사 PC용 로봄 01·02·03 전체 복원 작업이다.

먼저 `$skill-installer`를 사용해 공개 GitHub `robom-labs/robom`의 `main`에 있는 `.agents/skills/robom-company-hub`를 사용자 스킬로 설치해. 이미 같은 이름의 스킬이 있으면 삭제하거나 덮어쓰지 말고 GitHub `main`의 최신 스킬을 이번 실행에 직접 적용해.

설치 여부와 관계없이 같은 turn에서 GitHub `robom-labs/robom`의 `AGENTS.md`, `ops/ai-meetings/CODEX-HUB.md`, `.agents/skills/robom-company-hub/SKILL.md`, `.agents/skills/robom-company-hub/references/portable-user-guidance.md`, `ops/ai-meetings/BOOTSTRAP-CODEX.md`를 완독하고 부트스트랩 절차를 즉시 실행해.

이 요청은 현재 Codex 호스트에서 기존 로봄 01·02·03 작업 검색, 보관 해제, 없는 작업 생성, 정확한 제목 설정, 각 팀 전체 지침과 비공개 회의록 초기화, 세 작업 고정, 마지막에 02팀 작업 열기를 명시적으로 승인한다.

같은 제목의 작업은 중복 생성하지 마. 과거 로컬 대화가 없어도 질문하지 말고 GitHub 허브를 정본으로 복원해. 비공개 회의록 접근이 안 되면 공개 허브 복원은 계속하고 마지막에 필요한 GitHub 연결 행동만 한 줄로 알려줘. 완료 후 세 작업의 생성 또는 복원 상태, 고정 상태, 허브 스킬 상태, 비공개 회의록 접근 여부만 보고해.
```

## 사용자 승인 범위

이 부트스트랩을 실행하라는 사용자 메시지는 다음 작업을 명시적으로 승인한다.

- 공개 GitHub 허브 파일 전체 읽기
- `robom-company-hub` 사용자 스킬 설치 또는 현재 실행에서 직접 로드
- 현재 호스트의 Codex 작업 검색
- 같은 제목의 작업 복원과 고정
- 없는 작업의 새 생성
- 세 작업의 제목 변경과 초기화 메시지 전송
- 마지막에 02팀 작업 열기

제품 코드 변경, 배포, 계정·권한 변경은 이 초기화 자체의 범위가 아니다.

## 실행 절차

1. GitHub `robom-labs/robom`의 `main`에서 다음 파일을 완독한다.
   - `AGENTS.md`
   - `ops/ai-meetings/CODEX-HUB.md`
   - `.agents/skills/robom-company-hub/SKILL.md`
   - `.agents/skills/robom-company-hub/references/portable-user-guidance.md`
   - `ops/ai-meetings/PROTOCOL.md`
   - `ops/ai-meetings/COMPANY-MODE.md`
   - 01·02·03의 `PROMPT-CODEX.md`
2. `$skill-installer`가 있으면 공개 GitHub `robom-labs/robom`의 `.agents/skills/robom-company-hub`를 사용자 스킬로 설치한다. 이미 같은 이름의 스킬이 있으면 삭제하거나 덮어쓰지 말고 이번 실행에서는 GitHub `main`의 최신 파일을 직접 적용한다. 새로 설치한 스킬은 다음 turn부터 자동 발견될 수 있으므로 현재 초기화는 중단하지 않는다.
3. 비공개 GitHub `robom-labs/ai-meeting-logs` 접근 가능 여부를 확인한다. 접근되지 않아도 공개 허브로 작업 생성은 계속하고 최종 보고에 필요한 GitHub 연결 행동만 표시한다. 자격 증명 값을 요구하거나 출력하지 않는다.
4. 현재 호스트에서 제목이 정확히 일치하는 작업을 검색한다.
5. 같은 제목의 작업이 있으면 새로 만들지 않는다. 보관 상태면 복원하고 고정한다.
6. 같은 제목의 작업이 없으면 새 작업을 만든다.
   - 먼저 사용 가능한 프로젝트를 조회한다.
   - `robom-labs/robom`과 연결된 프로젝트가 있으면 그 프로젝트의 local 환경을 사용한다.
   - 적합한 프로젝트가 없으면 projectless 작업으로 생성한다.
7. 각 작업에 아래 초기화 메시지를 한 번만 보낸다. 새 작업이라면 최초 프롬프트로 사용한다.
8. 생성 또는 복원한 작업의 제목을 정확히 지정하고 세 작업 모두 고정한다.
9. 마지막에 `로봄 02 | 총괄 부서 2팀` 작업을 연다.
10. 최종 보고에는 각 작업별 `기존 복원` 또는 `새로 생성`, `고정 완료`, 허브 스킬 설치 상태, 비공개 회의록 접근 여부만 표시한다.

## 작업별 초기화 메시지

### 로봄 01

```text
새 PC 전체 복원 초기화다. 너는 `로봄 01 | 총괄 부서 1팀`이다. GitHub `robom-labs/robom`의 `main`에서 `AGENTS.md`, `ops/ai-meetings/CODEX-HUB.md`, `.agents/skills/robom-company-hub/SKILL.md`, `.agents/skills/robom-company-hub/references/portable-user-guidance.md`, `ops/ai-meetings/PROTOCOL.md`, `ops/ai-meetings/COMPANY-MODE.md`, `ops/ai-meetings/rooms/01-portfolio-release/PROMPT-CODEX.md`를 완독하고 적용해. 비공개 GitHub `robom-labs/ai-meeting-logs/01-portfolio-release/`의 최신 기록을 확인해. 코드·설정·회의 기록은 GitHub를 정본으로 사용하고 과거 로컬 대화가 없다는 이유로 질문하지 마. 지금은 제품 변경을 시작하지 말고 설정만 마친 뒤 `로봄 01 전체 설정 완료`라고 답해.
```

### 로봄 02

```text
새 PC 전체 복원 초기화다. 너는 `로봄 02 | 총괄 부서 2팀`이다. GitHub `robom-labs/robom`의 `main`에서 `AGENTS.md`, `ops/ai-meetings/CODEX-HUB.md`, `.agents/skills/robom-company-hub/SKILL.md`, `.agents/skills/robom-company-hub/references/portable-user-guidance.md`, `ops/ai-meetings/PROTOCOL.md`, `ops/ai-meetings/COMPANY-MODE.md`, `ops/ai-meetings/rooms/02-web-brand/PROMPT-CODEX.md`를 완독하고 적용해. 비공개 GitHub `robom-labs/ai-meeting-logs/02-web-brand/`의 최신 기록을 확인해. 코드·설정·회의 기록은 GitHub를 정본으로 사용하고 과거 로컬 대화가 없다는 이유로 질문하지 마. 지금은 제품 변경을 시작하지 말고 설정만 마친 뒤 `로봄 02 전체 설정 완료`라고 답해.
```

### 로봄 03

```text
새 PC 전체 복원 초기화다. 너는 `로봄 03 | 총괄 부서 3팀`이다. GitHub `robom-labs/robom`의 `main`에서 `AGENTS.md`, `ops/ai-meetings/CODEX-HUB.md`, `.agents/skills/robom-company-hub/SKILL.md`, `.agents/skills/robom-company-hub/references/portable-user-guidance.md`, `ops/ai-meetings/PROTOCOL.md`, `ops/ai-meetings/COMPANY-MODE.md`, `ops/ai-meetings/rooms/03-outbom/PROMPT-CODEX.md`를 완독하고 적용해. 비공개 GitHub `robom-labs/ai-meeting-logs/03-outbom/`의 최신 기록을 확인해. 코드·설정·회의 기록은 GitHub를 정본으로 사용하고 과거 로컬 대화가 없다는 이유로 질문하지 마. 지금은 제품 변경을 시작하지 말고 설정만 마친 뒤 `로봄 03 전체 설정 완료`라고 답해.
```

## 금지 사항

- 같은 제목의 작업 중복 생성
- 기존 작업이나 사용자 파일 삭제
- 기존 사용자 스킬 강제 덮어쓰기
- `~/.codex/auth.json`, 토큰, 세션 파일 복사
- 과거 로컬 대화가 없다는 이유로 초기화 중단
- 초기화 요청을 제품 코드 변경이나 배포 승인으로 확대 해석
