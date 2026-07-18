# v1.2.0 _ HQ 개편 전 전수 감사 결과

기준: main `379fa42` (2026-07-18, 개편 시작 SHA). v1.2 프롬프트 §3.3 가설 검증.

## 사실로 확인된 가설 (증거)

| 가설 | 판정 | 증거 |
|---|---|---|
| localhost 전용, 휴대폰 접속 불가 | 사실 | serve.mjs `LOCAL_HOST=127.0.0.1`, Host 검사 403 |
| Codex 어댑터 pending (실행기 없음) | 사실 | adapters/에 claude-hook·actions-emit만 존재 |
| 업무가 기록될 뿐 실행되지 않음 | 사실 | tasks는 store 저장 + 수동 "꾸러미 다운로드"뿐 |
| 메뉴 과다·중복 | 사실 | 화면 34개, 가시 메뉴 13개(브리핑·방송·조직도·성장·비용 등) |
| 회사 연출이 관리보다 앞 | 사실 | 첫 화면 회장실: 신호등 히어로·추천 카드·브리핑 낭독 |
| 서명 캔버스 연출 | 사실 | signaturePad canvas + "서명하고 승인" |
| 상태 세분화 과다 | 사실 | STATUS 22종이 사용자에게 그대로 노출 |
| 본사·앱 혼합 | 부분 사실 | snapshot apps=7(robom 포함), 화면 대부분 filter 없음 |
| localStorage↔runtime 갈라짐 | 사실 | portable 모드가 별도 정본이 될 수 있음(경고 없음) |
| 오피스 비중 과다 | 사실 | 모바일 탭 5개 중 1개가 오피스 |

## 이번 개편으로 해소된 것

5탭 IA(오늘·앱·업무·Codex·기록설정), 본사/계열사 분리, 단순 상태 8종, 업무 intake→작업 패킷 queue,
codex-runner(구독 CLI), 결정론적 감시기, 긴급 일시정지, 토큰 원격(opt-in), 데스크톱 앱(.dmg/.exe),
서명 캔버스·브리핑·방송·조직도 화면 제거, 오피스 부가기능화, 휴대용 모드 저장 시 경고 표시.

## 남은 항목 (정직)

- Codex 실제 실행 E2E: 이 개발 환경에 codex CLI가 없어 **NOT_VERIFIED** — 미연결 경로(blocked 처리)는 검증 완료. 맥북 연결 후 1건 실행으로 증명 필요.
- 서명·공증: Apple Developer 자격정보 없음 — **미서명 빌드** (MACOS-SIGNING-NOTARIZATION.md).
- 휴대폰 실기기 PWA: 실기기 없음 — 코드·문서 준비 완료, NOT_VERIFIED.
