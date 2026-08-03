"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";

/**
 * 캐시를 localStorage에 남긴다 — 요구사항 3.5 규칙 1
 *
 * 주 사용 시점이 지하철이라(03-scenarios S2) 앱을 열 때 네트워크를 기다릴 수 없다.
 * 마지막으로 본 데이터를 즉시 그리고, 서버 조회는 뒤에서 돌린다.
 * 실패해도 이미 보여준 것을 치우지 않는다.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 오프라인에서 캐시가 살아 있어야 한다
            gcTime: 24 * 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            // 오프라인이어도 캐시로 렌더한다. 로딩 상태에 갇히지 않게
            networkMode: "offlineFirst",
          },
          mutations: {
            // 실패는 큐가 받는다 (data/sync). 여기서 다시 시도하지 않는다
            retry: 0,
            networkMode: "offlineFirst",
          },
        },
      }),
  );

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "todo-app:cache:v1",
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          // 세션은 남기지 않는다. 인증 상태는 Supabase가 소유한다
          shouldDehydrateQuery: (query) => {
            const root = query.queryKey[0];
            return root === "tasks" || root === "categories";
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
