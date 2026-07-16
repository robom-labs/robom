# 2026-07-17 최종 감사 3 — 배포·운영·복구

## 실제 운영 상태

| 제품 | 버전 | main·운영 SHA | release evidence | 운영 상태 |
|---|---:|---|---|---|
| robom.kr | 2.1.6 | 코드 `15902d0`, Sites 운영은 이전 build | Guardrails `29538883215`, Pages `29538883236` 성공 | BLOCKED_EXTERNAL |
| 야외봄 | 0.25.2 | `15f318a` | CI `29538010235`, Pages `29538010575` 성공 | PASS |
| 청약봄 | 0.14.2 | `7b91314` | CI `29538038200`, Pages `29538037777` 성공 | PASS |
| 러닝봄 | 0.17.3 | `a43b6d0` | Family `29537644604`, Pages `29537644455` 성공 | PASS |
| 캘린더봄 | 0.6.1 | `96a10b8` | Family `29538807623`, release·Chromium·WebKit·smoke `29538806824` 성공 | PASS |
| 자격증봄 | 0.7.0 | `26f6895` | CI `29538052485`, Family `29538052778`, Vercel 운영 직접 확인 | PASS |

최종 watchdog `29539114543`은 다섯 앱과 자격증봄 source heartbeat를 PASS로 판정했다. 실패는 `robom.kr`에서 2.1.6과 build marker `15902d0`을 찾지 못한 한 건뿐이다.

## Production 직접 검증

- Chromium과 WebKit fresh context에서 캘린더봄 날짜 선택이 편집기를 자동으로 열지 않는지 확인했다.
- 두 브라우저에서 일정 추가 CTA 48px, 모바일 전체 화면 편집기, 600px 두 칸, 무가로스크롤, 콘솔 오류 0을 확인했다.
- 두 브라우저에서 자격증봄 시험 달력, 공통 회차 그룹, 일반 준비물 7개 전체, 준비물 checkbox, 콘솔 오류 0을 확인했다.
- watchdog이 야외봄·청약봄·러닝봄·캘린더봄·자격증봄의 version과 build SHA를 운영 자산에서 확인했다.

## 중앙 배포 차단

`site/.openai/hosting.json`은 robom.kr의 Sites 프로젝트를 가리키지만 이번 실행 표면에는 Sites `create_site`·`save_version`·`deploy` 호출 도구가 없고 Wrangler도 인증되지 않았다.

따라서 GitHub Pages preview는 최신 2.1.6으로 배포됐지만 `robom.kr` Sites Production 승격은 수행할 수 없었다. 이 문제는 `robom-labs/robom#54`에서 중복 없이 추적하며 watchdog이 계속 실패를 유지한다.

상태는 `BLOCKED_EXTERNAL`이다. 코드·빌드·E2E·Pages release gate 실패로 축소하거나 Production 성공으로 과장하지 않는다.

## 복구 검증

- CalendarBom `96a10b8`, `caed861`, `0ee3f67`을 임시 clone에서 역순 `git revert --no-commit`하고 `git diff --cached --check`를 통과했다.
- robom `15902d0`, `39e7951`을 임시 clone에서 `git revert --no-commit`하고 diff 검사를 통과했다.
- 야외봄 `15f318a`, 청약봄 `7b91314`·`d90e566`, 러닝봄 `a43b6d0`, 자격증봄 `26f6895`·`86917c8`의 staging rollback dry-run도 통과했다.
- 각 앱은 자체 release workflow로 독립 재배포 가능하며 중앙 family source 장애가 앱 runtime을 막지 않는다.

정확한 revert 예시는 다음과 같다.

```bash
git -C calendarbom revert 96a10b83d4143d93d21e91eeda28fd934d6f6fa3 caed861833cc136af595adbfa95652da8b1e605d 0ee3f6795e2b36b163a20053b371b32f187d43b6
git -C certbom revert 26f68957fe61710e4beeee56ba3cd3eb535b65e0 86917c8c971e145ebdd3223d6238d86ff491c909
git -C robom revert 15902d059f8f0808e1e2115322df0d8b834e253f 39e795160d51a558a9292a945cf93e5455e5b7f0
```

revert 뒤 해당 저장소의 full release gate와 Production smoke를 다시 실행해야 한다.

## 자율운영·보안

- 자격증봄 source 400일 simulation, anomaly gate, last-known-good와 source heartbeat가 통과했다.
- 중앙 watchdog은 version·build marker·manifest·service worker·source heartbeat를 확인하고 이슈를 dedupe한다.
- 중앙 production dependency audit는 0 advisory이며 다섯 앱 high/critical은 0이다.
- 비밀정보 검사와 family drift·QR decode가 CI에서 통과했다.
- 스토어 signing, OAuth, Q-Net 운영 key, 실제 private analytics endpoint는 계정 소유자 단계라 `BLOCKED_EXTERNAL`이다.

## 최종 판정

- 다섯 앱 운영 배포와 독립 복구: PASS.
- 자격증봄 source heartbeat: PASS.
- robom GitHub Pages preview와 release gate: PASS.
- robom.kr Sites Production 2.1.6 승격: BLOCKED_EXTERNAL.

