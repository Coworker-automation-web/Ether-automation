import { describe, expect, it } from "vitest";
import { markdownToDoc, parseInline } from "../markdown";

describe("parseInline", () => {
  it("parses bold, italic and code", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "c", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "d", marks: [{ type: "code" }] },
    ]);
  });

  it("leaves unmatched markers as text", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", text: "2 * 3 = 6" }]);
  });
});

describe("markdownToDoc", () => {
  it("builds headings (clamped to h2/h3), paragraphs and lists", () => {
    const doc = markdownToDoc("# Title\n\n#### Deep\n\nHello\nworld\n\n- a\n- b\n\n1. x\n2. y");
    expect(doc.map((n) => n.type)).toEqual(["heading", "heading", "paragraph", "bulletList", "orderedList"]);
    expect(doc[0]?.attrs).toEqual({ level: 2 });
    expect(doc[1]?.attrs).toEqual({ level: 3 });
    expect(doc[2]?.content?.[0]?.text).toBe("Hello world");
    expect(doc[3]?.content).toHaveLength(2);
  });

  it("handles quotes and fenced code verbatim", () => {
    const doc = markdownToDoc("> quoted\n\n```\nconst a = 1;\n\nb\n```");
    expect(doc[0]?.type).toBe("blockquote");
    expect(doc[1]).toEqual({ type: "codeBlock", content: [{ type: "text", text: "const a = 1;\n\nb" }] });
  });

  it("treats HTML as plain text, never as markup", () => {
    const doc = markdownToDoc('<img src=x onerror="alert(1)"> <script>alert(1)</script>');
    expect(doc).toHaveLength(1);
    expect(doc[0]?.type).toBe("paragraph");
    expect(doc[0]?.content?.[0]?.text).toContain("<script>");
    // Only schema node types are ever produced.
    const types = new Set<string>();
    const walk = (n: { type: string; content?: readonly { type: string }[] }): void => {
      types.add(n.type);
    };
    doc.forEach(walk);
    expect([...types]).toEqual(["paragraph"]);
  });

  it("returns nothing for empty input and tolerates CRLF", () => {
    expect(markdownToDoc("")).toEqual([]);
    expect(markdownToDoc("a\r\n\r\nb")).toHaveLength(2);
  });

  it("closes an unterminated fence at end of input", () => {
    expect(markdownToDoc("```\nabc")[0]).toEqual({ type: "codeBlock", content: [{ type: "text", text: "abc" }] });
  });
});
