import { z } from "zod";

/** Error code -> HTTP status. The code is the contract; the status is derived from it. */
export const ERROR_STATUS = {
  unauthenticated: 401,
  forbidden: 403,
  bad_origin: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,

  // Role keys. Revoked and unknown keys both return key_invalid (no enumeration of revoked keys).
  key_invalid: 400,
  key_expired: 410,
  key_exhausted: 410,

  // Membership invariants
  already_member: 409,
  last_admin: 409,
  invalid_transfer_target: 422,

  // AI
  ai_disabled: 403,
  ai_region_blocked: 403,
  ai_limit_reached: 429,
  ai_key_invalid: 400,

  // Free-tier platform limit hit until 00:00 UTC
  daily_limit: 503,

  internal: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;
export const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];

export const errorCodeSchema = z.enum(ERROR_CODES);

/** Wire format for every non-2xx JSON response (and the SSE `error` event). */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    /** Unix seconds when the limit resets (ai_limit_reached, rate_limited, daily_limit). */
    resetAt: z.number().int().positive().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export type ErrorStatus = (typeof ERROR_STATUS)[ErrorCode];

export function httpStatusFor(code: ErrorCode): ErrorStatus {
  return ERROR_STATUS[code];
}

export function errorBody(code: ErrorCode, message: string, resetAt?: number): ApiError {
  return { error: resetAt === undefined ? { code, message } : { code, message, resetAt } };
}
