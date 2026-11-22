import type { RuntimeConfig } from "../config";
import type { ConnectCollab } from "../collab/types";
import { createHttpApi } from "./http";
import type { EtherApi } from "./types";

export type { EtherApi } from "./types";
export { createHttpApi } from "./http";

let sharedMockFetch: Promise<typeof fetch> | undefined;

/** One in-memory "server" per page. It loads on first use, so it never weighs on the app shell. */
const lazyMockFetch: typeof fetch = async (input, init) => {
  sharedMockFetch ??= import("../mock").then((m) => m.createMockFetch());
  return (await sharedMockFetch)(input, init);
};

export function createApi(config: RuntimeConfig): EtherApi {
  return config.mock ? createHttpApi({ baseUrl: "", fetchImpl: lazyMockFetch }) : createHttpApi({ baseUrl: config.apiBase });
}

export function pickCollab(config: RuntimeConfig): ConnectCollab {
  return config.mock
    ? async (o) => (await import("../fake/collab")).connectMockCollab(o)
    : async (o) => (await import("../collab/ws")).connectWebsocketCollab(o);
}
