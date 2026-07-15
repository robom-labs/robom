# v0.2.0 심층 감사 → v0.3.0 보완 기록

감사 문서: calendarbom_v020_deep_audit_v2.md (기준 커밋 6e6eb1e). 감사 지적을 코드 위치와 함께 대응한다.

| 감사 지적 | 대응 | 위치 |
|---|---|---|
| P0-A 저장 실패 후 성공 토스트 | commit() 트랜잭션: 실패 시 rollback·시트 유지·성공 문구 금지 | app.js commit/saveDraft |
| P0-B 손상 v2 덮어쓰기·v1 부활 | recovery 키 보존, migrated 표식, LKG, 복구 배너 3택, 빈 덮어쓰기 금지 | app.js loadData/renderRecoveryBanner, DATA-RECOVERY-V3.md |
| P0-C 권한 무시 "알람 저장" 문구 | granted/그 외 문구 분리 + 첫 알람 1회 켜기 제안 | app.js saveDraft |
| P0-D 전달 전 notified | 표시 시도 후 기록, 스누즈 정리, delivery/completion 분리 | app.js fireAlarm |
| 해시 ID 충돌 | crypto.randomUUID + fallback, 중복 v2 ID 재부여, 동명이인 허용 | schedule-core newId/normalizeData |
| 약 이번만→매일 강제 | 제거. once/until 그대로 저장 | app.js buildSeriesList |
| 7일 전 알림 탐색 누락 | 발생일 탐색 지평선을 사전 알림 lead 만큼 확장 | schedule-core upcomingFires |
| 슬롯별 수정 불가 | overrides[date].times[slot], 상세에서 슬롯 선택 후 변경 | schedule-core/app.js |
| 부분 복원 | 전체 상태 백업·복원 + 합치기/교체 + 교체 전 자동 복구본 | exportJSON/importParsed/openImportChoice |
| 편집이 시간에 한정 | 상세 [수정] → 날짜·제목·시간·장소·메모 편집 | renderConfirmPanel 편집 행 |
| 기념일 "나" 불가·기준일 고정·관계 추천 없음 | 나 칩, 기준일 [바꾸기](date picker), 관계별 4추천+다른 종류 | annWho/annWhich |
| 같은 날짜 기념일 중복 | 저장 전 계산 날짜 병합 + "하나로 합쳤어요" | saveDraft |
| 라벨-시간 모순(아침 오후 10시) | 시간 변경 시 라벨 자동 제안(아침/점심/낮/저녁/자기 전), "예시 시간" 명시 | slotLabelForTime |
| 약 종료일 UI 없음 | 기간 행(계속/1·2주일/한 달/이번만) — 기본 화면 밖 | medUntil |
| 최근 label 충돌·복사 의미 | fingerprint dedupe, copy/recent/next snapshot 모드 분리 | snapshotOfSeries/pushRecent |
| 0단계 초안 유실 | 템플릿 선택 즉시 보존 + 이어서/새로 시작 + schema=2 | closeDaySheet |
| 320px 셀 39px | full-bleed+gap1 → 실측 45×64 (E2E boundingBox) | styles @360 |
| ARIA·focus | 단순 버튼 grid+aria-current/pressed, focus trap·restore, announcer | app.js/index.html |
| 약 알림 문구·딥링크 | "저녁 약 드실 시간이에요." + ?open=날짜 이동, 가짜 action 없음 | alarmCopy/handleDeepLink |
| 복용 기록 무기한·삭제 없음 | 보관 7/30/90/직접 + 전체 삭제(백업 선행) + 개인정보 문서 갱신 | 설정 카드, PRIVACY |
| ICS 400 잘림·Z 오해 | slice 제거(1년 전량), Z 감지 경고 토스트 | exportIcs/import |
| alarm-core·구 CSS 잔존 | 파일·참조·검증 규칙에서 제거 | index/sw/validate |
| SW 업데이트 안내 없음 | updatefound → 새로고침 토스트 | app.js |
| inline style 다수 | 일부 정리, 나머지는 다음 정리 대상(기능 영향 없음 — 미해결로 정직 기록) | — |
| MIT 근거 없음 | UNLICENSED 로 변경. 근거: 저장소에 승인된 라이선스 결정 문서가 없어 새 법적 결정을 만들지 않는다. 공개 라이선스 채택은 사람 결정(HUMAN-TASKS 후보) | package.json |
| 추적표 과장 | FINAL-TRACEABILITY-V7 로 대체, PARTIAL/BLOCKED/DEFERRED 정직 표기 | docs |

## 알려진 한계(정직 기록)

- B-09 전체 편집의 반복 범위: "반복 전체"만 지원(저장 2회 확인). 특정 날짜만 바꾸려면 시간 바꾸기(오늘만/앞으로/전체) 사용.
- 브라우저 알림의 실제 표시는 헤드리스에서 검증 불가 — 문구 선택 로직은 permission 스텁으로 검증, 실기기 확인은 사람 작업.
- WebKit E2E는 로컬 네트워크 정책으로 CI에서만 실행.
- 가져오기(파일 업로드) E2E 자동화는 DEFERRED — 코어 왕복은 단위로, UI는 수동 확인.
