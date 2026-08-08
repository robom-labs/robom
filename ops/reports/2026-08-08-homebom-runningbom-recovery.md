# 청약봄·러닝봄 데이터 복구와 비공개 테스트 업데이트

최종 검증 시각은 2026-08-08 22:54 KST다.

## 결과

| 제품 | 운영 버전 | 앱 소스 SHA | 최신 main | Android | 결과 |
| --- | --- | --- | --- | --- | --- |
| 청약봄 | 0.17.1 | `599180c6d51fda5086a23d6845c02c8b8353fc15` | `04884ce4ed3d11bdc05b579a383eadbf8d5eff85` | versionCode 24 | 코드·운영 웹·운영 데이터·최종 AAB·권한 최소화 PASS, Play 제출 BLOCKED_EXTERNAL |
| 러닝봄 | 0.21.0 | `86e1682468d8d0979d95943c957148d2c76cbc29` | `9aac3826fba02a53c7d5b08b318ae5cc288cb2ca` | versionCode 15 | 코드·운영 웹·대회 단일화·최종 AAB PASS, Play 제출 BLOCKED_EXTERNAL |

두 앱 최신 main에는 앱·AAB 소스 커밋 뒤의 운영 메타데이터와 Node 24 기반 CI 유지보수 커밋이 포함된다. 최종 AAB는 표의 앱 소스 SHA에서 생성됐고 EAS 빌드 메타데이터로 이를 별도 검증했다.

## 청약봄

- 청약홈 공식 상세 API의 아파트 일반공급, 무순위·잔여세대, 임의공급, 공공지원 민간임대, 오피스텔·도시형생활주택을 모두 수집한다.
- 운영 API는 활성 공고 25건과 `x-verified-at` 2026-08-08 21:05 KST를 제공한다. 25건의 ID는 모두 고유하고 2026-08-18 접수 시작 공고까지 포함한다.
- 가격·면적·청약통장·선정 방식·입주 예정·정정 여부·검증 시각을 공식 데이터 우선으로 표시하고 빠른 판단 타일과 일정 밀도 캘린더를 추가했다.
- 매시 5분 수집, 매시 35분·50분 독립 watchdog, 75분 stale 자가복구, 이상 응답·0건·대량 삭제 차단과 마지막 정상본 보존을 유지한다.
- 최종 EAS build `d43fa504-ec14-47b3-9e8f-f19042b50748`의 AAB SHA-256은 `24114174fa420e77b9856a22bdc88b0415d2c137634e464b2ecb560ad91257f5`다.
- bundletool 1.18.3 검증 결과 패키지는 `kr.robom.homebom`, 버전은 0.17.1(24), minSdk는 24, targetSdk는 36이다.
- 최종 병합 매니페스트에서 카메라·마이크·다른 앱 위 표시·구형 외부 저장소 권한이 모두 제거됐다. 이를 정적 검사로 고정해 이후 빌드의 재유입도 차단한다.
- 업로드 인증서 SHA-256은 `92:DD:3B:65:0E:9A:64:53:70:89:59:41:47:14:5C:4C:D6:EE:47:EF:82:B5:17:CF:DA:D3:F5:1D:56:D8:2F:40`이다.

## 러닝봄

- 데이터 리비전 `2026.08.08-race-data-34`에서 고유 대회 212건을 제공한다. 175개 대회가 여러 종목을 포함하지만 대회·카드·달력 날짜 수는 종목 수 때문에 늘어나지 않는다.
- 같은 대회의 5K·10K·하프·풀은 이름·대회일·지역·회차 기준 한 카드 안에 합치고 종목별 접수 정보는 카드 내부에 보존한다.
- 실제 월별 7열 캘린더, 한국시간 접수 마감 카운트다운, 마감 임박 바로가기와 48px 터치 셀을 추가했다.
- 6시간 수집, watchdog, 스키마 오류·0건·대량 삭제 차단, 마지막 정상본과 중복 잠금을 유지한다.
- 최종 EAS build `0cc5c452-54bc-492c-a983-19639df72127`의 AAB SHA-256은 `4cf319b97ea19b9bdf320974bdaa3496d5ccc5282ca0492a45ba9c6d7445e703`이다.
- bundletool 1.18.3 검증 결과 패키지는 `kr.robom.runningbom`, 버전은 0.21.0(15), minSdk는 24, targetSdk는 36이다.
- 업로드 인증서 SHA-256은 `68:F9:6A:DF:AB:A0:47:8A:53:F9:F7:70:2C:69:CA:43:EC:2E:59:91:0B:9C:06:0F:FB:72:70:82:62:28:F7:46`이다.
- 정식 앱과 별개인 Preview 0.21.0(67)은 GitHub Actions `31259700180`에서 기존 EAS Preview 서명·패키지·APK 무결성을 통과했고, 후속 Pages `31260542895`가 업데이트 매니페스트를 운영 배포했다.

## 검증

- 청약봄은 core 96, native 41, web 43, node 10, E2E 10, service worker 2 테스트와 typecheck·family drift 0·웹 빌드·Android/iOS export를 통과했다.
- 러닝봄은 root 94, mobile 1,192 테스트와 type/config/static/build/native export·production watchdog을 통과했다.
- 로봄 본사는 node 46, rendered HTML 11, Chromium 9개 viewport, WebKit 9개 viewport를 통과했다. 모든 E2E에서 overflow 0, 48px 이상 터치, console error 0을 확인했다.
- 청약봄 최신 CI `31259700256`과 Pages `31259700027`, 러닝봄 CI `31259700193`·Family `31259700404`·Preview APK `31259700180`·후속 Pages `31260542895`, 본사 상태 정본 Guardrails `31260690207`과 Pages `31260690183`이 통과했다. 공식 JavaScript Action은 Node 24 기반 최신 major의 immutable SHA로 고정했고 해당 실행 로그에 Node 20 폐기 경고가 없다.
- 청약봄 Production은 build SHA `04884ce4ed3d11bdc05b579a383eadbf8d5eff85`와 cache `zzc-v0.17.1`을 제공한다.
- 러닝봄 Production은 버전 0.21.0과 cache `pushrun-v0.21.0`을 제공한다.
- 러닝봄 Preview 운영 매니페스트는 0.21.0(67)과 분리 패키지 `kr.robom.runningbom.preview`를 제공한다.

## Play 제출 상태

- 두 최종 AAB는 생성·다운로드·해시·서명·패키지·버전·SDK·권한 검증을 마쳤다.
- EAS 프로젝트에는 Google Play Service Account가 연결되지 않았고 현재 실행 세션에는 사용자 Play Console을 제어하는 브라우저 도구가 없다.
- 따라서 Google Play에는 이번 최종 AAB가 올라가지 않았으며 기존 비공개 테스트 트랙과 테스터 상태는 변경하지 않았다.
- 다음 실행은 EAS에 최소 권한 Google Play Service Account를 한 번 연결한 뒤 같은 파일을 Alpha 트랙에 제출하는 것이다.

## 외장하드 정본

- 소스 미러는 `/Volumes/MANGO_LIBRARY/03_PROJECT_DATA/ROBOM/homebom`, `/Volumes/MANGO_LIBRARY/03_PROJECT_DATA/ROBOM/runningbom`, `/Volumes/MANGO_LIBRARY/03_PROJECT_DATA/ROBOM/robom`에 보존한다.
- 최종 AAB는 `/Volumes/MANGO_LIBRARY/03_PROJECT_DATA/ROBOM/releases/2026-08-08-homebom-runningbom`에 보존한다.
- 이전 AAB는 감사 이력으로 남기고 0.17.1(24)와 0.21.0(15)을 다음 Play 제출 대상으로 명확히 구분한다.

## 롤백

- 청약봄 CI 유지보수만 되돌릴 때는 `git revert 04884ce4ed3d11bdc05b579a383eadbf8d5eff85`를 사용한다. 기능까지 되돌릴 때는 이어서 `git revert 599180c6d51fda5086a23d6845c02c8b8353fc15 eea9a498bba77ea3e941055d1a95b65bc59229ad`를 수행한 뒤 테스트와 Pages를 재배포한다.
- 러닝봄 Preview 매니페스트만 되돌릴 때는 `git revert 9aac3826fba02a53c7d5b08b318ae5cc288cb2ca`를 사용한다. CI 유지보수는 `git revert 0b48526191c0e29ba2d650bfd8bc5ba0cb969713`, 기능까지 되돌릴 때는 이어서 `git revert 34053e555001abdb08797214a033f23579e16eb0 86e1682468d8d0979d95943c957148d2c76cbc29`를 수행한 뒤 테스트와 Pages를 재배포한다.
- 데이터 장애 시 두 앱 모두 마지막 정상본을 계속 제공하고, 새 Play 제출 전이므로 이번 작업으로 Google Play에서 되돌릴 출시는 없다.
