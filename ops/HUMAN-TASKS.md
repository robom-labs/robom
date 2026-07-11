# 회장님(사람) 전용 작업 목록 — AI가 대신 못 하는 것

> 본부장이 관리한다. 완료되면 체크하고 날짜를 적는다.
> 아래 작업들은 비밀키·계정 권한이 필요해서 **회장님만** 할 수 있다.

## 1. ~~ANTHROPIC_API_KEY 등록~~ → **불필요해짐 (2026-07-11, D20)**
하루 2회 자동화는 유료 API 키 대신 **회장 Claude 구독으로 도는 본부장 루틴**(Claude Code Remote
Routine, KST 06:00·18:00)이 수행한다 — 추가 비용 0원. 루틴이 작업 후 카카오톡·슬랙(#회사)·
노션(회장보고)으로 결재 요청을 보내고, 회장은 링크 타고 들어가 merge만 하면 된다.
GitHub Actions 쪽 Claude 워크플로들은 스케줄을 제거하고 수동 실행 전용으로 남겨뒀다
(나중에 API 키를 등록하면 백업 경로로 쓸 수 있음 — 선택사항, 지금은 아무것도 안 해도 됨).

## 2. main 브랜치 보호 (저장소마다 1회, 총 4곳)
지금은 실수로 main에 직접 push해도 막을 장치가 없다.
각 저장소: **Settings → Branches → Add branch ruleset(또는 protection rule)** → 대상 `main`
1인 회사 기준 권장 설정 (본인 PR을 본인이 승인 못 해 막히는 문제 방지):
- ✅ Require a pull request before merging — **승인 수 0** (외부 리뷰어 생기면 1로)
- ✅ Require status checks to pass (각 저장소의 CI 체크 선택)
- ✅ Require conversation resolution before merging
- ✅ Block force pushes / ❌ Allow deletions
- 관리자 우회(bypass)는 비상시에만
- [ ] Zoop-holdings
- [ ] zoopzoopcall
- [ ] runningcall
- [ ] pushrun

## 3. 러닝콜 — Vercel의 Kakao 키 확인 (검색 복구의 마지막 조각)
- [ ] Vercel 프로젝트 → Settings → Environment Variables 에 `KAKAO_REST_API_KEY` 가 있는지 확인
- [ ] 키가 유효한지 확인(값을 어디에도 붙여넣지 말 것):
      Kakao Developers(developers.kakao.com) → 내 애플리케이션 → 앱 키 → REST API 키가 살아있고
      "카카오맵(Local)" 사용 설정이 켜져 있는지, 일일 쿼터가 남아 있는지 확인
- [ ] 확인 후 러닝콜 화면에서 "성수동"과 "강남역" 검색이 되는지 직접 시험
      (수정 직후엔 이전 빈 결과가 최대 30분 캐시에 남아 있을 수 있음 — 30분 뒤 재시도)

## 4. 러닝콜 — 과거에 노출된 GitHub 토큰 폐기 확인 (보안)
- [ ] GitHub → Settings → Developer settings → Personal access tokens 에서
      옛 토큰(ghp_로 시작)이 남아 있으면 **Delete/Revoke**
- [ ] 각 저장소 → Settings → Code security → Secret scanning 켜기

## 5. 줍줍콜 — 서버 함수 재배포 (코드 개선분 반영)
- [ ] 줍줍콜 PR 머지 후, Supabase CLI로 `notices` 함수 재배포
      (`supabase functions deploy notices` — docs/DEPLOY.md 절차 그대로)
- [ ] Supabase 대시보드에서 함수 호출량/오류율 확인 (쿼터 방어)

## 6. 카카오 일일보고 정리 (선택)
- [ ] Zoop-holdings → Settings → Secrets and variables → Actions → **Variables** 에
      `KAKAO_CLIENT_ID` 등록 → 워크플로 파일의 하드코딩 fallback 제거 PR 요청
- [ ] Kakao Developers 에서 REST 키에 플랫폼(도메인) 제한 설정

## 7. 앱 PR 승인 (이번 라운드)
- [ ] zoopzoopcall `claude/release-hardening-0.1.4`
- [ ] runningcall `claude/release-hardening-0.13.4`
- [ ] pushrun `claude/release-hardening-0.6.9`
- [ ] Zoop-holdings (이 문서가 담긴 PR)
머지 순서는 자유. 앱 PR 3개가 머지되면 본부장이 사본 동기화 PR을 후속으로 올린다.
