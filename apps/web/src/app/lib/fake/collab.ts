import type { DocNode } from "../contracts";
import type { CollabConnection, CollabStatus, ConnectCollab } from "../collab/types";
import { registerMockRoom } from "./rooms";

/** Mock transport: a local Y.Doc and awareness, no network. The mock room hooks make restore work. */
export const connectMockCollab: ConnectCollab = async ({ workspaceId }) => {
  const [Y, { Awareness }] = await Promise.all([import("yjs"), import("y-protocols/awareness")]);
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const syncedListeners = new Set<() => void>();
  const status: CollabStatus = "connected";
  const unregister: (() => void)[] = [];

  const connection: CollabConnection = {
    doc,
    provider: { awareness },
    status: () => status,
    onStatus: (cb) => {
      cb(status);
      return () => undefined;
    },
    onSynced: (cb) => {
      syncedListeners.add(cb);
      queueMicrotask(() => {
        if (syncedListeners.has(cb)) cb();
      });
      return () => {
        syncedListeners.delete(cb);
      };
    },
    onClosed: () => () => undefined,
    onRoleChanged: () => () => undefined,
    destroy() {
      unregister.splice(0).forEach((fn) => fn());
      awareness.destroy();
      doc.destroy();
    },
    mock: {
      bind(hooks: { getContent(): DocNode; applyContent(doc: DocNode): void }) {
        const off = registerMockRoom(workspaceId, hooks);
        unregister.push(off);
        return off;
      },
    },
  };
  return connection;
};
