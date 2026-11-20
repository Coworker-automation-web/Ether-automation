import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { RuntimeConfig } from "../config";
import type { DocNode } from "../contracts";

export type CollabStatus = "connecting" | "connected" | "disconnected";

/** The socket was closed for good; the client must NOT reconnect (shared WS_CLOSE). */
export type CollabClosedKind = "unauthenticated" | "forbidden" | "revoked";

/** Mock mode only: lets the mock API read and replace the live document like the server room does. */
export interface MockBinding {
  bind(hooks: { getContent(): DocNode; applyContent(doc: DocNode): void }): () => void;
}

export interface CollabConnection {
  readonly doc: Y.Doc;
  /** What TipTap's collaboration caret needs: an object carrying the shared Awareness. */
  readonly provider: { readonly awareness: Awareness };
  status(): CollabStatus;
  onStatus(cb: (status: CollabStatus) => void): () => void;
  /** First full sync with the room (or immediately for the mock). */
  onSynced(cb: () => void): () => void;
  onClosed(cb: (kind: CollabClosedKind) => void): () => void;
  /** Role changed while connected (close 4409): the client reconnects and should refresh its access. */
  onRoleChanged(cb: () => void): () => void;
  destroy(): void;
  readonly mock?: MockBinding;
}

export interface ConnectCollabOptions {
  readonly workspaceId: string;
  readonly config: RuntimeConfig;
}

/** Async so Yjs and the socket provider load only when an editor mounts. */
export type ConnectCollab = (options: ConnectCollabOptions) => Promise<CollabConnection>;
