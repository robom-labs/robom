# v1 → v2 데이터 마이그레이션 (v0.2.0)

## 저장 키

| 키 | 역할 | 취급 |
|---|---|---|
| `calendarbom:events:v1` | v0.1.0 일정 원본 | **절대 삭제·수정하지 않음** (fallback·복구용) |
| `calendarbom:settings:v1` | v0.1.0 설정 | 읽기만(fontScale 인계) |
| `calendarbom:data:v2` | v0.2.0 단일 문서 | people/series/statuses/recents/settings |
| `calendarbom:draft:v2` | 작성 중 초안 | 저장·성공 시 삭제, 24시간 지나면 무시 |

## 절차 (app.js loadData)

```
v2 읽기 → normalizeData 성공 → 그대로 사용 (마이그레이션 재실행 없음)
        → 실패/없음 → v1 읽기 → migrateV1 → v2 저장 (v1 원본 유지)
                     → v1도 없음 → 빈 v2
```

- 멱등: v1 event id → `v1-<id>` 로 고정 매핑(unit "중복 실행해도 같은 ID").
- 보존: 제목·날짜·시간·알림 오프셋·완료 여부(완료는 statuses 로 이전) — unit + E2E 브라우저 검증.
- 깨진 항목: 건너뛰고 나머지는 살린다(총계·성공 수 반환).
- 실패 안전: v2 파싱이 언제든 깨지면 다음 로드에서 v1로 다시 이사한다(v1이 남아 있으므로 데이터 소실 없음).
  주의: v2에서 새로 만든 일정은 v2 문서가 손상되면 잃을 수 있다 → JSON v2 수동 백업 안내(설정 카드).
- 저장 공간 부족: writeJSON 이 사용자에게 알리고 기존 데이터는 메모리 유지.

## v2 스키마 요약

```
{version:2, people:[{id,name,relation?,createdAt}],
 series:[{id,kind,title,personId?,withPersonId?,date,allDay,
   slots:[{label?,time?,reminders[]}], allDayReminder?{daysBefore,time},
   repeat:{freq,weekdays?,until?}, anniversary?{baseDate,ruleType,n,label},
   overrides:{date:{skip?|time?}}, tone, place?, note?, done, createdAt, updatedAt}],
 statuses:{occId:{state:"done"|"skipped",at}|{snoozeUntil}},
 recents:[{label,snapshot,savedAt}] (표시 2·보관 5),
 settings:{fontScale, notifiedIds[], lastTime:*, ...}}
```

## 테스트 매트릭스 대응

빈 데이터·정상·하루 종일·알림 여러 개·완료·잘못된 항목·중복 실행 → scripts/schedule-core.test.mjs.
브라우저 실동작(원본 보존·표시) → scripts/e2e.mjs 첫 구간.
