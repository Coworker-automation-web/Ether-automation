import { z } from "zod";
import { apiErrorSchema } from "./errors";
import { type Role, roleAtLeast } from "./roles";

// ---------- Yjs document shape (one Y.Doc per workspace) ----------
export const YJS = {
  /** Y.XmlFragment holding the TipTap document (phases 0-3: the only content). */
  TEXT_FRAGMENT: "content",
  /** Y.Map of canvas objects (sticky notes, shapes, frames). Reserved for phase 4; do not use yet. */
  CANVAS_MAP: "canvas",
} as const;

// ---------- WebSocket: browser -> Worker -> WorkspaceRoom ----------
export const wsPath = (workspaceId: string): string => `/api/ws/${encodeURIComponent(workspaceId)}`;

/**
 * Headers the Worker sets when forwarding an upgraded socket to the room. The Worker MUST delete
 * any client-supplied headers with these names first: the room trusts them completely.
 */
export const ROOM_HEADERS = {
  userId: "x-ether-user-id",
  role: "x-ether-role",
  workspaceId: "x-ether-workspace-id",
} as const;

/** Org role, or "owner" for the owner of a personal workspace (who has no org role). */
export type RoomRole = Role | "owner";
export const roomRoleSchema = z.enum(["admin", "executive", "member", "viewer", "owner"]);

/** Viewers receive updates and send presence; the room drops their document updates. */
export function canWriteRoom(role: RoomRole): boolean {
  return role === "owner" || roleAtLeast(role, "member");
}

/** WebSocket close codes. Clients must NOT auto-reconnect on 4401, 4403 or 4410. */
export const WS_CLOSE = {
  unauthenticated: 4401,
  forbidden: 4403,
  /** Membership removed while connected. */
  accessRevoked: 4410,
  /** Role changed while connected: reconnect to pick up the new access level. */
  roleChanged: 4409,
} as const;

// ---------- SSE: POST /api/ai/generate ----------
export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
} as const;

export const SSE_EVENT = { text: "text", done: "done", error: "error" } as const;

export const sseTextDataSchema = z.object({ text: z.string() });
export const sseDoneDataSchema = z.object({
  /** Named route that served the request (e.g. "default"), never a raw model id. */
  route: z.string().optional(),
  usage: z.object({ tokensIn: z.number().int().nonnegative(), tokensOut: z.number().int().nonnegative() }).optional(),
});
/** Same shape as a non-2xx JSON body, so one error handler serves both. */
export const sseErrorDataSchema = apiErrorSchema;

export type SseEvent =
  | { event: "text"; data: z.infer<typeof sseTextDataSchema> }
  | { event: "done"; data: z.infer<typeof sseDoneDataSchema> }
  | { event: "error"; data: z.infer<typeof sseErrorDataSchema> };

/**
 * Stream grammar: zero or more `text` events, then exactly one terminal `done` or `error`.
 * JSON.stringify never emits a raw newline, so each event is a single `data:` line.
 */
export function formatSseEvent(e: SseEvent): string {
  return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}
