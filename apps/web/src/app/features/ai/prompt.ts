import { MAX_PROMPT_CHARS } from "@ether/shared";
import type { DocNode } from "../../lib/contracts";

export type PromptSource = "selection" | "document";

export type PromptResult =
  | { readonly ok: true; readonly prompt: string; readonly source: PromptSource; readonly truncated: boolean }
  | { readonly ok: false; readonly reason: "empty" };

/**
 * The workspace has no separate prompt box (prototype), so the prompt is what the user is working
 * on: the selection if there is one, otherwise the whole document. Over-long input is trimmed to
 * the contract limit: a selection keeps its start, a document keeps its end (where people type).
 */
export function composePrompt(input: { selection: string; document: string }): PromptResult {
  const selection = input.selection.trim();
  const source: PromptSource = selection === "" ? "document" : "selection";
  const text = source === "selection" ? selection : input.document.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (text.length <= MAX_PROMPT_CHARS) return { ok: true, prompt: text, source, truncated: false };
  const clipped = source === "selection" ? text.slice(0, MAX_PROMPT_CHARS) : text.slice(-MAX_PROMPT_CHARS);
  return { ok: true, prompt: clipped.trim(), source, truncated: true };
}

/** Plain text of a document, blocks separated by blank lines. Used by the mock room and tests. */
export function docToPlainText(doc: DocNode): string {
  const blocks: string[] = [];
  const walk = (node: DocNode): string => {
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(walk).join("");
  };
  for (const child of doc.content ?? []) {
    const text = walk(child).trim();
    if (text !== "") blocks.push(text);
  }
  return blocks.join("\n\n");
}
