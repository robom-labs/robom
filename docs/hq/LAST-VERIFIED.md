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

- **계약 356개**(273 → 356, 실측 가능한 고유 계약만; 문구만 바꾼 중복 금지). **5개 앱 진단 신호 전부 오픈 완료**(2026-07-19, 회장 지시 "원칙 수정·다 열어라·모든 권한"). 각 앱 원본 저장소를 세션에 붙여 **실제 데이터 소스·스키마를 확인한 뒤** 그에 맞는 실측 계약을 추가(가짜·추측 금지):
  - **야외봄**: Open-Meteo(서울 좌표, 공개·무키) → forecast 6종(200·JSON, 48시간+, 기온 전수 유효, 핵심 기상필드, 일출·일몰, 타임존). lib/weather.ts 쿼리와 동일.
  - **청약봄**: Supabase notices(공개 URL) → 공고 6종(housingCategory=아파트 상수, applyHome 공식 URL 고정, type 존재, modelDataStatus enum, lastVerifiedAt parse, events 배열). 서버 normalize() 보장 필드만 + 빈 배열 공허참 안전.
  - **러닝봄**: races.json(사이트 루트, top-level 객체) → 8종(featuredRaces·scheduleFeed 비어있지 않음·이름·날짜 parse·status enum·접수 URL 유효). URL http/https 혼용이라 https 단정 금지→url_valid. 기존 races-data-version 필드 경로 버그(dataVersion→version) 수정.
  - **자격증봄**: ops/source-registry/sources.json(raw GitHub) → 4종(schemaVersion≥2·dataVersion·출처 8곳·id 중복0·공식/접수 URL https·확인시각). 실제 파일 한글 키 스키마 확인. (런타임 데이터는 번들 내장이라 별도 API 없음 — 정직히 파일 점검)
  - **캘린더봄**: 서버 데이터 없음(클라이언트 전용) → 저장 키 6개 불변 계약(critical, 사용자 데이터 유실 방지) + 백업/ICS 내보내기·가져오기 UI 존재. 앱 스스로 선언한 '저장 키 불변' 원칙 기반.
  - 라이브 PASS는 회장 맥에서(샌드박스는 외부 호스트 403 차단). 엔진 구조 검증: 신규 계약 전수 코드 예외 0.
- **남은 need_new_source 6개(정직)**: 청약봄 collection-stats(Supabase 함수에 통계 헤더 추가 필요), 자격증봄 source-hash(수집 workflow가 sha256 기록), 캘린더봄 user-storage-health(설정 옵트인 — **개인정보라 회장 확인 경계**, 자동 미구현), robom-hq login-item(desktop API), 노트봄 2개('절대 수정 금지'). 이들은 각 앱 인프라 추가/개인정보 동의가 필요한 항목이라 허수로 채우지 않고 정직하게 남김.
- **오피스 80명 전원 데스크 배치**: 현재 층별 핵심 데스크 + 가족·생활 인원 구동. 80명을 11개 층 좌석에 충돌 없이 전수 배치(seatsByFloor 확장)는 다음 단계.
- **CompanyKernel SSE·ExecutorBroker**: 현재 6초 폴링 + Codex 단일 러너. 실행기 미연결은 정직하게 '자동 수정 대기'로 표기(연결 시 즉시 '수정 중'). 이벤트 버스(SSE)·다중 실행기 어댑터는 다음 단계.
