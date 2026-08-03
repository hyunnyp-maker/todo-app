import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // domain/ 은 순수 함수라 DOM이 필요 없다 (06-architecture 7장).
    // 컴포넌트 테스트(.test.tsx)만 파일 맨 위 @vitest-environment 주석으로 jsdom을 쓴다
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
