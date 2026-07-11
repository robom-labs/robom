# 로봄 통합 홈페이지

로봄 지주회사와 야외봄·청약봄·러닝봄을 소개하는 `robom.kr` 홈페이지입니다.

## 실행

```bash
npm install
npm run dev
npm run lint
npm test
```

## 관리 범위

- `app/page.tsx`에서 회사 소개와 앱 연결을 관리합니다.
- `app/globals.css`에서 반응형 디자인을 관리합니다.
- `app/layout.tsx`에서 검색·공유 메타데이터를 관리합니다.
- `public/`에서 로봄의 신호 아이콘과 공유 이미지를 관리합니다.
- `.openai/hosting.json`의 기존 Sites 프로젝트 ID를 유지합니다.
