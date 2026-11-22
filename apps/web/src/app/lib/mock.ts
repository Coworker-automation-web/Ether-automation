import {
  aiGenerateSchema,
  aiSummarizeSchema,
  API_ROUTES,
  ERROR_STATUS,
  errorBody,
  nameVersionSchema,
  putAiKeySchema,
  type SseEvent,
} from "@ether/shared";
import type { EtherApi } from "./client/types";
import { ApiError, isAbortError } from "./errors";
import { createMockApi, type MockApiOptions } from "./fake/api";

/**
 * In-memory handlers for the API, served over a fetch-compatible function. Enabled by
 * PUBLIC_API_MOCK=1: the real client (validation, error mapping, 401 handling, SSE parsing) runs
 * unchanged against these handlers, so mock mode exercises the same wire path as production.
 * Routes are keyed by the shared route table (API_ROUTES), so a path the server does not have
 * cannot be mocked by accident.
 */

type Route = (typeof API_ROUTES)[number];
type RouteKey = `${Route["method"]} ${Route["path"]}`;

interface MockRequest {
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly form: FormData | null;
  readonly signal: AbortSignal | undefined;
}

type Handler = (req: MockRequest) => Promise<Response>;

export interface MockFetchOptions extends MockApiOptions {
  /** Replace the in-memory backend (tests). */
  readonly backend?: EtherApi;
  /** Return false to make every route answer 401 (tests and the sign-in redirect). Default: signed in. */
  readonly isSignedIn?: () => boolean;
}

const encoder = new TextEncoder();

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function errorResponse(err: ApiError): Response {
  const status = err.status > 0 ? err.status : ERROR_STATUS[err.code];
  return json(errorBody(err.code, err.message, err.resetAt), status);
}

const sseBlock = (event: SseEvent): Uint8Array =>
  encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);

function parseBody<T>(parser: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, body: unknown): T {
  const r = parser.safeParse(body);
  if (!r.success) throw new ApiError("validation", "Invalid request");
  return r.data;
}

// ---------- Route matching ----------

interface Compiled {
  readonly key: RouteKey;
  readonly method: string;
  readonly regex: RegExp;
  readonly names: readonly string[];
}

function compile(route: Route): Compiled {
  const names: string[] = [];
  const pattern = route.path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    names.push(name);
    return "([^/]+)";
  });
  return {
    key: `${route.method} ${route.path}` as RouteKey,
    method: route.method,
    regex: new RegExp(`^${pattern}$`),
    names,
  };
}

const COMPILED: readonly Compiled[] = API_ROUTES.map(compile);

export function matchRoute(method: string, pathname: string): { key: RouteKey; params: Record<string, string> } | null {
  for (const route of COMPILED) {
    if (route.method !== method) continue;
    const m = route.regex.exec(pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    route.names.forEach((name, i) => {
      params[name] = decodeURIComponent(m[i + 1] ?? "");
    });
    return { key: route.key, params };
  }
  return null;
}

// ---------- Handlers ----------

function createHandlers(api: EtherApi): Partial<Record<RouteKey, Handler>> {
  const param = (req: MockRequest, name: string): string => req.params[name] ?? "";

  return {
    "GET /api/me": async (req) => json(await api.getMe(req.signal)),

    "GET /api/workspaces/:workspaceId/history": async (req) =>
      json({ snapshots: await api.listSnapshots(param(req, "workspaceId"), req.signal) }),

    "POST /api/workspaces/:workspaceId/history": async (req) => {
      const { title } = parseBody(nameVersionSchema, req.body);
      return json({ snapshot: await api.createSnapshot(param(req, "workspaceId"), title) }, 201);
    },

    "POST /api/workspaces/:workspaceId/history/:snapshotId/restore": async (req) =>
      json(await api.restoreSnapshot(param(req, "workspaceId"), param(req, "snapshotId"))),

    "POST /api/ai/summarize": async (req) => {
      const { workspaceId, snapshotId } = parseBody(aiSummarizeSchema, req.body);
      return json(await api.summarizeSnapshot(workspaceId, snapshotId));
    },

    "GET /api/ai/usage": async (req) => json(await api.getAiUsage(req.signal)),

    "POST /api/ai/generate": async (req) => {
      const input = parseBody(aiGenerateSchema, req.body);
      const iterator = api.generate(input, req.signal)[Symbol.asyncIterator]();
      // Limit failures happen before the first token. Read one event up front so they can be
      // answered as a normal non-2xx response, like the server does, instead of inside the stream.
      let first: IteratorResult<SseEvent>;
      try {
        first = await iterator.next();
      } catch (err) {
        if (err instanceof ApiError) return errorResponse(err);
        throw err;
      }
      let pending: IteratorResult<SseEvent> | null = first;
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = pending ?? (await iterator.next());
            pending = null;
            if (next.done) controller.close();
            else controller.enqueue(sseBlock(next.value));
          } catch (err) {
            controller.error(err);
          }
        },
        async cancel() {
          await iterator.return?.();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    },

    "GET /api/orgs/:orgId/ai-keys": async (req) => json({ keys: await api.listAiKeys(param(req, "orgId")) }),

    "PUT /api/orgs/:orgId/ai-keys": async (req) => {
      const { apiKey } = parseBody(putAiKeySchema, req.body);
      await api.putAiKey(param(req, "orgId"), apiKey);
      return new Response(null, { status: 204 });
    },

    "POST /api/orgs/:orgId/ai-keys/test": async (req) => {
      const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as { apiKey?: unknown };
      return json(
        await api.testAiKey(param(req, "orgId"), {
          provider: "gemini",
          ...(typeof body.apiKey === "string" ? { apiKey: body.apiKey } : {}),
        }),
      );
    },

    "POST /api/orgs/:orgId/public-workspace/uploads": async (req) => {
      const file = req.form?.get("file");
      if (!(file instanceof File)) throw new ApiError("validation", "No file was sent");
      return json({ upload: await api.uploadToPublicWorkspace(param(req, "orgId"), file) }, 201);
    },
  };
}

// ---------- The fetch ----------

export function createMockFetch(options: MockFetchOptions = {}): typeof fetch {
  const api = options.backend ?? createMockApi(options);
  const handlers = createHandlers(api);
  const isSignedIn = options.isSignedIn ?? ((): boolean => true);

  return async (input, init) => {
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const url = new URL(String(input), "http://mock.local");
    const method = (init?.method ?? "GET").toUpperCase();

    if (!isSignedIn()) return errorResponse(new ApiError("unauthenticated", "Sign in to continue."));

    const match = matchRoute(method, url.pathname);
    if (!match) return errorResponse(new ApiError("not_found", `No such route: ${method} ${url.pathname}`));
    const handler = handlers[match.key];
    if (!handler) return errorResponse(new ApiError("internal", `${match.key} is not implemented in the mock`, { status: 501 }));

    const body = init?.body;
    const form = body instanceof FormData ? body : null;
    let parsed: unknown;
    if (typeof body === "string") {
      try {
        parsed = JSON.parse(body);
      } catch {
        return errorResponse(new ApiError("validation", "Request body is not valid JSON"));
      }
    }

    try {
      return await handler({ params: match.params, body: parsed, form, signal });
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof ApiError) return errorResponse(err);
      return errorResponse(new ApiError("internal", err instanceof Error ? err.message : "Mock failure", { cause: err }));
    }
  };
}
