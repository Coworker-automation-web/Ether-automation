import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryRateLimiter, rateLimit, setRateLimiter } from "../src/lib/rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit then blocks, per key", async () => {
    let now = 1000;
    const l = new InMemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect((await l.hit("a", 3, 60)).allowed).toBe(true);
    const blocked = await l.hit("a", 3, 60);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, resetAt: 1060 });
    expect((await l.hit("b", 3, 60)).allowed).toBe(true);
    now = 1060;
    expect((await l.hit("a", 3, 60)).allowed).toBe(true);
  });
});

describe("rateLimit middleware", () => {
  afterEach(() => setRateLimiter(new InMemoryRateLimiter()));

  it("returns a typed 429 with resetAt and Retry-After", async () => {
    setRateLimiter(new InMemoryRateLimiter());
    const app = new Hono();
    app.post("/x", rateLimit("test", { limit: 2, windowSeconds: 60 }), (c) => c.json({ ok: true }));
    const hit = () => app.request("/x", { method: "POST", headers: { "cf-connecting-ip": "1.2.3.4" } });
    expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(200);
    const res = await hit();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    const body = (await res.json()) as { error: { code: string; resetAt: number } };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.resetAt).toBeGreaterThan(0);
    const other = await app.request("/x", { method: "POST", headers: { "cf-connecting-ip": "9.9.9.9" } });
    expect(other.status).toBe(200);
  });
});
