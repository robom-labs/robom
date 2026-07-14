# 사람 확인이 필요한 작업

## 캘린더봄 정식 저장소 이전 (2026-07-15 등록)

캘린더봄 v0.1.0은 AI 실행 환경에 조직 저장소 생성 권한이 없어(GitHub App 403)
임시로 본사 저장소 `apps/calendarbom`에 소스를 보관하고, 본사 Pages 아티팩트에
`/calendarbom/`로 함께 배포 중이다. 임시 주소: https://robom-labs.github.io/robom/calendarbom/

- [ ] GitHub에서 공개 저장소 `robom-labs/calendarbom`을 생성한다 (Settings 불필요, 빈 저장소면 됨).
- [ ] 생성 후 AI에게 "캘린더봄 저장소 이전 진행해"라고 요청한다. AI가 수행할 일:
  `apps/calendarbom` 소스 push → 동봉된 `.github/workflows/deploy-pages.yml`로 Pages 자동 활성화·배포 →
  레지스트리·본사 허브 URL을 `https://robom-labs.github.io/calendarbom/`으로 교체 →
  본사 임시 호스팅 제거(`apps/calendarbom`, prerender 복사 단계).
- [ ] 이전 완료 후 기존 임시 주소 접속자를 위해 본사에 리다이렉트 안내를 1개 버전 동안 유지한다.

## GitHub 조직 이전

- [x] GitHub 조직 `robom-labs`를 생성했다.
- [x] 운영 저장소를 `robom-labs` 조직으로 이전했다.
- [x] 앱 저장소 이름을 `outbom`, `homebom`, `runningbom`으로 변경했다.
- [ ] 네 저장소의 `main` branch protection과 Actions 권한을 확인한다.

## 배포 연결

- [x] 야외봄 Vercel 프로젝트가 `robom-labs/outbom`의 main 배포를 추적하는지 확인했다.
- [ ] 야외봄 Vercel 환경변수 `KAKAO_REST_API_KEY`가 유지되는지 확인한다.
- [x] 청약봄 Pages가 `/homebom/`에서 배포되는지 확인했다.
- [x] 러닝봄 Pages가 `/runningbom/`에서 배포되는지 확인했다.
- [x] Supabase notices 함수 v4 배포와 청약봄 공개 URL의 HTTP 200·확인 시각 헤더를 확인했다.

## 운영 보안

- [ ] 과거 노출 가능성이 있던 GitHub 토큰을 폐기한다.
- [ ] GitHub secret scanning과 Dependabot을 저장소별로 확인한다.
- [x] 개인정보 처리방침과 문의 이메일을 `robom.kr`에 공개했다.

비밀키 값, 결제 정보와 운영 계정 인증 정보는 문서나 PR에 기록하지 않는다.
