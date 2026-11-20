import type { DocMark, DocNode } from "./contracts";

/**
 * Converts AI markdown into editor document nodes. The output only ever contains node and mark
 * types of the editor schema (paragraph, heading, lists, blockquote, codeBlock; bold, italic,
 * code), built as plain objects — no HTML is produced or parsed anywhere on this path.
 */

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}(```|~~~)/;
const INLINE = /(`[^`\n]+`)|(\*\*[^\s*](?:[^*]*[^\s*])?\*\*)|(\*[^\s*](?:[^*]*[^\s*])?\*)/g;

function textNode(text: string, marks: readonly DocMark[]): DocNode[] {
  if (text === "") return [];
  return marks.length === 0 ? [{ type: "text", text }] : [{ type: "text", text, marks }];
}

export function parseInline(text: string, marks: readonly DocMark[] = []): DocNode[] {
  const out: DocNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    out.push(...textNode(text.slice(last, start), marks));
    const [whole, code, bold, italic] = match;
    if (code) {
      // The code mark excludes every other mark in the schema.
      out.push(...textNode(code.slice(1, -1), [{ type: "code" }]));
    } else if (bold) {
      out.push(...parseInline(bold.slice(2, -2), [...marks, { type: "bold" }]));
    } else if (italic) {
      out.push(...parseInline(italic.slice(1, -1), [...marks, { type: "italic" }]));
    }
    last = start + whole.length;
  }
  out.push(...textNode(text.slice(last), marks));
  return out;
}

function paragraph(text: string): DocNode {
  const content = parseInline(text);
  return content.length === 0 ? { type: "paragraph" } : { type: "paragraph", content };
}

function list(type: "bulletList" | "orderedList", items: readonly string[]): DocNode {
  return {
    type,
    content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
  };
}

export function markdownToDoc(markdown: string): DocNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: DocNode[] = [];
  let buffer: string[] = [];

  const flushParagraph = (): void => {
    if (buffer.length > 0) blocks.push(paragraph(buffer.join(" ").trim()));
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (FENCE.test(line)) {
      flushParagraph();
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i] ?? "")) {
        code.push(lines[i] ?? "");
        i++;
      }
      const text = code.join("\n");
      blocks.push(text === "" ? { type: "codeBlock" } : { type: "codeBlock", content: [{ type: "text", text }] });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      // The prototype styles h2/h3 only, so AI headings are clamped into that range.
      const level = (heading[1]?.length ?? 2) <= 2 ? 2 : 3;
      const content = parseInline(heading[2] ?? "");
      blocks.push(content.length === 0 ? { type: "heading", attrs: { level } } : { type: "heading", attrs: { level }, content });
      continue;
    }

    const kind = BULLET.test(line) ? "bulletList" : ORDERED.test(line) ? "orderedList" : null;
    if (kind) {
      flushParagraph();
      const pattern = kind === "bulletList" ? BULLET : ORDERED;
      const items: string[] = [];
      while (i < lines.length) {
        const m = pattern.exec(lines[i] ?? "");
        if (!m) break;
        items.push((m[1] ?? "").trim());
        i++;
      }
      i--;
      blocks.push(list(kind, items));
      continue;
    }

    if (QUOTE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length) {
        const m = QUOTE.exec(lines[i] ?? "");
        if (!m) break;
        quoted.push((m[1] ?? "").trim());
        i++;
      }
      i--;
      blocks.push({ type: "blockquote", content: [paragraph(quoted.join(" ").trim())] });
      continue;
    }

    buffer.push(line.trim());
  }

  flushParagraph();
  return blocks;
}
