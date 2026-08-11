# Google Play 공개본 3면 동기화

Google Play 공개본, GitHub 원본, 외장하드 복구본을 한 출시 단위로 맞추는 절차다. `업데이트해줘`라는 실행 요청을 받은 01~03 총괄팀은 앱 코드 반영만으로 완료 처리하지 않고 이 절차를 끝까지 수행한다.

## 세 표면의 의미

1. Google Play는 일반 사용자가 설치·업데이트할 수 있는 실제 공개 버전이다.
2. GitHub는 공개 AAB를 만든 `productSourceSha`가 대상 저장소 `main`에 포함된 상태다. 다음 버전 개발 때문에 `main`이 앞설 수 있으므로 공개 커밋과 `main` HEAD가 항상 같을 필요는 없다.
3. 외장하드는 최신 `main` 복제본과 공개 버전별 불변 복구 묶음을 함께 가진다.

## 기본 외장하드 경로

- 1차: `/Volumes/One Touch/ROBOM`
- 2차 미러: `/Volumes/MANGO_LIBRARY/03_PROJECT_DATA/ROBOM`
- 앱 복제본: `<root>/<app-id>`
- 공개본 묶음: `<root>/releases/<app-id>/<version>-v<versionCode>`

외장하드가 연결되지 않았으면 `BLOCKED_EXTERNAL_DRIVE`다. 연결되지 않은 상태에서 동기화 완료라고 보고하지 않는다.

## 출시 순서

1. 대상 앱 저장소의 최신 `main`, 기존 Play 최고 versionCode, 서명 체계를 확인한다.
2. 변경·검증 후 제품 소스를 `main`에 반영한다.
3. 더 높은 versionCode의 production AAB를 만들고 업로드 전에 AAB 파일과 SHA-256을 안전하게 보존한다.
4. Play Console에 AAB를 올려 심사·게시하고 일반 사용자 Store에서 새 버전 설치·업데이트 가능 상태를 확인한다.
5. `ops/registry/apps.yml`의 version, Store 상태·URL, `last_deployed_sha`, 확인 시각을 실제 공개 상태로 갱신한다.
6. 외장하드 앱 복제본을 `origin/main`으로 fast-forward한다. 강제 reset과 사용자 변경 삭제는 금지한다.
7. 공개 제품 커밋의 source archive, 현재 main Git bundle, AAB, `RELEASE-MANIFEST.json`, `SHA256SUMS`를 공개본 묶음에 저장한다.
8. 1차와 2차 미러에서 아래 검사기를 각각 통과시킨다.

```bash
node ops/scripts/verify-play-release-sync.mjs \
  --manifest "/Volumes/One Touch/ROBOM/releases/<app-id>/<version>-v<versionCode>/RELEASE-MANIFEST.json" \
  --repo "/Volumes/One Touch/ROBOM/<app-id>"
```

## 완료 조건

- Store 공개 version·versionCode·package가 manifest와 같다.
- 공개 제품 커밋이 GitHub `main`의 조상이다.
- 공개 제품 커밋의 `apps/mobile/app.json`이 manifest와 같다.
- registry가 공개 version·package·Store URL·제품 SHA와 같다.
- 외장하드 복제본이 깨끗하고 `git fsck`를 통과한다.
- source archive, Git bundle, AAB와 체크섬이 모두 맞는다.
- 공개 AAB 원본을 플랫폼에서 회수할 수 없다면 다른 빌드로 대체하지 않는다. 기존 SHA-256과 정확한 소스만 기록하고 `artifact.availability`에 미보존 상태를 명시한다.

위 조건 중 하나라도 남으면 `업데이트 완료`가 아니다. 심사 중은 `REVIEWING`, Store 전파 중은 `PROPAGATING`, 외장하드 미연결은 `BLOCKED_EXTERNAL_DRIVE`로 보고한다.

## 금지 항목

- keystore, 비밀번호, 토큰, 서비스 계정을 외장하드 묶음이나 GitHub에 복사하지 않는다.
- Store에 공개되지 않은 후보 빌드를 공개본 폴더에 넣지 않는다.
- 새로 빌드한 AAB를 이미 공개된 AAB와 같은 파일이라고 기록하지 않는다.
- GitHub `main`의 후속 개발 커밋을 공개 Store 버전으로 잘못 기록하지 않는다.
