# state: calendarbom (캘린더봄)

## 현재 상태

- 버전: 0.4.0
- 상태: live (독립 저장소·독립 Pages)
- 소스: https://github.com/robom-labs/calendarbom
- 운영: https://robom-labs.github.io/calendarbom/
- 기존 주소: https://robom-labs.github.io/robom/calendarbom/ (same-origin 저장 데이터 보존 이전 화면)
- 역할: 큰 달력에서 적은 질문과 큰 버튼으로 병원·약·약속·기념일을 저장하는 local-first 가족 알람.

## 방금 한 일

- 2026-07-16: Git subtree로 전체 이력을 보존해 독립 저장소를 만들고 0.4.0을 main에 배포했습니다.
- 2026-07-16: 서비스워커가 `calendarbom-pwa-v*` 자기 캐시만 정리하도록 격리하고 Chromium·WebKit E2E를 release gate에 넣었습니다.
- 2026-07-16: 기존 localStorage 키를 유지하고 기존 주소는 데이터를 읽거나 삭제하지 않는 이전 화면으로 전환했습니다.

## 다음

- [ ] 70대 실제 사용자 과업 테스트.
- [ ] Android·iOS local notification 프로젝트의 서명·스토어 계정 연결.

## Blocked

- 스토어 계약·서명·최종 제출은 계정 소유자 작업입니다.
