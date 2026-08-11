# state: outbom (야외봄)

## 현재 상태

- 웹·PWA 운영 버전: 0.25.6.
- Android 코드·서명 후보: 0.30.0 (versionCode 130).
- Google Play 운영 버전: 0.29.0 (versionCode 12).
- 기존 이름: 러닝콜.
- 역할: 걷기·산책·러닝·등산·자전거의 야외활동 컨디션과 추천 시간 제공.
- 목표 저장소: `robom-labs/outbom`.
- 공식 배포: https://robom-labs.github.io/outbom/.
- API·기존 PWA 호환 배포: https://outbom.robom.kr.
- 호환 배포: https://runningcall.vercel.app.
- 운영 main: `1445e0f91831c1d813fecd71e297d04f7bb85ae5`.
- PWA 캐시: `outbom-v0.25.6`.
- Google Play 프로덕션: versionCode 12, `0.29.0`, 대한민국 공개·설치 가능 상태(2026-08-11 확인).
- Google Play 배포 소스: `1c7dff3c036a292a31c39807b548a0f809dda13c`.
- 0.30.0 서명 AAB: `versionCode 130`, R8·리소스 축소·16KB 페이지 정렬·4 ABI·대화면 기본 방향을 검증했고 Google Play 프로덕션 전체 출시로 제출되어 검토 중이다(2026-08-11 23:40 KST 확인).

## Next

- [x] 패밀리 디자인과 대표 아이콘을 운영 배포했다.
- [x] 야외봄 브랜딩 PR을 merge했다.
- [x] 저장소 이전 뒤 Vercel 운영 주소와 CI 응답을 확인했다.
- [x] Vercel의 main 연동과 운영 배포 성공을 확인했다.
- [x] 위험 예보를 추천에서 제외하고 활동별 필수 준비물·강수 시간대·공유 체크 상태를 운영 반영했다.
- [x] 6시간 동일 좌표 예보 백업, 키보드·포커스 접근성, 모바일 준비물 창과 서비스워커 갱신 흐름을 운영 반영했다.
- [x] GitHub Pages `/outbom/`을 공식 운영 화면으로 배포하고 `outbom.robom.kr`은 API·기존 PWA 호환 주소로 유지한다.
- [x] TimeReel·가챠·큰 회전 로딩과 준비물 모달을 제거하고 필수·날씨·안전·선택 준비물을 준비 탭에 바로 표시한다.
- [x] 패밀리 1.0 셸·설정·5앱 목록·guest-first 상태와 Android·iPhone 네이티브 기반을 0.25.1에 배포했다.
- [x] 변형·중첩형 주소·정밀위치 키까지 차단하는 분석 scrubber와 모바일 대비를 release gate로 검증했다.
- [x] 위치 검색·현재 위치·집·회사·즐겨찾기·최근 위치와 활동·시간·날씨별 준비물, 추천 시간·대안 시간, 여섯 날씨 지표 상세 보기를 0.30.0에 반영했다.
- [x] 320·390 휴대전화, 600·840 대화면 분기, 1024 태블릿, 200% 글자 크기 회귀검사와 Android 16 대화면·R8 권장 조치를 코드와 서명 AAB에서 검증했다.
- [x] 0.30.0 (`versionCode 130`) 프로덕션 전체 출시 제출과 Google Play 검토 중 상태를 게시 개요에서 확인했다.
