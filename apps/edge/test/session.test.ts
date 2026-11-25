import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sha256Hex } from "../src/lib/crypto";
import { sessions } from "../src/db/schema";
import {
  SESSION_COOKIE,
  SESSION_REFRESH_AFTER_SECONDS,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  createSession,
  lookupSession,
  purgeExpiredSessions,
  readSessionToken,
  revokeAllSessions,
  revokeSession,
  sessionCookie,
} from "../src/lib/session";
import { createTestDb, seedUser, type TestDb } from "./helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.dispose();
});

const T0 = 1_800_000_000;

async function expiryOf(token: string) {
  const row = await t.db.select().from(sessions).where(eq(sessions.tokenHash, await sha256Hex(token))).get();
  return row?.expiresAt;
}

describe("session storage", () => {
  it("stores only the SHA-256 of a 256-bit token", async () => {
    const u = await seedUser(t.db);
    const { token, expiresAt } = await createSession(t.db, u, T0);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
    expect(expiresAt).toBe(T0 + SESSION_TTL_SECONDS);
    const all = await t.d1.prepare("SELECT * FROM sessions WHERE user_id = ?").bind(u).all();
    expect(JSON.stringify(all.results)).not.toContain(token);
    expect(all.results[0]).toMatchObject({ token_hash: await sha256Hex(token) });
  });

  it("issues unique tokens", async () => {
    const u = await seedUser(t.db);
    const a = await createSession(t.db, u, T0);
    const b = await createSession(t.db, u, T0);
    expect(a.token).not.toBe(b.token);
  });
});

describe("lookup, expiry and revocation", () => {
  it("finds a live session and rejects unknown tokens", async () => {
    const u = await seedUser(t.db);
    const { token } = await createSession(t.db, u, T0);
    expect(await lookupSession(t.db, token, T0 + 5)).toMatchObject({ userId: u, refreshed: false });
    expect(await lookupSession(t.db, "A".repeat(43), T0)).toBeNull();
  });

  it("rejects an expired session, exactly at and after expiry", async () => {
    const u = await seedUser(t.db);
    // Separate sessions: a successful lookup near expiry would itself extend the session.
    const last = await createSession(t.db, u, T0);
    expect(await lookupSession(t.db, last.token, last.expiresAt - 1)).not.toBeNull();
    const at = await createSession(t.db, u, T0);
    expect(await lookupSession(t.db, at.token, at.expiresAt)).toBeNull();
    const after = await createSession(t.db, u, T0);
    expect(await lookupSession(t.db, after.token, after.expiresAt + 1000)).toBeNull();
  });

  it("revokeSession kills only that session", async () => {
    const u = await seedUser(t.db);
    const a = await createSession(t.db, u, T0);
    const b = await createSession(t.db, u, T0);
    await revokeSession(t.db, a.token);
    expect(await lookupSession(t.db, a.token, T0 + 1)).toBeNull();
    expect(await lookupSession(t.db, b.token, T0 + 1)).not.toBeNull();
  });

  it("revokeAllSessions kills every session of that user and nobody else's", async () => {
    const u = await seedUser(t.db);
    const other = await seedUser(t.db);
    const a = await createSession(t.db, u, T0);
    const b = await createSession(t.db, u, T0);
    const o = await createSession(t.db, other, T0);
    await revokeAllSessions(t.db, u);
    expect(await lookupSession(t.db, a.token, T0 + 1)).toBeNull();
    expect(await lookupSession(t.db, b.token, T0 + 1)).toBeNull();
    expect(await lookupSession(t.db, o.token, T0 + 1)).not.toBeNull();
  });

  it("purgeExpiredSessions removes only expired rows", async () => {
    const u = await seedUser(t.db);
    const old = await createSession(t.db, u, T0);
    const fresh = await createSession(t.db, u, T0 + SESSION_TTL_SECONDS);
    await purgeExpiredSessions(t.db, T0 + SESSION_TTL_SECONDS + 1);
    expect(await expiryOf(old.token)).toBeUndefined();
    expect(await expiryOf(fresh.token)).toBeDefined();
  });
});

describe("sliding expiry is throttled", () => {
  it("does not write inside the refresh window", async () => {
    const u = await seedUser(t.db);
    const { token, expiresAt } = await createSession(t.db, u, T0);
    const r = await lookupSession(t.db, token, T0 + SESSION_REFRESH_AFTER_SECONDS - 1);
    expect(r).toMatchObject({ refreshed: false, expiresAt });
    expect(await expiryOf(token)).toBe(expiresAt);
  });

  it("extends once the window has passed, then goes quiet again for another window", async () => {
    const u = await seedUser(t.db);
    const { token } = await createSession(t.db, u, T0);

    const t1 = T0 + SESSION_REFRESH_AFTER_SECONDS;
    const r1 = await lookupSession(t.db, token, t1);
    expect(r1).toMatchObject({ refreshed: true, expiresAt: t1 + SESSION_TTL_SECONDS });
    expect(await expiryOf(token)).toBe(t1 + SESSION_TTL_SECONDS);

    const r2 = await lookupSession(t.db, token, t1 + 300);
    expect(r2).toMatchObject({ refreshed: false, expiresAt: t1 + SESSION_TTL_SECONDS });

    const t3 = t1 + SESSION_REFRESH_AFTER_SECONDS + 1;
    const r3 = await lookupSession(t.db, token, t3);
    expect(r3?.refreshed).toBe(true);
    expect(r3?.expiresAt).toBe(t3 + SESSION_TTL_SECONDS);
  });

  it("an active user stays signed in past the original 30 days", async () => {
    const u = await seedUser(t.db);
    const { token } = await createSession(t.db, u, T0);
    let now = T0;
    for (let day = 0; day < 40; day++) {
      now += 24 * 60 * 60;
      expect(await lookupSession(t.db, token, now)).not.toBeNull();
    }
  });
});

describe("cookie helpers", () => {
  it("uses a __Host- cookie with the required attributes", () => {
    const c = sessionCookie("tok");
    expect(c.startsWith("__Host-ether_session=tok;")).toBe(true);
    for (const attr of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax", `Max-Age=${SESSION_TTL_SECONDS}`]) expect(c).toContain(attr);
    expect(c).not.toContain("Domain"); // __Host- forbids Domain
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("reads the token out of a Cookie header", () => {
    expect(readSessionToken(`a=1; ${SESSION_COOKIE}=abc123; b=2`)).toBe("abc123");
    expect(readSessionToken(`${SESSION_COOKIE}=`)).toBeNull();
    expect(readSessionToken("other=1")).toBeNull();
    expect(readSessionToken(null)).toBeNull();
    expect(readSessionToken(`x${SESSION_COOKIE}=nope`)).toBeNull();
  });
});
