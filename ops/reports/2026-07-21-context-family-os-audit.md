# ROBOM Context & Family OS v1.0.0 — 설치 감사·실행 기록

- 실행: Claude Code · 2026-07-21
- 패키지: `ROBOM_ONE_SHOT_CONTEXT_FAMILY_OS_v1.0.0` (00·01·02·03)
- read receipt: 4개 required 파일 SHA-256·줄·바이트 MANIFEST 대조 일치, 순서대로 완독
  (01 2123줄 / 02 2160줄 / 03 1931줄). `.robom-bootstrap/read-progress.json`.
- 시작 main SHA: 531515b · HQ 앱 버전: **3.3.30**

## 핵심 판정 — 최신 main이 문서 가정을 크게 앞선다
패키지 자체 우선순위(§21 "사실은 최신 main·runtime·CI를 문서 과거값보다 우선")와
동시작업 보호(§2 "다른 AI 작업 중인 코드·branch를 덮어쓰지 않는다", §9 "두 체계를
나란히 만들지 않는다")를 그대로 적용한 결과:

| 문서(01·02·03) 요구 | 현재 main 상태 | 판정 |
|---|---|---|
| 01·02: HQ 앱 v1.3.2→v1.4.0 업그레이드 | HQ 이미 **v3.3.30** (30+ 패치 반복, Codex 활성) | 이미 초과 — 재작업·다운그레이드 금지 |
| §16 AGENTS/CLAUDE 짧은 router | AGENTS 40줄·CLAUDE 24줄 이미 router 형태 | 이미 충족 |
| §10 "어디에 무엇이 있는지" 지도 | `ops/family/ai/REPO-MAP.yml` 앱별 shell/domain/pwa/tests | 이미 충족 |
| §20 현재/역사 분리 | `CURRENT-STATE.json`·`LAST-VERIFIED.json`·`FAMILY-CONTEXT.md` | 이미 충족 |
| context 생성기 | `ops/scripts/family/build-ai-context.mjs`(diff 기반) | 존재 |
| §7·§17·§29 **요청 기반** 라우팅·pack·벤치마크 | 없음(생성기는 diff 기반, 사후용) | **진짜 공백 → 이번에 설치** |
| §11~§14 패밀리 UI 계약(하단바·설정·앱 디렉터리) | `ops/family/contracts`·`ops/family/design` 부분 존재, Codex 활성 이관 중 | 부분 — 병렬 이관 보류 |

## 이번 실행에서 실제로 설치·테스트·벤치마크한 것 (요청 라우팅 계층)
기존 `ops/family/ai/`를 **확장**(병렬 아님). 추가 유료비용 0원, 외부 의존성 0.

- `ops/family/ai/CORE-CONSTITUTION.md` — L0 항상 로드 최소 규칙(정본 캡슐).
- `ops/family/ai/routing.json` — 12 profile · L0~L4 · 예산 · escalation 기계 정본.
- `ops/family/ai/context-fixtures.json` — golden fixture 14종.
- `ops/scripts/family/lib/context-os.mjs` — 분류·pack·토큰추정 공용 로직.
- `ops/scripts/family/route-task.mjs` — 요청 → context pack (`--request/--app/--json/--help`, 종료코드).
- `ops/scripts/family/benchmark-context.mjs` — 라우팅 전/후 실측.
- `ops/scripts/family/route-task.test.mjs` — golden 테스트 19건 통과.
- `ops/family/ai/CONTEXT-OS.md` · `context-benchmark.json` — 문서·증거.

### 실측 벤치마크 (node로 재현 가능)
- 기준선(매 작업 전체 재독 후보 9개 파일 실측 합): **~17,946 estimated 토큰**
- 요청 라우팅 pack 평균: **~410 estimated 토큰** · 평균 **98% 감소**
- 14개 fixture 전부 기대 profile·level·포함/제외 일치, registry↔REPO-MAP 정합 검증.
- estimated = chars/4 결정론적 근사(항상 "estimated" 표기, 가짜 절감률 아님).

## 이번 실행에서 하지 않은 것 (정직한 경계 · 다음 단계)
아래는 실행하지 않았고 "완료"로 보고하지 않는다. 이유는 패키지 자체 규칙(§2·§9)과 증거 부재.

- **HQ 앱 v1.4.0 UI/Electron 릴리스**: 이미 v3.3.30로 초과. 서명·공증 credential은 회장 전용(BLOCKED_CEO).
- **6개 앱 패밀리 UI 대량 이관·per-app `.robom` 프로파일**: Codex가 현재 활발히 작업 중(HQ 엔진·CI·앱 대행). 병렬 덮어쓰기는 §2 위반 → 앱별 worktree·lease로 순차 진행해야 함.
- **AGENTS/CLAUDE router 재작성**: 이미 짧은 router이고 Codex가 자주 편집 → 불필요·고충돌.
- **quota-retry supervisor/HQ context 화면**: HQ(v3.3.30)는 Codex 소유 runtime → 조율 필요.

## 검증 재현
```bash
node --test ops/scripts/family/route-task.test.mjs   # 19 pass
node ops/scripts/family/benchmark-context.mjs         # 실측 98% 절감
node ops/scripts/family/route-task.mjs --request "청약봄 버튼 문구 수정"
```
