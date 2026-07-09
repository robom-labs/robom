# 보안 경계 플레이북

> CLAUDE.md 금지작업의 실행 계층 해설. "LLM에게 부탁"이 아니라 **CI·설정으로 강제**하는 게 보안이다(DESIGN 7절).

## 절대 손대지 않는 것 (SECURITY 등급 — 사람만)
- production secret / OAuth client secret 읽기·수정
- Supabase production DB schema 변경
- 비밀키·토큰을 코드·PR diff·로그에 노출
- `/zoopzoopcall/` base path (배포 URL 사망 — R1)

## 코드로 강제되는 가드레일 (우회 불가)
| 경계 | 강제 수단 | 위치 |
|---|---|---|
| base path 불변 | grep 게이트 | `guardrails.yml` base-path-guard |
| secret 미노출 | gitleaks | `guardrails.yml` secret-scan |
| lockfile 대량변경 차단 | diff 라인수 게이트(>200 실패) | `guardrails.yml` lockfile-guard |
| registry↔폴더 정합 | 존재 검사 | `guardrails.yml` registry-sanity |
| main 직접 push 차단 | branch protection(사장 설정) | GitHub 저장소 설정 |

## 키 취급 원칙
- 앱의 서버 키(DATA_GO_KR_SERVICE_KEY, KAKAO_REST_API_KEY 등)는 **서버(엣지펑션/서버라우트)에만** 둔다. 클라이언트 번들에 절대 안 넣는다.
- 카카오 REST API 키처럼 공개용 client_id 는 시크릿이 아니지만, client_secret·refresh_token 은 GitHub Secrets 로만.
- 무인증 공개 프록시(runningcall /api/*)는 레이트리밋·오리진 제한으로 유료키 소진 방지(R9).

## 의심스러우면
- 실행하지 말고 사람에게 묻는다. "열심히 잘못 달리는 것"이 가장 위험하다(CLAUDE.md 안전선).
