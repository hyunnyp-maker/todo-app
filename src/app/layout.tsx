import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Myquence",
  description: "색으로 구분하는 달력 할일 앱 · by hyunnyp",
  applicationName: "Myquence",
  appleWebApp: { capable: true, title: "Myquence", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
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
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        {/*
          첫 페인트 전에 테마를 정한다.
          React가 붙기를 기다리면 다크 모드 사용자에게 흰 화면이 한 번 번쩍인다.
          저장값이 없거나 깨져 있으면 기기 설정을 따른다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var raw = localStorage.getItem('todo-app:ui:v1');
              var mode = raw ? (JSON.parse(raw).state || {}).theme : null;
              if (mode !== 'light' && mode !== 'dark') {
                mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              }
              document.documentElement.dataset.theme = mode;
            }catch(e){
              document.documentElement.dataset.theme = 'light';
            }})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
