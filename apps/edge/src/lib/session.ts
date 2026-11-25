import { eq, lt } from "drizzle-orm";
import type { Db } from "../db";
import { sessions } from "../db/schema";
import { randomSecret, sha256Hex } from "./crypto";
import { nowSeconds } from "./time";

export const SESSION_COOKIE = "__Host-ether_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Expiry is extended at most this often; requests in between do no D1 write. */
export const SESSION_REFRESH_AFTER_SECONDS = 10 * 60;

export interface SessionInfo {
  userId: string;
  expiresAt: number;
  /** True when this lookup extended the expiry (the caller should re-issue the cookie). */
  refreshed: boolean;
}

/** 256-bit random token. Only its SHA-256 is stored, so a database leak does not yield sessions. */
export async function createSession(db: Db, userId: string, now = nowSeconds()) {
  const token = randomSecret(32);
  const expiresAt = now + SESSION_TTL_SECONDS;
  await db.insert(sessions).values({ tokenHash: await sha256Hex(token), userId, expiresAt, createdAt: now });
  return { token, expiresAt };
}

export async function lookupSession(db: Db, token: string, now = nowSeconds()): Promise<SessionInfo | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).get();
  if (!row || row.expiresAt <= now) return null;

  // expiresAt = lastExtension + TTL, so the time since the last extension needs no extra column.
  const sinceExtension = now - (row.expiresAt - SESSION_TTL_SECONDS);
  if (sinceExtension < SESSION_REFRESH_AFTER_SECONDS) {
    return { userId: row.userId, expiresAt: row.expiresAt, refreshed: false };
  }
  const expiresAt = now + SESSION_TTL_SECONDS;
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.tokenHash, tokenHash));
  return { userId: row.userId, expiresAt, refreshed: true };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, await sha256Hex(token)));
}

/** Sign out everywhere (password-less accounts: used on suspected compromise). */
export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** For a scheduled cleanup. Expired rows are already rejected by lookupSession. */
export async function purgeExpiredSessions(db: Db, now = nowSeconds()): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}

// ---- Cookie helpers. The __Host- prefix forces Secure, Path=/ and no Domain. ----

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = part.slice(eq + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
