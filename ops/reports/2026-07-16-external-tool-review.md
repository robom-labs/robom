# 2026-07-16 외부 공식 문서·오픈소스 채택 검토

| 후보 | 확인 내용 | 결정 |
|---|---|---|
| `node-qrcode` | MIT, build-time SVG/PNG 생성 가능 | 홈페이지 dev dependency로만 채택 |
| `jsQR` + `pngjs` | QR PNG를 실제 decode해 목적지 검증 | CI/dev dependency로만 채택 |
| Playwright | Chromium·WebKit·모바일 viewport·PWA landing 검증 | 기존 앱과 홈페이지 E2E에 채택 |
| Style Dictionary | 다중 네이티브 산출물에 강점이 있으나 현재 토큰 규모에는 추가 runtime·설정 비용 | 단순 JSON generator 유지 |
| Storybook | 컴포넌트 카탈로그 이점보다 다섯 이기종 저장소 유지 비용이 큼 | 이번 범위 제외 |
| Changesets | 중앙 패키지를 npm으로 배포하지 않으므로 효용이 작음 | 이번 범위 제외 |
| Umami | 작은 웹 분석과 self-host 장점 | private endpoint 운영 주체 결정 전 보류 |
| PostHog JS | 풍부한 event·feature flag, SDK와 운영 범위가 큼 | provider-neutral adapter 뒤 후보로만 유지 |
| Sentry | 오류 진단에 유용하나 민감정보 scrub·DSN·정책 고지가 먼저 필요 | credential·법률 검토 전 보류 |
| OpenFeature | 여러 flag provider 교체에 유용 | 앱당 동시 실험 1개 수준에는 과도해 단순 adapter 유지 |
| Expo SDK 57 | 2026-06 공식 문서가 `default@sdk-57`을 안내하고 Router·Linking·Notifications가 현재 지원됨 | 독립 native scaffold 기준으로 채택 |

## 공식 플랫폼 근거

- reusable workflow는 `workflow_call`로 제공하고 각 앱은 `@main` 대신 검증된 commit SHA를 참조한다. [GitHub 공식 문서](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- QR에는 store URL 대신 `https://robom.kr/get/<app>`만 넣는다. Android App Links는 앱 manifest와 `assetlinks.json`의 양방향 검증이 필요하다. [Android App Links 공식 문서](https://developer.android.com/training/app-links/verify-applinks)
- iOS Universal Links는 AASA와 signing된 associated domain이 모두 필요하다. Team ID·서명이 없는 현재는 빈 안전 파일과 활성화 절차만 제공한다. [Apple associated domains 공식 문서](https://developer.apple.com/documentation/Xcode/supporting-associated-domains)
- Apple·Google store badge는 실제 listing이 live가 된 뒤 공식 아트워크·여백·문구를 변형하지 않고 사용한다. [Apple 마케팅 가이드](https://developer.apple.com/app-store/marketing/guidelines/), [Google Play 배지](https://play.google.com/intl/en_us/badges/)
- `beforeinstallprompt`는 지원 브라우저에서 사용자 행동 뒤 호출하고 iOS에는 수동 홈 화면 추가 fallback을 제공한다. [web.dev PWA 설치 문서](https://web.dev/learn/pwa/installation-prompt/)
- Expo SDK 57 native project는 custom scheme·app ID·Universal/App Links 기반을 두고, push는 개발 build가 필요한 제약을 문서화한다. [Expo 프로젝트 생성](https://docs.expo.dev/more/create-expo/), [Expo linking](https://docs.expo.dev/linking/overview/), [Expo notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)

스토어 계약·서명 credential이 없으므로 실제 signed binary와 제출은 `BLOCKED_EXTERNAL`이며, 이를 통과한 것처럼 기록하지 않는다.

## 공개 앱 패턴과 채택·제외 판단

| 공개 근거 | 관찰 | 로봄 판단 |
|---|---|---|
| [TimeTree App Store](https://apps.apple.com/us/app/timetree-shared-calendar/id952578473) | 공유 일정·알림·기기 달력·위젯의 가치를 첫 설명에서 명확히 제시하지만 앱 크기와 기능 범위가 크다. | 캘린더봄은 알림·기기 달력 가치는 채택하고, 70대 사용자의 적은 질문과 local-first를 지키기 위해 채팅·앨범·다중 생산성 기능은 제외했다. |
| [FamilyWall App Store](https://apps.apple.com/us/app/familywall-family-organizer/id496889629) | 가족 캘린더·목록·문서·위치를 한 앱에 모으지만 공개 리뷰에는 참여자 기본값 혼란과 위치 정확도 요구가 보이고, 스토어 개인정보 표시는 식별자 추적을 포함한다. | 패밀리 앱을 슈퍼앱으로 합치지 않고, 캘린더 민감정보의 기본 로컬 저장과 명시적 동의 원칙을 유지했다. |
| [Drops Rain Alarm](https://play.google.com/store/apps/details?id=org.yoki.android.drops) | 비가 시작·종료되는 시점을 두 시간 안에서 한눈에 답하는 단일 과제가 선명하다. | 야외봄 첫 판단에서 비를 별도 핵심 신호로 유지하고, 수치 나열보다 지금 출발·좋은 시간·준비물 행동으로 번역한다. |
| [Nike Run Club App Store](https://apps.apple.com/us/app/nike-run-club-running-coach/id387771637) | 달리기 시작과 기록, Watch·Health 연동 같은 네이티브 가치가 분명하지만 대형 종합 러닝 제품이다. | 러닝봄은 대회 검색·접수 시작이라는 고유 과제를 유지하고 로컬 알림·공식 deep link만 네이티브 첫 가치로 둔다. |

공개 앱의 화면·문구·자산은 복제하지 않았다. 공통으로 채택한 것은 첫 화면의 단일 행동, 권한 요청 전 가치 설명, 네이티브 기능의 명확한 이유뿐이다.
