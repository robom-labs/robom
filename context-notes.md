# 로봄 웹 허브 컨텍스트

## 제품 구조

- 로봄은 세 알림 앱의 소비자용 공용 입구다.
- 현재 실서비스는 러닝콜, 줍줍콜, PushRun이며 모두 공개 URL 응답 200을 확인했다.
- Holdings 저장소는 운영·검증용 control plane이므로, 웹 허브 프로젝트는 `/Users/runner706/Developer/robom-site`로 분리했다.

## 브랜드 표현 원칙

- 로봄의 핵심 문장은 `중요한 순간을 먼저 봅니다.`다.
- 세 앱은 정보 포털이 아니라 각자 `행동해야 할 타이밍`을 알려주는 서비스로 설명한다.
- 상표 등록 여부가 확정되지 않았으므로 등록·출원 상태를 사이트에 단정해서 표기하지 않는다.

## 현재 직접 연결 URL

- 러닝콜: https://runningcall.vercel.app
- 줍줍콜: https://runnerpyrri-lgtm.github.io/zoopzoopcall/
- PushRun: https://runnerpyrri-lgtm.github.io/pushrun/

## 출시 전 위험

- PushRun의 원본 대회 데이터에는 외부 `http://` 링크가 남아 있다. 로봄 허브는 해당 앱의 입구까지만 HTTPS로 연결하고 외부 대회 링크를 직접 중계하지 않는다.
- 도메인 구매, DNS 변경, 결제, 상표 출원은 회장 계정의 승인·결제가 필요한 외부 상태 변경이다.
