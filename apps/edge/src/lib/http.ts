import { errorBody, type ErrorCode, httpStatusFor } from "@ether/shared";
import type { Context } from "hono";

/** One place that turns an error code into the wire format and status. */
export function errorResponse(c: Context, code: ErrorCode, message: string, resetAt?: number) {
  return c.json(errorBody(code, message, resetAt), httpStatusFor(code));
}
