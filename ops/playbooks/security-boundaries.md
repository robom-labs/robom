# 보안 경계 플레이북 — 사람만 다루는 것 / AI가 못 넘는 선

> CLAUDE.md 금지작업의 실행 지침. 실제 강제는 CI(secret-scan)와 CODEOWNERS가 담당한다.
> "LLM에게 부탁하는 건 보안이 아니다. 검사(코드)가 보안이다"(DESIGN 7절).

## AI가 절대 못 하는 것 (SECURITY tier — 사람만)
- production secret / OAuth client secret / prod DB schema 읽기·수정.
- 배포 워크플로 변경 후 즉시 배포.
- 외부 채널(유튜브·인스타·커뮤니티) 자동 게시 — 초안만, 발행은 사람.

## 코드로 강제되는 경계
- **secret-scan(gitleaks)**: 매 PR. 키/토큰 커밋 차단.
- **CODEOWNERS**: base path·워크플로·거버넌스 파일은 사람 승인 필수(branch protection 켜야 실제 강제, R7).
- **.gitignore**: `.env`·빌드 산출물 커밋 방지.
- **base-path-guard**: `/homebom/` 변경 차단(배포 URL 보호).

## 의심되면
- 실행하지 말고 사람에게 묻는다. "열심히 잘못 달리는 것"이 가장 위험하다(CLAUDE.md 안전선).
