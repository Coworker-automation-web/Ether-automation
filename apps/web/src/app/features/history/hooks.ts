import type { Snapshot } from "@ether/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/client/context";
import type { SummarizeResult } from "../../lib/client/types";
import type { ApiError } from "../../lib/errors";
import { queryKeys } from "../../lib/queries";

export function useSummarize(workspaceId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation<SummarizeResult, ApiError, string>({
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
