# v1.2.0 _ ROBOM HQ 회장 사용법 (한 페이지)

## 설치 (회사컴·맥북)

1. https://github.com/robom-labs/robom/releases 에서 최신 `hq-v*` 릴리스를 연다.
2. **맥**: `ROBOM-HQ-*-mac-arm64.dmg`(M1/M2/M3/M4) 또는 `-x64.dmg`(인텔) 다운로드 → 열어서 `ROBOM HQ.app`을 응용 프로그램에 끌어넣기 → **처음 한 번만 우클릭 → 열기** (미서명 앱이라 필요).
3. **윈도우**: `ROBOM-HQ-Setup-*-win-x64.exe` 다운로드 → 실행. SmartScreen이 막으면 **추가 정보 → 실행**.
4. 창을 닫아도 메뉴 막대(트레이)에서 계속 감시한다. 완전 종료는 트레이 → 완전 종료.

## 매일 쓰는 법

- **오늘** 탭: 내가 확인할 일 → Codex 상태 → 6개 앱 상태. 30초면 끝.
- **새 수정 요청**: 오늘 탭의 초록 버튼 → 6개 질문에 말하듯 답하면 Codex 대기열에 자동 등록.
- **업무** 탭: 요청이 지금 어디까지 갔는지(대기→작업 중→검토 중→완료).
- **Codex** 탭: 지금 뭘 하는지 + [모든 자동작업 일시정지] 버튼.
- **기록·설정** 탭: 결재·회의·백업·보안. 오피스 게임도 여기(부가기능).

## Codex 연결 (맥북에서 1회)

터미널에서:
```
codex login          # 구독 계정으로 로그인 (API 키 아님)
node scripts/control-center/codex-runner.mjs   # 저장소 폴더에서 실행
```
연결 전에는 요청이 대기열에 안전 보관되고 화면에 "Codex 미연결"로 정직하게 표시된다.

## 휴대폰에서 보기

`docs/hq/REMOTE-ACCESS.md` 참고 — Tailscale(무료)로 맥북과 휴대폰을 묶고, 맥북에서
`ROBOM_HQ_REMOTE_TOKEN=<긴 비밀문구>`로 본부를 실행하면 휴대폰 브라우저로 접속·PWA 설치.

## 문제가 생기면

- 화면이 안 뜸 → 앱 완전 종료 후 다시 실행.
- 급하게 다 멈추고 싶다 → 오늘/Codex 탭의 **모든 자동작업 일시정지** (또는 트레이 메뉴).
- 데이터 위치: 맥 `~/Library/Application Support/robom-hq/`, 윈도우 `%APPDATA%/robom-hq/`.
