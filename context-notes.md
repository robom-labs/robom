# 출시 준비 컨텍스트 노트

- 서버 Web Push 없이 브라우저 종료 후 예약 알림을 보장할 수 없다. 이번 변경은 조용한 실패를 막고 동작 범위를 정직하게 표시한다.
- 실제 배포 소스는 세 앱 원본 저장소다. 원본 CI를 릴리스 게이트 정본으로 두고 holdings CI는 vendored 사본 스모크로만 사용한다.
- 앱 PR 머지 순서는 zoopzoopcall #8, runningcall #5, pushrun #4 이후 holdings PR이다.
- runningcall 텍스트 위치 검색은 Kakao 키가 없으면 오답 대신 503과 현재 위치 안내를 반환한다. Production 키 등록은 사람 작업이다.
- production secret, Supabase 배포, 실제 릴리스, branch protection은 이번 작업에서 변경하지 않는다.
