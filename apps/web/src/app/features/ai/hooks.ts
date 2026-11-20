import type { AiKeyInfo, AiUsageResponse } from "@ether/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { TestAiKeyRequest } from "../../lib/contracts";
import { useApi } from "../../lib/api/context";
import type { TestAiKeyResult } from "../../lib/api/types";
import { queryKeys } from "../../lib/query";

export function useAiUsage(enabled = true): UseQueryResult<AiUsageResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.aiUsage(),
    queryFn: ({ signal }) => api.getAiUsage(signal),
    enabled,
  });
}

/** Only call with an org the caller may manage keys for (shared `aikey.manage`). */
export function useAiKeys(orgId: string | null, enabled: boolean): UseQueryResult<AiKeyInfo[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.aiKeys(orgId ?? "none"),
    queryFn: () => {
      if (orgId === null) return Promise.resolve([]);
      return api.listAiKeys(orgId);
    },
    enabled: enabled && orgId !== null,
  });
}

export function usePutAiKey(orgId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (apiKey) => api.putAiKey(orgId, apiKey),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.aiKeys(orgId) }),
  });
}

export function useTestAiKey(orgId: string) {
  const api = useApi();
  return useMutation<TestAiKeyResult, Error, TestAiKeyRequest>({
    mutationFn: (request) => api.testAiKey(orgId, request),
  });
}
