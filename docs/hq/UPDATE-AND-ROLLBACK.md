# v1.2.0 _ 업데이트·롤백

## HQ 앱 업데이트 (현재: 원클릭 수동 — 자동 업데이트는 서명 후)

1. 새 버전 태그(`hq-v1.3.0` 등) push → CI가 Release 생성.
2. 사용자: Releases에서 새 dmg/exe 받아 덮어 설치. 데이터는 userData에 있어 보존됨.
3. 미서명 상태에서 자동 업데이트(무검증 다운로드 실행)는 **하지 않는다** — checksum·서명 검증 없는 자동 교체 금지 원칙. 서명 도입 후 electron-updater 검토.

## 롤백

- HQ 앱: 이전 버전 Release 파일로 재설치(데이터 호환 — runtime은 append-only 스키마 v1).
- 저장소 코드: `git revert` 후 main push → 가드레일 통과 확인.
- 실패한 Codex 작업: 패킷의 rollback_plan(기준 SHA revert) + runtime/runs/<id>.log 근거.

## 금지

버전 안 올리고 파일만 바꾸는 배포 · 실행 중 번들 무검증 덮어쓰기 · 업데이트 실패 시 기존 앱 삭제 ·
HQ 업데이트로 6개 앱 운영 중단(완전 독립).
