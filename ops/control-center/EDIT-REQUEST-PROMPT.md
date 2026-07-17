# 로봄 수정 요청 공통 프롬프트 (앞에 붙여 쓰기)

> 코덱스·클로드 등에 **무엇을 수정/추가해달라고 요청할 때 이 블록을 맨 앞에 붙인다.**
> 요청 내용을 처리하면서 **로봄 본부 오피스(실시간 회사 관제 게임)도 항상 같이 최신화**하도록 강제하는 지침이다.

---

## 배경 (이미 있는 것 — 새로 만들지 말고 읽고 확장)

`robom-labs/robom` main에 ROBOM COMPANY OS 2.0이 구현돼 있다.

- 데이터·조직은 `ops/control-center/`의 정본과 `ops/registry/apps.yml`, `ops/state/`, `ops/HUMAN-TASKS.md`, `ops/ROADMAP.md`에서 읽는다.
- 경영 OS는 `app/index.html`·`app.js`이며 회장실, 결재, 회의, 제품, 출시, 검수, 데이터, 사고, 성장, 비용, 보안, 기억과 백업을 다룬다.
- 6층 오피스는 `app/office-map.json`과 `office.html`·`office.js`로 구성된다. 자체 Canvas SD 벡터 캐릭터 20명과 앱 마스코트 5종을 사용한다.
- 내부 기록은 `runtime/`의 append-only JSONL에 저장하며 Git에서 제외한다.
- `bin/robom-hq.command|.bat`는 `http://127.0.0.1:4321/` 경영 OS를 연다. 오피스는 `/office.html`이다.
- 단일 HTML은 `dist/로봄본부.html`과 `dist/로봄본부-오피스.html`이다.

## 항상 지킬 원칙

- **연출 금지**: 실제 작업 이벤트/세션/Git/PR/CI 증거가 있을 때만 '일하는 중'. 없으면 대기/휴식(오토파일럿), heartbeat 30분 만료면 '상태 확인 필요'.
- **무료·내부 전용**: 새 유료 API·상시 서버 금지. `events/*.jsonl`·`snapshots/latest.json`·`runtime/`은 `.gitignore`(커밋 금지). 공개 robom.kr 노출 금지.
- **본사 구조 유지**: robom에 앱 소스 사본 금지. 앱은 각자 저장소.

## 이번 요청과 함께 반드시 같이 업데이트할 것 (팀/직원/앱이 바뀌면)

`ops/control-center/OFFICE-UPDATE.md`의 절차대로:
- 직원 추가·이동 → `agents.yml`과 `office-map.json`의 `desks`, `names`, 해당 `floors[].employees`.
- 팀·공간 추가 → `departments.yml`과 `office-map.json`의 `zones`, `teams`, 해당 `floors[].zones`.
- 앱 추가·이름 변경 → `ops/registry/apps.yml`과 `office-map.json`의 `products`, `names`, `desks`, 층 배치.
- 회장·비서·좌석·비품 → `office-map.json`의 `chair`, `secretaries`, `seats`, `zones[].props`.

## 실시간 연동(요청이 "애들이 실제로 일하게" 관련이면)

`ops/control-center/ADAPTERS.md`대로 Claude Code 훅(`adapters/claude-hook.mjs`)·Codex·GitHub Actions(`adapters/actions-emit.sh`)를 `emit-event`에 연결. 직원 id는 `agents.yml`·`office.js` 로스터와 일치해야 캐릭터에 매핑됨.

## 검증

- `node --test scripts/control-center/*.test.mjs scripts/control-center/lib/*.test.mjs`를 실행한다.
- `node scripts/control-center/build-snapshot.mjs` → `serve.mjs`로 띄워 **실제 화면 스크린샷**으로 경영 OS와 6개 층의 배치·이동·회의·휴식·연동을 확인한다.
- 데모 이벤트는 커밋하지 말고 `example.json`은 정직(runs 0) 유지.
- 320~PC 반응형·성능(60fps 목표)·다크 대비.

---

## (여기 아래에 이번에 원하는 수정/추가 내용을 적는다)

예: "러닝봄 카드 필터를 …로 바꿔줘" / "새 앱 XX봄 추가해줘" / "감독팀을 개발실로 옮겨줘" 등.
그리고 **위 배경대로 로봄 본부 오피스도 같이 최신화**해줘.
