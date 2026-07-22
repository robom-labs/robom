# v2.4.2 _ 마지막 검증 기록

## v2.4.2 재점검 수정 3건 (2026-07-19)

- office.js 글로우 게이트 괄호 버그: 치환 실수로 `SHADOW_MUL*(조건)?A:B`가 되어 저품질 모드에서 캐릭터 링 글로우가 안 꺼지던 것 → `SHADOW_MUL*((조건)?A:B)`로 교정
- /api/hq-status가 tasks를 빈 배열로 계산해 회사 화면 '수정 중' KPI가 실제 작업 중에도 0으로 나오던 버그 → store의 실제 작업 목록 반영
- 데스크톱 트레이 '로그인 시 자동 시작' 토글 시 desktop-status.json 즉시 갱신(재시작 전까지 낡은 상태로 판정되던 것)
- 자격증봄 source-monitor 워크플로 수동 실행으로 출처 해시 실데이터 채움 시작
- 청약봄 Supabase 함수는 자동 배포 워크플로 부재 확인 — 코드 병합 완료, 함수 배포는 Supabase 토큰(비밀값) 필요라 회장 확인 경계로 정직 기록

# v2.4.1 _ 마지막 검증 기록

## v2.4.1 성능·전체 점검 (2026-07-19, 회장 지시 "끊김 없이 최적화·전체 보완")

| 항목 | 상태 | 근거 |
|---|---|---|
| 바닥 월드 캐시 — 팬·관람·호버 중 재렌더 0(blit만), 줌은 0.25 버킷에서만 재렌더 | PASS | renderFloorCache + floorDirty 4곳(층·fit·resize)으로 축소 |
| nightFactor 프레임당 Intl 생성 제거(소품마다 매 프레임 → 30초 캐시) | PASS | NIGHT_AT 캐시 |
| 자동 품질 조절 — fps<40 2초 지속 시 글로우 OFF→해상도 1x 하향, 55fps 회복 시 복원 | PASS | PERF_LEVEL·SHADOW_MUL·applyPerf |
| HUD DOM 갱신 스로틀(매 프레임 → 초당 3회) · 정적 비품 1회 정렬+병합(전체 재정렬 제거) | PASS | hudAt·FURN sort+merge |
| 시계 Intl 포매터 캐시 · 호버는 오버레이(캐시 무효화 없음) | PASS | CLOCK_FMT·drawHoverZone |
| 실측: idle 61fps · 팬 61fps · 관람 61fps · 모바일(390px) 61fps · 콘솔 오류 0 | PASS | Playwright v241-office*.png |
| 전 화면 6종(오늘·앱·업무·회사·자동화·기록) 오류 0·가로 넘침 0 · 오피스 11층 전 층 오류 0 | PASS | sweep 결과 |
| '수정 대기' 라벨 서버-오피스 표기 일치(구 '사건 분류') | PASS | ACT_LABEL 갱신 |
| 테스트 112종 통과 · standalone 빌드 정상 · 버전 삼중 2.4.1 · SW v6.4.1 | PASS | node --test · build-standalone |

# v2.4.0 _ 마지막 검증 기록

- 검증 시각: 2026-07-19 (KST) · 검증 환경: Linux 컨테이너(Node 22) + Playwright Chromium
- 참고: 컨테이너는 외부 운영 호스트가 프록시로 차단돼 앱 계약이 다수 FAIL/막힘으로 나타난다(엔진이 정직 보고함을 실증). 회장 맥에서는 실측된다.

| 항목 | 상태 | 근거 |
|---|---|---|
| control-center 테스트 111종 | PASS | node --test 전체 통과(workforce 12·office 12 갱신 포함) |
| 24시간 무교대·전원 배정 — 가동 중 근무자(복지·홍보·회장 제외) OFF_DUTY 0 + 전원 담당 계약 | PASS | workforce.test + c:robom-company:wf-full-coverage·wf-24h (라이브 미배정 0명) |
| 부하분산 소유권 — 계약을 역량 있는 최소부하 직원에게 배분(전원 커버리지 보장 이관 포함) | PASS | buildAssignment · 근무 69명 전원 계약 보유 |
| 시간 회전 점검 연출(30초 버킷) — 담당 계약을 돌아가며 점검(엔진 전수 평가와 일치, 랜덤 아님) | PASS | computeWorkforce 결정론 + 오피스 라이브 |
| 막힘 구분 — 자동 수정 대기(Codex 큐) vs 사람 확인 필요(비밀키·보안·데이터소스) | PASS | needsHuman + contractsAutoFixing/contractsNeedHuman + 회사·업무 화면 안내 |
| 2인자 = 리리(수석부회장)·회장 직속 | PASS | workforce.test + c:robom-company:wf-riri + 조직도 트리 |
| 조직도 시각 트리(회장→리리→16본부 나란히) | PASS | Playwright v24-orgtree.png(황준필→리리·민서→본부 그리드) |
| 회사 가동 시각 배너(● 가동 중·근무/점검/막힘·실행기 연결 표시) | PASS | Playwright v24-company.png · 콘솔 오류 0 |
| 계약 332개(273 + PWA head 실측 + 회사 자체점검 27) | PASS | catalog 카운트 · company-ops 27/27 PASS |
| 오피스 관람 카메라(자동 층 순회·잔잔한 팬) + 최적화(미표시 시 렌더 정지·정적 비품 depth 캐시) | PASS | Playwright v24-office-tour.png(5F→4F 자동 전환) · office.test |
| 회사 가동 모드 6종 | PASS | company-authority + 회사 화면 고급 제어 |
| 거짓 성과 금지(복지=생활 연출 비집계·홍보 STANDBY·인원≠실행기·'수정 중'=실제 실행기만·회장=총괄) | PASS | workforce.test + 자체 점검 계약 |
| 버전 삼중 2.4.0 + SW 캐시 v6.4.0 | PASS | version-triad |

## v2.3.0 → v2.4.0 핵심 변화

- **전원이 진짜 일한다**: 이전엔 소수 리드에게만 계약이 몰려 대부분 "관제 대기"였다. 이제 근무 직원 69명 전원이 담당 계약을 갖고(부하분산+커버리지 보장), 24시간 무교대로 상시 점검한다. 회장 화면·오피스에서 미배정 0명.
- **막힘이 뭘 하라는 건지 명확**: 막힌 계약은 자동으로 Codex 수정 대기열에 오르고(회장 조치 불필요), 비밀키·보안 같은 건만 '사람 확인 필요'로 분리해 '오늘→내가 확인할 일'로 안내. 회사·업무 화면에 자동/사람 레인 표시.
- **가동 버튼이 눈에 보인다**: 누르면 상단에 ● "회사 가동 중 — 전 직원 24시간 근무" 배너 + 근무/점검/막힘·실행기 연결 상태.
- **조직도가 위→아래 트리**: 회장(황준필) 맨 위, 바로 밑 2인자 리리, 그 아래 16본부 나란히.

## 정직한 미완(다음 단계 — 프롬프트의 거짓 성과 금지 원칙 준수)

- **계약 356개**(273 → 356, 실측 가능한 고유 계약만; 문구만 바꾼 중복 금지). **4개 앱 진단 신호 전부 오픈 완료**(2026-07-19, 회장 지시 "원칙 수정·다 열어라·모든 권한"). 각 앱 원본 저장소를 세션에 붙여 **실제 데이터 소스·스키마를 확인한 뒤** 그에 맞는 실측 계약을 추가(가짜·추측 금지):
  - **야외봄**: Open-Meteo(서울 좌표, 공개·무키) → forecast 6종(200·JSON, 48시간+, 기온 전수 유효, 핵심 기상필드, 일출·일몰, 타임존). lib/weather.ts 쿼리와 동일.
  - **청약봄**: Supabase notices(공개 URL) → 공고 6종(housingCategory=아파트 상수, applyHome 공식 URL 고정, type 존재, modelDataStatus enum, lastVerifiedAt parse, events 배열). 서버 normalize() 보장 필드만 + 빈 배열 공허참 안전.
  - **러닝봄**: races.json(사이트 루트, top-level 객체) → 8종(featuredRaces·scheduleFeed 비어있지 않음·이름·날짜 parse·status enum·접수 URL 유효). URL http/https 혼용이라 https 단정 금지→url_valid. 기존 races-data-version 필드 경로 버그(dataVersion→version) 수정.
  - **자격증봄**: ops/source-registry/sources.json(raw GitHub) → 4종(schemaVersion≥2·dataVersion·출처 8곳·id 중복0·공식/접수 URL https·확인시각). 실제 파일 한글 키 스키마 확인. (런타임 데이터는 번들 내장이라 별도 API 없음 — 정직히 파일 점검)
  - 라이브 PASS는 회장 맥에서(샌드박스는 외부 호스트 403 차단). 엔진 구조 검증: 신규 계약 전수 코드 예외 0.
- **남은 신호도 전부 착수 완료**(회장 지시 "다 진행·모든 권한"). 열린 신호는 각 앱 원본 저장소 PR로 상신했다:
  - **robom-hq login-item** ✅ 본사에서 구현 완료 — desktop main이 `app.getLoginItemSettings()`를 `desktop-status.json`에 기록, 계약이 OS 실제 자동시작 상태를 판정(v2.4.0 포함).
  - **청약봄 collection-stats** → homebom PR #31(Supabase 함수 `x-collection-stats` 숫자 헤더). 병합·배포 시 계약 자동 green.
  - **자격증봄 source-hash** → certbom PR #8(공식 출처 콘텐츠 모니터 워크플로 + `source-hashes.json`). 병합·배포 시 green.
  - 앱 신호는 Draft PR로 상신(사람 병합·배포 검증). 계약은 이미 실측형으로 전환돼 배포되는 즉시 green으로 살아남.
- **오피스 78명 전원 데스크 배치**: 현재 층별 핵심 데스크 + 가족·생활 인원 구동. 78명을 11개 층 좌석에 충돌 없이 전수 배치(seatsByFloor 확장)는 다음 단계.
- **CompanyKernel SSE·ExecutorBroker**: 현재 6초 폴링 + Codex 단일 러너. 실행기 미연결은 정직하게 '자동 수정 대기'로 표기(연결 시 즉시 '수정 중'). 이벤트 버스(SSE)·다중 실행기 어댑터는 다음 단계.
