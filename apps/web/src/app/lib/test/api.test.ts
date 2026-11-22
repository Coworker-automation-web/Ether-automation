import { snapshotsResponseSchema } from "@ether/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, limitStateOf, LOGIN_PATH, redirectToLogin } from "../api";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const errorJson = (code: string, message: string, status: number, resetAt?: number): Response =>
  json({ error: resetAt === undefined ? { code, message } : { code, message, resetAt } }, status);

function client(respond: (url: string, init: RequestInit | undefined) => Response, onUnauthorized = vi.fn()) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const c = createApiClient({
    baseUrl: "https://x.test",
    onUnauthorized,
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return respond(String(input), init);
    },
  });
  return { c, calls, onUnauthorized };
}

afterEach(() => vi.unstubAllGlobals());

describe("request shape", () => {
  it("sends JSON with cookies included", async () => {
    const { c, calls } = client(() => json({ snapshots: [] }));
    await c.json(snapshotsResponseSchema, { method: "POST", path: "/api/x", body: { a: 1 } });
    const init = calls[0]?.init;
    expect(init?.credentials).toBe("include");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({ accept: "application/json", "content-type": "application/json" });
  });

  it("does not set a content type for bodiless GETs", async () => {
    const { c, calls } = client(() => json({ snapshots: [] }));
    await c.json(snapshotsResponseSchema, { method: "GET", path: "/api/x" });
    expect(calls[0]?.init?.headers).not.toHaveProperty("content-type");
  });
});

describe("response validation", () => {
  it("returns parsed data when the body matches the shared schema", async () => {
    const { c } = client(() => json({ snapshots: [] }));
    await expect(c.json(snapshotsResponseSchema, { method: "GET", path: "/api/x" })).resolves.toEqual({ snapshots: [] });
  });

  it("turns a body that does not match into an internal ApiError", async () => {
    const { c } = client(() => json({ snapshots: "nope" }));
    const err = await c.json(snapshotsResponseSchema, { method: "GET", path: "/api/x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "internal", status: 200 });
  });

  it("turns non-JSON success bodies into an internal ApiError", async () => {
    const { c } = client(() => new Response("<html>", { status: 200 }));
    await expect(c.json(snapshotsResponseSchema, { method: "GET", path: "/api/x" })).rejects.toMatchObject({ code: "internal" });
  });
});

describe("ApiError mapping", () => {
  it("carries status, code and message from the shared error body", async () => {
    const { c } = client(() => errorJson("forbidden", "Not allowed", 403));
    const err = await c.send({ method: "GET", path: "/api/x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "forbidden", message: "Not allowed" });
  });

  it("keeps resetAt for limits", async () => {
    const { c } = client(() => errorJson("daily_limit", "Used up", 503, 1234));
    await expect(c.send({ method: "GET", path: "/api/x" })).rejects.toMatchObject({ code: "daily_limit", status: 503, resetAt: 1234 });
  });

  it("maps unknown error bodies to a generic internal error with the real status", async () => {
    const { c } = client(() => new Response("<h1>Bad gateway</h1>", { status: 502 }));
    await expect(c.send({ method: "GET", path: "/api/x" })).rejects.toMatchObject({ code: "internal", status: 502 });
  });

  it("maps fetch failures to a network ApiError (status 0) but lets aborts through", async () => {
    const down = createApiClient({ fetchImpl: () => Promise.reject(new TypeError("offline")) });
    await expect(down.send({ method: "GET", path: "/x" })).rejects.toMatchObject({ status: 0, isNetwork: true });
    const aborted = createApiClient({ fetchImpl: () => Promise.reject(new DOMException("x", "AbortError")) });
    await expect(aborted.send({ method: "GET", path: "/x" })).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("limit states", () => {
  it("exposes ai_limit_reached and daily_limit as typed states", () => {
    expect(limitStateOf(new ApiError("ai_limit_reached", "m", { resetAt: 9 }))).toEqual({ kind: "ai_limit_reached", message: "m", resetAt: 9 });
    expect(limitStateOf(new ApiError("daily_limit", "m"))).toEqual({ kind: "daily_limit", message: "m", resetAt: undefined });
  });

  it("is null for every other failure", () => {
    expect(limitStateOf(new ApiError("forbidden", "m"))).toBeNull();
    expect(limitStateOf(new ApiError("rate_limited", "m"))).toBeNull();
    expect(limitStateOf(new Error("x"))).toBeNull();
    expect(limitStateOf(null)).toBeNull();
  });

  it("is what the client throws for a limit response", async () => {
    const { c } = client(() => errorJson("ai_limit_reached", "Out of AI", 429, 55));
    const err = await c.send({ method: "POST", path: "/api/ai/generate" }).catch((e: unknown) => e);
    expect(limitStateOf(err)).toMatchObject({ kind: "ai_limit_reached", resetAt: 55 });
  });
});

describe("401 redirect", () => {
  it("calls onUnauthorized once and still throws an unauthenticated ApiError", async () => {
    const { c, onUnauthorized } = client(() => errorJson("unauthenticated", "Sign in", 401));
    await expect(c.send({ method: "GET", path: "/api/me" })).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("redirects on a 401 even when the body is not the shared shape (e.g. a proxy page)", async () => {
    const { c, onUnauthorized } = client(() => new Response("nope", { status: 401 }));
    await expect(c.send({ method: "GET", path: "/api/me" })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not redirect for other failures or for success", async () => {
    for (const status of [400, 403, 404, 429, 500]) {
      const { c, onUnauthorized } = client(() => errorJson("internal", "x", status));
      await c.send({ method: "GET", path: "/x" }).catch(() => undefined);
      expect(onUnauthorized).not.toHaveBeenCalled();
    }
    const ok = client(() => json({ snapshots: [] }));
    await ok.c.send({ method: "GET", path: "/x" });
    expect(ok.onUnauthorized).not.toHaveBeenCalled();
  });

  it("by default sends the browser to /login", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/app/o/1/w/2", assign } });
    const c = createApiClient({ fetchImpl: async () => errorJson("unauthenticated", "x", 401) });
    await c.send({ method: "GET", path: "/api/me" }).catch(() => undefined);
    expect(assign).toHaveBeenCalledWith("/login");
    expect(LOGIN_PATH).toBe("/login");
  });

  it("does not loop when already on /login, and is a no-op without a window", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/login", assign } });
    redirectToLogin();
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    expect(() => redirectToLogin()).not.toThrow();
  });
});
