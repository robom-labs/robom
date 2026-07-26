# state: runningbom (러닝봄)

## 현재 상태

- 운영 웹·PWA 버전: 0.19.0.
- 기존 이름: PushRun.
- 역할: 러닝 대회 탐색, 접수 시작과 대회일 알림 제공.
- 목표 저장소: `robom-labs/runningbom`.
- 현재 배포: https://robom-labs.github.io/runningbom/.
- 보조 배포: https://runningbom.vercel.app/.
- 기존 배포: https://runnerpyrri-lgtm.github.io/pushrun/.
- 운영 main: `0f71ff5502965aba3e6f63c2e7e748fe3f5c5ecc`.
- PWA 캐시: `pushrun-v0.19.0`.
- Google Play Alpha: versionCode 6, `0.18.3`, 테스터 제공 상태.
- Android 코드 후보: versionCode 7, `0.19.0`, signed AAB 검증 완료·Play 미업로드.
- 릴리스 단계: `CODE_ONLY`. 기존 Alpha 트랙·테스터·프로덕션은 변경하지 않았다.

## Next

- [x] 패밀리 디자인과 대표 아이콘을 운영 배포했다.
- [x] 러닝봄 브랜딩 PR을 merge했다.
- [x] 저장소 이전 후 Pages 배포와 HTTP 200 응답을 확인했다.
- [x] 검색·필터를 캘린더 위로 올리고 카드 일정 우선순위와 모바일 거리 필터를 운영 반영했다.
- [x] 검색 우선 홈, 간결한 일정 카드, 공식 접수·알림 분리와 기존 PWA 캐시 갱신을 운영 반영했다.
- [x] 기존 커스텀 `봄` 트레이드마크를 복원하고 중복 테마 토큰을 단일 밝은 팔레트로 통합했다.
- [x] 접수 중 우선 화면, 마감 임박 바로가기, 의미가 포함된 카운트다운과 단일 공식 접수처 CTA를 운영 반영했다.
- [x] Vercel 보조 배포 프로젝트와 production alias의 HTTP 200 응답을 확인했다.
- [x] 패밀리 공통 하단 내비게이션과 설정 정보 구조를 반영하고 0.12.0의 접수 행동 교정이 유지되는지 재검증했다.
- [x] Vercel 보조 배포를 정적 미러로 재연결하고 0.17.2·동일 캐시·운영 SHA `94667c2`·HTTP 200을 확인했다.
- [x] 패밀리 1.0 셸·5앱 설정·모바일 대비·CLS 안정화와 Android·iPhone 알림 기반을 0.17.2에 배포했다.
- [x] vNext 1차에서 5탭·로컬 코칭·스트릭·배지·러닝화·보호된 소셜 기반과 Release Guard를 구현하고 웹 0.19.0을 운영 배포했다.
- [x] Android 0.19.0(versionCode 7) production 후보 AAB와 분리 설치 Preview APK를 서명·권한·16KB·bundletool 기준으로 검증했다.
- [ ] 0.19.0 Android 후보의 삼성·Pixel 실기기 장시간 코칭·전화·Bluetooth·절전·업데이트 설치 검증은 실제 기기가 연결될 때 수행한다.
- [ ] Play Alpha 0.18.3에서 0.19.0으로 올리는 작업은 별도 단계 명령 전까지 보류한다.
- [ ] GitHub 계정 이전으로 404가 된 기존 개인 계정 Pages 주소는 해당 계정의 별도 redirect 저장소를 만들 수 있을 때 안내 페이지로 전환한다.
