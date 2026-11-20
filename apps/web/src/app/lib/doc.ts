import type { JSONContent } from "@tiptap/react";
import type { DocNode } from "./contracts";

const EMPTY: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

/** Editor JSON -> our contract type. Anything that is not a node object becomes an empty document. */
export function toDocNode(value: unknown): DocNode {
  if (typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string") {
    return value as DocNode;
  }
  return EMPTY;
}

/** Our contract type -> editor JSON. The shapes are identical; only readonly-ness differs. */
export function toJsonContent(doc: DocNode): JSONContent {
  return doc as unknown as JSONContent;
}
