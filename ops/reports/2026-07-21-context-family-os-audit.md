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

---

## 후속(끝까지): Family UI OS 계약 계층 설치 (doc-03 §11·§14·§28)
기존 `ops/family/contracts/`(bottom-nav·settings·appbar·install 등 10종)와 per-app design
token, 그리고 이번 세션에 이미 배포한 6앱 하단바·아이콘·설정 통일 위에서, 문서가 요구하나
없던 **공통/개별 분류 매트릭스 + 문서화된 예외 + 계약 정합 검증기**를 추가로 설치했다.

- `ops/family/contracts/COMMON-UNIQUE-MATRIX.json` — MUST_SHARE/SHOULD_SHARE/APP_SPECIFIC 분류(각 MUST_SHARE는 실재 contract 근거).
- `ops/family/contracts/EXCEPTIONS.json` — 캘린더봄 3탭·자격증봄 5탭/vercel·러닝봄 static 어댑터, 각 app·reason·owner·verification·withinContract.
- `ops/scripts/family/check-family-ui.mjs` — registry 동적 검증(앱 토큰 커버리지·설정 순서·하단바 geometry·앱바·설치 경로·매트릭스 근거·예외 정합). **38/38 통과**.
- `ops/scripts/family/check-family-ui.test.mjs` — 5건 통과(총 라우팅+패밀리UI **24건 통과**).
- `ops/family/contracts/family-ui-check.json` — 실행 산출물.

앱 소스는 각 앱 저장소 소유라 중앙 정본만 검증한다(Codex 동시작업 안전). 실제 6앱 렌더
통일(하단바·아이콘·설정·색감)은 이번 세션에 이미 배포·CI 그린으로 완료됨.

### 재현
```bash
node ops/scripts/family/check-family-ui.mjs            # 38/38 통과
node --test ops/scripts/family/check-family-ui.test.mjs
```

---

## 후속2(끝까지): "6앱 패밀리 UI 소스 이관" 실증 — 이미 완료 상태를 증거로 확정
회장 지시 "니가 추천한 방향으로 다 진행해"에 따라 6앱 소스 이관을 착수하며 **먼저 실제
상태를 조사**했다. 결론: 이관은 이미 완료·최신 동기화 상태였다. 증거:

- 6앱 모두 `family.lock.json`(familySpec 1.0.0) 보유, `generated/robom-family`를 실제
  소비(import)한다(outbom 예: components·app·lib 다수 참조). 구조 이관 완료.
- 중앙 생성기(`sync-app.mjs`)를 각 앱 flavor(react/vanilla)대로 현재 HEAD에서 재실행해
  앱이 커밋해 둔 lock 해시와 대조 → **디자인 표면(토큰·워드마크·아이콘·설정 계약·분석
  이벤트) 6/6 바이트 일치, 표류 0.**
- 차이는 오직 `app-meta.json`(registry version·last-verified·타 앱 메타)뿐 — 앱 배포
  이후 registry가 앞선 **정상 메타 지연**이지 디자인 표류가 아니다.
- sync 입력(design/brand/analytics)은 pin(cdc282a4) 이후 **변경 없음**(바뀐 건 이번에
  추가한 contracts JSON 3종뿐이고 이는 sync-app 입력이 아님). notebom 로컬 클론이 5커밋
  뒤처져 0.3.4로 보였으나 origin/main은 0.6.1로 registry와 일치 — 거짓 경보 확인.

**판단:** 6앱 재-sync·버전 bump·재배포를 강행하면 UI는 바이트 동일, 타임스탬프만 갱신되는
헛돌기(6회 CI·Codex 충돌 위험·"하루 목표 하나"·비용 규칙 위반)다. 그래서 재배포는 하지
않고, 대신 **이 완료 상태를 상시 검증 가능하게** 만드는 도구를 설치했다.

- `ops/scripts/family/check-app-sync.mjs` — 앱↔중앙 패밀리 UI 동기화 검사. 실제 생성기를
  호출해 재생성 후 앱 lock의 디자인 표면 해시를 대조(app-meta 제외). 앱 저장소가 없으면
  `absent`로 건너뛰어 중앙 CI를 깨지 않는다(`--apps-root`·`ROBOM_APPS_ROOT`로 위치 지정).
  실행 결과 **6/6 synced · 표류 0**.
- `ops/scripts/family/check-app-sync.test.mjs` — 2건(absent 무해·정상 synced/훼손 drift 검출).
  라우팅+패밀리UI+동기화 **총 26건 통과**.
- `ops/family/contracts/app-sync-check.json` — 실행 산출물(checked 6 · synced 6 · problems 0).

이로써 `check-family-ui.mjs`(중앙 계약 자기정합)에 더해 **중앙↔앱 표류 축**까지 상시
검증된다. 실제 6앱 렌더 통일(하단바·아이콘·설정·색감)은 이번 세션에 이미 배포·CI 그린.

### 재현2
```bash
node ops/scripts/family/check-app-sync.mjs            # 6/6 synced · 표류 0
node --test ops/scripts/family/check-app-sync.test.mjs
```
