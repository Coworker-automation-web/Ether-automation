import type { MeResponse, RestoreResponse, Snapshot } from "@ether/shared";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "./client/context";
import type { ApiError } from "./errors";

/** Every query key in the app, built here and nowhere else. */
export const queryKeys = {
  me: () => ["me"] as const,
  history: (workspaceId: string) => ["history", workspaceId] as const,
  aiUsage: () => ["ai", "usage"] as const,
  aiKeys: (orgId: string) => ["ai", "keys", orgId] as const,
};

/** GET /api/me: who is signed in and their memberships. A 401 redirects to /login (see api.ts). */
export function useMe(): UseQueryResult<MeResponse, ApiError> {
  const api = useApi();
  return useQuery<MeResponse, ApiError>({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => api.getMe(signal),
    staleTime: 60_000,
  });
}

/** GET /api/workspaces/:id/history. Pass `enabled: false` when the role may not list history. */
export function useSnapshots(workspaceId: string, options: { enabled?: boolean } = {}): UseQueryResult<Snapshot[], ApiError> {
  const api = useApi();
  return useQuery<Snapshot[], ApiError>({
    queryKey: queryKeys.history(workspaceId),
    queryFn: ({ signal }) => api.listSnapshots(workspaceId, signal),
    enabled: options.enabled ?? true,
  });
}

/** POST .../history/:snapshotId/restore. The server snapshots the live document first, so the list always changes. */
export function useRestoreSnapshot(workspaceId: string): UseMutationResult<RestoreResponse, ApiError, string> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation<RestoreResponse, ApiError, string>({
    mutationFn: (snapshotId) => api.restoreSnapshot(workspaceId, snapshotId),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.history(workspaceId) }),
  });
}

/** POST .../history: names the current document as a version. */
export function useCreateSnapshot(workspaceId: string): UseMutationResult<Snapshot, ApiError, string> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation<Snapshot, ApiError, string>({
    mutationFn: (title) => api.createSnapshot(workspaceId, title),
    onSuccess: (snapshot) => {
      client.setQueryData<Snapshot[]>(queryKeys.history(workspaceId), (list) => (list ? [snapshot, ...list] : [snapshot]));
      return client.invalidateQueries({ queryKey: queryKeys.history(workspaceId) });
    },
  });
}
