# 롤백 플레이북 — 앱별 독립 복구 절차

> 각 제품은 원본 저장소 main의 revert 커밋으로 복구하고 해당 저장소의 배포 게이트를 다시 통과한다. force push와 배포 산출물 브랜치 직접 reset은 사용하지 않는다.

## 공통 절차

1. 운영 장애가 시작된 main 커밋과 직전 정상 커밋을 확인한다.
2. 원본 저장소에서 `git revert <장애-커밋-SHA>`를 실행하고 변경된 저장값·URL·서비스워커 호환성을 검토한다.
3. 저장소의 full release gate를 실행한 뒤 `git push origin main`으로 반영한다.
4. Actions 배포가 끝나면 fresh profile, 기존 PWA, 핵심 흐름과 build marker를 확인한다.
5. `ops/state/<app>.md`에 원인·revert SHA·운영 확인 시각을 기록한다.

## robom.kr

- 저장소: `robom-labs/robom`
- GitHub Pages 보조 표면은 main push의 `Deploy robom site to Pages`가 재배포한다.
- Sites 정본은 revert된 robom main을 Sites source mirror에 동기화하고 새 버전을 배포한다.
- 확인: `https://robom.kr/`, 다섯 `/get/<app>`, QR decode, `/sw.js`, 이전 캘린더 경로.

## 야외봄

- 저장소: `robom-labs/outbom`
- 정본 배포: GitHub Pages `https://robom-labs.github.io/outbom/`.
- 호환 Vercel 주소가 연결돼 있으면 같은 revert SHA의 배포만 production으로 승격한다.
- 확인: 현재 출발 판단, 위치·활동, 준비물, 기존 `running-alarm:*`, cache version.

## 청약봄

- 저장소: `robom-labs/homebom`
- 정본 배포: GitHub Pages `https://robom-labs.github.io/homebom/`.
- 확인: 공고·접수·발표·계약, 공식 링크, LKG/stale, 기존 `zzc:*` 저장 키, cache version.

## 러닝봄

- 저장소: `robom-labs/runningbom`
- 정본 배포: GitHub Pages `https://robom-labs.github.io/runningbom/`.
- Vercel 미러가 운영 대상이면 Pages와 같은 main SHA만 production으로 승격한다. 그렇지 않으면 registry에서 legacy로 분리한다.
- 확인: 검색·지역·거리·상태, 공식 접수, 알림 저장값, `races.json`, cache version.

## 캘린더봄

- 저장소: `robom-labs/calendarbom`
- 정본 배포: GitHub Pages `https://robom-labs.github.io/calendarbom/`.
- 확인: 기존 localStorage 일정, JSON/ICS 백업·복원, 알림, 서비스워커 scope, `https://robom-labs.github.io/robom/calendarbom/` 이전 안내.

## 자격증봄

- 저장소: `robom-labs/certbom`
- 정본 배포: Vercel `https://certbom.vercel.app/`.
- main revert 뒤 Vercel 자동 배포를 사용한다. 자동 배포가 없으면 직전 정상 deployment를 Promote하고 revert main 배포로 다시 고정한다.
- 확인: 시험 catalog, 일정·준비물·관심 시험, 공식 출처, cache/data version.

## 복구가 막힐 때

- Vercel Promote, Sites 배포, DNS 또는 store console 권한이 없으면 코드 revert와 release gate까지 완료한 뒤 `BLOCKED_EXTERNAL`로 기록한다.
- 한 앱의 실패 때문에 다른 앱을 함께 되돌리지 않는다.
