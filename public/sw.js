/**
 * 앱 셸 캐시 — 04-engagement E2
 *
 * 데이터는 건드리지 않는다. 그건 TanStack Query persister가 이미 맡고 있다.
 * 여기서는 HTML/JS/CSS만 캐시해서 "오프라인에서 앱이 열리기까지"를 완성한다.
 *
 * 전략을 나눈 이유
 *   /_next/static/*  파일명에 해시가 붙어 내용이 바뀌면 이름도 바뀐다 → 캐시 우선이 안전
 *   HTML(navigate)   배포하면 내용이 바뀐다 → 네트워크 우선, 실패하면 캐시
 *   그 외             건드리지 않는다. 특히 Supabase 요청은 절대 캐시하지 않는다
 */

const VERSION = "v1";
const SHELL = `myquence-shell-${VERSION}`;
const PAGES = `myquence-pages-${VERSION}`;

self.addEventListener("install", (event) => {
  // 새 서비스 워커를 기다리지 않고 바로 활성화한다
  self.skipWaiting();
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add("/")));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("myquence-") && k !== SHELL && k !== PAGES)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 다른 출처(Supabase 등)는 서비스 워커가 관여하지 않는다
  if (url.origin !== self.location.origin) return;

  // 해시가 붙은 정적 자산 — 캐시 우선
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 화면 이동 — 네트워크 우선, 끊기면 캐시로
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return res;
        } catch {
          return (
            (await caches.match(request)) ??
            (await caches.match("/")) ??
            Response.error()
          );
        }
      })(),
    );
  }
});
