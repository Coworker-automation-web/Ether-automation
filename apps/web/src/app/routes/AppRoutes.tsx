import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createApi, type EtherApi } from "../lib/client";
import { ApiProvider } from "../lib/client/context";
import { browserConfig, type RuntimeConfig } from "../lib/config";
import { createQueryClient } from "../lib/query";
import { ConfigProvider } from "../lib/runtime";
import theme from "../lib/theme.module.css";
import { routes } from "./routes";

// Opt in to React Router 7 behavior now, so the later upgrade changes nothing.
const ROUTER_FUTURE = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export interface AppRoutesProps {
  /** Tests and hosts that need to override the environment. PUBLIC_API_MOCK=1 selects the mock otherwise. */
  readonly config?: RuntimeConfig;
  readonly api?: EtherApi;
  readonly queryClient?: QueryClient;
}

/** The single entry the Astro page mounts with `client:only="react"`. */
export default function AppRoutes(props: AppRoutesProps) {
  const [config] = useState<RuntimeConfig>(() => props.config ?? browserConfig());
  const [api] = useState<EtherApi>(() => props.api ?? createApi(config));
  const [queryClient] = useState<QueryClient>(() => props.queryClient ?? createQueryClient());
  const [router] = useState(() => createBrowserRouter(routes, { future: ROUTER_FUTURE }));

  return (
    <div className={theme["theme"]}>
      <ConfigProvider config={config}>
        <ApiProvider api={api}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} future={{ v7_startTransition: true }} />
          </QueryClientProvider>
        </ApiProvider>
      </ConfigProvider>
    </div>
  );
}
