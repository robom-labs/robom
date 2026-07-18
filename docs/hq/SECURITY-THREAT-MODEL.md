# v1.2.0 _ 보안 위협 모델

| 위협 | 방어 |
|---|---|
| 비밀값이 기록에 저장 | company-store가 키·토큰·비밀번호 패턴을 저장 단계에서 거부(SENSITIVE_CONTENT) |
| 내부 기록 공개 유출 | runtime·events·latest.json·desktop/payload 전부 .gitignore + gitleaks CI |
| 외부에서 본부 접근 | 기본 127.0.0.1 전용. 원격은 토큰 opt-in + 사설망 권장(REMOTE-ACCESS.md) |
| 무차별 대입 | timingSafeEqual + IP rate limit(240/분) + 12자 미만 토큰 무시 |
| path traversal | decodeSafePath(.. \0 \\ 거부) + resolveStaticFile 루트 검사 |
| 요청 폭주·거대 본문 | Content-Length·스트림 이중 검사(32KB) + 405/415 |
| 휴대폰에서 임의 실행 | shell·경로 API 자체가 없음. records/tasks/control 화이트리스트뿐 |
| Codex 폭주 | queue 단일 실행 + lease TTL + 타임아웃 + 일시정지 + 사용량은 구독 한도 내 |
| 러너 죽음/이중 실행 | stale lease 자동 복구, 단일 인스턴스 큐 계약(테스트로 고정) |
| HQ 장애의 앱 전파 | HQ는 읽기(수집)와 별도 저장소 작업만. 앱 운영 경로는 독립 |
| 데스크톱 임의 코드 | contextIsolation, nodeIntegration off, 새 창은 외부 브라우저로만 |

미해결(정직): 미서명 바이너리(Gatekeeper 우클릭 필요 — 자격정보 등록 시 서명 파이프라인 재사용),
휴대폰 실기기 검증 미수행.
