import type {
  AiAgent,
  AiGenerateInput,
  AiKeyInfo,
  AiUsageResponse,
  RestoreResponse,
  Snapshot,
  SseEvent,
  Upload,
} from "@ether/shared";
import type { TestAiKeyRequest } from "../contracts";

export interface SummarizeResult {
  readonly summary: string;
  readonly summary_status: Snapshot["summary_status"];
}

export interface TestAiKeyResult {
  readonly ok: boolean;
  readonly message?: string | undefined;
}

/**
 * Everything the workspace, history and AI features need from the backend. One real implementation
 * (http.ts) and one typed mock (mock/api.ts), selected by PUBLIC_API_MOCK=1.
 */
export interface EtherApi {
  listSnapshots(workspaceId: string, signal?: AbortSignal): Promise<Snapshot[]>;
  restoreSnapshot(workspaceId: string, snapshotId: string): Promise<RestoreResponse>;
  summarizeSnapshot(workspaceId: string, snapshotId: string): Promise<SummarizeResult>;

  /**
   * Streams `text` events then exactly one terminal `done` or `error`. Failures before the stream
   * starts (non-2xx) reject with ApiRequestError; failures after it arrive as an `error` event.
   */
  generate(input: AiGenerateInput, signal?: AbortSignal): AsyncIterable<SseEvent>;
  getAiUsage(signal?: AbortSignal): Promise<AiUsageResponse>;

  listAiKeys(orgId: string): Promise<AiKeyInfo[]>;
  putAiKey(orgId: string, apiKey: string): Promise<void>;
  testAiKey(orgId: string, request: TestAiKeyRequest): Promise<TestAiKeyResult>;

  uploadToPublicWorkspace(orgId: string, file: File): Promise<Upload>;
}

export type { AiAgent };
