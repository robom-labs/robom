# apps/ — 읽기 전용 미러 (배포 소스 아님)

이 폴더의 세 앱 사본은 **원본 저장소의 미러**다. 여기서 앱 코드를 고치면 안 된다.

| 앱 | 원본(배포 소스) | 배포 |
|---|---|---|
| zoopzoopcall | https://github.com/runnerpyrri-lgtm/zoopzoopcall | GitHub Pages |
| runningcall | https://github.com/runnerpyrri-lgtm/runningcall | Vercel |
| pushrun | https://github.com/runnerpyrri-lgtm/pushrun | GitHub Pages |

## 규칙 (D16)
1. **앱 코드 변경은 반드시 원본 저장소에 PR로.** 각 원본에는 `daily-self-improve.yml`
   자가개선 워크플로가 있다(하루 2회, draft PR → 회장 승인).
2. 이 사본의 역할은 두 가지뿐:
   - Holdings 보조 CI(스모크)의 검사 대상
   - `drift-check.yml` 이 원본과 대조하는 기준점
3. 원본에 새 버전이 머지되면 **동기화 PR**로 이 사본과 `ops/registry/apps.yml` 버전을 함께 올린다.
   드리프트는 `drift-check.yml` 이 매일 05:30 KST에 감시한다.
4. 여기 사본만 고치고 "고쳐졌다"고 기록하는 것 금지 — 배포에 닿지 않는 변경은 해결이 아니다.
