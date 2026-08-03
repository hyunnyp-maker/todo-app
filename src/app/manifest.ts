import type { MetadataRoute } from "next";

/** PWA manifest — E2. 홈 화면에 설치하면 주소창 없이 앱처럼 실행된다 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Myquence",
    short_name: "Myquence",
    description: "색으로 구분하는 달력 할일 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1c1f23",
    orientation: "portrait",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
