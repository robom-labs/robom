# 캘린더봄 안드로이드 네이티브 로드맵 (2차 단계)

원 요구 문서의 안드로이드 전용 요구사항을 보존한다. 웹 PWA(1차)가 검증한 UX 를 그대로 옮긴다.

## 왜 네이티브가 필요한가

- **꺼져 있어도 울리는 알람**: `AlarmManager.setExactAndAllowWhileIdle` + `POST_NOTIFICATIONS`.
- **부팅 후 알람 재등록**: `BOOT_COMPLETED` 리시버.
- **잠금화면 전체 알람 화면**과 큰 글자 알림.

## 이관 계획

| 웹 (현재) | 안드로이드 |
| --- | --- |
| calendar-core.js (순수 계산) | Kotlin 순수 모듈로 포팅 (같은 테스트 케이스) |
| localStorage `calendarbom:events:v1` | Room DB — JSON 가져오기로 무마이그레이션 이전 |
| setTimeout 알람 엔진 | AlarmManager + Foreground 재등록 서비스 |
| JSON/ICS 내보내기 | 동일 포맷 유지 (왕복 호환) |
| 패밀리 UI (라벤더) | Compose 테마로 동일 토큰 적용 |

## 사람 확인이 필요한 것 (승인 경계)

- Google Play 개발자 계정(유료 등록) — 새 지출·법적 계약.
- 앱 서명 키 생성·보관 정책.
- 스토어 등록 정보(개인정보 URL 은 robom.kr/privacy/calendarbom 재사용 가능).
