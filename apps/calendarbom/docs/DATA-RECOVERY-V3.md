# 데이터 보호·복구 설계 v3 (v0.3.0)

## 저장 키

| 키 | 역할 |
|---|---|
| `calendarbom:data:v2` | 정본 문서(내부 version 필드는 3 — 저장 키 이름은 호환을 위해 유지) |
| `calendarbom:lkg` | 마지막 정상 로드 시점의 스냅샷(성공 로드마다 갱신) |
| `calendarbom:recovery:v2` | 손상된 원본 raw(최초 손상본 보존, 덮지 않음) |
| `calendarbom:recovery:v2:before-replace` | 백업 교체 직전 자동 복구본 |
| `calendarbom:migrated` | "1"이면 v1을 다시 정본으로 삼지 않는다(부활 방지) |
| `calendarbom:events:v1` | v0.1.0 원본 — 영구 보존, 삭제·수정 금지 |
| `calendarbom:draft:v2` | 작성 중 초안(schema=2, 24시간 뒤 무시) |

## 로드 절차

```
raw 있음 → JSON 파싱+정규화 성공 → 사용 + migrated=1 + LKG 갱신
        → 실패(손상) → recovery 키에 raw 보존(이미 있으면 유지)
                      → LKG 유효 → LKG 로 기동 + 복구 배너(이 상태로 계속/내려받기/가져오기)
                      → LKG 없음 → 빈 화면 + 복구 배너(새로 시작은 사용자가 눌러야 저장)
raw 없음 → migrated=1 → 빈 문서(v1 부활 금지)
        → migrated 없음 → v1 마이그레이션(멱등, v1 보존) → 저장 성공 시 migrated=1
```

## 쓰기 절차 (A-02)

모든 변경은 `commit(label, mutate)`: 변경 전 직렬화 → 변경 → setItem 성공 시 undo 준비 / 실패 시 메모리 rollback + "저장 공간이 부족해 저장하지 못했어요" + 시트·입력 유지. 성공 문구는 성공 후에만.

## 스키마 v3 변경점 (v2 흡수 — 사용자는 마이그레이션을 느끼지 않음)

- `allDayReminder`(단일) → `allDayReminders[]`(최대 3, 중복 제거)
- `overrides[date].time` → `overrides[date].times{slotIndex}` (슬롯별)
- 중복 series ID → 첫 항목 유지, 이후 난수 재부여(상태 기록은 첫 항목 소유)
- 신규 ID 전부 `crypto.randomUUID()` 기반

## 복원 경로

1. 복구 배너 → 손상 전 데이터 내려받기(raw 그대로) / 백업 파일 가져오기 / 새로 시작·계속 쓰기.
2. 가져오기 → 파일 검증 후 [합치기 / 백업 후 교체]. 교체는 현재 데이터를 자동 다운로드+복구 키 저장 후 진행.
3. 전체 삭제 → 백업 파일 자동 다운로드 후 삭제, 되돌리기 토스트 제공.
