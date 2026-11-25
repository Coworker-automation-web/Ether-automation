import type { MiddlewareHandler } from "hono";
import { errorResponse } from "./http";
import { nowSeconds } from "./time";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix seconds when the current window ends. */
  resetAt: number;
}

export interface RateLimiter {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/**
 * TODO(phase 2/5): replace with a Durable Object (QuotaGuard) limiter. This in-memory version
 * is per isolate, so it only slows a single noisy connection; it is NOT a global limit.
 * Cloudflare's own rate-limiting rules should front /api/auth/* and /api/orgs/join in production.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly clock: () => number = nowSeconds) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = this.clock();
    if (this.windows.size > 10_000) {
      for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
    }
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowSeconds };
      this.windows.set(key, w);
    }
    w.count += 1;
    return { allowed: w.count <= limit, remaining: Math.max(0, limit - w.count), resetAt: w.resetAt };
  }
}

let limiter: RateLimiter = new InMemoryRateLimiter();
export function setRateLimiter(next: RateLimiter): void {
  limiter = next;
}

/** Starting budgets; tune with real traffic. */
export const RATE_LIMITS = {
  authStart: { limit: 20, windowSeconds: 60 },
  orgJoin: { limit: 10, windowSeconds: 600 },
  aiGenerate: { limit: 30, windowSeconds: 60 },
} as const;

export function rateLimit(
  name: string,
  budget: { limit: number; windowSeconds: number },
  keyOf: (c: Parameters<MiddlewareHandler>[0]) => string = (c) => c.req.header("cf-connecting-ip") ?? "unknown",
): MiddlewareHandler {
  return async (c, next) => {
    const result = await limiter.hit(`${name}:${keyOf(c)}`, budget.limit, budget.windowSeconds);
    if (!result.allowed) {
      c.header("Retry-After", String(Math.max(1, result.resetAt - nowSeconds())));
      return errorResponse(c, "rate_limited", "Too many requests, try again shortly", result.resetAt);
    }
    await next();
  };
}
