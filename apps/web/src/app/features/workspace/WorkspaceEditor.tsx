import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useApi } from "../../lib/client/context";
import { queryKeys, useMe } from "../../lib/queries";
import { useRuntimeConfig } from "../../lib/runtime";
import { resolveWorkspace } from "./access";
import WorkspaceApp from "./WorkspaceApp";

export interface WorkspaceEditorProps {
  readonly orgId: string;
  readonly workspaceId: string;
}

/**
 * The workspace route's body: loads who you are, works out your role in this organisation and
 * mounts the editor. It plugs into the host's API, config and query cache (see routes/).
 */
export function WorkspaceEditor({ orgId, workspaceId }: WorkspaceEditorProps) {
  const me = useMe();
  const api = useApi();
  const config = useRuntimeConfig();
  const client = useQueryClient();
  // A role change closes the socket with a reconnect code; refetching /api/me gives the new role.
  const onAccessStale = useCallback(() => {
    void client.invalidateQueries({ queryKey: queryKeys.me() });
  }, [client]);

  if (me.isPending) return <div role="status">Loading…</div>;
  if (me.isError) return <div role="alert">Couldn&apos;t load your account: {me.error.message}</div>;

  const resolved = resolveWorkspace(me.data, orgId, workspaceId);
  if (!resolved) return <div role="alert">You don&apos;t have access to this organisation.</div>;

  return (
    <WorkspaceApp
      access={resolved.access}
      user={resolved.user}
      api={api}
      config={config}
      queryClient={client}
      onAccessStale={onAccessStale}
    />
  );
}
