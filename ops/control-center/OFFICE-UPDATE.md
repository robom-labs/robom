# 로봄 본부 오피스 — 팀/직원/앱 바뀔 때 업데이트 프롬프트

> 조직이 바뀌면(팀 추가·직원 이동·앱 추가/이름 변경) **`ops/control-center/app/office-map.json` 한 파일만** 고치면 오피스 게임이 자동으로 맞춰진다. **office.js(코드)는 건드릴 필요 없다.**
> 원칙: **데이터로 관리**하고, **연출 금지**(실제 이벤트 있을 때만 '일하는 중'), 무료·내부 전용 유지.

## 정본 = `app/office-map.json`

레이아웃·직원·앱·좌석이 전부 이 JSON에 있다. `office.js`는 부팅 시 이 파일을 읽어 배치한다(fetch 실패 시 내장 폴백으로 동일 동작). 단일 HTML 빌드는 `build-standalone.mjs`가 이 JSON을 `window.__MAP__`로 인라인한다.

### 필드 지도

| 필드 | 의미 |
|---|---|
| `grid` | `{w,h,tileW,tileH}` — 격자 칸 수·타일 픽셀. 층을 넓히려면 `w`/`h`를 키운다 |
| `teams` | 팀색 맵(`키:hex`). 데스크의 `team`이 이 키를 참조 |
| `products` | 앱 캐릭터로 취급할 id 목록(오토파일럿에서 앱 캐릭터는 자리 위주) |
| `names` | id→표시명(직원·앱 공통) |
| `zones[]` | 방 `{x,y,w,h,color,label,code,walls,door,props}`. `door:[x,y]`는 실제 통행 가능한 문이며 `props`는 방 비품 목록 |
| `desks[]` | 책상 `{id,x,y,team,appearance}`. **직원은 `y+1`에 착석**. 팀·직원·캐릭터 외형은 여기서 변경 |
| `chair` | 회장 `{id,name,x,y,appearance}` |
| `secretaries[]` | 비서 `{id,name,x,y,appearance}` |
| `seats.meeting` / `meetingTable` | 회의실 좌석 6개 / 원탁 중심 |
| `seats.lounge` | 휴게실 소파 좌석 |
| `seats.cafe` / `cafeTables` | 식당 좌석 / 식탁 |

`appearance`는 `gender`, `hair`, `hairColor`, `skin`, `outfit`, `accent`, `glasses`, `headset`, `hairAccessory`를 지원한다. 현재 직원 20명은 남성 4명·여성 16명으로 2:8 비율이며, 앱 캐릭터 5종은 성비와 분리된 브랜드 아바타다.

현재 오피스는 본부·전략실, 대회의실, 회장·비서실, 개발·QA 스튜디오, 운영·보안 센터, 프로젝트 워룸, 디자인·데이터 랩, 라운지·폰부스, 카페테리아, 리셉션, 서버·관제실, 비품창고까지 12개 공간으로 구성된다. 비품 좌표도 코드가 아니라 각 방의 `props`에서 관리한다.

좌표는 타일 격자(정수 또는 소수), 색은 hex. 편집 후 JSON 유효성만 지키면 된다(`node -e "JSON.parse(require('fs').readFileSync('ops/control-center/app/office-map.json','utf8'))"`).

## 체크리스트 (바뀔 때 — office-map.json만 수정)

- **직원 추가**: `agents.yml`에 등록 → `office-map.json`의 `desks[]`에 `{id,x,y,team,appearance}` 1개 추가 → `names`에 표시명. 색은 `team`, 외형은 `appearance`가 결정한다.
- **직원 이동(팀 변경)**: 해당 `desks` 항목의 `x,y`를 새 팀 방 좌표로, `team`을 새 팀으로. + `departments.yml` 소속 갱신.
- **팀(부서) 추가**: `departments.yml`에 부서 + `office-map.json`의 `zones[]`에 방 1개(`label`/`code`/`color`/`door`) + `teams`에 팀색 + 그 팀 직원 `desks` 배치.
- **앱 추가/이름 변경**: `apps.yml`(정본) 갱신 → `office-map.json`의 `products`·`names`·`teams`(앱색)와 프로젝트룸 `desks`(앱 아바타) 반영. 가드레일의 앱 수 하드코딩이 있으면 비종속화.
- **회장/비서 변경**: `chair`/`secretaries` 수정.
- **층을 넓히기**: `grid.w`/`grid.h`를 키우고 방(`zones`)·복도를 재배치.
- **비품 추가**: 해당 방의 `props[]`에 `{type,x,y,solid}`를 추가. `solid:true`면 캐릭터가 비품을 통과하지 않는다.

## 검증

```
node scripts/control-center/build-snapshot.mjs   # 실데이터→snapshots/latest.json
node scripts/control-center/serve.mjs            # localhost:4321/office.html
```
띄워서 캐릭터 배치·앉기·이동·회의·휴식, 벽·문 통행, 직원 상세 패널, 모바일 핀치 줌이 맞는지 **실제 화면 스크린샷**으로 확인. 단일 HTML은 `node scripts/control-center/build-standalone.mjs` → `dist/로봄본부-오피스.html` 더블클릭.
데모 이벤트는 커밋하지 말고 `example.json`은 정직(runs 0)하게 유지.

## 실시간 연동(캐릭터가 실제로 일하게)

- 직원 id는 `agents.yml`과 `office-map.json`의 `desks` 로스터가 일치해야, Claude Code·Codex·Actions가 `emit-event`로 남긴 `agentId`가 그 캐릭터에 매핑된다(`EVENT-PROTOCOL.md`·`ADAPTERS.md`).
- 로스터에 없는 id로 이벤트가 오면 매핑 안 됨 → 로스터를 맞추거나, 그 id를 `desks`에 추가.
- 상태→행동 매핑(현재): working/implementing→자리 타이핑, verifying→🔍, blocked→⚠️, approval_pending→회장실 앞 대기, deploying→서버·관제실, 같은 앱 2명↑→실제 회의 소집. 바꾸려면 `office.js`의 `applySnap()`을 수정한다.
- 실제 이벤트가 없을 때는 대기·식사·휴식·순찰만 수행하며, 업무·회의·배포를 연출하지 않는다.

## 하지 말 것

- 실제 이벤트 없이 "일하는 중"으로 보이게 만들기(연출). 미연결이면 오토파일럿(휴식·식사·순찰)만.
- 내부 데이터(`events/*.jsonl`, `snapshots/latest.json`) 커밋 / 공개 robom.kr 노출.
- 새 유료 API·상시 유료 서버 추가.
