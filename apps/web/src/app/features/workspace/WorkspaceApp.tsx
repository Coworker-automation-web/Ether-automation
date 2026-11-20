import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiProvider } from "../../lib/api/context";
import { createApi, type EtherApi } from "../../lib/api";
import { browserConfig, type RuntimeConfig } from "../../lib/config";
import type { CurrentUser, WorkspaceAccess } from "../../lib/contracts";
import { createQueryClient } from "../../lib/query";
import { ConfigProvider } from "../../lib/runtime";
import theme from "../../lib/theme.module.css";
import { ToastHost } from "../../lib/toast-host";
import { WorkspacePage } from "./WorkspacePage";

export interface WorkspaceAppProps {
  readonly access: WorkspaceAccess;
  readonly user: CurrentUser;
  readonly searchQuery?: string;
  readonly onClearSearch?: () => void;
  /** Controlled by the shell's Settings button. */
  readonly settingsOpen?: boolean;
  readonly onSettingsOpenChange?: (open: boolean) => void;
  readonly onAccessStale?: () => void;
  /** Tests and storybook-style hosts; production uses PUBLIC_API_MOCK to pick the transport. */
  readonly config?: RuntimeConfig;
  readonly api?: EtherApi;
}

/**
 * The feature's single entry point for the shell. Mount it on the client only (Astro `client:only="react"`),
 * so the SSR pass never touches the window, storage or the socket.
 */
export default function WorkspaceApp(props: WorkspaceAppProps) {
  const [config] = useState<RuntimeConfig>(() => props.config ?? browserConfig());
  const [api] = useState<EtherApi>(() => props.api ?? createApi(config));
  const [queryClient] = useState(createQueryClient);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);

  const settingsOpen = props.settingsOpen ?? internalSettingsOpen;
  const onSettingsOpenChange = props.onSettingsOpenChange ?? setInternalSettingsOpen;

  return (
    <div className={theme["theme"]}>
      <ConfigProvider config={config}>
        <ApiProvider api={api}>
          <QueryClientProvider client={queryClient}>
            <WorkspacePage
              access={props.access}
              user={props.user}
              settingsOpen={settingsOpen}
              onSettingsOpenChange={onSettingsOpenChange}
              {...(props.searchQuery === undefined ? {} : { searchQuery: props.searchQuery })}
              {...(props.onClearSearch === undefined ? {} : { onClearSearch: props.onClearSearch })}
              {...(props.onAccessStale === undefined ? {} : { onAccessStale: props.onAccessStale })}
            />
            <ToastHost />
          </QueryClientProvider>
        </ApiProvider>
      </ConfigProvider>
    </div>
  );
}
