# 캘린더봄 (calendarbom)

큰 달력에서 날짜를 누르고, 버튼 몇 번으로 일정과 알람을 저장하는 **우리 가족 달력** PWA.
로봄(robom) 패밀리의 네 번째 앱입니다.

- 운영 주소: https://robom-labs.github.io/calendarbom/
- 현재 버전: **v0.1.0** (`app/sw.js` 의 `calendarbom-v0.1.0` 과 일치)

## 누구를 위한 앱인가

부모님 세대(고령 사용자)가 **키보드 없이** 쓸 수 있는 달력·알람 앱.

- 첫 화면 = 큰 월간 달력. 날짜를 누르면 바로 일정 추가 시트가 열립니다.
- 일정 내용은 준비된 큰 버튼(병원·약 먹기·가족 모임…)으로 고릅니다. 직접 입력은 선택 사항.
- 시간도 오전/오후 → 시 → 분 큰 버튼으로 고릅니다. 최대 4번의 터치로 저장까지 끝.
- 저장하면 "7월 20일 월요일 오후 3시, '병원 예약' 알람을 저장했어요."처럼 말로 확인해 줍니다.
- 알림 탭은 다가오는 일정을 D-day와 함께 시각순으로 보여줍니다.
- 설정에서 글자 크기(보통/크게/아주 크게), JSON/ICS 보관·이동을 지원합니다.

## 정직한 알람 정책

웹 앱은 서버 푸시 없이 **페이지가 열려 있을 때만** 알람을 울릴 수 있습니다.
이 한계를 설정 화면에 그대로 안내하고, 홈 화면 추가(안드로이드/아이폰)를 권장합니다.
백그라운드에서도 울리는 진짜 알람은 안드로이드 네이티브 버전에서 제공합니다 — `docs/ROADMAP-ANDROID.md` 참고.

## 구조

```
app/                    # 배포되는 정적 PWA 전체
  index.html            # 단일 화면(달력/알림/설정 뷰 전환)
  styles.css            # 로봄 패밀리 정본 UI + 라벤더 팔레트
  app.js                # 상태·렌더·알람 엔진 (localStorage 저장)
  calendar-core.js      # 순수 달력 계산 (요일·grid·자연어 문장)
  alarm-core.js         # 순수 알람 계산 (발화 시각·D-day·확인 문장)
  ics-core.js           # ICS 내보내기·가져오기
  sw.js                 # 네트워크 우선 캐시 + 알림 클릭
scripts/                # 테스트·검증·아이콘 생성·로컬 서버
```

데이터는 이 기기의 `localStorage` 에만 저장합니다(`calendarbom:events:v1`). 서버 전송 없음.

## 개발

```bash
npm test          # 코어 테스트 19개 + 정적 자산 검증
npm run serve     # http://localhost:4177/
npm run icons     # icon-v2.svg → PNG 재생성 (Playwright 필요)
```

배포 파일을 바꾸면 `index.html`·`sw.js` 의 `?v=` 캐시버스트와
`sw.js` 의 `CACHE_NAME`(package.json 버전과 동일)을 함께 올립니다 — `npm test` 가 강제합니다.

## 로봄 패밀리

| 앱 | 역할 | 주소 |
| --- | --- | --- |
| 야외봄 | 나가기 좋은 시간 | https://robom-labs.github.io/outbom/ |
| 청약봄 | 청약 접수 일정 | https://robom-labs.github.io/homebom/ |
| 러닝봄 | 대회 접수 알림 | https://robom-labs.github.io/runningbom/ |
| **캘린더봄** | **가족 달력·알람** | https://robom-labs.github.io/calendarbom/ |

본사: https://robom.kr
