# state: runningbom (러닝봄)

## 현재 상태

- 운영 웹·PWA 버전: 0.19.3.
- 기존 이름: PushRun.
- 역할: 러닝 대회 탐색, 접수 시작과 대회일 알림 제공.
- 목표 저장소: `robom-labs/runningbom`.
- 현재 배포: https://robom-labs.github.io/runningbom/.
- 보조 배포: https://runningbom.vercel.app/.
- 기존 배포: https://runnerpyrri-lgtm.github.io/pushrun/.
- 운영 main: `ab8d458fbac90d9917bdfd02e026543d3cddc3ac`.
- 운영 앱 소스 SHA: `da648cae6e0ec8b7fb998fbb2269e563df237310`.
- PWA 캐시: `pushrun-v0.19.3`.
- 데이터 리비전: `2026.08.08-race-data-34`, 전체 212개 대회, 마지막 대회일 2027-04-18.
- Google Play Alpha: 기존 비공개 테스트와 테스터는 보존했다.
- Android 후보: versionCode 13, `0.19.3`, EAS build `51695246-f022-48bb-a493-f0ddf67a2495`, AAB SHA-256 `add709437ef030a39c87b06243f0e47db7a1599713950434f64debe331b3aaea`.
- 릴리스 단계: `CLOSED_PUBLISH` 승인을 통과했지만 EAS의 Google Service Account 미연결로 Play 업로드 전에 중단됐다.

## Next

- [x] 212개 대회의 기간·상태·접수 링크를 검증하고 반복 동기화가 데이터 리비전을 불필요하게 올리지 않도록 수정했다.
- [x] 대회군 기준 관심 상태, 구버전 저장값 마이그레이션, 손상 저장값 정리와 원격 일정 변경 알림 재조정을 반영했다.
- [x] 같은 대회의 5K·10K·하프·풀 행을 대회 카드 한 개로 합치고, 종목·종목별 접수창은 그 카드 안에 보존하는 불변조건을 수집·웹·네이티브·릴리스 게이트에 적용했다.
- [x] 운영 데이터 212건이 고유 대회 212개, 표시 카드 212개이며 종목 때문에 늘어난 중복 카드가 0개인지 두 운영 주소에서 확인했다.
- [x] Android 0.19.3(13) AAB의 패키지·버전·업로드 인증서·해시와 EAS 소스 SHA를 검증했다.
- [x] fail-closed 릴리스 가드의 Alpha 제출 dry-run과 공식 bundletool 검증을 GitHub Actions 실행 `31250602238`에서 통과했다.
- [ ] Google Play Console에서 AAB를 직접 업로드하거나 EAS Google Service Account를 연결한 뒤 기존 Alpha 트랙에 0.19.3(13)을 제출한다.
- [x] 패밀리 디자인과 대표 아이콘을 운영 배포했다.
- [x] 러닝봄 브랜딩 PR을 merge했다.
- [x] 저장소 이전 후 Pages 배포와 HTTP 200 응답을 확인했다.
- [x] 검색·필터를 캘린더 위로 올리고 카드 일정 우선순위와 모바일 거리 필터를 운영 반영했다.
- [x] 검색 우선 홈, 간결한 일정 카드, 공식 접수·알림 분리와 기존 PWA 캐시 갱신을 운영 반영했다.
- [x] 기존 커스텀 `봄` 트레이드마크를 복원하고 중복 테마 토큰을 단일 밝은 팔레트로 통합했다.
- [x] 접수 중 우선 화면, 마감 임박 바로가기, 의미가 포함된 카운트다운과 단일 공식 접수처 CTA를 운영 반영했다.
- [x] Vercel 보조 배포 프로젝트와 production alias의 HTTP 200 응답을 확인했다.
- [x] 패밀리 공통 하단 내비게이션과 설정 정보 구조를 반영하고 0.12.0의 접수 행동 교정이 유지되는지 재검증했다.
- [x] Vercel 보조 배포의 오래된 0.17.2·100건 미러를 제거하고 0.19.3·212건·운영 앱 SHA `da648ca`·HTTP 200으로 동기화했다.
- [x] 패밀리 1.0 셸·5앱 설정·모바일 대비·CLS 안정화와 Android·iPhone 알림 기반을 0.17.2에 배포했다.
- [x] vNext 1차에서 5탭·로컬 코칭·스트릭·배지·러닝화·보호된 소셜 기반과 Release Guard를 구현하고 웹 0.19.0을 운영 배포했다.
- [x] Android 0.19.0(versionCode 7) production 후보 AAB와 분리 설치 Preview APK를 서명·권한·16KB·bundletool 기준으로 검증했다.
- [ ] 0.19.3 Android 후보의 삼성·Pixel 실기기 장시간 코칭·전화·Bluetooth·절전·업데이트 설치 검증은 실제 기기가 연결될 때 수행한다.
- [ ] Play Alpha의 기존 활성 0.17.13(2)에서 0.19.3(13)으로 올리고 Google 처리 상태와 테스터 설치 업데이트를 확인한다.
- [ ] GitHub 계정 이전으로 404가 된 기존 개인 계정 Pages 주소는 해당 계정의 별도 redirect 저장소를 만들 수 있을 때 안내 페이지로 전환한다.
