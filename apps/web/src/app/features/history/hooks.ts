import type { RestoreResponse, Snapshot } from "@ether/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "../../lib/api/context";
import type { SummarizeResult } from "../../lib/api/types";
import { queryKeys } from "../../lib/query";

export function useSnapshots(workspaceId: string, enabled: boolean): UseQueryResult<Snapshot[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.history(workspaceId),
    queryFn: ({ signal }) => api.listSnapshots(workspaceId, signal),
    enabled,
  });
}

export function useRestore(workspaceId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation<RestoreResponse, Error, string>({
    mutationFn: (snapshotId) => api.restoreSnapshot(workspaceId, snapshotId),
    // The server takes a pre-restore snapshot first, so the list has a new entry either way.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.history(workspaceId) }),
  });
}

export function useSummarize(workspaceId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation<SummarizeResult, Error, string>({
    mutationFn: (snapshotId) => api.summarizeSnapshot(workspaceId, snapshotId),
    onSuccess: (result, snapshotId) => {
      client.setQueryData<Snapshot[]>(queryKeys.history(workspaceId), (list) =>
        list?.map((s) =>
          s.id === snapshotId ? { ...s, summary: result.summary, summary_status: result.summary_status } : s,
        ),
      );
      void client.invalidateQueries({ queryKey: queryKeys.aiUsage() });
    },
  });
}
