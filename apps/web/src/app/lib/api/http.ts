import {
  aiGenerateSchema,
  aiKeysResponseSchema,
  aiSummarizeResponseSchema,
  aiSummarizeSchema,
  aiUsageResponseSchema,
  MAX_UPLOAD_BYTES,
  putAiKeySchema,
  restoreResponseSchema,
  snapshotsResponseSchema,
  testAiKeyResponseSchema,
  uploadResponseSchema,
  type AiGenerateInput,
} from "@ether/shared";
import type { TestAiKeyRequest } from "../contracts";
import { ApiRequestError, errorFromResponse, isAbortError, networkError } from "../errors";
import { parseSseStream } from "./sse";
import type { EtherApi } from "./types";

interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

interface SendOptions {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  readonly form?: FormData;
  readonly signal?: AbortSignal | undefined;
  readonly accept?: string;
}

export interface HttpApiOptions {
  /** Prefix for every path. Empty = same origin. */
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

const enc = encodeURIComponent;

function validated<T>(parser: Parser<T>, value: unknown): T {
  const r = parser.safeParse(value);
  if (!r.success) throw new ApiRequestError("validation", "Invalid request", { status: 400, cause: r.error });
  return r.data;
}

export function createHttpApi(options: HttpApiOptions = {}): EtherApi {
  const base = options.baseUrl ?? "";
  const doFetch: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function send(o: SendOptions): Promise<Response> {
    const headers: Record<string, string> = { accept: o.accept ?? "application/json" };
    let body: BodyInit | undefined;
    if (o.form) {
      body = o.form;
    } else if (o.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(o.body);
    }
    let res: Response;
    try {
      res = await doFetch(base + o.path, {
        method: o.method,
        headers,
        body,
        signal: o.signal,
        credentials: "same-origin",
      });
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw networkError(err);
    }
    if (!res.ok) throw await errorFromResponse(res);
    return res;
  }

  async function json<T>(parser: Parser<T>, o: SendOptions): Promise<T> {
    const res = await send(o);
    let payload: unknown;
    try {
      payload = await res.json();
    } catch (err) {
      throw new ApiRequestError("internal", "Unexpected response from the server", { status: res.status, cause: err });
    }
    const r = parser.safeParse(payload);
    if (!r.success) {
      throw new ApiRequestError("internal", "Unexpected response from the server", { status: res.status, cause: r.error });
    }
    return r.data;
  }

  return {
    async listSnapshots(workspaceId, signal) {
      const r = await json(snapshotsResponseSchema, {
        method: "GET",
        path: `/api/workspaces/${enc(workspaceId)}/history`,
        signal,
      });
      return r.snapshots;
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
      if (!res.body) throw new ApiRequestError("internal", "Empty response stream", { status: res.status });
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
        throw new ApiRequestError("payload_too_large", "That file is too large to upload.");
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
