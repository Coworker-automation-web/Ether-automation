import { describe, expect, it } from "vitest";
import { isMockEnabled, readConfig, wsBaseFor } from "../config";
import { shouldRetry } from "../query";
import { ApiRequestError, networkError } from "../errors";

describe("config", () => {
  it("enables mocks only for PUBLIC_API_MOCK=1", () => {
    expect(isMockEnabled({ PUBLIC_API_MOCK: "1" })).toBe(true);
    expect(isMockEnabled({ PUBLIC_API_MOCK: "0" })).toBe(false);
    expect(isMockEnabled({ PUBLIC_API_MOCK: "true" })).toBe(false);
    expect(isMockEnabled({})).toBe(false);
  });

  it("derives the socket base from the page origin and picks wss on https", () => {
    expect(wsBaseFor({ protocol: "https:", host: "ether.app" })).toMatch(/^wss:\/\/ether\.app\/api\/ws$/);
    expect(wsBaseFor({ protocol: "http:", host: "localhost:4321" })).toMatch(/^ws:\/\/localhost:4321\//);
  });

  it("builds a full runtime config", () => {
    const c = readConfig({ PUBLIC_API_MOCK: "1" }, { protocol: "http:", host: "x" });
    expect(c.mock).toBe(true);
    expect(c.apiBase).toBe("");
  });
});

describe("query retry policy", () => {
  it("retries network blips and 5xx up to twice, never 4xx", () => {
    expect(shouldRetry(0, networkError())).toBe(true);
    expect(shouldRetry(1, new ApiRequestError("internal", "x", { status: 503 }))).toBe(true);
    expect(shouldRetry(2, networkError())).toBe(false);
    expect(shouldRetry(0, new ApiRequestError("forbidden", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiRequestError("ai_limit_reached", "x"))).toBe(false);
    expect(shouldRetry(0, new Error("x"))).toBe(false);
  });
});
