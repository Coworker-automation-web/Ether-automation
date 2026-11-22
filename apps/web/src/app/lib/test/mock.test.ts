import { API_ROUTES, snapshotsResponseSchema } from "@ether/shared";
import { describe, expect, it, vi } from "vitest";
import { createApiClient, limitStateOf } from "../api";
import { createHttpApi } from "../client/http";
import { createMockFetch, matchRoute } from "../mock";
import { MOCK_ME } from "../fake/seed";

const NOW = 1_800_000_000;

function setup(extra: Parameters<typeof createMockFetch>[0] = {}) {
  const onUnauthorized = vi.fn();
  const fetchImpl = createMockFetch({ now: () => NOW, delayMs: 0, streamDelayMs: 0, ...extra });
  const api = createHttpApi({ fetchImpl, onUnauthorized });
  return { api, fetchImpl, onUnauthorized };
}

describe("matchRoute", () => {
  it("matches shared routes and extracts decoded params", () => {
    expect(matchRoute("GET", "/api/me")).toEqual({ key: "GET /api/me", params: {} });
    expect(matchRoute("POST", "/api/workspaces/w%201/history/s1/restore")).toEqual({
      key: "POST /api/workspaces/:workspaceId/history/:snapshotId/restore",
      params: { workspaceId: "w 1", snapshotId: "s1" },
    });
  });

  it("does not match unknown paths or wrong methods", () => {
    expect(matchRoute("GET", "/api/nope")).toBeNull();
    expect(matchRoute("DELETE", "/api/me")).toBeNull();
    expect(matchRoute("GET", "/api/workspaces/w1/history/extra")).toBeNull();
  });

  it("can reach every route in the shared table", () => {
    for (const route of API_ROUTES) {
      const path = route.path.replace(/:[A-Za-z]+/g, "x");
      expect(matchRoute(route.method, path)?.key, `${route.method} ${route.path}`).toBe(`${route.method} ${route.path}`);
    }
  });
});

describe("GET /api/me", () => {
  it("serves the demo user and membership, validated by the shared schema", async () => {
    const me = await setup().api.getMe();
    expect(me).toEqual(MOCK_ME);
    expect(me.memberships[0]?.role).toBe("admin");
  });
});

describe("history handlers", () => {
  it("seeds the prototype's seven items as snapshots", async () => {
    const list = await setup().api.listSnapshots("w1");
    expect(list).toHaveLength(7);
    expect(snapshotsResponseSchema.safeParse({ snapshots: list }).success).toBe(true);
    expect(list.map((s) => s.title)).toContain("AI Productivity Tips");
    for (const s of list) {
      expect(Object.keys(s).sort()).toEqual(["bytes", "created_at", "id", "kind", "summary", "summary_status", "title"]);
      expect(["auto", "named"]).toContain(s.kind);
    }
  });

  it("creates a named version that shows up first", async () => {
    const { api } = setup();
    const made = await api.createSnapshot("w1", "  Release draft ");
    expect(made).toMatchObject({ kind: "named", title: "Release draft", summary_status: "none" });
    const list = await api.listSnapshots("w1");
    expect(list).toHaveLength(8);
    expect(list[0]?.id).toBe(made.id);
  });

  it("rejects an invalid name with a validation error before touching state", async () => {
    const { fetchImpl } = setup();
    const res = await fetchImpl("/api/workspaces/w1/history", { method: "POST", body: JSON.stringify({ title: "" }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "validation" } });
  });

  it("restores: takes a pre-restore snapshot first and reports both ids", async () => {
    const { api } = setup();
    const [first] = await api.listSnapshots("w1");
    const r = await api.restoreSnapshot("w1", first!.id);
    expect(r.restoredSnapshotId).toBe(first!.id);
    const after = await api.listSnapshots("w1");
    expect(after.find((s) => s.id === r.preRestoreSnapshotId)?.kind).toBe("pre_restore");
  });

  it("answers 404 for a version that does not exist", async () => {
    await expect(setup().api.restoreSnapshot("w1", "missing")).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("keeps each workspace's history separate", async () => {
    const { api } = setup();
    await api.createSnapshot("a", "Only in a");
    expect(await api.listSnapshots("a")).toHaveLength(8);
    expect(await api.listSnapshots("b")).toHaveLength(7);
  });
});

describe("routing and sign-in", () => {
  it("answers 404 for routes the server does not have", async () => {
    const res = await setup().fetchImpl("/api/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("answers 501 for a real route the mock does not implement", async () => {
    const res = await setup().fetchImpl("/api/orgs/o1/members");
    expect(res.status).toBe(501);
  });

  it("answers 401 everywhere when signed out, which sends the client to /login", async () => {
    let signedIn = false;
    const { api, onUnauthorized } = setup({ isSignedIn: () => signedIn });
    await expect(api.getMe()).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    signedIn = true;
    await expect(api.getMe()).resolves.toBeDefined();
  });

  it("honours an already-aborted request", async () => {
    const { fetchImpl } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(fetchImpl("/api/me", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("AI handlers over the wire", () => {
  const input = { workspaceId: "w1", tool: "write", agent: "default", prompt: "hi", web: false } as const;

  it("streams text then done as server-sent events", async () => {
    const { api } = setup();
    const events = [];
    for await (const e of api.generate(input)) events.push(e);
    expect(events.at(-1)?.event).toBe("done");
    expect(events.filter((e) => e.event === "text").length).toBeGreaterThan(1);
  });

  it("answers limit failures as non-2xx responses carrying resetAt (typed limit state)", async () => {
    const { api } = setup();
    const run = async () => {
      for await (const _ of api.generate({ ...input, prompt: "x [limit]" })) void _;
    };
    const err = await run().catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "ai_limit_reached", status: 429 });
    expect(limitStateOf(err)?.resetAt).toBeTypeOf("number");

    const daily = await (async () => {
      for await (const _ of api.generate({ ...input, prompt: "x [daily]" })) void _;
    })().catch((e: unknown) => e);
    expect(limitStateOf(daily)?.kind).toBe("daily_limit");
  });

  it("delivers mid-stream failures as an error event, not a thrown error", async () => {
    const { api } = setup();
    const events = [];
    for await (const e of api.generate({ ...input, prompt: "[midfail]" })) events.push(e);
    expect(events.at(-1)?.event).toBe("error");
  });

  it("reports usage, keys and uploads", async () => {
    const { api } = setup();
    expect((await api.getAiUsage()).generations.limit).toBe(15);
    await api.putAiKey("org-demo", "A".repeat(16) + "wxyz");
    expect(await api.listAiKeys("org-demo")).toEqual([{ provider: "gemini", last4: "wxyz" }]);
    expect(await api.testAiKey("org-demo", { provider: "gemini" })).toEqual({ ok: true });
    const file = new File(["hello"], "a.txt", { type: "text/plain" });
    expect((await api.uploadToPublicWorkspace("org-demo", file)).filename).toBe("a.txt");
  });

  it("still validates bodies the way the server does", async () => {
    const { fetchImpl } = setup();
    const res = await fetchImpl("/api/orgs/o/ai-keys", { method: "PUT", body: JSON.stringify({ provider: "gemini", apiKey: "short" }) });
    expect(res.status).toBe(400);
  });
});

describe("the client works against the mock without its own redirect hook", () => {
  it("createApiClient + mock fetch round-trips JSON", async () => {
    const c = createApiClient({ fetchImpl: createMockFetch({ delayMs: 0 }), onUnauthorized: () => undefined });
    const res = await c.send({ method: "GET", path: "/api/me" });
    expect(res.status).toBe(200);
  });
});
