import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./errors";

export const queryKeys = {
  history: (workspaceId: string) => ["history", workspaceId] as const,
  aiUsage: () => ["ai", "usage"] as const,
  aiKeys: (orgId: string) => ["ai", "keys", orgId] as const,
};

const MAX_RETRIES = 2;

/** Retry network blips and 5xx; never retry an answer the server already gave (4xx, limits). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiRequestError) return error.isNetwork || error.status >= 500;
  return false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 10_000, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}
