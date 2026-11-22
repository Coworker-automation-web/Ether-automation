import type { DocNode } from "../contracts";

/**
 * In mock mode there is no WorkspaceRoom. The mounted editor registers itself here so the mock API
 * can read the live document (for the pre-restore snapshot) and replace it (for a restore), which
 * is exactly what the server-side room does in production.
 */
export interface MockRoomHooks {
  getContent(): DocNode;
  applyContent(doc: DocNode): void;
}

const rooms = new Map<string, MockRoomHooks>();

export function registerMockRoom(workspaceId: string, hooks: MockRoomHooks): () => void {
  rooms.set(workspaceId, hooks);
  return () => {
    if (rooms.get(workspaceId) === hooks) rooms.delete(workspaceId);
  };
}

export function getMockRoom(workspaceId: string): MockRoomHooks | undefined {
  return rooms.get(workspaceId);
}
