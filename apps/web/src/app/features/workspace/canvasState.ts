import type { CollabState } from "./editor/useCollab";

export interface CanvasMessage {
  readonly text: string;
  /** True when the editor must not be shown (closed room or failed transport). */
  readonly blocksEditor: boolean;
}

/** What the empty canvas says, given the connection state. Designed copy for every non-ready state. */
export function canvasMessage(state: Pick<CollabState, "closed" | "failed" | "synced" | "connection">, placeholder: string): CanvasMessage {
  if (state.closed === "unauthenticated") {
    return { text: "Your session has ended. Sign in again to keep editing.", blocksEditor: true };
  }
  if (state.closed === "forbidden") {
    return { text: "You don't have access to this workspace.", blocksEditor: true };
  }
  if (state.closed === "revoked") {
    return { text: "Your access to this workspace changed. Reload to continue.", blocksEditor: true };
  }
  if (state.failed) {
    return { text: "Couldn't start the editor. Reload to try again.", blocksEditor: true };
  }
  if (state.connection === null || !state.synced) {
    return { text: "Connecting…", blocksEditor: false };
  }
  return { text: placeholder, blocksEditor: false };
}
