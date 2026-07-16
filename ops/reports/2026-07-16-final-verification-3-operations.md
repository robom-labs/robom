# 2026-07-16 최종 감사 3 — 배포·운영·복구·성장체계

## 운영 배포

| 제품 | 운영 URL | 버전·cache | 운영 식별 | release evidence | 상태 |
|---|---|---|---|---|---|
| robom.kr | https://robom.kr | 2.1.2 · `robom-site-v2.1.2` | 운영 build marker를 audited main과 대조 | Sites production·GitHub Pages | PASS |
| 야외봄 | https://robom-labs.github.io/outbom/ | 0.25.1 · `outbom-v0.25.1` | `0addaa7` | CI `29470524005`, Pages `29470523936` | PASS |
| 청약봄 | https://robom-labs.github.io/homebom/ | 0.14.1 · `zzc-v0.14.1` | `40151b5` | CI `29470478807`, Pages `29470478355` | PASS |
| 러닝봄 | https://robom-labs.github.io/runningbom/ · https://runningbom.vercel.app | 0.17.2 · `pushrun-v0.17.2` | 양쪽 `94667c2` | Family `29471774936`, Pages `29471774773`, Vercel `dpl_ARJt647BMB4swPzkZTY1byZ6yHwh` | PASS |
| 캘린더봄 | https://robom-labs.github.io/calendarbom/ | 0.5.1 · `calendarbom-pwa-v0.5.1` | `997f13e` | release `29470479461` | PASS |
| 자격증봄 | https://certbom.vercel.app | 0.6.0 · `certbom-0.6.0` | `69478f8` | CI `29467843024` | PASS |

모든 운영 URL, manifest, service worker와 최신 app/build marker는 HTTP 200으로 확인했다. 중앙 Pages의 기존 `/robom/calendarbom/`은 localStorage를 읽거나 지우지 않는 독립 주소 안내와 구형 자기 cache 정리를 제공한다.

감사 문서와 상태 정본을 반영하는 documentation-only successor는 앱 소스 변화 없이 Pages와 Sites로 승격하며, 최종 handoff에서 실제 main SHA와 배포 ID를 기록한다.

## 설치·PWA·store 분기

- 운영 QR PNG 5개를 다시 내려받아 512×512 decoder로 읽었고 모두 `https://robom.kr/get/<app>`과 정확히 일치했다.
- Chromium·WebKit 운영 E2E에서 PC QR, Android PWA CTA, iPhone Safari 홈 화면 추가 fallback, 웹 계속 사용을 검증했다.
- 여섯 표면의 실제 구형 cache 이름을 fresh profile에 1회 seed한 뒤 현재 worker 활성화를 수행했고, 구형 cache 삭제와 현재 cache 보존이 모두 통과했다.
- Play·App Store가 planned인 동안 가짜 URL이나 비활성 배지를 표시하지 않는다. 실제 listing이 없으므로 공식 배지 노출은 NOT_APPLICABLE이다.
- `assetlinks.json`과 AASA는 HTTP 200 안전 템플릿이며 signing 정보가 없어 빈 association을 유지한다.

## 성장·개인정보

| 검사 | 결과 | 상태 |
|---|---|---|
| 공통 이벤트·funnel·activation 계약 | 중앙 YAML과 앱별 adapter 생성물 | PASS |
| 금지 PII | private aggregate validation에서 raw PII 0 | PASS |
| consent·provider 없음 | 이벤트 네트워크 0 | PASS |
| private 저장소 | `robom-labs/robom-growth` visibility PRIVATE | PASS |
| 주간·월간 generator | 최소 cohort 30, synthetic sample deterministic 생성 | PASS |
| 실제 주간·월간 보고 | 비공개 집계 endpoint와 read-only token 필요 | BLOCKED_EXTERNAL |

합성 sample은 배관 검증용이며 실제 성장 성과로 보고하지 않는다.

## 보안·CI

- 중앙과 다섯 앱의 production dependency audit는 high/critical 0이다. 중앙 PostCSS와 Expo 계열 uuid의 moderate advisory는 확인했으며 현재 실행 경로·상위 패키지 고정 때문에 강제 breaking upgrade를 하지 않았다.
- 중앙 Gitleaks run과 각 release gate가 성공했다. reusable family workflow는 `@main`이 아니라 검증된 full commit SHA에 고정되어 있다.
- workflow는 기본 `contents: read`와 배포 job의 Pages·contents write만 사용한다. private growth workflow도 `contents: read`이고 secret이 없으면 가짜 보고서를 만들지 않는다.
- central family source나 GitHub raw가 장애여도 앱은 lock된 로컬 생성물로 독립 실행·빌드한다.

## 복구

- 러닝봄 final 두 commit을 임시 clone에서 `git revert --no-commit 94667c2 8af63ff`로 되돌리는 staging drill과 `git diff --cached --check`가 통과했다. 원본 저장소와 운영 환경은 건드리지 않았다.
- 앱별 Git revert 후 기존 release workflow가 독립 재배포하며, 중앙 family는 current와 current-1을 지원해 전 앱 동시 rollback을 요구하지 않는다.
- Sites는 저장된 v28과 v29를 유지하고 Vercel은 이전 production deployment를 유지한다. 운영 rollback은 장애 때 해당 버전만 다시 promote한다.

## 외부 차단

| 항목 | 이유 | 상태 |
|---|---|---|
| Google Play 5개·App Store 5개 제출 | 계약·signing·listing·review가 계정 소유자 단계 | BLOCKED_EXTERNAL |
| OAuth 실제 연결 | Kakao·Google·Apple credential과 redirect 등록 필요 | BLOCKED_EXTERNAL |
| analytics 실제 report | 비공개 집계 endpoint credential 필요 | BLOCKED_EXTERNAL |
| HomeBom·RunningBom 구 개인 Pages redirect | 이전 개인 계정 주소에 배포 가능한 별도 repo/alias 필요 | BLOCKED_EXTERNAL |
