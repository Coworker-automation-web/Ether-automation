import { describe, expect, it } from "vitest";
import { createHttpApi } from "../api/http";

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function fakeFetch(responder: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = { url: String(input), init };
    calls.push(call);
    return responder(call);
  };
  return { calls, api: createHttpApi({ baseUrl: "https://x.test", fetchImpl }) };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("http API", () => {
  it("lists history with same-origin credentials and validates the response", async () => {
    const snap = { id: "s1", kind: "auto", title: "T", summary: null, summary_status: "none", bytes: 1, created_at: 5 };
    const { api, calls } = fakeFetch(() => json({ snapshots: [snap] }));
    expect(await api.listSnapshots("w 1")).toEqual([snap]);
    expect(calls[0]?.url).toBe("https://x.test/api/workspaces/w%201/history");
    expect(calls[0]?.init?.credentials).toBe("same-origin");
  });

  it("rejects responses that do not match the contract", async () => {
    const { api } = fakeFetch(() => json({ snapshots: [{ id: "s1" }] }));
    await expect(api.listSnapshots("w1")).rejects.toMatchObject({ code: "internal" });
  });

  it("maps server error bodies, including limits", async () => {
    const { api } = fakeFetch(() => json({ error: { code: "daily_limit", message: "full", resetAt: 99 } }, 503));
    await expect(api.getAiUsage()).rejects.toMatchObject({ code: "daily_limit", status: 503, resetAt: 99 });
  });

  it("turns fetch failures into network errors but lets aborts through", async () => {
    const down = createHttpApi({
      fetchImpl: () => Promise.reject(new TypeError("offline")),
    });
    await expect(down.getAiUsage()).rejects.toMatchObject({ isNetwork: true });
    const aborted = createHttpApi({
      fetchImpl: () => Promise.reject(new DOMException("x", "AbortError")),
    });
    await expect(aborted.getAiUsage()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("validates outgoing AI input before sending", async () => {
    const { api, calls } = fakeFetch(() => new Response(""));
    const run = async () => {
      for await (const _ of api.generate({ workspaceId: "w", tool: "write", agent: "default", prompt: "  ", web: false })) void _;
    };
    await expect(run()).rejects.toMatchObject({ code: "validation" });
    expect(calls).toHaveLength(0);
  });

  it("streams generation events from an SSE response", async () => {
    const body =
      'event: text\ndata: {"text":"Hi"}\n\nevent: done\ndata: {"route":"default"}\n\n';
    const { api, calls } = fakeFetch(() => new Response(body, { headers: { "content-type": "text/event-stream" } }));
    const events = [];
    for await (const e of api.generate({ workspaceId: "w", tool: "write", agent: "default", prompt: "p", web: true })) events.push(e);
    expect(events.map((e) => e.event)).toEqual(["text", "done"]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ prompt: "p", web: true });
  });

  it("never sends an API key in a URL", async () => {
    const { api, calls } = fakeFetch(() => json({ ok: true }));
    await api.testAiKey("org", { provider: "gemini", apiKey: "SECRET-KEY-VALUE-1234" });
    expect(calls[0]?.url).not.toContain("SECRET");
    expect(calls[0]?.init?.method).toBe("POST");
  });
});
