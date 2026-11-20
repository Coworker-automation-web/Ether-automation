import { useEffect, useRef, useState } from "react";
import { pickCollab } from "../../../lib/api";
import type { CollabClosedKind, CollabConnection, CollabStatus } from "../../../lib/collab/types";
import { useRuntimeConfig } from "../../../lib/runtime";

export interface CollabState {
  readonly connection: CollabConnection | null;
  readonly status: CollabStatus;
  readonly synced: boolean;
  /** Set when the room closed for good (do not reconnect). */
  readonly closed: CollabClosedKind | null;
  /** The transport could not even be created. */
  readonly failed: boolean;
}

const INITIAL: CollabState = { connection: null, status: "connecting", synced: false, closed: null, failed: false };

/**
 * Owns one collaboration connection per workspace, created lazily (Yjs and the socket provider
 * load here, not in the app shell) and destroyed on unmount or workspace change.
 */
export function useCollab(workspaceId: string, enabled: boolean, onRoleChanged: () => void): CollabState {
  const config = useRuntimeConfig();
  const [state, setState] = useState<CollabState>(INITIAL);
  const roleChangedRef = useRef(onRoleChanged);
  roleChangedRef.current = onRoleChanged;

  useEffect(() => {
    setState(INITIAL);
    if (!enabled) return;

    let cancelled = false;
    let connection: CollabConnection | null = null;
    const unsubscribe: (() => void)[] = [];

    pickCollab(config)({ workspaceId, config })
      .then((conn) => {
        if (cancelled) {
          conn.destroy();
          return;
        }
        connection = conn;
        unsubscribe.push(
          conn.onStatus((status) => setState((s) => ({ ...s, status }))),
          conn.onSynced(() => setState((s) => ({ ...s, synced: true }))),
          conn.onClosed((closed) => setState((s) => ({ ...s, closed }))),
          conn.onRoleChanged(() => roleChangedRef.current()),
        );
        setState((s) => ({ ...s, connection: conn, status: conn.status() }));
      })
      .catch(() => {
        if (!cancelled) setState({ ...INITIAL, failed: true, status: "disconnected" });
      });

    return () => {
      cancelled = true;
      unsubscribe.forEach((off) => off());
      connection?.destroy();
    };
  }, [workspaceId, enabled, config]);

  return state;
}
