# 데일리 보고 운영 (3채널 자동보고) — 런북

목적: 매일 아침 **08:00(한국시간)** zoop-holdings 진행상황을 **슬랙·노션·카카오톡** 3곳에 자동 보고한다.
이 문서만 보면 다른 PC/세션에서도 전체 구성을 재현·점검할 수 있다. (누락 방지용 단일 기준 문서)

최초 작성: 2026-07-09 (황준필 회장 지시)

---

## 1. 3채널 한눈에

| 채널 | 발송 주체 | 스케줄 | 비밀값 위치 |
|---|---|---|---|
| 카카오톡 "나에게 보내기" | GitHub Actions 워크플로 | 매일 08:00 KST | GitHub repo Secrets |
| 슬랙 `#회사` (C0BGEA7RN92) | Claude 예약 세션(Routine) | 매일 08:00 KST | 세션의 Slack MCP 연결 |
| 노션 "회장보고" (page `398e3492-cb1c-814b-803a-c3508b34b35f`) | 같은 Claude Routine | 매일 08:00 KST | 세션의 Notion MCP 연결 |

> 카카오는 **저장소 안**에 있어 어느 PC든 동일하게 돈다. 슬랙·노션은 **계정 단위 Routine**이라 저장소엔 없다 → 재현법은 §3.

---

## 2. 카카오톡 — GitHub Actions

- 파일: `.github/workflows/daily-kakao-report.yml`
- 동작: `KAKAO_REFRESH_TOKEN`으로 access_token 갱신 → `kapi.kakao.com/v2/api/talk/memo/default/send` 로 "나에게 보내기".
- 스케줄: cron `0 23 * * *` (UTC 23:00 = KST 08:00).
- 필요한 **GitHub Secrets** (사람이 직접 등록, Claude는 값 접근 금지):
  - `KAKAO_CLIENT_SECRET`
  - `KAKAO_REFRESH_TOKEN`
- REST API 키(공개용, 비밀 아님)는 워크플로에 직접 기재: `30dbc23cb8c40f05689b66eb425539d6`
- 수동 실행: GitHub → Actions → `daily-kakao-report` → **Run workflow**.
  - `message` 입력값을 주면 그 내용으로, 비우면 기본 문구로 발송(`workflow_dispatch` inputs.message).
- 검증 이력: 2026-07-09 수동 실행 `success` (테스트 카톡 발송 확인).

## 3. 슬랙·노션 — Claude Routine (계정 단위)

- Routine 이름: **매일 8시 슬랙·노션 일일보고 (핵심요약·시각표기)**
- Trigger ID: `trig_01EPA6RWMNUpjx4UCrCF3GSD`
- cron: `0 23 * * *` (08:00 KST), 매 실행 새 세션(create_new_session_on_fire).
- 대상: 슬랙 채널 `C0BGEA7RN92`, 노션 페이지 `398e3492-cb1c-814b-803a-c3508b34b35f`.
- ⚠️ **이 Routine은 계정에 저장되고 저장소엔 없다.** 다른 환경에서 안 보이면 아래 프롬프트로 재생성한다.

<details><summary>Routine 재생성용 프롬프트 (그대로 사용)</summary>

```
너는 zoop-holdings 회사 '일일 보고' 담당이다. 매일 아침 8시(한국시간)에 새 세션으로 시작한다.
오늘자 진행상황을 짧고 깔끔하게 핵심만 정리해 슬랙과 노션에 보고한다. 보고는 8줄 안팎, 서론·미사여구 금지.

[반드시]
- 첫 줄에 현재 한국시간을 "🕒 <오전/오후 H시 M분> 기준" 으로 적는다.
  시각은 Bash `TZ=Asia/Seoul date +"%p %-I시 %-M분"` 로 구하고 AM→오전/PM→오후.
- 둘째 줄은 "황준필 회장님, 보고드리겠습니다!" 로 시작.

[양식]
🕒 <오전/오후 H시 M분> 기준
황준필 회장님, 보고드리겠습니다!

📋 zoop-holdings 데일리 보고 · <YYYY-MM-DD>

🟢 진행 PR <N>건 (검토 대기)
• <repo> #<번호> · <제목> — <draft/CI상태>   (최대 5줄, 많으면 "외 n건")

✅ 반영 완료
• <repo> #<번호> · <제목>   (없으면 "없음")

⚠️ 다음: <한 줄>

[전송] 1) 슬랙 slack_send_message 채널 C0BGEA7RN92  2) 노션 notion-update-page 페이지
398e3492-cb1c-814b-803a-c3508b34b35f, insert_content, position end, "## <날짜>" 섹션.
[주의] 카카오는 별도 워크플로 담당(건드리지 않음). 도구 없으면 마지막 메시지에 명시.
secret 값 안 다룸. 외부 자동게시 금지. main 직접 push 금지.
```
</details>

## 4. 보고 양식 (3채널 공통 지향)

```
🕒 <오전/오후 H시 M분> 기준
황준필 회장님, 보고드리겠습니다!

📋 zoop-holdings 데일리 보고 · <날짜>

🟢 진행 PR <N>건 (검토 대기)
• <repo> #<번호> · <제목> — <상태>

✅ 반영 완료
• <repo> #<번호> · <제목>

⚠️ 다음: <한 줄>
```
- 시각은 매번 실제 한국시간을 읽어 표기. 5~10줄 핵심만.
- (카카오 기본 문구는 짧은 "오늘 PR 확인하세요" 링크형 — 상세는 슬랙·노션.)

## 5. 다른 PC에서 점검·재현하는 법

1. **카카오**: 저장소에 워크플로가 있으므로 PC 무관. GitHub Secrets 2개만 등록돼 있으면 됨. Actions 탭에서 수동 Run으로 즉시 검증.
2. **슬랙/노션 Routine**: 계정 단위. Claude Code에서 Routine 목록 확인 → 없으면 §3 프롬프트로 재생성.
3. **(선택) 카카오 수동 MCP**: 맥 `~/kakao-mcp-server/index.js` + `~/.kakao-mcp.json`. 이 저장소 자동화와는 별개(즉석 수동 발송용).

## 6. 사람이 계속 관리할 것

- [ ] GitHub Secrets `KAKAO_CLIENT_SECRET`, `KAKAO_REFRESH_TOKEN` 유지.
- [ ] 채팅에 노출됐던 client_secret은 카카오 developers에서 **재발급** 권장(재발급 시 Secret 갱신).
- [ ] refresh_token 만료 시(장기 미사용) 재발급.
