# 신규 앱 온보딩

## 편입 전 확인

- 실제 원본 저장소와 책임자가 있는지 확인합니다.
- 스택, 테스트, 빌드, 배포 명령과 사용자 URL을 확인합니다.
- 비밀키, 운영 DB, OAuth, 결제와 배포 권한 경계를 기록합니다.
- 기존 사용자 URL이나 저장 키가 있으면 호환 계획을 먼저 세웁니다.

## 편입 절차

1. `robom-labs/<id>` 독립 저장소를 준비합니다.
2. `ops/registry/apps.yml`에 저장소, 검증 명령, 배포 URL을 등록합니다.
3. `ops/state/<id>.md`와 `ops/changelog/<id>.md`를 추가합니다.
4. 해당 앱 저장소에 자체 CI와 CODEOWNERS를 설정합니다.
5. `robom/site`에 앱 소개와 실제 동작 URL을 연결합니다.

앱 소스 사본, subtree, submodule은 `robom` 저장소에 추가하지 않습니다.
