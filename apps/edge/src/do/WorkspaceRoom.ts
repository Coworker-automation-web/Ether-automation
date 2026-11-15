import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

/** One live room per workspace. Phase 3 adds Yjs sync, role checks and snapshot persistence. */
export class WorkspaceRoom extends DurableObject<Env> {
  override async fetch(_request: Request): Promise<Response> {
    return new Response("WorkspaceRoom not implemented", { status: 501 });
  }
}
