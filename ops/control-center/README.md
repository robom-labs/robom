# 로봄 본부 · ROBOM Control Center

로봄 계열사의 **실제** 운영 상태(저장소·git·GitHub PR/CI·작업 이벤트)를 한 화면에서 보는 **내부 전용 관제 도구**다.
가짜 AI 직원 연출이 아니라, **실제 증거가 있을 때만** 직원을 "작업 중"으로 표시한다.

- 코드명: `robom-hq` · 단계: **Phase 1 (읽기 전용)**
- 새 유료 API·상시 서버 없음. GitHub는 무료 REST(공개 저장소는 무인증으로도 읽음).
- 공개 `robom.kr`에 노출하지 않는다. 로컬에서만 실행한다.

## 실행 (바탕화면에서)

```bash
# 어디서든
node scripts/control-center/serve.mjs
# 또는 런처 더블클릭
bin/robom-hq.command   # macOS/Linux
bin/robom-hq.bat       # Windows
```

실행하면 스냅샷을 새로 만들고 `http://localhost:4321/` 로 대시보드를 연다.
브라우저에서 **"홈 화면에 추가 / 앱 설치"** 하면 바탕화면 아이콘처럼 독립 창으로 열 수 있다(PWA).

스냅샷만 갱신하려면:
```bash
node scripts/control-center/build-snapshot.mjs   # ops/control-center/snapshots/latest.json 생성
```

## 무엇을 읽나 (데이터 소스)

| 소스 | 파일/경로 | 쓰임 |
|---|---|---|
| 앱 정본 | `ops/registry/apps.yml` | 등록 앱·저장소·버전·URL |
| 앱 보조 | `ops/control-center/apps-extra.yml` | registry 미등록 실재/준비 앱(자격증봄·캘린더봄) |
| 앱 상태 | `ops/state/*.md` | 다음 작업·막힘 |
| 조직 | `ops/control-center/departments.yml` | 사장실·제품·공통 전문 부서 |
| 직원 | `ops/control-center/agents.yml` | 등록 직원(.claude/agents 11 + 회의실 3) |
| git | 로컬 클론 | 브랜치·SHA·작업 브랜치 |
| GitHub | 무료 REST | 열린 PR·최근 Actions |
| 작업 이벤트 | `ops/control-center/events/*.jsonl` | 실제 직원 상태·타임라인 |

## 화면

오늘의 로봄(회사 신호등·핵심 지표·진행 작업) · 조직도 · 직원 상황실(상태·타임라인) · 앱 관제(5앱 건강) · 승인함(사장 결정만) · 활동 로그 · 연결 상태.

## 안전 원칙 (Phase 1)

- **연출 금지**: 이벤트/세션 증거 없는 직원은 항상 "대기". heartbeat 만료(30분)면 "상태 확인 필요".
- **읽기 전용**: 이 단계는 코드 실행 버튼 없음(상태만 표시).
- **커밋 제외**: `events/*.jsonl` 와 `snapshots/latest.json` 은 `.gitignore` (내부 데이터). 저장소에는 코드·문서·정직한 `example.json`(작업 이벤트 0)만 커밋.
- **비밀 금지**: 브라우저 번들에 토큰 없음. 이벤트에 프롬프트 원문·비밀값·개인정보·전체 로그 저장 금지.

## 다음 단계

- Phase 2: Claude Code 훅 / Codex 어댑터가 `emit-event`로 실제 세션 이벤트를 남겨 직원 상태 실시간화.
- Phase 3: 태스크 생성·중복 감지·일일/주간 보고.
- Phase 4~5: 제한적 실행 제어(승인 후), 스토어/성장 지표.
