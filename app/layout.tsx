// 로봄 브랜드 사이트의 전역 메타데이터와 문서 구조를 설정한다.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    template: "%s | 로봄",
  },
  description:
    "놓치면 끝나는 중요한 순간을, 생활에 맞는 신호로 먼저 알려주는 알림 앱 스튜디오 로봄입니다.",
  openGraph: {
    title: "로봄 | 중요한 순간을 먼저 보는 알림 스튜디오",
    description: "놓치면 끝나는 중요한 순간을, 생활에 맞는 신호로 먼저 알려줍니다.",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/robom-signal-hero.png",
        width: 2048,
        height: 2048,
        alt: "로봄의 신호가 도착하는 장면",
      },
    ],
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
