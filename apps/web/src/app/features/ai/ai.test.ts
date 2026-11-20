import { MAX_PROMPT_CHARS, type AiUsageResponse } from "@ether/shared";
import { describe, expect, it } from "vitest";
import { ApiRequestError, describeError } from "../../lib/errors";
import { attributionLabel, attributionName, MAX_ATTRIBUTION_NAME } from "./attribution";
import { generationReducer, initialGeneration } from "./generation";
import { composePrompt, docToPlainText } from "./prompt";
import { usageLabel } from "./UsageBadge";

describe("composePrompt", () => {
  it("prefers the selection, falls back to the document, and rejects empty input", () => {
    expect(composePrompt({ selection: " pick me ", document: "whole doc" })).toEqual({
      ok: true,
      prompt: "pick me",
      source: "selection",
      truncated: false,
    });
    expect(composePrompt({ selection: "", document: "whole doc" })).toMatchObject({ source: "document", prompt: "whole doc" });
    expect(composePrompt({ selection: "  ", document: "  \n " })).toEqual({ ok: false, reason: "empty" });
  });

  it("trims to the contract limit: selection keeps its start, document keeps its end", () => {
    const long = "a".repeat(MAX_PROMPT_CHARS) + "TAIL";
    const sel = composePrompt({ selection: "HEAD" + long, document: "" });
    expect(sel).toMatchObject({ ok: true, truncated: true });
    if (sel.ok) {
      expect(sel.prompt.startsWith("HEAD")).toBe(true);
      expect(sel.prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    }
    const doc = composePrompt({ selection: "", document: long + "HEAD" });
    if (doc.ok) {
      expect(doc.prompt.endsWith("HEAD")).toBe(true);
      expect(doc.prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    }
  });
});

describe("docToPlainText", () => {
  it("joins blocks with blank lines and skips empty ones", () => {
    const text = docToPlainText({
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "Hi" }] },
        { type: "paragraph" },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] }] },
      ],
    });
    expect(text).toBe("Hi\n\nx");
  });
});

describe("attribution", () => {
  it("labels AI output with who requested it", () => {
    expect(attributionLabel("Ada Lovelace")).toBe("AI, requested by Ada Lovelace");
  });

  it("collapses whitespace, caps length and falls back for blank names", () => {
    expect(attributionName("  Ada \n  L  ")).toBe("Ada L");
    expect(attributionName("x".repeat(200)).length).toBe(MAX_ATTRIBUTION_NAME);
    expect(attributionName("   ")).toBe("a collaborator");
  });

  it("keeps markup characters as inert text", () => {
    expect(attributionName("<b>Eve</b>")).toBe("<b>Eve</b>");
  });
});

describe("generationReducer", () => {
  it("accumulates chunks only while streaming", () => {
    let s = generationReducer(initialGeneration, { type: "chunk", text: "ignored" });
    expect(s).toEqual({ status: "idle" });
    s = generationReducer(s, { type: "start" });
    s = generationReducer(s, { type: "chunk", text: "a" });
    s = generationReducer(s, { type: "chunk", text: "b" });
    expect(s).toEqual({ status: "streaming", text: "ab" });
  });

  it("discards partial output on failure and resets", () => {
    const error = describeError(new ApiRequestError("ai_limit_reached", "m", { resetAt: 1 }));
    let s = generationReducer({ status: "streaming", text: "partial" }, { type: "fail", error });
    expect(s).toEqual({ status: "error", error });
    s = generationReducer(s, { type: "reset" });
    expect(s).toEqual({ status: "idle" });
  });

  it("restarts cleanly after an error", () => {
    const error = describeError(new Error("x"));
    expect(generationReducer({ status: "error", error }, { type: "start" })).toEqual({ status: "streaming", text: "" });
  });
});

describe("usageLabel", () => {
  const usage: AiUsageResponse = {
    day: "2026-11-20",
    generations: { used: 3, limit: 15 },
    summaries: { used: 60, limit: 60 },
    resetAt: 1,
  };
  it("shows what is left today and never goes negative", () => {
    expect(usageLabel(usage, "generations")).toBe("Powered by Gemini · 12 left today");
    expect(usageLabel({ ...usage, summaries: { used: 70, limit: 60 } }, "summaries")).toBe("Summaries by Gemini · 0 left today");
    expect(usageLabel(undefined, "generations")).toBe("Powered by Gemini");
  });
});
