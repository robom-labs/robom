# ROBOM Context OS v1.0.0 — 요청 기반 라우팅 계층

이 계층은 새 병렬 시스템이 아니라 기존 `ops/family/ai/`(REPO-MAP·FAMILY-CONTEXT·CURRENT-STATE)를
**확장**한 것이다(ROBOM_ONE_SHOT_CONTEXT_FAMILY_OS_v1.0.0 doc-03 §7·§9·§17·§29).

## 문제
매 작업마다 CLAUDE·AGENTS·Company OS·PROTOCOL·전체 REPO-MAP·registry·state를 다시 읽으면
작은 문구 수정에도 ~18,000 추정 토큰의 지침/상태 스택을 재독하게 된다.

## 해결
자연어 요청을 profile로 분류하고, L0 헌법 + 대상 앱 지도 블록 + 최소 read-next 계획만 담은
작은 context pack을 만든다. 기존 `build-ai-context.mjs`는 **git diff 기반**(사후·CI용)이고,
이 라우터는 **요청 기반**(작업 전 무엇을 읽을지 결정)이라 상호 보완한다.

## 구성
- `CORE-CONSTITUTION.md` — 항상 로드하는 L0 최소 규칙(정본에서 뽑은 캡슐).
- `routing.json` — profile·level·키워드·예산 기계 정본.
- `context-fixtures.json` — 라우팅/벤치마크 golden fixture 14종.
- `../../scripts/family/route-task.mjs` — 요청 → context pack.
- `../../scripts/family/benchmark-context.mjs` — 라우팅 전/후 실측.
- `../../scripts/family/lib/context-os.mjs` — 공용 로직.
- `../../scripts/family/route-task.test.mjs` — golden 테스트(19건).

## 사용
```bash
# 요청 하나를 최소 read-plan으로 라우팅
node ops/scripts/family/route-task.mjs --request "청약봄 버튼 문구 수정"
node ops/scripts/family/route-task.mjs --request "자격증봄 저장 마이그레이션" --json

# 라우팅 전/후 실측 벤치마크
node ops/scripts/family/benchmark-context.mjs
node ops/scripts/family/benchmark-context.mjs --json

# golden 테스트(라우팅 정확성 + registry↔REPO-MAP 정합)
node --test ops/scripts/family/route-task.test.mjs
```

## 원칙
- 앱 이름을 코드에 하드코딩하지 않는다(registry에서 동적).
- 추정 토큰은 chars/4 결정론적 근사이며 항상 "estimated"로 표기한다.
- 코드 전문을 pack에 인라인하지 않고 read-next 경로만 제공한다(doc-03 §17).
- 안전 규칙(헌법)은 어떤 예산에서도 제거하지 않는다(doc-03 §18).
- 새 registry 앱에 REPO-MAP 항목이 없으면 golden 테스트가 실패한다.

## 범위 밖(정직한 경계)
이 설치는 doc-03의 토큰 효율(요청 라우팅) 핵심만 담는다. HQ 앱(현재 v3.3.30, 이미 doc의
v1.4.0 목표 초과)·Electron 데스크톱 릴리스·6개 앱 패밀리 UI 대량 이관은 Codex가 활발히
작업 중이라 이 실행에서 병렬로 덮어쓰지 않는다(doc-03 §2 동시 작업 보호). 세부는
`ops/reports/`의 Context/Family OS 감사 기록 참조.
