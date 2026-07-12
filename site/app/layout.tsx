// 로봄 브랜드 사이트의 전역 메타데이터와 문서 구조를 설정한다.
import type { Metadata, Viewport } from "next";
import "./globals.css";

// 모바일에서 브라우저 UI까지 패밀리 배경색으로 맞추고 하단 탭바가 기기 안전 영역을 존중하게 한다.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8ef" },
    { media: "(prefers-color-scheme: dark)", color: "#fff8ef" },
  ],
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://robom.kr"),
  title: {
    default: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    template: "%s | 로봄",
  },
  description:
    "야외 날씨, 청약 접수, 러닝 대회처럼 놓치고 싶지 않은 순간을 먼저 보는 로봄 패밀리 공식 허브입니다.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    description: "야외봄·청약봄·러닝봄을 한곳에서 만나고 공식 웹 서비스로 이동하세요.",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: "따뜻한 색의 타이밍 신호로 표현한 로봄 알림 앱 스튜디오",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    description: "놓치면 끝나는 중요한 순간을, 생활에 맞는 신호로 먼저 알려줍니다.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 폰트를 HTML 파싱 단계에서 바로 발견·병렬 로드해 첫 화면이 늦게 뜨는 문제를 없앤다. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
