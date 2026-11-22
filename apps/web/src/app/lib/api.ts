import { ApiError, errorFromResponse, isAbortError, networkError } from "./errors";

export { ApiError } from "./errors";

/**
 * The fetch wrapper every request goes through: JSON in and out, cookies included, responses
 * validated with the shared Zod schemas, failures turned into ApiError, and a 401 sends the
 * browser to /login.
 */

export const LOGIN_PATH = "/login";

/** Structural stand-in for a Zod schema, so this file does not need its own zod dependency. */
export interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface SendOptions {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly form?: FormData;
  readonly signal?: AbortSignal | undefined;
  readonly accept?: string;
}

export interface ApiClientOptions {
  /** Prefix for every path. Empty = same origin. */
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  /** Called on a 401 before the error is thrown. Defaults to redirecting to /login. */
  readonly onUnauthorized?: () => void;
}

export interface ApiClient {
  /** Sends the request and returns the (ok) response; use for streams and empty bodies. */
  send(options: SendOptions): Promise<Response>;
  /** Sends the request and validates the JSON body against `parser`. */
  json<T>(parser: Parser<T>, options: SendOptions): Promise<T>;
}

/** Leaves the page for the sign-in screen. A no-op outside a browser and when already there. */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === LOGIN_PATH) return;
  window.location.assign(LOGIN_PATH);
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const base = options.baseUrl ?? "";
  const doFetch: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const onUnauthorized = options.onUnauthorized ?? redirectToLogin;

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
        credentials: "include",
      });
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw networkError(err);
    }

    if (!res.ok) {
      const error = await errorFromResponse(res);
      if (res.status === 401) onUnauthorized();
      throw error;
    }
    return res;
  }

  async function json<T>(parser: Parser<T>, o: SendOptions): Promise<T> {
    const res = await send(o);
    let payload: unknown;
    try {
      payload = await res.json();
    } catch (cause) {
      throw new ApiError("internal", "Unexpected response from the server", { status: res.status, cause });
    }
    const parsed = parser.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError("internal", "Unexpected response from the server", { status: res.status, cause: parsed.error });
    }
    return parsed.data;
  }

  return { send, json };
}

// ---------- Limit states ----------

/**
 * The two "you have used your allowance" failures, as a typed state the UI can render
 * (message, when it resets) instead of a generic error.
 */
export interface LimitState {
  readonly kind: "ai_limit_reached" | "daily_limit";
  readonly message: string;
  /** Unix seconds when the allowance resets, if the server said. */
  readonly resetAt: number | undefined;
}

export function limitStateOf(err: unknown): LimitState | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code !== "ai_limit_reached" && err.code !== "daily_limit") return null;
  return { kind: err.code, message: err.message, resetAt: err.resetAt };
}
