import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "할일",
  description: "색으로 구분하는 달력 할일 앱",
};

export const viewport: Viewport = {
  // 모바일 우선 — 375px를 설계 기준으로 삼는다 (요구사항 6.3)
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1c1f23",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 웹폰트를 로드하지 않는다 (05-design 3.1) — 시스템 폰트는 globals.css에서 지정
  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
