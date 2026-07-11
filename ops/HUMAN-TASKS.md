# 사람 확인이 필요한 작업

## GitHub 조직 이전

- [ ] GitHub에서 무료 조직 `robom-labs`를 생성한다.
- [ ] `robom`, `runningcall`, `zoopzoopcall`, `pushrun`을 조직으로 이전한다.
- [ ] 앱 저장소 이름을 `outbom`, `homebom`, `runningbom`으로 변경한다.
- [ ] 네 저장소의 `main` branch protection과 Actions 권한을 확인한다.

## 배포 연결

- [ ] 야외봄 Vercel 프로젝트가 `robom-labs/outbom`을 계속 추적하는지 확인한다.
- [ ] 야외봄 Vercel 환경변수 `KAKAO_REST_API_KEY`가 유지되는지 확인한다.
- [ ] 청약봄 Pages가 `/homebom/`에서 배포되는지 확인한다.
- [ ] 러닝봄 Pages가 `/runningbom/`에서 배포되는지 확인한다.
- [ ] Supabase notices 함수와 청약봄 공개 URL을 확인한다.

## 운영 보안

- [ ] 과거 노출 가능성이 있던 GitHub 토큰을 폐기한다.
- [ ] GitHub secret scanning과 Dependabot을 저장소별로 확인한다.
- [ ] 개인정보 처리방침과 문의 이메일을 `robom.kr`에 공개한다.

비밀키 값, 결제 정보와 운영 계정 인증 정보는 문서나 PR에 기록하지 않는다.
