# v1.2.0 _ macOS·Windows 앱 패키징

## 산출물

- `ROBOM-HQ-<버전>-mac-arm64.dmg` (Apple Silicon) / `-x64.dmg` (인텔) / `-mac-arm64.zip`
- `ROBOM-HQ-Setup-<버전>-win-x64.exe` (NSIS 원클릭)
- 배포: GitHub Release `hq-v<버전>` 태그. 바이너리 저장소 커밋 금지.

## 번들 구성

```
ROBOM HQ.app
├─ Electron 셸 (desktop/main.cjs — 창·트레이·자동시작·단일 인스턴스)
├─ resources/payload/  ← 저장소 부분집합 미러(서버·화면·정본·오피스)
└─ 데이터는 번들 밖: ~/Library/Application Support/robom-hq/{runtime,snapshots}
```

payload는 `desktop/scripts/prepare-payload.mjs`가 생성(내부 데이터 절대 미포함, 방어적 제거 포함).
REPO_ROOT가 모듈 상대(../../..)라 payload 루트가 곧 저장소 루트로 동작한다.

## 빌드

- 로컬(맥): `cd desktop && npm install && npm run prepare-payload && npm run dist`
- CI: `.github/workflows/hq-desktop-release.yml` — `hq-v*` 태그 push → macos-latest·windows-latest에서 빌드 → Release 업로드. `CSC_IDENTITY_AUTO_DISCOVERY=false`로 서명 시도 차단(미서명 명시).

## 버전 규칙

`desktop/package.json` version = 태그 `hq-v<버전>` = Release 표기. 변경 시 항상 버전을 올린다.
