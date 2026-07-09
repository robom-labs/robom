# 신규 앱 온보딩 게이트

> strategist(월간)가 신규 앱 추가 요청을 이 게이트로 판단한다. 통과해야 편입한다. 회사가 앱 3개든 30개든 구조는 그대로(모델 A).

## 게이트 체크리스트 (전부 YES 여야 편입)
- [ ] 앱이 **실제 존재**하고 배포되고 있는가? (빈 저장소를 앱으로 착각 금지 — 과거 실패모드)
- [ ] 원본 저장소가 명확한가? (배포는 원본에서 — D1)
- [ ] 스택·테스트·빌드·배포 방식을 registry 한 블록으로 적을 수 있는가?
- [ ] base path / 배포 URL 등 **깨지면 안 되는 것**이 무엇인지 파악됐는가?
- [ ] 유지보수 여력이 되는가? (매일 앱1 원칙 상, 앱이 늘면 각 앱 최소 주1회 touch SLA만 지키면 됨)

## 편입 절차 (통과 시)
1. `ops/registry/apps.yml` 에 한 블록 추가(id·name·status·version·repo·stack·test·build·deploy·base_path·url·marketing_tone).
2. `ops/state/<id>.md` + `ops/changelog/<id>.md` 생성(`_TEMPLATE.md` 복사).
3. 앱별 CI 필요하면 `.github/workflows/ci-<id>.yml`(path 필터). 정적이면 산출물 검증만.
4. base path 등 금지선 있으면 `guardrails.yml`/CODEOWNERS 에 앵커 추가.
5. **팀·중앙 워크플로는 손대지 않는다.**

## 편입하지 않는 경우
- "보류"도 정당한 결정. 죽은/미완 앱에 매일 시간 쓰지 않는다(strategist 원칙).
