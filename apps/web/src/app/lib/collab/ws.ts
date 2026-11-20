import { classifyClose, isRoleChangeClose, shouldReconnectOnClose } from "./close";
import type { CollabClosedKind, CollabConnection, CollabStatus, ConnectCollab } from "./types";

type Listener<T> = (value: T) => void;

function emitter<T>(): { add(cb: Listener<T>): () => void; emit(value: T): void } {
  const set = new Set<Listener<T>>();
  return {
    add(cb) {
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    emit(value) {
      set.forEach((cb) => cb(value));
    },
  };
}

/**
 * Production transport: y-websocket against `GET /api/ws/:workspaceId`. The session cookie
 * authenticates the upgrade and the room enforces role; the browser sends Origin itself.
 * Cross-tab BroadcastChannel is off so a tab can never relay edits the room has not accepted.
 *
 * NOTE: the room speaks the standard y-protocols sync/awareness framing (what y-websocket
 * implements). WorkspaceRoom is not built yet — see the hand-off list.
 */
export const connectWebsocketCollab: ConnectCollab = async ({ workspaceId, config }) => {
  const [Y, { WebsocketProvider }] = await Promise.all([import("yjs"), import("y-websocket")]);

  const doc = new Y.Doc();
  const provider = new WebsocketProvider(config.wsBase, encodeURIComponent(workspaceId), doc, {
    disableBc: true,
    shouldReconnect: (event) => shouldReconnectOnClose(event.code),
  });

  const status = emitter<CollabStatus>();
  const synced = emitter<void>();
  const closed = emitter<CollabClosedKind>();
  const roleChanged = emitter<void>();
  let current: CollabStatus = "connecting";

  provider.on("status", ({ status: s }) => {
    current = s;
    status.emit(s);
  });
  provider.on("sync", (isSynced) => {
    if (isSynced) synced.emit();
  });
  provider.on("connection-close", (event) => {
    if (event && isRoleChangeClose(event.code)) roleChanged.emit();
  });
  provider.on("closed", ({ code }) => {
    const kind = classifyClose(code);
    if (kind) closed.emit(kind);
  });

  const connection: CollabConnection = {
    doc,
    provider,
    status: () => current,
    onStatus: status.add,
    onSynced: synced.add,
    onClosed: closed.add,
    onRoleChanged: roleChanged.add,
    destroy() {
      provider.destroy();
      doc.destroy();
    },
  };
  return connection;
};
