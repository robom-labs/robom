# v1.2.0 _ 서명·공증 (현재: 미서명 — 정직 표기)

## 현재 상태

Apple Developer 계정·Developer ID 인증서·공증 자격정보가 등록되어 있지 않다.
따라서 **서명·공증을 하지 않았고, 했다고 표시하지 않는다.** 릴리스 노트에도 미서명 명시.

미서명 앱 실행(맥): 처음 1회 `ROBOM HQ.app` **우클릭 → 열기 → 열기**.
시스템 전체 보안 설정을 끄라는 안내는 하지 않는다.

## 자격정보가 준비되면 (사람 작업 → CEO INBOX)

1. Apple Developer Program 가입(유료 — C급 결재 대상).
2. Developer ID Application 인증서 발급 → GitHub Secrets 등록:
   `CSC_LINK`(p12 base64), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
3. 워크플로에서 `CSC_IDENTITY_AUTO_DISCOVERY=false` 제거 + electron-builder `notarize` 옵션 추가.
   → 같은 파이프라인이 서명·공증·staple까지 수행. 코드는 재사용, 자격정보만 추가.

## Windows

서명 인증서 없음 → SmartScreen "추가 정보 → 실행" 1회. EV 인증서 도입은 별도 C급 결정.
