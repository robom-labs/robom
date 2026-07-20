# ROBOM HQ 자율 Loop Engineering OS — 구현 현황 (v3.1.0 지침 대비)

실행 프롬프트 `ROBOM_HQ_AUTONOMOUS_LOOP_ENGINEERING_OS_PROMPT_v3.1.0`에 대한 **정직한** 구현 현황이다.
"1년·10년 자율 운영"은 한 번에 완성되는 제품이 아니라 계속 자라는 구조이므로, 아래는 뼈대·핵심부터
단계별로 실제 배포한 내용과 남은 항목을 구분해 기록한다(가짜 완료율 금지 — 지침 §2·§20).

## 배포 완료 (실제 동작·테스트 통과·릴리스)

| 지침 | 구현 | 릴리스 |
|---|---|---|
| §9·§15 분류(self_heal/codex/human) | `lib/incident-fix.mjs` — 계약 계열·텍스트 기반 결정론 분류 | hq-v2.5.0 |
| §2 자동/사람 경계 정직 표기 | 문제 처리 현황 보드(자동/Codex/회장) + 감지 시각·해결방안 | hq-v2.5.0 |
| §5 Codex 실패 구분 | 실행기 quota·auth·code 실패 구분, "용량 소진" 정직 표시 | hq-v2.5.0 |
| §9 실행기 설정 | 회장이 모델·추론 강도 선택 → codex exec 전달 | hq-v2.5.0 |
| §6 Loop 객체 | `lib/loop-engine.mjs` — 목표·합격기준·담당·검증자·iteration·증거 | hq-v2.6.0 |
| §7 상태기계 | 23개 상태·전이 검증·종료 후 재개 금지·이벤트 저장소 | hq-v2.6.0 |
| §5·§7 **원래 계약 자동 재검증** | Codex exit 0 ≠ 해결. 원래 실패 계약이 다시 PASS해야 CLOSED | hq-v2.6.0 |
| §10.2 iteration | 실패 시 같은 수정 반복 대신 새 iteration으로 접근 변경 | hq-v2.6.0 |
| §7 회복 자동 종료 | 신호 회복 시 결재·Loop 동시 CLOSED | hq-v2.5.0/2.6.0 |
| §18 Loop 화면 | 자율 개선 Loop 보드(목표·기준·상태·증거·다시 시도) | hq-v2.6.0/2.8.0 |
| §14 Meta Loop | 멈춘 Loop·재시도 폭주·담당 누락 자가 점검 | hq-v2.8.0 |
| §13 성장 Loop | 개선 제안도 목표·기준을 갖춘 닫힌 Loop로 관리 | hq-v2.9.0 |
| §16 verifier 분리 | 완료 판정을 실행자가 아니라 점검 사이클이 원래 계약으로 독립 재검증 | hq-v2.6.0 |
| §17 감사2 회귀 방지 | Loop 시작 시 앱별 실패 기준선 저장 → 수정이 다른 걸 깨뜨리면 종료 보류·재시도 | hq-v2.10.0 |
| §18 Loop 버튼 | Loop별 다시 시도·증거 보기·앱 열기 (dead button 0) | hq-v2.11.0 |
| §0 하드코딩 금지 | 과거 계약 수(257) 제거 → 카탈로그 동적 집계 | hq-v2.5.0 |
| (별건) 자동 재실행 오류 | 창 닫으면 완전 종료·레거시 KeepAlive 매 실행 제거·러너 자식 정리 | hq-v2.7.0 |
| §18 잘림 정직 표기 | 보드에서 잘린 항목 개수(+N) 표시 — 은닉 상한 제거 | hq-v2.18.0 |
| §17 감사2 회귀 감사(집합) | 실패 '수'가 아니라 '집합' 기준 — 만성 동반실패가 새 회귀를 가리지 못함 | hq-v3.0.2 |
| §10.2 반복 종료 조건 | 자동 재시도 상한(5회) → FAILED_SAFE 안전 중단 + 회장 확인 escalate | hq-v3.0.1 |
| (안전) 점검 동시 실행 잠금 | run lease — 겹친 점검이 같은 안건을 이중 승인·이중 처리하지 못함 | hq-v3.0.1 |
| §13 성장 Loop 자동 종료 | health 계약이 없는 성장·보안 Loop도 '완료+회귀 없음'으로 자동 종료 | hq-v3.0.0 |

## 자기 반박 감사 이력 (§16·§17 — 독립 에이전트가 완료를 깨뜨리려 시도)

핵심 Loop 코드부터 시작해 Electron 본체·서버·저장소·판정 엔진·스냅샷 파이프라인·화면(UI)·심층 계약 엔진·사건 분류기·배포 파이프라인·자율 Loop 종료 게이트·인력 시뮬레이션·원격/휴대폰 인증까지 독립 red-team 에이전트로 **열아홉 차례** 반박 감사했고, 찾은 실제 결함을 모두 고쳐 배포했다(가짜 완료 금지):

- **1차** → 실제 결함 3건: 회귀 감사 앱키 정규화(HIGH)·성장 Loop 무한 in_review(MED)·전결이 human 분류 무시(MED). → hq-v3.0.0
- **2차** → 실제 결함 4건: 점검 동시 실행 이중 승인(HIGH)·무한 재시도 quota 낭비 + FAILED_SAFE 부재(MED+)·회귀 감사 수 비교의 만성실패 가림(MED)·회귀 보류 시 streak 미리셋(LOW). → hq-v3.0.1
- **3차(2차 수정분 반박)** → 새 회귀 0건 확인 + 기존 잠재결함 1건(회사 레벨 성장 Loop 회귀키 불일치, LOW) 발견·수정. → hq-v3.0.2
- **4차(범위 확대 — Loop 코어 밖)** → Electron 본체·서버 보안 표면·건강 진단 엔진/화면을 3개 독립 감사로 병렬 점검. 실제 결함 다수 수정 → hq-v3.1.0:
  - Electron: 회장이 앱을 껐을 때 codex 손자 프로세스가 고아로 계속 도는 문제(그룹/트리째 종료로 수정, HIGH — "왜 자꾸 켜져있냐"의 잔재), will-navigate origin 우회(보안, MEDIUM), 종료 중 점검창 생성 방지·미처리 예외 가드.
  - 서버 보안: localhost 예외 API의 CSRF(다른 웹페이지 no-cors 호출) 차단(Sec-Fetch-Site), authority/control 파일 원자적 쓰기(크래시 시 일시정지가 몰래 풀리는 fail-open 방지), 모바일 토큰 편향 제거(거부 표집), rate-limit 맵 누수 정리. (경로 조작·토큰 비교·바인딩·XSS는 감사 결과 이미 안전 확인.)
  - 건강 진단: 대시보드가 미확인 앱까지 "정상 운영"으로 포장하던 거짓 표기 수정(정직 표기), 항상-PASS no-op 계약 3건(stale-lease·certbom parity·wf-mode-6)을 실측 또는 정직한 '점검 불가'로 전환, 아이콘 0개 통과·JSON 미검증 통과 수정, 회장이 못 쓰던 점검주기 조절 UI 복구.
- **5차(데이터 무결성·실행 정확성)** → 실행기·큐·저장소·인력/카탈로그를 3개 독립 감사로 병렬 점검. 실제 결함 다수 수정 → hq-v3.2.0:
  - **[치명적]** 저장소 `updateStatus`가 `{status}` 외 필드(verifiedBy·reason·originPassStreak·requeueCount·loopId)를 throw로 거부해 **업무 생명주기 전이가 기록에 아예 안 남던** 문제(재검증·재시도 상한 무력화) → 허용 필드를 넓혀 append-only로 보존(테스트 추가).
  - **[HIGH]** 큐 claim/finish/회수가 write-then-rm이라 경쟁 시 같은 작업 이중 실행·완료된 작업 재실행 가능 → 원자적 rename으로 교체(+독성 작업 회수 상한→failed).
  - **[HIGH]** 저장소 append가 개행 안전하지 않아 크래시로 끊긴 줄이 다음 레코드까지 삼키던 유실 → 개행 안전 append(테스트 추가).
  - 실행기 실패 분류가 모델 서술(stdout)의 auth/401/billing에 속아 오분류하던 문제 → stderr 구체 신호만 판정(테스트 추가). 작업 제한시간을 lease TTL보다 짧게 강제(이중 실행 방지), claim 직후 일시정지 재확인.
  - 인력 화면 '자동 수정' 수가 계약이 아니라 직원 수를 세서 실패 계약 일부가 사라지던 문제 → 계약 단위 집계(합계 정합). 캐시 격리 계약의 하드코딩 6앱 목록 → registry 정본 생성. 시설 division 역량 범주·비밀키 오분류(qnet) 수정.

- **6차(판정 엔진·권한·오피스 — 5차와 함께 hq-v3.2.0에 포함)** → contract-assert·company-authority·browser-driver·sources·office를 3개 독립 감사로 병렬 점검:
  - **[HIGH]** 브라우저 스모크 점검이 **HTTP 상태를 안 봐서 404/500 오류 페이지가 '정상'으로 통과**하던 거짓 PASS(가장 흔한 배포 사고) → HTTP 상태 포착·400↑ 실패, 본문 0자(빈 화면)도 실패.
  - **[HIGH]** 건강 점검의 authority-valid가 6종 중 3종만 유효로 봐서 회장이 **긴급정지/안전복구/안전마무리**로 세우면 '권한 정본 깨짐' 헛경보를 내던 문제 → 정본 6종 전부 유효 처리.
  - **[HIGH]** 권한 파일이 손상·유실되면 **RUNNING으로 몰래 되돌아가(fail-open)** 정지시킨 회사가 다시 돌던 문제 → .bak 복구 + 복구 불가 시 안전 PAUSED(테스트 추가).
  - **[HIGH]** 판정 엔진(assertion)의 거짓 PASS: 빈 배열 every 진공참·undefined끼리 eq·중복 same_set → 모두 실패로 교정(테스트 추가). 정규식 백트래킹 폭발 입력 상한.
  - YAML 파서 섹션 경계 복원, 오피스 지도 손상 시 화면 하얗게 비지 않게 방어.

- **7차(사건 분류·저장소 폴딩·휴대폰 — hq-v3.2.1)** → incident-fix·company-store·mobile-access를 3개 독립 감사로 병렬 점검:
  - **[HIGH·거버넌스]** 사이트 다운 같은 **치명(critical) 장애가 self_heal로 분류돼** 결재·Loop·에스컬레이션 없이 "회장님이 누를 것 없음"으로 조용히 방치되던 문제 → classifyFix를 심각도 인지형으로: critical/error인 self_heal 계열은 codex로 올려 Loop·에스컬레이션 생성.
  - **[HIGH·거버넌스]** self_heal 경로엔 전결 2차 방어가 없는데 HUMAN_TEXT가 보안·사용량·인증서·키 교체 단어를 빠뜨려, 보안/인증서 장애가 회장 확인 없이 자동 처리로 새던 문제 → HUMAN_TEXT를 NON_DELEGABLE과 정렬(보안·security·사용량·한도·인증서·키 교체/재발급 추가).
  - **[HIGH]** 저장소에서 created 이벤트가 손상되면 그 뒤 status_changed가 **조용히 사라져 레코드가 통째로 안 보이던** 문제 → 최소 복구(_recovered)로 보존·로그. 컬렉션 하나 읽기 실패가 화면 전체를 blank로 만들던 문제 → 컬렉션 단위 격리.
  - **[MED]** 휴대폰 토큰 재발급(다른 기기 연결 끊기) 경로 부재 → 재발급 API·버튼 추가(분실 기기 즉시 무효화). 공인 IP 호스트에서 토큰 박힌 URL이 QR로 노출되던 문제 → 사설망·Tailscale 주소만 노출.

- **8차(스냅샷 파이프라인·계약 카탈로그 — hq-v3.3.2)** → 미감사 영역(스냅샷 서빙·신선도·계약 정의)을 2개 독립 감사로 병렬 점검. 정직(§4) 결함을 수정:
  - **[HIGH·거짓 성과]** 화면이 **예시(offline)·낡은 스냅샷을 '실시간 정상'으로 위장**하던 문제. `/snapshot.json`이 latest.json 없으면 example.json을, 있으면 아무리 오래됐어도 그대로 내보내고 UI는 `generatedAt`·`example`을 읽지 않아 초록 신호등을 띄웠다. 게다가 신선도 감지(snapshot-age/example)는 **빌더 성공 뒤에만** 돌아, 낡음이 시작되는 바로 그 순간(빌더 실패)엔 점검이 통째로 스킵됐다. → (a) 서빙 스냅샷에 `_freshness`(example·ageMs·stale) 주입, (b) UI가 예시/지연이면 신호등을 '미확인'으로 낮추고 상단 배너로 명시, (c) **빌더가 실패해도 신선도·예시 점검은 반드시 실행**(테스트 추가).
  - **[MED·거짓 경보]** 공통 호스트·네트워크 순단으로 **여러 앱 운영 점검이 동시에 실패**하면 신호등이 '전부 빨강(장애)'으로 위장하던 문제(build-snapshot이 health-engine의 all-down 가드를 안 가짐). → 점검 대상 2개↑가 전부 FAIL이면 개별 장애가 아니라 로컬 네트워크 문제로 보고 '미확인'으로 낮춰 헛경보 차단(health-engine `company:network`와 정렬).
  - **[MED·공허 계약]** `title-nonempty`가 `page-title`과 똑같이 `<title` **문자열 존재**만 봐서 `<title></title>` 빈 제목도 통과(가짜 진단). → 정규식 marker(`regexMarkers`) 지원을 판정 엔진에 추가하고, title이 **실제로 비어있지 않은지**(`<title[^>]*>\s*[^\s<]`) 검사하도록 교정 — page-title(태그 존재)과 역할 분리(테스트 추가).

- **9차(운영 요약·이벤트 재구성·Loop 안전 — hq-v3.3.3)** → company-ops·events·loop-engine·propose-improvements를 2개 독립 감사로 병렬 점검. 정직·안전 결함 수정:
  - **[HIGH·거짓 성과]** 보안 카드 2개가 **하드코딩 `ok:true`**였고, 그중 "127.0.0.1만 허용"은 원격/휴대폰 연결이 켜지면 서버가 `0.0.0.0`(사설망)에 열리므로 **실제로 거짓**이었다. → 카드를 실측으로: 비밀값 저장 차단은 **거부 로직 존재 여부**로, 서버 접근 범위는 **실제 원격/휴대폰 노출 상태**로 정직하게 표기(테스트 추가).
  - **[HIGH·거짓 성과]** 이벤트 정렬이 문자열 비교라, `createdAt`이 빠진 깨진 이벤트가 `"undefined"`로 **가장 최신(last)에 정렬돼 완료된 작업을 '작업 중'으로 되돌리고** 신선도 감지까지 무력화하던 문제. → 숫자 시각 정렬 + 깨진 시각은 과거로 취급, 활동 시각 불명 비종료 작업은 '상태 확인 필요'로 낮춤(테스트 추가).
  - **[HIGH·회귀 은폐]** `rollback_completed`(배포 되돌림=회귀 발생)가 상태 라벨 누락으로 **'배정됨'(아직 시작 안 함)** 으로 표시되던 문제. → `rolled_back`("되돌림(롤백)") 상태·라벨 추가. 손상된 이벤트 줄은 조용히 삼키지 않고 로그로 남김(테스트 추가).
  - **[MED·무한 반복 안전]** `openIteration`에 엔진 차원 상한이 없어(serve.mjs 재큐 상한을 우회하면) 무한히 iteration만 오를 수 있었다. → `MAX_LOOP_ITERATION` 초과 시 `FAILED_SAFE`로 안전 중단·회장 확인 escalate(테스트 추가).
  - **[MED·중복 Loop]** `createLoop`이 같은 계약에 이미 활성 Loop가 있어도 새로 만들어 orphan 중복이 쌓이던 문제. → 활성 중복이 있으면 기존 Loop 반환(테스트 추가). meta 점검이 `RETRY_WAIT`(기계 대기)·승인 대기를 나이 무제한으로 면제하던 사각지대에 임계 부여.
  - 정직하게 남긴 후속(맥 Codex·구조 변경 필요): `transitionLoop` 자체에 종료 게이트(필수 합격기준·회귀 확인)를 넣어 "Codex exit 0 ≠ 해결"을 caller 규율이 아니라 엔진이 보장하게 하는 것 — 현재는 serve.mjs 주 경로가 원래 계약 2회 재검증+회귀 감사로 이행 중이고, 회복 자동종료 경로는 신호 회복(anti-flap 확정)으로만 닫는다. 엔진 내 게이트 통합은 회귀 위험이 커 후속에서 단계적으로.

- **10차(계약 평가자·UI·인력 정직성 — hq-v3.3.4)** → contract-engine 평가자·app.js UI·workforce를 2개 독립 감사로 병렬 점검. 거짓 성과 결함 수정:
  - **[HIGH·거짓 PASS]** `github_actions` 평가자가 `maxAgeHours`만 있고 `workflowFile`이 없으면(배포된 `pipeline-workflow` 계약) 성공·실패 섞인 최신 run을 받아 **conclusion을 안 보고 '성공 N시간 전'으로 통과**시켰다. 최근 실패한 수집 파이프라인이 초록으로 보이던 문제 → conclusion을 실제로 확인(실패=FAIL, 취소=DEGRADED, 진행중=정상)하도록 교정.
  - **[HIGH·거짓 진행]** 인력 화면이 **실행기 연결 플래그만으로** 담당 계약이 실패인 모든 직원을 '수정 중(REPAIRING)'으로 칠했다. 실행기는 1대라 큐에서 1건씩 처리하는데 12명이 동시에 '고치는 중'으로 보이던 거짓 병렬 진행 → 실제 작업(task)이 있을 때만 '수정 중', 나머지는 '자동 수정 대기(큐·순차)'로 정직화(테스트 추가).
  - **[HIGH·거짓 PASS]** '심층 계약 진단'이 fail·degraded만 보고 **미실행·점검불가(unavailable/blocked) 계약을 무시한 채 '전 계약 정상'** 초록을 띄웠다 → 실행 못한 계약이 있으면 '정상(점검 불가 N)'으로 표기.
  - **[MED]** 자산 점검이 **예산 소진으로 일부만 보거나 자산이 0개일 때 '자산 전부 200'으로 통과**하던 문제 → 미점검/자산없음은 UNAVAILABLE로 정직 표기(테스트 추가). 러닝봄 공식 링크 표본이 **5xx·401·400 오류도 '유효한 링크'로 통과**하던 문제 → 2xx(및 403/429 정책 구분)만 통과.
  - **[MED]** 오늘 '막힘·장애' KPI가 앱 상태가 전부 미확인일 때도 **0을 초록**으로 띄우던 것 → 확인된 상태가 없으면 '상태 확인 중' 중립. 포트폴리오 표가 **장애(down) 앱에 열린 작업이 있으면 '작업 중'으로 덮어** 장애를 가리던 것 → 장애가 우선 표시. `needNewSource`(회장이 소스 선언해야 풀리는) 계약이 인력 집계에서 빠져 '사람 확인 필요'에서 사라지던 것 → 사람 확인·실패 총계에 포함(테스트 추가).

- **11차(러너 종료·자동시작·전결 게이트 — hq-v3.3.5)** → runner-supervisor·desktop autostart·company-authority·serve 결재/전결 경로를 2개 독립 감사로 병렬 점검. **치명 1건 포함**:
  - **[치명·거짓 성과]** 자동 점검이 만든 **모든 결재가 생성 단계에서 통째로 버려지고** 있었다. `createRecord("approvals", …)`의 허용 필드에 `fixClass·failureClass·detectedAt`이 없어 throw → serve.mjs가 `catch`로 조용히 삼킴. 결과: 실제 장애·개선 신호가 있어도 결재·사건 보드가 비고, 점검은 "created 0"으로 정상인 척했다(자율 Loop·성장·전결의 근간이 실제로는 끊겨 있었음). 게다가 전결 human-gate(`isDelegable`의 fixClass 검사)도 fixClass가 저장 안 돼 **무력**이었다. → 허용 필드를 넓혀 생성 단계 보존(tasks의 originContract·approvalId·loopId 포함, 테스트 추가·실증 검증).
  - **[HIGH·전결 escape]** 전결(수석부회장 자동승인)이 헌장상 **항상 회장 확인**인 범주 일부를 자동승인했다. `NON_DELEGABLE`/`HUMAN_TEXT` 정규식이 `계정·구매·환불·자격증명·OAuth`를 놓치고, `NON_DELEGABLE`은 `개인정보 수집`만 있어 "개인정보 노출/처리방침"을 통과시켰다("동일하다"는 주석과 달리 두 정규식이 실제로 달랐음). → 두 정규식을 실제로 일치시키고 누락 키워드 추가(테스트 추가). 분류기가 읽는 텍스트도 게이트와 동일하게(본문 actual 포함) 맞춤.
  - **[HIGH·끄면 꺼질 것]** 러너 상태 파일이 **비원자적**이라 감독·러너 자식 동시 기록 시 조회가 반쯤 쓰인 파일을 읽어 **실행 중 러너를 '꺼짐'으로 오표시**(거짓 성과) → tmp+rename 원자적 쓰기. Windows에서 앱 종료 시 `spawn(taskkill)`이 exit 핸들러에서 실행되지 못해 러너·codex 손자가 **고아**로 남던 것 → `spawnSync`로 확실 종료.
  - **[MED]** 레거시 `install-autostart.mjs`가 여전히 **`KeepAlive=true`**(종료해도 되살리는 엔진)를 설치 — "왜 자꾸 켜져있냐"의 실제 뿌리 → `KeepAlive=false`(RunAtLoad만, 끄면 꺼짐)로 교정(테스트 갱신). 인력 산출 실패 시 'RUNNING' 위장 → 'UNKNOWN'. 수동 승인 라우트 멱등화(중복 업무 방지).
  - 정직하게 남긴 후속(LOW): 회사 모드 전이 매트릭스(긴급정지 해제 재확인)는 미도입 — fail-safe 방향(손상→PAUSED·원자적 쓰기)은 이미 견고. 러너 respawn의 EMERGENCY_STOP 게이팅은 pause/resume 회귀 위험으로 후속.

- **12차(큐 경쟁·실행기 경로·정본 파서 — hq-v3.3.6)** → task-queue·codex-runner·browser-driver·sources를 2개 독립 감사로 병렬 점검:
  - **[HIGH·이중 실행]** 큐가 교차 프로세스에서 비원자적 read-modify-write라, 서버(매 hq-status마다 `recoverStaleLeases`)와 러너가 동시에 같은 패킷을 만지면 claim 직후 lease 기록 전 마이크로초 창에 서버가 '정체'로 오판해 pending으로 되돌리고 → **같은 작업이 두 저장소에 동시 존재·이중 실행**될 수 있었다. → lease 없는 running 패킷은 파일 mtime으로 생존 판단(갓 쓰였으면 회수 안 함)해 창을 닫음(테스트 추가).
  - **[MED·거짓 성과+작업 유실]** 용량 소진·로그인 만료·미연결·복제본 부재 같은 **일시적** 사유가 "한도 회복되면 자동 재시도"라 알리면서도 실제로는 `failed`(종료)로 **작업을 영구 폐기**했다. → 일시적 사유는 대기열로 되돌려(러너 30초 폴링 재시도) 메시지대로 진짜 재개하고, 실제 코드 실패만 종결(테스트 추가).
  - **[MED·안전]** `control.json`이 손상되면 `paused:false`로 **fail-open**(긴급 정지가 몰래 풀림) → 파일이 있는데 파싱 실패면 안전측(일시정지)으로 읽음(테스트 추가).
  - **[MED·거짓 성과]** 상태 파서가 `## Blocked`에 '없음'이 **부분 문자열**로 든 실제 막힘("결제 응답 없음")을 '막힘 없음'으로 오인 → 섹션 전체가 none-표식일 때만 null(테스트 추가). `gitInfo`가 git 바이너리 실패에도 `available:true`로 '깨끗한 idle(작업 브랜치 0)'로 위장 → git 실패 시 `available:false`. 정본 레지스트리가 있는데 앱 0개로 파싱되면 경고 로그(손상 은폐 방지).
  - 정직하게 남긴 후속: 러너 heartbeat가 `spawnSync` 블로킹으로 실행 중 못 뛰는 문제(lease TTL>timeout로 완화 중, 근본 async 전환은 맥 Codex 검증 필요), 브라우저 드라이버 launch 실패 시 UNAVAILABLE 대신 FAIL(런타임 감지 필요)는 후속.

- **13차(건강 엔진 anti-flap·계약 정의 — hq-v3.3.7)** → health-engine·propose-improvements·contract-catalog 전 앱을 2개 독립 감사로 병렬 점검:
  - **[HIGH·거짓 성과]** 전역 네트워크 가드가 `production===null`(미점검)을 `FAIL`로 취급해, **무관한 앱이 아직 점검 안 됐다는 이유로 진짜 단일 critical 장애를 숨기거나**(장애를 info로 강등→화면에서 사라짐) 전부 미점검(콜드 스타트)일 때 헛경보를 냈다. → 실제 점검된 앱만·실제 FAIL만으로 판정하고, 실패한 앱만 강등(미점검·통과 앱은 정상 처리)(테스트 추가).
  - **[HIGH·영구 열림]** 건강 상태 파일이 비원자적이라 쓰다 크래시로 잘리면 다음 실행에서 **anti-flap·열린 incidentId가 통째로 리셋**돼, 회복돼도 자동 종료가 안 되고 회장 화면에 **영원히 열린 장애 카드**가 남았다. → 원자적 쓰기(tmp+rename)+`.bak` 복구(테스트 근거).
  - **[MED·헛경보] critical이 anti-flap을 우회(needed=1)** 해 재시도 없는 단발 probe의 순간 5xx·타임아웃 한 번이 곧바로 '긴급' 카드로 확정됐다 → critical도 2회 연속 확인(테스트 갱신).
  - **[MED·영구 열림+증식]** retired 앱 등 더 이상 방출 안 되는 계약이 `incidentId`를 영구 보유해 자동 종료 안 되고 상태가 무한 증식 → 유예(7일) 후 고아 정리 + 열린 incident는 회복으로 닫음(테스트 추가).
  - **[계약 정의]** `deployed-sha`가 SHA 미기록 시 빈 marker로 **진공 통과(거짓 green)**하던 것 → 미기록이면 `need_new_source`(정직한 UNAVAILABLE). 오해 소지 주석 교정.
  - 정직하게 남긴 후속: 계약 카탈로그의 나머지 공허·중복 marker(`page-title` `<title` 부분일치, `ics`/`storage`/`worker`/`기준·확인` 등 흔한 토큰, kakao·storage 중복)는 **발견했으나 이번엔 건드리지 않았다** — 라이브 앱 번들에 대조 없이 marker를 조이면 지금 잘 도는 앱을 **거짓 FAIL**로 만들 위험이 있어(공허 통과보다 나쁨), 맥에서 실측 검증 후 앱별로 신중히 고친다. (kakao JS 키·레거시 마이그레이션 키는 정상적으로 존재할 수 있어 forbidden 처리 시 오탐.)

- **14차(desktop IPC·창·트레이 — hq-v3.3.8, 일부)** → desktop main.cjs·mobile-access를 독립 감사. IPC 권한 상승·토큰 비교·바인딩은 **실제로 안전**함을 확인(ipcMain 핸들러 0개 — 모든 권한 동작이 로컬 HTTP·토큰 게이트를 지남). 발견한 실제 결함:
  - **[MED·거짓 안전]** 트레이 '모든 자동작업 일시정지'(안전 브레이크)가 fire-and-forget이라 서버가 순간 불통이면 **조용히 실패**하고 회장은 멈춘 줄 알지만 실제로는 계속 돌았다. → 성공/실패를 알림·오류 대화상자로 반드시 표시(HTTP 응답 상태까지 확인).
  - **[LOW 방어]** 메인 창에도 `sandbox:true`(스모크 창과 동일). 종료 시 `tray.destroy()`로 트레이 잔상 제거("끄면 꺼질 것"). (토큰 URL 지속성·스모크 종료 중 중단은 재설계 필요로 후속, 문서화.)
  - **[스냅샷 집계 — hq-v3.3.9]** company-store는 감사 결과 **견고**(뮤텍스·원자적 백업·개행 안전·고아 복구 모두 정상). build-snapshot 집계에서 실제 결함 수정: (a) `appHealth`가 배포 run이 없으면 lint·test 같은 **무관한 워크플로로 down/ok를 판정**하던 것 → 미확인으로(거짓 장애·거짓 정상 방지), (b) '오늘 실패' 수가 **비배포 워크플로 실패까지** 포함해 부풀던 것 → 배포 실패만('오늘 배포'와 기준 일치), (c) 승인함이 approvals.yml+이벤트를 **중복 제거 없이 병합**해 같은 안건이 두 번 뜨던 것 → id 기준 dedup. (store는 견고 확인, 집계 파이프라인 crash-guard·`planned` 버킷·networkSuspected 트레이드오프는 현 시점 무해로 문서화.)

- **15차(운영 프로브·서버 라우트 — hq-v3.3.10)** → operations-watchdog(운영 점검 프로브)·serve.mjs 나머지 라우트를 2개 독립 감사. 서버 라우트는 **인증 게이트 일관·경로우회 없음·비밀 유출 없음** 확인. 실제 결함 수정:
  - **[거짓 성과] 미래 시각을 fresh로 통과** — `freshnessState`가 미래 타임스탬프(시계 오류·9999 placeholder)를 음수 나이로 계산해 '신선'으로 판정 → 데이터 heartbeat가 영구 초록으로 위장될 수 있었다. 15분 skew만 허용하고 그 이상 미래는 `future`(≠fresh)로(테스트 추가).
  - **[거짓 성과] 만료된 TLS 인증서를 STALE(경고)로 삼킴** — 만료·자가서명 등 인증서 자체 문제까지 네트워크 오탐과 뭉뚱그려 STALE로 처리해 FAIL 집계에서 빠졌다 → 인증서 오류(CERT_HAS_EXPIRED 등)는 FAIL, 순수 네트워크 오류만 STALE로 분리.
  - **[거짓 제어] 실행 중 작업 취소가 먹히지 않던 것** — 회장이 실행 중 작업을 '취소'로 바꿔도 러너가 계속 돌고 완료 시 상태를 'in_review'로 **되돌려** 취소가 무시됐다 → 러너가 실행 직전·완료 시 기록 상태를 확인해, 취소·보류면 코덱스를 돌리지 않거나 상태를 덮어쓰지 않음(코덱스가 이미 변경했으면 정직하게 로그)(테스트 추가).
  - **[방어] 저장소 이름 slug 검증** — `resolveWorkdir`가 `..`·경로구분자 섞인 저장소 이름으로 작업 디렉터리가 상위로 이탈할 수 있던 것(쉘 없음이라 주입은 아님) → 안전 slug + 형제 경로 재확인으로 차단(테스트 추가). `/api/tasks`가 클라이언트 status를 그대로 받아 '완료' 표시하며 실행하던 불일치 → 접수 작업은 항상 queued로 시작.
  - 정직하게 확인·문서화: outbom 날씨 신선도는 inspectApp이 아니라 **계약 엔진의 forecast 심층 계약**이 담당(division of labor), 200 빈 렌더는 **browser_smoke 계약**이 잡음 — 프로브 단독 거짓 PASS 아님. source-workflow BLOCKED_EXTERNAL·hq-status GET recover는 무해로 후속.

- **16차(판정 엔진 evaluator + 화면 정직성 — hq-v3.3.11)** → health-engine evaluator와 app.js 나머지 화면(문제 처리 보드·Loop 보드·앱 상세·기록 탭)을 2개 독립 감사. 실제 결함 수정:
  - **[HIGH·거짓 성과] 정체 PR 신호가 죽어 있었음** — `prAgeResult`가 실제 스냅샷에 **존재하지 않는 필드**(`pr.createdAt`)를 읽어 `Date.parse("")→NaN→0일`로 계산 → 30일 넘게 정체된 PR도 전부 PASS로 삼켰다(테스트는 합성 `createdAt`을 써서 초록). → 실제 필드 `pr.updatedAt`(마지막 활동)으로 정체를 판정하고 draft PR은 제외(테스트 추가).
  - **[MED·거짓 정상/거짓 장애] CI 판정이 배포와 무관** — `ciResult`가 `ci[0]`(최근 아무 워크플로)만 봐서 lint 실패로 '배포 위험' 오탐하거나 오래된 배포 실패를 최근 lint 통과로 가렸고, `failure`만 실패로 봐 `timed_out`·`startup_failure`를 정상으로 위장했다. → build-snapshot(appHealth)과 동일하게 **deploy run만으로** 판정, 완료 못한 종료(timed_out·startup_failure)도 실패(테스트 추가).
  - **[HIGH·거짓 성과] 화면이 '미점검·미해결·미갱신'을 초록으로 위장** — (a) 문제 처리 보드가 종합 점검 전에도 "문제 없음" 표시 → `HQ.health` 유무로 '아직 확인 전'과 구분, (b) '컴퓨터 자동' KPI가 열린 미해결 사건을 항상 초록 성공으로 → 진행 중(accent)으로, (c) Loop 상태 칩 색이 담당(authorityClass) 기준이라 멈춘 Loop도 초록 → **실제 상태** 기준 색으로, (d) 자동 점검 0건이 "이상 없음"(무결 주장) → 사실 '대기 중 제안 없음'으로, (e) 데이터 탭이 production 없음을 "운영 기준 통과"로·FAIL을 amber로 → '미확인'·red로, (f) 보안 탭이 실패 항목을 amber '확인'으로 완화 → red '실패'로, (g) 앱 화면에 예시·지연 데이터 freshness 배너 추가, (h) '열린 요청' 집계가 종료 집합 불일치로 부풀던 것 → openCount과 동일한 OPEN_DONE 사용(전부 소스-패턴 테스트로 고정).
  - 정직하게 확인·문서화: loopBoard meta의 "모두 정상" 문구는 `issueCount`가 항상 숫자(0 포함)라 오탐 아님 — 지어낸 수정 없이 **비결함으로 판정**(거짓 성과 금지는 없는 버그를 만들지 않는 것도 포함).

- **17차(심층 계약 엔진 + 사건 분류기 + 배포 파이프라인 — hq-v3.3.12)** → 심층 계약 엔진(catalog·engine·assert), 사건 분류/전결 게이트, 배포·오프라인 셸을 3개 독립 감사. 배포/SW는 대부분 **견고**(network-first라 stale-forever 없음, payload·serve 경로 일치, 자산 glob 정상) 확인, 실제 결함만 수정:
  - **[HIGH·거짓 PASS] 비밀 스캔이 자산을 못 봐도 통과** — `evalSurfaceMarker`가 금지 marker(비밀키·analytics)의 '없음=PASS'를, 비밀 든 번들이 503·예산소진으로 **안 떠서 못 본 채로도** 통과시켰다(같은 자산에 `surface_assets`는 FAIL). → 자산 미수신·미점검이면 PASS가 아니라 UNAVAILABLE(evalSurfaceAssets와 동일 가드). 테스트 추가.
  - **[HIGH·거짓 정상] 완료 못한 CI를 success로 위장** — `evalGithubActions` 기본 분기가 `failure`만 실패로 보고 `timed_out`·`startup_failure`를 PASS로 삼켰다(같은 함수의 maxAgeHours 분기는 이미 올바름). → success만 통과, 나머지 미완료 종료는 FAIL(cancelled만 degraded)로 정렬. 테스트 추가.
  - **[MED·거짓 강등/mis-severity] 만료 인증서를 네트워크 오탐으로 삼킴** — `evalTls`가 rejectUnauthorized로 secureConnect 전에 나는 인증서 오류(만료·자가서명)를 catch에서 degraded로 처리해, 이 계약이 존재 이유인 하드다운(만료=접속 차단)을 FAIL로 못 냈다. → 인증서 자체 오류는 critical FAIL, 순수 연결 실패만 degraded(operations-watchdog와 동일 분류). 테스트 추가.
  - **[MED·자기감시 오작동] engine-self가 항상 DEGRADED** — 실행 카운트 증가가 evaluator '이후'라 마지막 engine-self 차례엔 N-1/N이 돼 정상 run도 영구 '계약 부족' 경보(off-by-one). → 자신(+1)을 세어 비교, 정상 run은 PASS. 테스트 추가.
  - **[MED·거짓 강등] x-data-stale: 0을 stale로 오표기** — 서버가 명시적 fresh("0")를 보내도 truthy 문자열이라 DEGRADED로 강등했다. → 0/false/no/off/fresh는 fresh로 취급. 테스트 추가.
  - **[HIGH·라우팅] 회장 전용 안건이 소문자/영문 변형으로 새어 codex+전결 자동승인** — 사건 분류기 HUMAN_TEXT와 전결 게이트 NON_DELEGABLE이 바이트동일·대소문자 구분이라 `oauth`·`app store`·`api key`·`payment/stripe`가 둘 다 빠져나가, 비밀·결제 안건이 회장 확인 없이 자동 실행 대상이 됐다. → 두 정규식에 `/i` + 동의어(payment·stripe·paypal·앱스토어·App key) 동일 추가. 테스트 추가(양쪽).
  - **[HIGH·거짓 안전] self_heal이 영구 '자동 처리 중'으로 방치** — 재점검만으로 안 낫는 코드/설정 결함(예: 오프라인 셸 프리캐시 누락)이 warning self_heal이면 결재도 Loop도 안 생기고 회장 화면에 영원히 초록으로 남았다. → self_heal이 3일 이상 미회복이면 codex 결재로 **승격**(#escalated 키로 중복 상신 없음). 테스트(분류)로 고정.
  - **[MED·거짓 표기] 릴리스 태그≠package.json 버전** — 릴리스 제목은 태그, 설치본 버전은 package.json에서 와 서로 어긋나면 회장이 'v3.4.0'을 받아도 앱은 v3.3.11로 표시될 수 있었다. → 릴리스 워크플로에 태그↔package.json 버전 일치 가드(불일치 시 빌드 중단).
  - 정직하게 후속 문서화(비결함/트레이드오프): `ci-latest`가 워크플로 무관 최신 run을 보는 마스킹(M1)·버전 marker 부분문자열 매칭(M3)·on-host soft-404(M5)는 카탈로그 config 변경이 필요한 별도 설계로 이관, `company:security` 단일 dedup 키(M1-incident)·PASS+warnings 경로(M2-incident)는 실제 발생 조건이 드물어 후속. SW 캐시 이름 비-bump는 network-first라 무해(문서화).

- **18차(자율 Loop 종료 게이트 + 인력 시뮬레이션 — hq-v3.3.13)** → Loop 상태기계·회귀 가드·러너 감시기, 인력/제안 생성을 2개 독립 감사. 이 회사의 **핵심 정직 약속**("원래 계약이 다시 통과해야 종료" + "다른 걸 깨뜨리면 성공 아님")을 겨눈 감사다. 정본 종료 경로(원래 계약 2회 연속 PASS + 회귀 가드)는 **건전** 확인, 그 앞의 더 느슨한 두 종료 경로에서 실제 결함 수정:
  - **[HIGH·거짓 성공] 회복 자동종료가 회귀 가드를 건너뜀** — 신호 회복으로 Loop를 닫는 경로(serve.mjs)가 코드 변경 Loop(codex/human)를 회귀 검사 없이 닫아, 원래 계약은 고쳤지만 **다른 계약을 깨뜨린** 수정도 성공으로 종료됐다(task 경로는 같은 상황을 '회귀 보류'로 막는데 서로 모순). → 회복 경로에도 같은 집합 기준 회귀 가드를 적용, 회귀면 성공으로 닫지 않고 재시도로 남긴다.
  - **[HIGH·거짓 종료] 고아(retired) 계약을 '회복 PASS'로 위장 종료** — 앱 은퇴·점검 중단으로 계약이 더 이상 방출되지 않으면(orphan_pruned) 원래 계약이 통과한 적 없는데도 `origin_recheck: PASS`로 Loop를 닫았다. → orphan_pruned는 회복과 구분해 `UNVERIFIED_RETIRED`로 정직 종료(성공 아님 명시), 결재도 "재검증 불가" 문구로 종료.
  - **[HIGH·거짓 병렬/거짓 성과] 대기·막힌 업무가 '자동 수정 중'으로 위장** — workforce가 `queued`·`blocked` 업무까지 REPAIRING("자동 수정 · 수정 중")으로 표시해, 실행기 미연결인데도 `executorBusy`가 `executorCapacity(0)`를 넘고 **막힌 업무가 자동 처리 중으로 뒤집혀** 보였다. → 실행기 연결 + 실제 진행 상태일 때만 REPAIRING, `queued`→대기(TRIAGING)·`blocked`→BLOCKED로 정직 표기(같은 규칙을 실패 계약엔 이미 적용 중이던 것을 업무에도 확장). 테스트 추가.
  - 정직하게 확인·문서화(비결함/후속): 정본 종료 게이트(원래 계약 2회 PASS + 집합 기준 회귀 가드)·iteration 캡(8)·requeue 캡(5)·감시기 프로세스 위생(detached kill·지수 backoff)은 **건전**. 후속 설계 이관: 엔진 `transitionLoop` 자체 CLOSE 게이트 부재(M3, call-site 규율로 보강 중)·앱 범위 회귀 가드의 앱 간 파급 미검(M2)·느린 크래시 backoff 회피(supervisor L1)·warn 앱 무-incident 드롭·DEGRADED가 workforce 실패 헤드라인서 제외(중간 심각도, 다음 라운드).

- **19차(원격/휴대폰 인증 + 보안 점검 — hq-v3.3.14)** → 원격/휴대폰 토큰 인증 게이트와 보안 점검 자체의 정직성을 감사. **인증 게이트는 견고**(우회 없음·상수시간 비교·crypto 무작위 54비트 토큰·DNS 리바인딩 차단·로컬 전용 기본·토큰 응답 유출 없음) — 헛경보 없이 확인. 실제 결함만 수정:
  - **[MED·토큰 수명] 페어링 토큰이 서버상 무기한 유효** — 24h 쿠키 Max-Age는 브라우저만 잊게 할 뿐 서버는 같은 토큰을 영원히 받아줘, 유출된 QR/토큰(사진·URL 기록·랜 캡처)이 사람이 재발급할 때까지 무기한 유효했다. → 발급 시각+TTL(기본 30일)로 서버가 실제 만료 강제, 만료 토큰은 '연결됨'으로 위장하지 않고 재발급 안내(expired 플래그). 테스트 추가.
  - **[MED·거짓 안심] 보안 점검 2개가 하드코딩 ok:true** — "서버 접근 범위"·"추가 유료 운영비 없음"이 어떤 상태에서도 초록이라 회장에게 경고할 수 없었다. → "서버 접근 범위"는 약한 원격 토큰(16자 미만·단순 반복)이면 경고, "유료 API·키 미사용"은 슬로건 대신 모델 API 키 env 실측(있으면 경고)으로 바꿈. 테스트 추가.
  - 정직하게 확인·문서화(비결함/후속): 인증 게이트 전반은 건전(위 목록). L1(비밀 차단 점검이 문자열 존재만 확인)·L2(QR 첫 로드 URL에 토큰 포함 — QR 페어링 특성상 불가피, 로컬 생성으로 완화)·L3(길이 단락 timing — 토큰 길이 공개라 무해)는 저심각도로 문서화.

- **20차 정리(이월 중간건 소진 — hq-v3.3.15)** → 새 감사 대신, 앞선 라운드에서 검증했지만 이월했던 중간 심각도 결함 중 명확·저위험 2건을 정리 배포:
  - **[MED·문제 가림] 보안 실패가 하나의 결재로 뭉쳐 서로를 가림** — `company:security` 단일 키로 모든 보안 실패를 한 결재에 묶어, 한 건이 상신돼 있는 동안 새로 실패한 다른 점검이 dedup에 걸려 안 보였다. → 점검 항목마다 개별 키(`company:{slug}:security`, 끝은 :security 유지해 필터·human 분류 정상)로 상신. 테스트 추가.
  - **[MED·화면 불일치] DEGRADED가 workforce 실패 헤드라인서 누락** — DEGRADED+warning은 health 엔진이 incident로 올리는데 인력 화면 '실패 N'엔 빠져 두 화면이 어긋났다. → FAIL과 함께 DEGRADED+warning(info 제외)도 '주의 필요'로 집계(파티션 불변식 유지). 테스트 추가.
  - 남은 이월(다음 라운드): 앱 간 회귀 파급(M2)·엔진 자체 CLOSE 게이트(M3)·warn 앱 무-incident 드롭·supervisor 느린 크래시 상한(L1). 미감사: office.js 시뮬레이션 수치, contract-catalog 마커 품질.

- **21차(계약 카탈로그 마커 품질 + office.js 시뮬레이션 — hq-v3.3.16)** → 계약 '정의'(마커·임계·needNewSource)와 오피스 시뮬레이션 수치의 정직성 감사. HIGH 없음. office.js는 **완전 건전**(HUD·층별·티커 등 회장이 사실로 읽는 모든 수치가 실데이터(computeWorkforce·SNAP) 출처, 랜덤/among이 표시 수치에 안 섞임 — 시각 연출만 illustrative). 카탈로그도 대체로 정직(need_new_source·빈배열 FAIL·forbidden-marker UNAVAILABLE 경로 모두 비진공). 실제 결함(진공 marker green) 수정:
  - **[MED·거짓 green] 특정 기능을 증명 못 하는 진공 marker 4건** — `offline-shell`(sw.js의 './'·'index.html'), `multi-tab-safety-static`(번들의 'storage' — localStorage에도 있음), `stale-banner`(certbom '기준'·'확인' — 거의 모든 한국어 UI), `worker-wasm-refs`(notebom 'worker' — serviceWorker에도 있음)가 일반적 substring 하나로 PASS를 내며 각각 특정 기능(프리캐시·멀티탭 핸들러·LKG 배너·Web Worker) 존재를 주장했다. → 마커를 억지로 조이면(un-inspectable 번들에 거짓 FAIL) 더 나쁘므로, 정직하게 `need_new_source`(UNAVAILABLE '새 신호 필요')로 전환 — 거짓 green 제거, 거짓 FAIL 없음, sourceNeeded/whyNeeded/fallback 메타 완비. 테스트로 고정.
  - 정직하게 확인·문서화(비결함): office.js 사실 수치 전부 건전, `login-item-status`는 pass/fail 게이트가 아니라 실제 ON/OFF를 읽는 상태 보고(정상). deployed-sha·forecast-probe·user-recording-health 등 기존 need_new_source 경로는 이미 정직.

- **22차(자율 Loop 종료 — 엔진 자체 2차 방어, hq-v3.3.17)** → 이월 M3 처리. 정본 종료 게이트는 call-site 규율(원래 계약 2회 PASS + 회귀 가드)로 지켜지지만, `transitionLoop`이 **엔진 레벨**에선 아무 CLOSE나 근거 없이 받아들여, 미래에 잘못 짜인 호출부 하나가 '거짓 성공'을 낼 수 있었다. → CLOSED 전이는 **반드시 검증 근거(evidence.origin_recheck)를 지녀야** 하고, 없으면 엔진이 거부하고 `close_rejected` 이벤트로 기록하며 Loop를 열린 채 남긴다(거짓 성공 대신 열린 상태로 드러냄). 5개 호출부 모두 근거 보유 확인(회장 확인 종료엔 `HUMAN_CONFIRMED` 근거 명시), FAILED_SAFE(정직한 포기)는 게이트 예외. 테스트(근거 없는 CLOSE 거부) 추가.

- **23차(러너 감독기 느린 크래시 — hq-v3.3.18)** → 이월 supervisor L1 처리. 크래시 판정이 '15초 미만'이라 ~20초에 반복해 죽는 '느린 크래시'가 clean 종료로 오인돼 3초 고정 재시작(백오프·상한·escalate 없음) → 무한 tight 재시작이 될 수 있었다. → 크래시 판정을 '안정 가동(90초) 미달'로 넓혀 느린 크래시도 지수 백오프(최대 2분)에 걸리게 하고, 안정 가동 없이 15회 연속 실패하면 재시작 간격을 10분으로 낮추고 회장 확인으로 escalate(쿼터·자원 소모 방지). 재시작 정책을 순수 함수 `restartPlan`으로 분리해 테스트로 고정.
- **24차(CI 판정 두 화면 일치 — hq-v3.3.19)** → 이월 warn 드롭 처리. 배포 결론이 success도 hard-fail(failure·timed_out·startup_failure)도 아닌 종료(cancelled·neutral·action_required·stale)를 `ciResult`가 PASS로 위장해, build-snapshot이 'warn'으로 보는 것과 어긋나고 무-probe 앱에서 조용히 드롭됐다. → success만 PASS, hard-fail은 FAIL, 그 외 종료는 **DEGRADED-info**로 노출(초록 위장 없음·사건/결재 스팸 없음, 두 화면 일치). 테스트 추가. **이월 중간건 전부 소진**.

- **25차(이벤트 로그·자동시작 — hq-v3.3.20)** → 마지막 미감사 모듈(events.mjs·install-autostart.mjs·main.cjs 자동시작 배선) 감사. 자동시작은 **건전**(실제 OS 로그인 항목을 읽어 정직 보고, disable이 실제로 꺼짐, 재설치 idempotent, plist 절대경로·XML 이스케이프). 이벤트 리더도 대체로 건전(손상 라인 건너뛰되 이후 유효 이벤트 유지, 깨진 createdAt이 last 오염 못 함, 원자적 스냅샷). 실제 결함 수정:
  - **[HIGH·승인 게이트 붕괴] 사람 승인 대기가 30분 뒤 조용히 사라짐** — `deriveRuns`가 비종료 run을 30분 경과 시 무조건 `needs_check`로 낮춰, 이벤트 기반 `approval_pending`·`external_wait`(사람/외부 대기는 정상적으로 오래 걸림)가 회장 승인함(build-snapshot의 approvalPending)에서 **시간 경과만으로 빠졌다**. CLAUDE.md의 human-in-the-loop 승인 경계를 정면으로 무너뜨리는 결함. → 대기 상태(`approval_pending`·`external_wait`)를 stale 강등 예외로(터미널처럼) 처리해 결재될 때까지 승인함에 유지. 테스트 추가.
  - **[LOW] run 정렬이 버렸던 localeCompare 안티패턴 재도입** — `lastActivity` null 항목이 실제 시각보다 뒤로 정렬돼 순서 오염 → 시각 비교로 교체(깨진 값은 가장 과거). 
  - **[MED·정직성, hq-v3.3.21에서 처리] 손상 이벤트 유실이 화면에 안 뜸(M2)** — 손상 라인을 건너뛰고 로그엔 남기지만 스냅샷 `connections.events`는 무조건 'connected'라 회장이 데이터 유실을 못 봤다. → `readEventsWithMeta`로 dropped 수를 반환해 스냅샷에 `degraded(손상 N줄 건너뜀 — 일부 상태 부정확)`으로 정직 노출. 테스트 추가.
  - 정직하게 후속 문서화: M1(이벤트 히스토리 무회전 — 다월 운영 시 디스크·스냅샷 크기 증가)은 실제 결함이나, 날짜 윈도우/rotation을 넣되 **장기 대기(external_wait 스토어 심사 등) 항목이 유실되지 않게** 하는 설계가 필요해 별도 라운드로 신중히.

- **26차(세션 자기검증 → 자기 결함 수정 — hq-v3.3.22)** → 이 세션 변경분(3.3.11~3.3.21)을 적대적으로 자기검증. 핵심 정직 경로(CLOSE 게이트·ciResult·workforce 파티션·runner backoff·events·정규식·카탈로그)는 **전부 건전** 확인. 내가 이 세션에 넣은 실제 결함만 수정: **[MED]** self_heal 승격 결재가 승인되면 existingKeys에서 빠져 매 실행 중복 상신됐고 회복돼도 안 닫힘 → 승격은 **열린 Loop 유무**로 중복 방지, 회복 시 `#escalated` 결재도 base contractId로 함께 종료. **[LOW]** 회복 경로가 존재하지 않는 `loop.fixClass`를 읽던 것 → `loop.authorityClass`로 교정.
- **27차(두 CI 엔진 판정 일치 — hq-v3.3.23)** → `evalGithubActions`(deep)가 skipped·neutral·action_required·cancelled를 FAIL(사건)로 올려 health-engine `ciResult`(3.3.19: DEGRADED-info)와 어긋나던 것 → 실제 실패(failure·timed_out·startup_failure)만 FAIL, 나머지 비성공 종료는 **DEGRADED-info**(deep 계약 severityIfFail=error여도 incident 안 나게 severity:info 명시)로 통일. 테스트 추가. **알려진 이월 결함 전부 소진.**
- **29차(desktop IPC·계약 assertion·task-queue 심층 — hq-v3.3.25)** → 마지막 미감사 보안 표면 감사. `desktop/main.cjs` IPC는 **건전**(리포 전체에 `ipcMain`/`preload` 자체가 없음 — renderer가 특권 동작을 호출할 통로가 물리적으로 없음, contextIsolation+sandbox+no-preload 확인). 실제 결함 2건(HIGH) + 1건(LOW) 수정:
  - **[HIGH·DoS] `safeRegex`의 중첩 수량자 방어가 겹치는 대체(alternation)를 놓침** — `(a|a)+` 같은 패턴이 통과해, 31자 입력 하나로 Node 단일 스레드를 **73초** 멈췄다(계약 엔진 전체가 멈춤). 현재 카탈로그엔 미사용이지만 공개 연산자 allowlist라 향후 계약이 채택하면 실사용 데이터로 트리거 가능. → 대체(|)를 품은 그룹에 수량자가 붙으면 추가로 거부. 테스트(실측 73초 재현 케이스) 추가.
  - **[HIGH·안전 무력화] 손상된 task 패킷이 `task-queue.mjs`에서 조용히 사라져 단일 실행 보장이 깨짐** — `readPacket`이 파싱 실패를 삼키고 `listState`가 filter(Boolean)으로 던져, 크래시로 잘린 running 패킷이 모든 큐 조회에서 **투명 인간**이 됐다. 결과: (a) `claimNextTask`의 동시쓰기 방지 가드가 손상 파일을 못 세어 **같은 저장소에 두 작업이 동시에 running**될 수 있었고, (b) `recoverStaleLeases`가 못 보므로 영원히 회수 안 되는 유령 잠금, (c) `queueSummary`엔 아무 이상 없다고 표시. → 두 함수 모두 **원본 파일 목록**을 순회하도록 바꿔 손상 여부와 무관하게 잠금을 인정하고, stale이면 조용히 버리지 않고 `failed`로 격리(+`.corrupt`로 원본 증거 보존). `queueSummary`에 `corrupted` 카운트 신설(숨기지 않음). 테스트 추가.
  - **[LOW] `unique` 연산자가 빈 배열에서 진공참 통과** — 같은 파일의 `every` 쿼안티파이어는 이미 막아둔 패턴을 `unique`엔 적용 안 함(빈 결과를 "중복 0개"로 오인). → `length > 0` 가드 추가(실제 카탈로그 사용처인 notices/sources id 중복 계약이 즉시 혜택 — 수집 실패로 빈 배열이 와도 더는 통과 못 함). 테스트 추가.
  - 정직하게 확인·문서화: `contract-assert.mjs` 숫자 비교 전부 `===`/타입 가드로 coercion 안전, `every`/`some` 빈배열 처리 이미 정확, `task-queue.mjs`의 원자적 rename 기반 claim·`MAX_RECOVER` 상한·`writeControl`/`writeRunnerStatus` tmp+rename은 전부 건전. `resolvePath`의 빈 문자열→인덱스 0 귀결은 사람이 작성하는 계약 path 오타에만 영향(공격 표면 아님)이라 저위험 후속.
- **28차(M1 — 스냅샷 runs 크기 제한 — hq-v3.3.24)** → `latest.json`이 종료된 run까지 전부 임베드해 다월 운영 시 무한 증가하던 것 → 임베드 runs를 **비종료(approval_pending·external_wait·작업중) 전부 보존 + 종료 run 최근 80개**로 bound(build-snapshot). 집계 수치는 전체 runs로 계산해 정확도 유지, **장기 대기 항목은 비종료라 절대 안 잘림**. readEvents 파일 파싱은 장기 대기 보존 위해 미변경(파일 rotation은 별도 설계 필요로 후속). 테스트 가드 추가.
- **30차(레거시 자동시작 제거 정합성 — hq-v3.3.26)** → 25차에서 경미로 문서화했던 L4(`install-autostart.mjs`의 `uninstallAutostart`가 `bootout`만 하고 `disable`은 생략) 해소. `desktop/main.cjs`의 `killLegacyAutostart`는 이미 bootout+disable을 함께 하는데, 레거시 CLI 도구만 disable을 빼먹어 "다른 프로세스가 같은 경로에 plist를 되살리면 조용히 부활"할 수 있는 비대칭이 실재했다. → `uninstallAutostart`에 `launchctl disable`을 추가해 데스크톱 셸과 동일 정책(bootout+disable+rm)으로 통일. `launchctl`은 실제 macOS 바이너리라 이 샌드박스에서 기능 검증은 불가 — 소스 패턴 가드 테스트로 고정.
- **39차(robom.kr 보안 헤더 부재 — site, HQ 버전 무관)** → site/ 전수 레드팀 감사(이번 세션 처음). `site/worker/index.ts`(Cloudflare Worker 진입점)가 vinext handler로 순수 passthrough만 해 사이트 전역에 보안 헤더가 하나도 없었다 — 회장이 앱을 받는 핵심 경로 `/get/[id]`가 clickjacking(투명 iframe으로 설치 버튼 위 덮기)에 노출됐다. → 페이지 렌더링에 영향을 줄 수 있는 CSP script-src/style-src 세부 지시문(이 샌드박스에서 실제 배포 검증 불가)은 손대지 않고, 프레이밍만 막는 안전한 헤더(X-Frame-Options: DENY, CSP frame-ancestors 'none', X-Content-Type-Options, Referrer-Policy, HSTS)만 모든 응답에 추가했다. 정직하게 후속 문서화(미수정): iframe 미리보기(`/apps/[id]`)에 sandbox 속성 없음(LOW-MED, 1차 당사자 신뢰로 완화), JSON-LD `dangerouslySetInnerHTML`이 `</script>` 이스케이프 안 함(LOW, 데이터 출처가 통제된 registry라 잠재 결함), GitHub Pages 정적 미러의 hydration 비활성으로 인한 설치 안내 기본값 굳음(LOW, 구조적).
- **38차(macOS ad-hoc 서명 실패 은폐 — CI, HQ 버전 무관)** → `desktop/build/after-pack.cjs`(electron-builder afterPack 훅, 미감사 영역)를 직접 점검. `codesign` 실패를 `console.error`만 하고 "계속 진행"해, 서명이 실제로 안 된 dmg/zip이 그대로 만들어지고 릴리스 워크플로 "산출물 확인" 스텝은 파일 존재만 보므로 CI가 초록불로 끝날 수 있었다 — 이 훅의 유일한 목적이 "손상됨" 대신 "확인되지 않은 개발자"로 뜨게 하는 것인데, 서명이 실패하면 정확히 그 목적이 조용히 무너진 채(회장이 겪을 UX 저하를 아무도 모른 채) 릴리스됐다. → 서명 실패를 삼키지 않고 throw해 빌드를 실패시켜 CI에서 보이게 했다.
- **37차(certbom 소스 워크플로 heartbeat 영구 실패 마스킹 — CI, HQ 버전 무관)** → `operations-watchdog.mjs`의 `inspectCertbomSourceWorkflow`가 fetch 예외·`!response.ok` 모두 `BLOCKED_EXTERNAL`(status 집계에서 FAIL로 안 잡힘)로 묻었다 — GITHUB_TOKEN 만료(401), 워크플로 파일 rename·삭제(404), rate-limit(403) 같은 **영구 실패**까지 "일시적으로 도달 못 함"으로 위장돼 certbom 데이터 파이프라인 생존 감시가 무기한 조용히 무력화될 수 있었다. → 실제 HTTP 응답을 받은 경우(GitHub가 확정적으로 답함)는 FAIL로 승격하고, fetch 자체가 던지는 진짜 네트워크 예외(DNS·타임아웃)만 BLOCKED_EXTERNAL로 남겼다. 함수를 export하고 전역 fetch 스텁으로 두 경로(HTTP 404→FAIL, 네트워크 예외→BLOCKED_EXTERNAL) 모두 테스트로 고정(7/7 통과).
- **36차(AI 컨텍스트 생성기 정확성 — CI, HQ 버전 무관)** → `build-ai-context.mjs`(35차 감사에서 발견, 현재 어떤 cron에도 연결 안 됨을 확인했지만 향후 자동 작업 배선 시 실제로 쓰일 파일이라 지금 고침) 2건 수정:
  - **[MED]** `git diff` 계산 실패(얕은 체크아웃 등)를 `["diff를 계산하지 못했습니다."]`라는 가짜 파일 항목으로 둔갑시켜 "## 변경 파일" 목록에 그대로 렌더했다 — 이 컨텍스트를 읽는 AI가 오류 문구를 실제 변경 파일로 오인해 "변경 거의 없음"으로 판단하고 잘못된 범위의 작업을 승인할 수 있었다. → 조용히 계속하지 않고 loud하게 throw.
  - **[MED]** 16KB 하드 truncation이 컨텍스트 뒤쪽부터 잘라내는데 "패밀리 핵심 규칙"(안전 규칙)이 맨 뒤에 있어, 변경 파일·앱 지도가 커지면 안전 규칙부터 조용히 잘려나갈 수 있었다. → 패밀리 핵심 규칙을 맨 앞으로 옮겨 truncation이 변경 파일·앱 지도(덜 치명적)부터 잘리게 했다. 실행 확인: 정상 경로(규칙이 맨 앞에 옴)·실패 경로(diff 실패 시 즉시 에러) 둘 다 실측.
- **35차(보안 감사 스크립트 사각지대 — CI, HQ 버전 무관)** → `ops/scripts/family/`(9개, cron 워크플로가 실제 호출하는 로직 — 이번 세션 처음 감사) 전수 점검. 실제 결함 수정(security-audit.mjs):
  - **[HIGH·거짓 성공]** `auditDir`가 `.`·`apps/mobile`·`apps/web` 3경로 전부에서 lockfile을 못 찾으면 `null`을 반환하고, 호출부가 `if (entry) results.push(entry)`로 null을 조용히 버렸다 — 저장소가 이 3경로 밖에 lockfile을 두도록 재구성되면(워크스페이스 이관 등) 그 저장소는 감사 결과에 흔적조차 안 남고, `failures` 집계는 `results` 안의 항목만 보므로 **감사를 못 했는데도 전체 status가 PASS**로 새는 구조였다(보안 감사가 스스로 "감사 실패"를 놓치는 유형). → 저장소당 최소 1곳도 감사 못 하면 명시적 `error` 항목을 추가해 FAIL로 승격. 격리된 로직 시뮬레이션으로 수정 전/후 동작 차이 확인(수정 전 PASS→수정 후 FAIL).
  - 정직하게 후속 문서화(이번엔 미수정): security-audit.mjs의 audit JSON 포맷 드리프트 시 취약점 0 오판(MED), operations-watchdog.mjs의 certbom heartbeat 영구 실패가 BLOCKED_EXTERNAL로 마스킹(MED), build-ai-context.mjs의 git diff 실패 시 오류문구가 파일 목록으로 둔갑 + 16KB truncation이 패밀리 안전규칙 꼬리를 자를 수 있음(MED×2, 단 현재 두 스크립트 모두 어떤 cron에서도 호출 안 됨 확인) — 다음 라운드 후보.
- **34차(payload 준비 스크립트 — CI, HQ 버전 무관)** → `desktop/scripts/prepare-payload.mjs`(릴리스 워크플로가 매번 호출, 미감사 영역)를 직접 점검. 필수 복사 항목(`scripts/control-center` 서버 전체, `ops/control-center/app` 화면 전체)이 없으면 `console.warn`만 하고 조용히 건너뛰었다 — 릴리스 워크플로의 "산출물 확인" 스텝은 dmg/zip/exe **파일 존재**만 보고 내용은 안 보므로, 향후 저장소 구조 변경으로 이 경로가 사라지면 서버·화면 없는 빈 껍데기 설치본이 그대로 릴리스되는데도 CI는 초록불로 끝나는 조용한 거짓 성공이 될 수 있었다(이번 세션 반복 발견 패턴). → 두 필수 항목만 누락 시 `process.exit(1)`로 즉시 실패시키고, 나머지(트레이 아이콘·예시 스냅샷 등 선택 항목)는 기존 경고 유지. 실제 payload 빌드로 회귀 없음 확인(16개 항목 정상 복사).
- **33차(GitHub Actions 워크플로 11종 전수 감사 — CI, HQ 버전 무관)** → `.github/workflows/*.yml`은 이번 세션 처음으로 전수 레드팀 감사(그동안 lib/*.mjs·desktop/main.cjs·app.js 위주). 스크립트 인젝션·`pull_request_target` 오용·시크릿 로그 노출·과도한 권한은 **0건**(9개 파일 건전 확인 — operations-watchdog·security-audit·daily-company-run·daily-marketing·monthly-board-run·deploy-site-pages·family-contract·guardrails·registry-drift). 실제 결함 수정(daily-kakao-report.yml):
  - **[MED·거짓 성공]** 카카오 "나에게 보내기" 발송 curl에 `-f`도 응답 검증도 없어, 토큰 만료·쿼터 초과로 HTTP 4xx/5xx나 에러 바디가 와도 워크플로가 초록불로 끝났다(회장에게 일일 PR 보고가 전혀 안 갔는데 성공으로 보임). → HTTP 상태코드와 카카오 성공 응답(`result_code:0`)을 함께 확인해 실패 시 명시적으로 잡을 실패시킨다.
  - **[LOW·정합성]** PR 건수는 `$GITHUB_REPOSITORY`로 세면서 버튼 링크는 리포 전체에서 이 파일에만 남아있던 레거시 저장소(`runnerpyrri-lgtm/Zoop-holdings`)로 고정돼, 버튼을 눌러도 방금 센 PR 목록을 못 봤다. → 링크도 `$GITHUB_REPOSITORY`로 통일, 메시지의 "Zoop Holdings"도 "로봄"으로 정리.
- **32차(릴리스 워크플로 거짓 성공 방지 — CI, HQ 버전 무관)** → `hq-v3.3.26` 릴리스를 직접 트리거하다가 실측으로 재현: `workflow_dispatch`를 `tag` 입력 없이 돌리면(`ref: main`, `github.ref`가 `refs/tags/`로 시작 안 함) "버전 일치 확인"·"GitHub Release 업로드" 두 스텝이 조건(`startsWith(github.ref,'refs/tags/') || inputs.tag != ''`) 불충족으로 **조용히 skipped**되고, 빌드·산출물 확인 스텝만 통과해 **잡 전체가 success로 끝난다** — 태그도 Release도 안 생겼는데 초록불만 보고 "릴리스했다"고 오판할 수 있는 거짓 성공. → `workflow_dispatch.inputs.tag`를 `required: true`로 바꿔 UI 디스패치에서 빈 입력을 원천 차단하고, 잡 첫 스텝에 명시적 가드(태그 push도 아니고 tag 입력도 없으면 즉시 `::error`로 실패)를 추가해 API 디스패치로 `required` 강제가 우회되는 경로까지 막았다. YAML 문법 검증(python yaml.safe_load) 통과.
- **31차(청약봄 수집 오경보 제거 — hq-v3.3.27)** → 회장이 실제 결재함 스크린샷으로 전달한 "워크플로가 죽으면 수집이 멈춥니다 / 마지막 성공 27시간 전"(문서 제4899호) 실측. 청약봄의 실제 수집은 `supabase/migrations/20260714142951_notice_sync_queue_schedule.sql`의 **Supabase pg_cron**(15분마다 `net.http_post`로 함수 직접 호출)이 맡고 있어 GitHub Actions와 무관함을 소스로 확인. 그런데 `pipeline-workflow` 계약이 `workflowFile` 없는 `github_actions` 평가자를 써서 main 브랜치의 **'가장 최근 아무 run'**(CI·Pages 배포 등 push 트리거)의 나이를 24시간 임계로 봤다 — 이는 git push 빈도일 뿐 수집 상태와 무관해, 며칠 커밋이 없으면 수집이 멀쩡해도 "워크플로가 죽으면 수집이 멈춥니다"라는 **거짓 인과로 오경보**한다(실제 원인 불명 — 커밋 공백 vs 진짜 pg_cron 장애를 구분 못 함). 실제 수집 신선도는 이미 `verified-header-fresh`(x-verified-at ≤설정 시간)·`verified-monotonic`·`stale-flag-honest`가 probe 응답 헤더로 직접 실측 중이라 대체 신호로 충분 → `pipeline-workflow`를 §18 `need_new_source`로 정직 전환(거짓 대리 신호를 GH Actions 최근 run 나이로 계속 쓰지 않음). 테스트 추가(회귀 가드: `pipeline-workflow`가 다시 `github_actions` evaluator로 돌아가면 실패).

## 코덱스 부재 대응(2026-07-20~ · 토큰 1주 후)
- 코덱스 토큰이 일주일 뒤 도착. 그때까지 **앱 저장소 코드 수정** 필요 항목은 `docs/hq/CODEX-PENDING-REQUESTS.md`에 대기열로 적재. HQ 본체(robom 저장소) 개선은 Claude가 직접 계속(audit→fix→release). 프로덕션 실측 장애는 HQ 실행 중 결재함으로 자동 상신되므로 대기열이 아니라 그쪽으로 흐른다. 자동시작 L3/L4(트레이 마커 없는 OS 직접 활성 클로버·legacy uninstall의 launchctl disable 생략)는 의도된 tradeoff/경미로 문서화.

## 회장 추가 요구(7·8·9) 반영 (hq-v3.3.0~)
- **9. 설정 화면 + Codex 모델 클릭 선택** — 배포됨(3.3.0): 실행기 모델을 텍스트 타이핑이 아니라 **클릭 리스트**(기본값·gpt-5-codex·gpt-5·o4-mini·o3)로 고른다. 추론 강도(낮음/보통/높음)도 클릭. 점검 주기·모델·강도를 '설정' 화면으로 이동(자동화 화면에서 링크로 안내).
- **7. 전결→Codex 자동 연동 지속** — 메커니즘 배포됨(전결 위임 → 위임 가능 안건 자동 재가 → 큐 → Codex 실행 → 원래 계약 재검증 → 다음 iteration). '전결' UI에 "위임하면 유지보수만이 아니라 계속 성장" 명시. 실제 실행은 맥 `codex login` 연결 시 작동.
- **8. 성장(유지보수 넘어)** — 배포됨(3.3.1): 급한 장애·구체 개선 신호가 없는 건강한 앱에도 **정직한 '성장 지시'(:grow)** 를 하나씩 세워 성장 백로그가 마르지 않게 했다. 가짜 문제를 지어내지 않고("급한 장애·대기 개선 없음"을 명시), Codex 실행기가 코드·사용자 흐름을 보고 **다음 신기능·UX·성능·접근성 개선을 발굴·구현**하게 하는 지시다. 전결 위임 시 이 성장 지시가 자동으로 Codex로 흘러 계속 성장한다. 창의적 '실행'(실제 코드 작성)은 맥 `codex login` 연결 시 작동.

### 5·6·7차 감사에서 정직하게 '미완'으로 남긴 항목 (맥 Codex/라이브 브라우저/구조 변경 필요)
- 회사 모드 **전이 게이트**(긴급정지 해제 시 확인 절차): UI 흐름 변경 필요, 후속.
- registry **필드 검증**(readApps 형상 검사): 통제된 파일이라 현재 무해, 진단 강화는 후속.
- 브라우저 스모크 HTTP 상태 실측: 코드 반영했으나 **라이브 브라우저(맥/CI)**에서 실동작 검증 후 확정.
- 저장소 **교차 프로세스 append 경쟁**(실행기가 별도 프로세스로 같은 JSONL을 씀): 근본 해결은 단일 라이터(실행기→HTTP API) 또는 파일락. 실행기가 실제로 도는 맥 환경에서 검증·적용 예정.
- 저장소 **fsync 내구성**·**장기 compaction**(수년치 JSONL 누적): 장기 운영 보강, 후속.
- 실행기 **async spawn**(현재 spawnSync가 이벤트루프를 막아 heartbeat가 비활성): TASK_TIMEOUT<TTL 강제로 단일 러너 이중실행은 막았으나, 근본 async 전환은 맥 Codex 검증 필요.
- 실행기 **exit 0 ≠ 성공** 실측(커밋/diff 확인): 현재는 원래 계약 재검증으로 사후 확인. 러너 내 git 확인은 맥 검증 후.

## 이미 존재해 Loop에 연결한 기반 (지침 §4)

health contract 엔진·anti-flap·incident/recovery·task queue·lease·heartbeat·Codex runner·
막힘 자동 재큐·회사 모드(RUNNING/MONITOR_ONLY/PAUSED 등)·수석부회장 전결·조직도·인력.

## 남은 단계 (후속 배포 예정 — 정직하게 '미완'으로 표기)

- §17 감사1·감사3(요구사항·장기운영) 완전 자동화 — 감사2(회귀 방지)와 verifier 재검증은 배포됨. 나머지 두 감사는 부분.
- §10.1 worktree 격리 실행 — 현재는 대상 저장소 직접 작업. 병렬 쓰기 안전을 위한 격리는 미구현.
- §11 완전 event-driven 트리거 — 현재는 감시기 주기(watchdog) + 상태 변화 반응 일부. git/CI/deploy webhook 확대는 미구현.
- §12 유지보수 Loop 심화(dependency advisory·TLS·secret expiry·backup age) — 일부 health contract로 존재, 전용 Loop·외부 probe는 미구현.
- §16 별도 red-team **에이전트** 분리 — verifier(원래 계약 재검증)는 프로그램 안에 배포됨. 완료를 깨뜨리려는 독립 red-team **AI 단계**는 아직 프로그램 자동 파이프라인엔 미탑재이고, 지금은 개발 세션에서 수동(에이전트)으로 세 차례 수행했다(위 '자기 반박 감사 이력'). 맥 Codex 연결 후 프로그램 내 자동 단계로 탑재 예정.

## 닫힌 자율 Loop 달성 여부 (§21 최종 판단)

지침 §21의 최종 질문 — "단지 현재 오류를 고치는가, 아니면 스스로 발견·수정·검증·학습하며 계속 성장하는 닫힌 자율 Loop가 되었는가" — 에 대해:

**결정론적 핵심 Loop는 닫혔다.** 발견(health/contract) → 분류(자동/Codex/회장) → 목표·합격기준 정의 →
승인(회장/전결) → 수정(Codex) → **원래 계약 자동 재검증 + 회귀 감사** → 통과 시 종료 / 실패 시 새 iteration →
회복 자동 종료 → Meta 자가점검. 이 순환이 회사가 켜져 있는 동안 실제로 돈다(가짜 완료 없음).

남은 항목(worktree 격리·webhook 이벤트·별도 red-team AI·외부 probe 유지보수)은 이 닫힌 Loop를 **더 강하게**
만드는 보강이며, Loop 닫힘 자체의 결함은 아니다. 후속 세션에서 단계별로 추가한다.

## 원칙

- 시스템이 직접 확인 못 하는 외부 항목(로그인·구독 한도·비밀키·결제·법적 동의·스토어 제출·복구 불가 삭제)은
  거짓 PASS하지 않고 회장 확인(human) 또는 BLOCKED로 표시한다.
- 계약 수·앱 수·직원 수 등은 항상 최신 registry·catalog·runtime에서 동적 계산한다.
