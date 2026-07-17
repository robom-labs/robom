# 로봄 본부 · ROBOM COMPANY OS

로봄 웹과 다섯 앱을 경영·제품·출시·운영·기억의 같은 흐름으로 관리하는 내부 전용 회사 운영체제다. 실제 저장소·운영 URL·GitHub Actions·작업 이벤트·운영 장부에 근거가 있을 때만 상태를 표시한다.

- 버전은 `2.0.0`이다.
- 추가 유료 API와 상시 서버는 사용하지 않는다.
- 로컬 서버는 `127.0.0.1`만 수신하며 공개 `robom.kr`에는 배포하지 않는다.
- 내부 회의·결재·검수·요청은 `ops/control-center/runtime/` 아래 append-only JSONL로 저장하고 Git에서 제외한다.

## 바로 실행

```bash
node scripts/control-center/serve.mjs
# 또는 macOS에서 bin/robom-hq.command 더블클릭
```

기본 주소는 `http://127.0.0.1:4321/`이다. 실시간 본부는 로컬 기록 API, 스냅샷 새로고침, 백업과 내보내기를 제공한다. 서버 없이 `dist/로봄본부.html`을 열면 마지막 스냅샷을 보는 휴대용 모드로 동작한다.

GitHub CLI에 로그인된 컴퓨터에서는 기존 `gh` 인증을 읽기 전용으로 재사용해 PR·CI 상태를 수집한다. 로그인되지 않았으면 공개 REST를 시도하고, 둘 다 실패하면 로컬 Git 근거만 표시한다. 자격 증명 원문은 snapshot과 브라우저에 저장하지 않는다.

```bash
node scripts/control-center/build-snapshot.mjs
node scripts/control-center/build-standalone.mjs
```

## 주요 공간

- 회장실과 경영 브리핑은 회사 신호, 운영 정상 수, 실제 실행 중 업무, 결재 대기와 다음 추천을 보여 준다.
- 회의실·결재판·업무 대기열·앱 검수실은 로컬 기록을 생성하고 상태 이력을 남긴다.
- 포트폴리오·업데이트·로드맵·출시·데이터·장애·성장 화면은 앱별 운영 근거를 한 구조로 비교한다.
- 회사 기억 검색과 실행 기록은 회의·결정·실패·검수 이유를 다시 찾게 한다.
- 오피스는 20명 임직원과 5개 브랜드 마스코트를 SD 벡터 캐릭터로 표시한다. 실제 이벤트가 없을 때 업무 중으로 연출하지 않는다.

## 정본 데이터

| 소스 | 쓰임 |
|---|---|
| `ops/registry/apps.yml` | 앱·버전·운영 URL·스토어 상태 |
| `ops/state/*.md` | 최근 완료·다음 작업·외부 막힘 |
| `ops/HUMAN-TASKS.md` | 계정 소유자 행동 필요 |
| `ops/ROADMAP.md` | 회사 로드맵 완료 여부 |
| `.github/workflows/*.yml` | 자동화 등록과 주기 |
| `ops/control-center/departments.yml` | 조직 구조 |
| `ops/control-center/agents.yml` | 등록 에이전트 |
| `ops/control-center/events/*.jsonl` | 실제 작업 이벤트 |
| `ops/control-center/runtime/` | 내부 회의·결재·검수·업무 기록 |

## 안전 원칙

- 토큰·비밀키·비밀번호 패턴은 기록 단계에서 거부한다.
- 브라우저 번들에 GitHub 토큰이나 계정 자격 증명을 넣지 않는다.
- 예약 workflow는 등록됐다는 사실만 보여 주며 실행 완료로 꾸미지 않는다.
- 결재가 필요한 일은 결제·계정·스토어·법률·되돌리기 어려운 운영 변경으로 제한한다.
- portable 모드는 저장소 수정이나 AI 실행을 수행할 수 있다고 표시하지 않는다.

## 검증

```bash
node --test scripts/control-center/*.test.mjs scripts/control-center/lib/*.test.mjs
node scripts/control-center/build-snapshot.mjs
node scripts/control-center/build-standalone.mjs
node --check ops/control-center/app/app.js
node --check ops/control-center/app/office.js
```
