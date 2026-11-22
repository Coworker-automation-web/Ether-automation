import { describe, expect, it } from "vitest";
import { ApiError, describeError, errorFromResponse, isAbortError, networkError, toApiError } from "../errors";

describe("describeError", () => {
  it("maps network failures", () => {
    expect(describeError(networkError()).kind).toBe("network");
  });

  it("maps each error code to a state kind", () => {
    const kind = (code: ConstructorParameters<typeof ApiError>[0]) => describeError(new ApiError(code, "m")).kind;
    expect(kind("unauthenticated")).toBe("auth");
    expect(kind("forbidden")).toBe("forbidden");
    expect(kind("bad_origin")).toBe("forbidden");
    expect(kind("ai_disabled")).toBe("ai-disabled");
    expect(kind("ai_region_blocked")).toBe("ai-disabled");
    expect(kind("ai_limit_reached")).toBe("ai-limit");
    expect(kind("daily_limit")).toBe("daily-limit");
    expect(kind("rate_limited")).toBe("rate-limit");
    expect(kind("ai_key_invalid")).toBe("ai-key");
    expect(kind("validation")).toBe("validation");
    expect(kind("not_found")).toBe("generic");
  });

  it("offers to add a key only for the per-user AI limit, and carries resetAt", () => {
    const limit = describeError(new ApiError("ai_limit_reached", "m", { resetAt: 100 }));
    expect(limit.suggestAddKey).toBe(true);
    expect(limit.resetAt).toBe(100);
    expect(describeError(new ApiError("daily_limit", "m", { resetAt: 100 })).suggestAddKey).toBe(false);
  });

  it("never leaks raw unknown errors into copy beyond their message", () => {
    expect(describeError("boom").kind).toBe("generic");
  });
});

describe("errorFromResponse", () => {
  it("parses the shared error body", async () => {
    const res = new Response(JSON.stringify({ error: { code: "rate_limited", message: "slow", resetAt: 5 } }), { status: 429 });
    const err = await errorFromResponse(res);
    expect(err).toMatchObject({ code: "rate_limited", status: 429, resetAt: 5 });
  });

  it("falls back to a generic error for unknown bodies", async () => {
    const err = await errorFromResponse(new Response("<html>", { status: 502 }));
    expect(err).toMatchObject({ code: "internal", status: 502 });
  });
});

describe("helpers", () => {
  it("detects aborts and wraps unknown values", () => {
    expect(isAbortError(new DOMException("x", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("x"))).toBe(false);
    expect(toApiError(new Error("x"))).toBeInstanceOf(ApiError);
  });
});
