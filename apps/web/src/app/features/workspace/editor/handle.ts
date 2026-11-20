import type { DocNode } from "../../../lib/contracts";

/** What the rest of the workspace may do to the editor, without importing TipTap. */
export interface EditorHandle {
  getSelectionText(): string;
  getDocumentText(): string;
  /** Adds AI output as a new attributed block after the block holding the cursor. False if it could not be inserted. */
  insertAiBlock(blocks: readonly DocNode[], requestedBy: string): boolean;
  focus(): void;
}

export interface EditorViewState {
  readonly empty: boolean;
  readonly focused: boolean;
}
