# 로봄 본부 오피스 — 팀/직원/앱 바뀔 때 업데이트 프롬프트

> 조직이 바뀌면(팀 추가·직원 이동·앱 추가/이름 변경) 아래만 고치면 오피스 게임이 자동으로 맞춰진다.
> 원칙: **데이터로 관리**하고, **연출 금지**(실제 이벤트 있을 때만 '일하는 중'), 무료·내부 전용 유지.

## 이 프롬프트를 그대로 쓰기

"로봄 본부 오피스(`ops/control-center/`)를 현재 조직에 맞춰 업데이트해줘. 아래 정본을 먼저 읽고 반영해:
- 앱 정본: `ops/registry/apps.yml` (+ `apps-extra.yml`)
- 조직: `ops/control-center/departments.yml`
- 직원: `ops/control-center/agents.yml`
그리고 오피스 배치는 `ops/control-center/app/office.js` 상단의 데이터 블록만 수정해:
- `DESKS` : [직원id, 책상x, 책상y] — 팀/직원이 바뀌면 여기 추가·삭제·이동
- `ZONES` : 방(러그·라벨). 팀 방을 추가/이름변경하면 수정
- `NAMES`/`BODY`/`TEAM`/`PRODUCT` : 표시 이름·색·앱 아바타 집합
- `CHAIR`/`SECS` : 회장(황준필)·비서. 바뀌면 여기
- `LOUNGE`/`CAFE`/`MEET` : 휴게실·식당·회의 좌석 좌표
반영 후 `node scripts/control-center/build-snapshot.mjs`로 스냅샷 만들고, `node scripts/control-center/serve.mjs`로 띄워 실제로 캐릭터 배치·이동·회의·휴식이 맞는지 스크린샷으로 확인해. 데모 이벤트는 커밋하지 말고 `example.json`은 정직(runs 0)하게 유지해."

## 체크리스트 (바뀔 때)

- **직원 추가**: `agents.yml`에 등록 → `office.js`의 `DESKS`에 자리 1개 추가 → `NAMES`/`BODY`에 표시명·색.
- **직원 이동(팀 변경)**: `DESKS`에서 그 직원의 (x,y)를 새 팀 방 좌표로 옮김 + `departments.yml`의 소속 갱신.
- **팀(부서) 추가**: `departments.yml`에 부서 + `ZONES`에 방(러그·라벨·코드) + 그 팀 직원 `DESKS` 배치.
- **앱 추가/이름 변경**: `apps.yml`(정본) 갱신 → `office.js` `PRODUCT`/`NAMES`/`BODY`와 프로젝트룸 `DESKS`(앱 아바타) 반영. 가드레일의 앱 수 하드코딩이 있으면 비종속화.
- **회장/비서 변경**: `CHAIR`/`SECS` 수정.

## 실시간 연동(캐릭터가 실제로 일하게)

- 직원 id는 `agents.yml`과 `office.js` 로스터가 일치해야, Claude Code·Codex·Actions가 `emit-event`로 남긴 `agentId`가 그 캐릭터에 매핑된다(`EVENT-PROTOCOL.md`).
- 로스터에 없는 id로 이벤트가 오면 매핑 안 됨 → 로스터를 맞추거나, 그 id를 `DESKS`에 추가.
- 상태→행동 매핑(현재): working/implementing→자리 타이핑, verifying→🔍, blocked→⚠️, approval_pending→회장실 앞 대기, deploying→서버실, 같은 앱 2명↑→회의 소집. 바꾸려면 `office.js`의 `applySnap()` 수정.

## 하지 말 것

- 실제 이벤트 없이 "일하는 중"으로 보이게 만들기(연출). 미연결이면 오토파일럿(휴식·식사·순찰)만.
- 내부 데이터(`events/*.jsonl`, `snapshots/latest.json`) 커밋 / 공개 robom.kr 노출.
- 새 유료 API·상시 유료 서버 추가.
