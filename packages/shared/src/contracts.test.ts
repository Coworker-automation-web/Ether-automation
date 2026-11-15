import { describe, expect, it } from "vitest";
import {
  AI_AGENTS,
  aiGenerateSchema,
  aiUsageResponseSchema,
  apiErrorSchema,
  canWriteRoom,
  changeRoleSchema,
  ERROR_CODES,
  ERROR_STATUS,
  errorBody,
  formatSseEvent,
  httpStatusFor,
  isRoleKeyFormat,
  joinOrgSchema,
  meResponseSchema,
  mintRoleKeyResponseSchema,
  mintRoleKeySchema,
  normalizeRoleKey,
  ROOM_HEADERS,
  ROLES,
  snapshotSchema,
  sseErrorDataSchema,
  wsPath,
  YJS,
  JOIN_ROLE,
} from "./index";

const DOC_KEY = "ETH-K7QM-4XZP-9WDC-H2TN-8RVB"; // example from the architecture doc

describe("errors", () => {
  it("every code has a 4xx/5xx status", () => {
    for (const c of ERROR_CODES) {
      expect(ERROR_STATUS[c]).toBeGreaterThanOrEqual(400);
      expect(ERROR_STATUS[c]).toBeLessThan(600);
      expect(httpStatusFor(c)).toBe(ERROR_STATUS[c]);
    }
  });

  it("includes the codes the clients depend on", () => {
    for (const c of ["unauthenticated", "forbidden", "not_found", "validation", "rate_limited", "key_invalid", "key_expired", "key_exhausted", "ai_limit_reached", "daily_limit"]) {
      expect(ERROR_CODES).toContain(c);
    }
  });

  it("builds and validates the wire format, with optional resetAt", () => {
    const body = errorBody("ai_limit_reached", "Daily AI limit reached", 1_800_000_000);
    expect(apiErrorSchema.parse(body)).toEqual({ error: { code: "ai_limit_reached", message: "Daily AI limit reached", resetAt: 1_800_000_000 } });
    expect(errorBody("forbidden", "No").error).not.toHaveProperty("resetAt");
    expect(apiErrorSchema.safeParse({ error: { code: "nope", message: "x" } }).success).toBe(false);
  });
});

describe("role keys", () => {
  it("accepts the documented format and normalises user input", () => {
    expect(isRoleKeyFormat(DOC_KEY)).toBe(true);
    expect(normalizeRoleKey("  eth-k7qm-4xzp-9wdc-h2tn-8rvb \n")).toBe(DOC_KEY);
    expect(isRoleKeyFormat("eth-k7qm-4xzp-9wdc-h2tn-8rvb")).toBe(true);
  });

  it("rejects wrong shape and ambiguous letters (I, L, O, U)", () => {
    expect(isRoleKeyFormat("ETH-K7QM-4XZP-9WDC-H2TN")).toBe(false);
    expect(isRoleKeyFormat("ETH-K7QM-4XZP-9WDC-H2TN-8RVI")).toBe(false);
    expect(isRoleKeyFormat("KEY-K7QM-4XZP-9WDC-H2TN-8RVB")).toBe(false);
  });

  it("join schema normalises but never reveals format problems", () => {
    expect(joinOrgSchema.parse({ roleKey: " eth-k7qm-4xzp-9wdc-h2tn-8rvb " }).roleKey).toBe(DOC_KEY);
    expect(joinOrgSchema.safeParse({ roleKey: "garbage" }).success).toBe(true);
    expect(joinOrgSchema.safeParse({ roleKey: "" }).success).toBe(false);
  });

  it("joining grants member by default", () => {
    expect(JOIN_ROLE).toBe("member");
  });

  it("mint defaults to member, 7 days, 1 use", () => {
    expect(mintRoleKeySchema.parse({})).toEqual({ role: "member", label: "", expiresInHours: 168, maxUses: 1 });
  });

  it("mint can never grant admin or executive", () => {
    for (const role of ["admin", "executive", "owner"]) expect(mintRoleKeySchema.safeParse({ role }).success).toBe(false);
    expect(mintRoleKeySchema.safeParse({ role: "viewer" }).success).toBe(true);
  });

  it("mint bounds: expiry 1h-30d, uses 1-100", () => {
    expect(mintRoleKeySchema.safeParse({ expiresInHours: 0 }).success).toBe(false);
    expect(mintRoleKeySchema.safeParse({ expiresInHours: 24 * 30 + 1 }).success).toBe(false);
    expect(mintRoleKeySchema.safeParse({ maxUses: 0 }).success).toBe(false);
    expect(mintRoleKeySchema.safeParse({ maxUses: 101 }).success).toBe(false);
  });

  it("mint response carries the plaintext key in the documented format", () => {
    const ok = { id: "k1", role: "member", label: "", expiresAt: 1, maxUses: 1, createdAt: 0, key: DOC_KEY };
    expect(mintRoleKeyResponseSchema.safeParse(ok).success).toBe(true);
    expect(mintRoleKeyResponseSchema.safeParse({ ...ok, key: "short" }).success).toBe(false);
  });
});

describe("request/response schemas", () => {
  it("role change rejects admin", () => {
    expect(changeRoleSchema.safeParse({ role: "admin" }).success).toBe(false);
    for (const role of ["executive", "member", "viewer"]) expect(changeRoleSchema.safeParse({ role }).success).toBe(true);
  });

  it("snapshot list item uses the specified column names", () => {
    const item = { id: "s1", kind: "named", title: "v1", summary: null, summary_status: "none", bytes: 10, created_at: 1 };
    expect(snapshotSchema.parse(item)).toEqual(item);
    expect(snapshotSchema.safeParse({ ...item, kind: "manual" }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...item, summary_status: "ready" }).success).toBe(false);
  });

  it("ai.generate: defaults, tools and limits", () => {
    expect(aiGenerateSchema.parse({ workspaceId: "w", tool: "write", prompt: " hi " })).toEqual({ workspaceId: "w", tool: "write", agent: "default", prompt: "hi", web: false });
    expect(aiGenerateSchema.safeParse({ workspaceId: "w", tool: "image", prompt: "x" }).success).toBe(false);
    expect(aiGenerateSchema.safeParse({ workspaceId: "w", tool: "plan", prompt: "   " }).success).toBe(false);
    expect(aiGenerateSchema.safeParse({ workspaceId: "w", tool: "plan", prompt: "x".repeat(8001) }).success).toBe(false);
    expect([...AI_AGENTS]).toEqual(["default", "fast", "creative", "research"]);
    expect(aiGenerateSchema.safeParse({ workspaceId: "w", tool: "write", agent: "gemini-3.5-flash", prompt: "x" }).success).toBe(false);
  });

  it("ai.usage and /api/me shapes validate", () => {
    expect(aiUsageResponseSchema.safeParse({ day: "2026-11-15", generations: { used: 1, limit: 15 }, summaries: { used: 0, limit: 60 }, resetAt: 1_800_000_000 }).success).toBe(true);
    const me = {
      user: { id: "u1", email: "a@b.co", name: "A", picture: null },
      memberships: [{ orgId: "o1", orgName: "Org", role: "viewer", publicWorkspaceId: "w1", aiKeyDelegated: false }],
    };
    expect(meResponseSchema.safeParse(me).success).toBe(true);
    expect(ROLES).toHaveLength(4);
  });
});

describe("collaboration contract", () => {
  it("fixes the Yjs shape", () => {
    expect(YJS.TEXT_FRAGMENT).toBe("content");
    expect(YJS.CANVAS_MAP).toBe("canvas");
  });

  it("builds the websocket path and uses lowercase header names", () => {
    expect(wsPath("abc")).toBe("/api/ws/abc");
    expect(wsPath("a/b")).toBe("/api/ws/a%2Fb");
    for (const h of Object.values(ROOM_HEADERS)) expect(h).toBe(h.toLowerCase());
  });

  it("viewers cannot write to a room; owner and editors can", () => {
    expect(canWriteRoom("viewer")).toBe(false);
    for (const r of ["member", "executive", "admin", "owner"] as const) expect(canWriteRoom(r)).toBe(true);
  });

  it("formats SSE events as a single data line, round-tripping through JSON", () => {
    const text = formatSseEvent({ event: "text", data: { text: "line one\nline two" } });
    expect(text).toBe('event: text\ndata: {"text":"line one\\nline two"}\n\n');
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!.slice("data: ".length))).toEqual({ text: "line one\nline two" });
    expect(formatSseEvent({ event: "done", data: {} })).toBe("event: done\ndata: {}\n\n");
  });

  it("SSE error events carry the same body as HTTP errors", () => {
    const body = errorBody("ai_limit_reached", "Limit reached", 1_800_000_000);
    expect(sseErrorDataSchema.safeParse(body).success).toBe(true);
    expect(formatSseEvent({ event: "error", data: body })).toContain('"code":"ai_limit_reached"');
  });
});
