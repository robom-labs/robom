// 로봄 브랜드 사이트의 전역 메타데이터와 문서 구조를 설정한다.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://robom.kr"),
  title: {
    default: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    template: "%s | 로봄",
  },
  description:
    "놓치면 끝나는 중요한 순간을, 생활에 맞는 신호로 먼저 알려주는 알림 앱 스튜디오 로봄입니다.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    description: "놓치면 끝나는 중요한 순간을, 생활에 맞는 신호로 먼저 알려줍니다.",
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
      <body>{children}</body>
    </html>
  );
}
