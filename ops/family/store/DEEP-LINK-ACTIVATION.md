# App Links·Universal Links 활성화

서명 정보가 없는 현재 운영 파일은 빈 배열이며 가짜 fingerprint나 Team ID를 게시하지 않습니다.

## Android

1. Play Console에서 각 앱의 실제 Play signing SHA-256 fingerprint를 확인합니다.
2. `/.well-known/assetlinks.json`에 registry의 `kr.robom.<app>` package와 해당 fingerprint를 넣습니다.
3. HTTPS 200, redirect 없음, `application/json` 응답을 확인합니다.
4. Android의 App Links 검증 명령으로 다섯 package를 각각 확인합니다.

## iOS

1. Apple Developer에서 Team ID와 다섯 Bundle ID를 확정합니다.
2. `apple-app-site-association`의 `appIDs`와 `/get/<app>/*` components를 생성합니다.
3. 확장자 없이 HTTPS 200, redirect 없음, JSON 응답을 확인합니다.
4. Associated Domains entitlement의 `applinks:robom.kr`을 다섯 앱에서 검증합니다.
