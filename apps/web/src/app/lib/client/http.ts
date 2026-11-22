import {
  aiGenerateSchema,
  aiKeysResponseSchema,
  aiSummarizeResponseSchema,
  aiSummarizeSchema,
  aiUsageResponseSchema,
  MAX_UPLOAD_BYTES,
  meResponseSchema,
  nameVersionResponseSchema,
  nameVersionSchema,
  putAiKeySchema,
  restoreResponseSchema,
  snapshotsResponseSchema,
  testAiKeyResponseSchema,
  uploadResponseSchema,
  type AiGenerateInput,
} from "@ether/shared";
import type { TestAiKeyRequest } from "../contracts";
import { createApiClient, type ApiClientOptions, type Parser } from "../api";
import { ApiError } from "../errors";
import { parseSseStream } from "./sse";
import type { EtherApi } from "./types";

export type HttpApiOptions = ApiClientOptions;

const enc = encodeURIComponent;

function validated<T>(parser: Parser<T>, value: unknown): T {
  const r = parser.safeParse(value);
  if (!r.success) throw new ApiError("validation", "Invalid request", { status: 400, cause: r.error });
  return r.data;
}

export function createHttpApi(options: HttpApiOptions = {}): EtherApi {
  const { send, json } = createApiClient(options);

  return {
    getMe(signal) {
      return json(meResponseSchema, { method: "GET", path: "/api/me", signal });
    },

    async listSnapshots(workspaceId, signal) {
      const r = await json(snapshotsResponseSchema, {
        method: "GET",
        path: `/api/workspaces/${enc(workspaceId)}/history`,
        signal,
      });
      return r.snapshots;
    },

    async createSnapshot(workspaceId, title) {
      const r = await json(nameVersionResponseSchema, {
        method: "POST",
        path: `/api/workspaces/${enc(workspaceId)}/history`,
        body: validated(nameVersionSchema, { title }),
      });
      return r.snapshot;
    },

    restoreSnapshot(workspaceId, snapshotId) {
      return json(restoreResponseSchema, {
        method: "POST",
        path: `/api/workspaces/${enc(workspaceId)}/history/${enc(snapshotId)}/restore`,
      });
    },

    summarizeSnapshot(workspaceId, snapshotId) {
      return json(aiSummarizeResponseSchema, {
        method: "POST",
        path: "/api/ai/summarize",
        body: validated(aiSummarizeSchema, { workspaceId, snapshotId }),
      });
    },

    async *generate(input: AiGenerateInput, signal?: AbortSignal) {
      const res = await send({
        method: "POST",
        path: "/api/ai/generate",
        body: validated(aiGenerateSchema, input),
        signal,
        accept: "text/event-stream",
      });
      if (!res.body) throw new ApiError("internal", "Empty response stream", { status: res.status });
      yield* parseSseStream(res.body);
    },

    getAiUsage(signal) {
      return json(aiUsageResponseSchema, { method: "GET", path: "/api/ai/usage", signal });
    },

    async listAiKeys(orgId) {
      const r = await json(aiKeysResponseSchema, { method: "GET", path: `/api/orgs/${enc(orgId)}/ai-keys` });
      return r.keys;
    },

    async putAiKey(orgId, apiKey) {
      await send({
        method: "PUT",
        path: `/api/orgs/${enc(orgId)}/ai-keys`,
        body: validated(putAiKeySchema, { provider: "gemini", apiKey }),
      });
    },

    testAiKey(orgId, request: TestAiKeyRequest) {
      return json(testAiKeyResponseSchema, {
        method: "POST",
        path: `/api/orgs/${enc(orgId)}/ai-keys/test`,
        body: request,
      });
    },

    async uploadToPublicWorkspace(orgId, file) {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new ApiError("payload_too_large", "That file is too large to upload.");
      }
      const form = new FormData();
      form.append("file", file, file.name);
      const r = await json(uploadResponseSchema, {
        method: "POST",
        path: `/api/orgs/${enc(orgId)}/public-workspace/uploads`,
        form,
      });
      return r.upload;
    },
  };
}
