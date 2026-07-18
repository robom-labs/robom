# v1.2.0 _ HQ 아키텍처 결정 기록

## 데스크톱 셸: Electron — ADOPT

- **Electron (ADOPT)**: 기존 HTML/CSS/JS + Node ESM 서버를 무수정 재사용. electron-builder가 리눅스 CI에서도 mac(.dmg)/win(.exe) 크로스 패키징 지원. 백그라운드 트레이·자동시작·단일 인스턴스 내장. 유지보수를 Codex/Claude가 안정적으로 수행 가능.
- **Tauri (REJECT-지금은)**: 번들은 작지만 Rust 툴체인·사이드카로 Node 서버를 별도 동봉해야 해 복잡도↑. 추후 재평가 가치 있음.
- **SwiftUI (REJECT)**: 웹 자산 재사용 불가, macOS 전용(회사컴 윈도우 배제), 유지보수 주체 없음.

## 저장: JSONL 유지 — ADOPT

append-only 이벤트 폴드 + 배타적 쓰기 큐 + audit + 백업이 이미 검증됨(테스트 10종). SQLite 전환은 검색·동시성 병목이 실측될 때만.

## 업무 queue: 파일 기반(pending/running/done/failed) — ADOPT

- 프로세스 간(서버↔러너) 공유가 필요해 store 내부가 아닌 파일 디렉터리 사용.
- lease(45분 TTL)+heartbeat+stale 복구, 한 저장소 1 쓰기 작업.
- Codex는 UI가 아니라 queue의 JSON 패킷을 읽는다(§10 나쁜 흐름 차단).

## 원격 접속: 토큰 opt-in + Tailscale 권장 — ADAPT

- 기본은 127.0.0.1 전용(변화 없음). `ROBOM_HQ_REMOTE_TOKEN`(12자↑) 설정 시에만 0.0.0.0 바인딩 + Bearer/쿠키 토큰 + timingSafeEqual + rate limit.
- 공개 인터넷 노출 금지 → 사설망(Tailscale 무료)을 표준 경로로 문서화. 포트포워딩 금지.

## 배포: GitHub Actions(macos/windows 러너) → GitHub Release — ADOPT

바이너리는 저장소 비커밋(§18.10). 태그 `hq-v*` push가 유일한 릴리스 트리거.

## 데이터 위치: OS userData — ADOPT

payload(.app 내부)는 읽기 전용 취급. `ROBOM_HQ_RUNTIME_DIR`/`ROBOM_HQ_SNAP_DIR` env로
runtime·snapshots를 `~/Library/Application Support/robom-hq/`(맥)·`%APPDATA%`(윈)로 분리.
