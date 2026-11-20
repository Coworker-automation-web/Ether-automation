import { WS_CLOSE } from "@ether/shared";
import type { CollabClosedKind } from "./types";

/** Clients must NOT auto-reconnect on 4401, 4403 or 4410 (shared WS_CLOSE). 4409 reconnects. */
export function classifyClose(code: number): CollabClosedKind | null {
  switch (code) {
    case WS_CLOSE.unauthenticated:
      return "unauthenticated";
    case WS_CLOSE.forbidden:
      return "forbidden";
    case WS_CLOSE.accessRevoked:
      return "revoked";
    default:
      return null;
  }
}

export function shouldReconnectOnClose(code: number): boolean {
  return classifyClose(code) === null;
}

export function isRoleChangeClose(code: number): boolean {
  return code === WS_CLOSE.roleChanged;
}
