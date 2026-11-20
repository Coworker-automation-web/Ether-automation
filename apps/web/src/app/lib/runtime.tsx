import { createContext, useContext, type ReactNode } from "react";
import type { RuntimeConfig } from "./config";

const ConfigContext = createContext<RuntimeConfig | null>(null);

export function ConfigProvider({ config, children }: { config: RuntimeConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useRuntimeConfig(): RuntimeConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error("useRuntimeConfig must be used inside <ConfigProvider>");
  return config;
}

/**
 * Dialogs and menus portal into the workspace card (not <body>) so they keep the prototype's
 * look (the backdrop covers the card) and inherit the scoped design tokens.
 */
const DialogContainerContext = createContext<HTMLElement | null>(null);
export const DialogContainerProvider = DialogContainerContext.Provider;

export function useDialogContainer(): HTMLElement | undefined {
  return useContext(DialogContainerContext) ?? undefined;
}
