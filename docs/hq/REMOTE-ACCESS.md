# v1.2.0 _ 휴대폰 원격 접속 (무료·비공개)

## 위협 모델 요약

공개 인터넷 노출 금지(익명 스캔·무차별 대입 차단). 휴대폰 분실 시 차단 가능해야 함.
휴대폰에서 임의 shell·파일 경로 실행 불가(서버 API가 원래 제공하지 않음 — records/tasks/control뿐).

## 권장 구성: Tailscale(무료) + 토큰

1. 맥북·휴대폰에 Tailscale 설치, 같은 계정 로그인(사설 WireGuard 망 — 공개 노출 없음).
2. 맥북에서 본부 실행 시 토큰 지정:
   ```
   ROBOM_HQ_REMOTE_TOKEN="긴-무작위-문구-12자-이상" node scripts/control-center/serve.mjs
   ```
   (데스크톱 앱은 추후 설정 화면 예정 — 현재는 터미널 실행 시에만 원격 허용)
3. 휴대폰 브라우저에서 `http://<맥북 tailscale IP>:4321/?token=<토큰>` 1회 접속 → 세션 쿠키(24h) → 홈 화면에 PWA 추가.

## 서버 방어 (serve.mjs)

- 토큰 미설정 시: 127.0.0.1 바인딩 + Host 검사 = 기존과 동일(변화 없음).
- 토큰 설정 시: `timingSafeEqual` 비교(Bearer/쿠키/1회 query), IP당 240req/분 rate limit, HttpOnly·SameSite=Strict 쿠키, 24h 만료.
- 차단: 토큰 변경 후 재시작(모든 기기 세션 무효) 또는 Tailscale에서 기기 제거.

## 오프라인·동기화 (§9.2)

- 온라인: 맥북 HQ runtime이 단일 정본.
- 휴대용 보기(서버 없음): 읽기 중심. 요청을 저장하면 "임시 저장 — 본부 연결 시 다시 등록" 경고를 명시(이중 정본 방지).

## 금지

포트포워딩·공개 도메인 연결·토큰의 저장소 커밋. HTTPS 종단이 필요하면 Tailscale 내장 암호화가 담당(추가 인증서 불필요).
