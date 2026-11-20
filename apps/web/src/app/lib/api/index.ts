import type { RuntimeConfig } from "../config";
import type { ConnectCollab } from "../collab/types";
import { createHttpApi } from "./http";
import type { EtherApi } from "./types";

export type { EtherApi } from "./types";
export { createHttpApi } from "./http";

/** The mock loads on first use, so it never weighs on the app shell. */
export function createLazyMockApi(): EtherApi {
  const load = (): Promise<EtherApi> => import("../mock/api").then((m) => m.createMockApi());
  let instance: Promise<EtherApi> | undefined;
  const get = (): Promise<EtherApi> => (instance ??= load());

  return {
    listSnapshots: async (...a) => (await get()).listSnapshots(...a),
    restoreSnapshot: async (...a) => (await get()).restoreSnapshot(...a),
    summarizeSnapshot: async (...a) => (await get()).summarizeSnapshot(...a),
    generate: (input, signal) => ({
      async *[Symbol.asyncIterator]() {
        yield* (await get()).generate(input, signal);
      },
    }),
    getAiUsage: async (...a) => (await get()).getAiUsage(...a),
    listAiKeys: async (...a) => (await get()).listAiKeys(...a),
    putAiKey: async (...a) => (await get()).putAiKey(...a),
    testAiKey: async (...a) => (await get()).testAiKey(...a),
    uploadToPublicWorkspace: async (...a) => (await get()).uploadToPublicWorkspace(...a),
  };
}

export function createApi(config: RuntimeConfig): EtherApi {
  return config.mock ? createLazyMockApi() : createHttpApi({ baseUrl: config.apiBase });
}

export function pickCollab(config: RuntimeConfig): ConnectCollab {
  return config.mock
    ? async (o) => (await import("../mock/collab")).connectMockCollab(o)
    : async (o) => (await import("./../collab/ws")).connectWebsocketCollab(o);
}
