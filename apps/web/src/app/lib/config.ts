import { wsPath } from "@ether/shared";

export interface RuntimeConfig {
  readonly mock: boolean;
  /** Prefix for REST calls. Empty means same origin (dev proxy / production routing). */
  readonly apiBase: string;
  /** Base URL for the collaboration socket; the room name is appended as `/${encodeURIComponent(id)}`. */
  readonly wsBase: string;
}

export interface EnvLike {
  readonly PUBLIC_API_MOCK?: string | undefined;
}

export interface LocationLike {
  readonly protocol: string;
  readonly host: string;
}

export function isMockEnabled(env: EnvLike): boolean {
  return env.PUBLIC_API_MOCK === "1";
}

/** Derived from shared `wsPath` so the client cannot drift from the server route. */
export function wsBaseFor(loc: LocationLike): string {
  const scheme = loc.protocol === "https:" ? "wss:" : "ws:";
  const base = wsPath("").replace(/\/$/, "");
  return `${scheme}//${loc.host}${base}`;
}

export function readConfig(env: EnvLike, loc: LocationLike): RuntimeConfig {
  return { mock: isMockEnabled(env), apiBase: "", wsBase: wsBaseFor(loc) };
}

/** Browser entry point. Safe to call only on the client. */
export function browserConfig(): RuntimeConfig {
  return readConfig(import.meta.env, window.location);
}
