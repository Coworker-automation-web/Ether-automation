import { apiErrorSchema, ERROR_STATUS, type ApiError, type ErrorCode } from "@ether/shared";

export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  /** HTTP status; 0 means the request never reached the server. */
  readonly status: number;
  /** Unix seconds when a limit resets (ai_limit_reached, rate_limited, daily_limit). */
  readonly resetAt: number | undefined;

  constructor(code: ErrorCode, message: string, opts: { status?: number; resetAt?: number; cause?: unknown } = {}) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "ApiRequestError";
    this.code = code;
    this.status = opts.status ?? ERROR_STATUS[code];
    this.resetAt = opts.resetAt;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function networkError(cause?: unknown, message = "Network error. Check your connection and try again."): ApiRequestError {
  return new ApiRequestError("internal", message, { status: 0, cause });
}

export function fromApiError(body: ApiError, status: number): ApiRequestError {
  const { code, message, resetAt } = body.error;
  return new ApiRequestError(code, message, { status, ...(resetAt === undefined ? {} : { resetAt }) });
}

/** Parses a non-2xx response body; unknown shapes become a generic internal error. */
export async function errorFromResponse(res: Response): Promise<ApiRequestError> {
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const parsed = apiErrorSchema.safeParse(json);
  if (parsed.success) return fromApiError(parsed.data, res.status);
  return new ApiRequestError("internal", `Request failed (${res.status})`, { status: res.status });
}

export function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

export function toApiRequestError(err: unknown): ApiRequestError {
  if (err instanceof ApiRequestError) return err;
  const message = err instanceof Error ? err.message : "Something went wrong";
  return new ApiRequestError("internal", message, { cause: err });
}

export type ErrorKind =
  | "auth"
  | "forbidden"
  | "rate-limit"
  | "daily-limit"
  | "ai-limit"
  | "ai-disabled"
  | "ai-key"
  | "validation"
  | "network"
  | "generic";

export interface ErrorDescription {
  readonly kind: ErrorKind;
  readonly message: string;
  readonly resetAt?: number;
  /** ai_limit_reached: offer the user the option to add an organisation key (arch §9). */
  readonly suggestAddKey: boolean;
}

/** One place that turns any failure into copy and a state kind the UI can design for. */
export function describeError(err: unknown): ErrorDescription {
  const e = toApiRequestError(err);
  const withReset = e.resetAt === undefined ? {} : { resetAt: e.resetAt };
  if (e.isNetwork) return { kind: "network", message: e.message, suggestAddKey: false };

  switch (e.code) {
    case "unauthenticated":
      return { kind: "auth", message: "Your session has ended. Sign in again to continue.", suggestAddKey: false };
    case "forbidden":
    case "bad_origin":
      return { kind: "forbidden", message: "You don't have permission to do that here.", suggestAddKey: false };
    case "ai_disabled":
      return { kind: "ai-disabled", message: "AI is turned off for this workspace.", suggestAddKey: false };
    case "ai_region_blocked":
      return { kind: "ai-disabled", message: "AI isn't available in your region.", suggestAddKey: false };
    case "ai_limit_reached":
      return { kind: "ai-limit", message: "You've reached today's AI limit.", suggestAddKey: true, ...withReset };
    case "daily_limit":
      return {
        kind: "daily-limit",
        message: "Ether has reached its free daily capacity.",
        suggestAddKey: false,
        ...withReset,
      };
    case "rate_limited":
      return { kind: "rate-limit", message: "Too many requests. Wait a moment and try again.", suggestAddKey: false, ...withReset };
    case "ai_key_invalid":
      return { kind: "ai-key", message: "That API key was rejected.", suggestAddKey: false };
    case "validation":
      return { kind: "validation", message: e.message, suggestAddKey: false };
    default:
      return { kind: "generic", message: e.message || "Something went wrong.", suggestAddKey: false };
  }
}
