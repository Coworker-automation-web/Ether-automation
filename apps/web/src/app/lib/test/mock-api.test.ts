import { describe, expect, it } from "vitest";
import type { SseEvent } from "@ether/shared";
import { ApiError } from "../errors";
import { cannedMarkdown, chunkText, createMockApi } from "../fake/api";
import { registerMockRoom } from "../fake/rooms";
import type { DocNode } from "../contracts";

const NOW = 1_800_000_000;
const make = (o: Parameters<typeof createMockApi>[0] = {}) =>
  createMockApi({ now: () => NOW, delayMs: 0, streamDelayMs: 0, ...o });

async function run(api: ReturnType<typeof make>, prompt: string, tool: "write" | "plan" | "blueprint" = "write") {
  const events: SseEvent[] = [];
  for await (const e of api.generate({ workspaceId: "w1", tool, agent: "default", prompt, web: false })) events.push(e);
  return events;
}

describe("mock API: history", () => {
  it("lists the seeded versions newest first, without content", async () => {
    const list = await make().listSnapshots("w1");
    expect(list).toHaveLength(7);
    expect(list[0]?.title).toBe("AI Productivity Tips");
    expect(list.every((s, i) => i === 0 || (list[i - 1]?.created_at ?? 0) >= s.created_at)).toBe(true);
    expect(Object.keys(list[0] ?? {})).not.toContain("content");
  });

  it("restore snapshots the live document first, then replaces it", async () => {
    const api = make();
    const live: DocNode = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "mine" }] }] };
    let applied: DocNode | null = null;
    registerMockRoom("w1", { getContent: () => live, applyContent: (d) => void (applied = d) });

    const [first] = await api.listSnapshots("w1");
    const result = await api.restoreSnapshot("w1", first!.id);

    expect(result.restoredSnapshotId).toBe(first!.id);
    expect(applied).not.toBeNull();
    const after = await api.listSnapshots("w1");
    const pre = after.find((s) => s.id === result.preRestoreSnapshotId);
    expect(pre?.kind).toBe("pre_restore");
    expect(after).toHaveLength(8);
  });

  it("restoring an unknown version is not_found", async () => {
    await expect(make().restoreSnapshot("w1", "nope")).rejects.toMatchObject({ code: "not_found" });
  });

  it("summarises and enforces the summary limit", async () => {
    const api = make({ summaryLimit: 1 });
    const [a, b] = await api.listSnapshots("w1");
    const r = await api.summarizeSnapshot("w1", a!.id);
    expect(r.summary_status).toBe("done");
    expect(r.summary.length).toBeGreaterThan(0);
    await expect(api.summarizeSnapshot("w1", b!.id)).rejects.toMatchObject({ code: "ai_limit_reached" });
  });
});

describe("mock API: generation", () => {
  it("streams text then a single done, and the text is the canned markdown", async () => {
    const events = await run(make(), "hello");
    expect(events.at(-1)?.event).toBe("done");
    expect(events.filter((e) => e.event !== "text")).toHaveLength(1);
    const text = events.flatMap((e) => (e.event === "text" ? [e.data.text] : [])).join("");
    expect(text).toBe(cannedMarkdown("write", "default"));
  });

  it("covers every tool", () => {
    expect(cannedMarkdown("plan", "fast")).toContain("Execution Plan");
    expect(cannedMarkdown("blueprint", "creative")).toContain("System Blueprint");
  });

  it("rejects invalid input before streaming", async () => {
    await expect(run(make(), "   ")).rejects.toMatchObject({ code: "validation" });
  });

  it("fails before the stream with limit errors that carry resetAt", async () => {
    await expect(run(make(), "x [limit]")).rejects.toMatchObject({ code: "ai_limit_reached", resetAt: expect.any(Number) });
    await expect(run(make(), "x [daily]")).rejects.toMatchObject({ code: "daily_limit" });
    const capped = make({ generationLimit: 1 });
    await run(capped, "one");
    await expect(run(capped, "two")).rejects.toBeInstanceOf(ApiError);
  });

  it("reports failures as a terminal error event, before or part-way through", async () => {
    const early = await run(make(), "[fail]");
    expect(early).toHaveLength(1);
    expect(early[0]?.event).toBe("error");

    const mid = await run(make(), "[midfail]");
    expect(mid.at(0)?.event).toBe("text");
    expect(mid.at(-1)?.event).toBe("error");
  });

  it("counts usage and resets at the next UTC midnight", async () => {
    const api = make();
    await run(api, "a");
    const usage = await api.getAiUsage();
    expect(usage.generations).toEqual({ used: 1, limit: 15 });
    expect(usage.resetAt).toBe((Math.floor(NOW / 86400) + 1) * 86400);
  });

  it("aborting stops the stream with an AbortError", async () => {
    const api = createMockApi({ now: () => NOW, delayMs: 0, streamDelayMs: 5 });
    const controller = new AbortController();
    const iterator = api.generate({ workspaceId: "w", tool: "write", agent: "default", prompt: "x", web: false }, controller.signal);
    const pending = (async () => {
      for await (const _ of iterator) controller.abort();
    })();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("chunks text without losing characters", () => {
    expect(chunkText("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(chunkText("", 3)).toEqual([]);
  });
});

describe("mock API: keys and uploads", () => {
  it("stores only the last four characters and tests keys", async () => {
    const api = make();
    expect(await api.listAiKeys("org1")).toEqual([]);
    await expect(api.putAiKey("org1", "short")).rejects.toMatchObject({ code: "ai_key_invalid" });
    await api.putAiKey("org1", "A".repeat(16) + "wxyz");
    expect(await api.listAiKeys("org1")).toEqual([{ provider: "gemini", last4: "wxyz" }]);
    expect(await api.testAiKey("org1", { provider: "gemini" })).toEqual({ ok: true });
    expect((await api.testAiKey("org2", { provider: "gemini" })).ok).toBe(false);
    expect((await api.testAiKey("org2", { provider: "gemini", apiKey: "tiny" })).ok).toBe(false);
  });

  it("rejects oversized uploads", async () => {
    const api = make();
    const big = { name: "big.bin", size: 11 * 1024 * 1024, type: "" } as File;
    await expect(api.uploadToPublicWorkspace("org1", big)).rejects.toMatchObject({ code: "payload_too_large" });
    const ok = { name: "a.txt", size: 3, type: "text/plain" } as File;
    expect((await api.uploadToPublicWorkspace("org1", ok)).filename).toBe("a.txt");
  });
});
