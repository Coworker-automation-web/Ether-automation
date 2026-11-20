import { mergeAttributes, Node } from "@tiptap/react";
import { attributionLabel, attributionName } from "../../ai/attribution";
import styles from "./editor.module.css";

/**
 * A block holding AI output. It is a wrapper node, so AI text always lands as its own block with a
 * visible "AI, requested by <name>" label and never merges into the user's paragraphs.
 *
 * - The label is CSS generated content from a data attribute (text only; nothing is parsed as HTML).
 * - parseHTML is empty on purpose: pasted or dropped HTML can never create an AI block, so the
 *   attribution cannot be forged through the clipboard.
 */
export const AiBlock = Node.create({
  name: "aiBlock",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      requestedBy: { default: "", rendered: false },
    };
  },

  parseHTML() {
    return [];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = attributionName(String(node.attrs["requestedBy"] ?? ""));
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: styles["aiBlock"],
        role: "group",
        "aria-label": attributionLabel(name),
        "data-requested-by": name,
      }),
      0,
    ];
  },
});
