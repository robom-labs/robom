# STATE DRIFT REPORT — Phase 0 (2026-07-21)

릴리스 프로그램 §6.4 기준선 드리프트 감사. 이 세션 실측(git fetch·registry·open PR·버전 파일).

## 1. 중앙 AI 상태 파일 드리프트 (수정 필요, 재생성은 deploy-SHA 근거로만)
- `ops/family/ai/CURRENT-STATE.json`: `generatedAt` = **2026-07-16T09:39:39Z 고정**, `familySpecVersion` = **1.0.0**, `robom.version` = **2.1.4**, `sourceCommit` = 46ac6c5.
  - 실제(2026-07-21): registry `family_spec_version` = **1.1.0**, site `package.json` = **2.2.1**, 앱들 다수 상향(runningbom 0.17.13, certbom 0.7.4 등). → **CURRENT-STATE가 5일+ 뒤처짐.**
- `ops/family/ai/LAST-VERIFIED.json`: 동일 `generatedAt` 고정, `ops/registry/apps.yml` sha256 핀이 현재 registry와 불일치 가능.
- 조치: 가짜 `generatedAt`-only sync 금지(§19.3). 실제 Production deploy-SHA 근거로 재생성하는 검증기 경유로만 갱신. 다음 세션 과제.

## 2. registry(ops/registry/apps.yml) — 대체로 최신(코덱스 유지 중)
- family_spec_version 전 앱 1.1.0, store status 전부 `planned`, mobile_status 전부 `pwa` (아직 스토어 미출시 — 정상 기준선).
- 버전: outbom 0.25.6 / homebom 0.14.8 / runningbom 0.17.13 / certbom 0.7.4.

## 3. 버전 네임스페이스(혼동 주의, 드리프트 아님)
- HQ 데스크톱 앱 = **3.3.30** (desktop/package.json·control-center/app/version.json). ← 3.3.30 아래로 내리지 말 것.
- Company OS = **1.3.0** (ops/company-os/VERSION). 적용만.
- 홈페이지 site = **2.2.1** (site/package.json).
- 문서의 "v1.4.0"은 실행지침 버전이지 HQ 앱버전 아님.

## 4. 스토어 문구/데이터 드리프트 (빌드 전 게이트)
- certbom: 검증 카탈로그 **104개**. 모바일 스토어 문구에 **"97개"** 잔존 여부 확인 → 104로 정정 필요(§9.10).

## 5. Open PR 재판정 대상 (Phase 4)
- homebom#32(draft): Edge Function 정규화 단일소스 — 병합 전 Supabase deploy smoke(HUMAN).
- certbom#14(draft): 글자크기 복원 — #15(104 확장)과 rebase.
- dependabot: certbom 8건 — lockfile·CI 통과 시 병합 후보.
- 이미 merge(재구현 금지): outbom#28/#29, homebom#33, runningbom#34, certbom#15.
