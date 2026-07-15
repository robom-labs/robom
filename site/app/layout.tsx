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
    default: "로봄 | 날씨·청약·러닝·달력·자격증, 놓치기 전에",
    template: "%s | 로봄",
  },
  description:
    "날씨, 청약, 러닝 대회, 가족 일정, 자격증 시험 준비를 한곳에서 확인하고 로봄의 다섯 앱으로 바로 이동하세요.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/robom.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/robom-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "로봄 | 날씨·청약·러닝·달력·자격증, 놓치기 전에",
    description: "날씨, 청약, 러닝 대회, 가족 일정, 자격증 시험 준비를 한곳에서 확인하고 로봄의 다섯 앱으로 바로 이동하세요.",
    siteName: "로봄",
    url: "https://robom.kr/",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "따뜻한 색의 타이밍 신호로 표현한 로봄 알림 앱 스튜디오",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "로봄 | 날씨·청약·러닝·달력·자격증, 놓치기 전에",
    description: "날씨, 청약, 러닝 대회, 가족 일정, 자격증 시험 준비를 한곳에서 확인하세요.",
    images: ["/og.png"],
  },
  verification: {
    google: "vI5PGnioYNAnrbUh_jGdkKLstO-SAypw3ftvVMWW1T4",
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
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://robom.kr/#organization",
              name: "로봄",
              alternateName: "ROBOM",
              url: "https://robom.kr/",
              email: "hello.robom@gmail.com",
              logo: {
                "@type": "ImageObject",
                url: "https://robom.kr/icons/robom-512.png",
                width: 512,
                height: 512,
              },
              description: "야외봄·청약봄·러닝봄·캘린더봄·자격증봄을 운영하는 생활 타이밍 앱 패밀리",
            }),
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">본문 바로가기</a>
        {children}
      </body>
    </html>
  );
}
