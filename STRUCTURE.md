# 로봄 저장소 구조

```text
robom/
  site/                  # robom.kr 통합 홈페이지
  ops/                   # 포트폴리오 운영 장부
    registry/apps.yml    # 앱 목록 단일 소스
    state/               # 본사와 앱별 현재 상태
    changelog/           # 본사 관점 앱별 운영 이력
    scorecards/          # 우선순위와 운영 평가
    playbooks/           # 반복 운영 절차
  .claude/agents/        # 운영 역할 정의
  .github/workflows/     # 본사 CI와 수동 운영 워크플로
  VERSION                # 본사 시스템 버전 단일 소스
  CHANGELOG.md           # 본사 운영 변경 이력
```

앱 소스는 각각 `robom-labs/outbom`, `robom-labs/homebom`, `robom-labs/runningbom`에만 존재합니다.

앱을 추가할 때는 원본 저장소를 만든 뒤 `ops/registry/apps.yml`, `ops/state/<id>.md`, `ops/changelog/<id>.md`만 추가합니다.
