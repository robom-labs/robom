# 계정·동기화·네이티브 로드맵 (현재 BLOCKED 범위의 정직한 설계)

현재 캘린더봄은 **계정 없이** 동작하며, 가짜 로그인·가짜 동기화 UI를 두지 않는다.

## 현재 준비된 것 (코드·데이터 계약)

- 오프라인 우선 저장: v2 단일 문서(`calendarbom:data:v2`) — 그대로 서버 문서로 승격 가능.
- 안정적인 내부 ID: series/person/occurrence id 는 계정 연결 후에도 재사용한다(마이그레이션 불필요).
- 일정 한 건 공유 모델: ShareEnvelope = {title, date, time, place} 만 — 다른 일정·메모 절대 미포함(app.js shareText).
- JSON v2 내보내기 = 수동 백업이자 향후 서버 초기 업로드 포맷.

## 앱 등록 후 구현 계약 (사람 작업 선행)

| 단계 | 사람 작업 | AI 구현 |
|---|---|---|
| 1 | 카카오 developers 앱 등록, 키 발급 | auth adapter(kakao) + 로그인 없이 시작 유지 |
| 2 | Google Cloud OAuth 동의화면·클라이언트 | auth adapter(google) |
| 3 | Apple Developer 등록(유료)·Sign in with Apple | auth adapter(apple) |
| 4 | 백엔드 선택(Supabase 계열 예상)·과금 승인 | sync adapter: 오프라인 우선, updatedAt 기반 충돌 해결(늦은 쓰기 우선+로컬 보존) |
| 5 | 개인정보처리방침 갱신(사람 검토) | 계정 삭제 = 서버 문서·연결 토큰 즉시 삭제 + 로컬 유지 선택 |

원칙(v6 §8-2): 계정 연결≠공유. 가족과 연결돼도 일정은 자동 공개되지 않으며,
초대는 일정 한 건 단위, 수락해야 상대 달력에 들어가고, 개인 알람·메모는 각자 유지한다.
전체 캘린더 공유는 기본 기능으로 두지 않는다.

## 네이티브 알람 (ROADMAP-ANDROID.md 와 연결)

- Android: AlarmManager.setExactAndAllowWhileIdle + BOOT_COMPLETED 재등록 + 알림 채널.
- iOS: UNUserNotificationCenter 로컬 알림(64개 한도 → 가까운 발생 우선 등록).
- 웹 현재 한계는 앱 내 문구로 유지: "캘린더봄이 실행 중일 때 알림이 가장 정확해요."
