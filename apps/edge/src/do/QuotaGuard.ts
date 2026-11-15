import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

/** Per-user / per-org AI quota counters. Phase 5. */
export class QuotaGuard extends DurableObject<Env> {
  override async fetch(_request: Request): Promise<Response> {
    return new Response("QuotaGuard not implemented", { status: 501 });
  }
}
