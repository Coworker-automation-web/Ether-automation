import { createContext, useContext, type ReactNode } from "react";
import type { EtherApi } from "./types";

const ApiContext = createContext<EtherApi | null>(null);

export function ApiProvider({ api, children }: { api: EtherApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): EtherApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used inside <ApiProvider>");
  return api;
}
