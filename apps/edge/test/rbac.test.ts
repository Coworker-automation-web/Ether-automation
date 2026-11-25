import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { memberships, sessions } from "../src/db/schema";
import type { Env } from "../src/env";
import { requireOrgRole, requireSession, requireWorkspaceAccess, type AppEnv } from "../src/lib/rbac";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSession, revokeSession } from "../src/lib/session";
import { nowSeconds } from "../src/lib/time";
import { sha256Hex } from "../src/lib/crypto";
import { createTestDb, seedMember, seedOrg, seedPersonal, seedUser, type TestDb } from "./helpers/db";

let t: TestDb;
let app: Hono<AppEnv>;

beforeAll(async () => {
  t = await createTestDb();
  app = new Hono<AppEnv>();
  app.use("/api/*", requireSession);
  app.get("/api/me", (c) => c.json({ userId: c.get("userId") }));
  app.get("/api/orgs/:orgId/members", requireOrgRole("members.list"), (c) => c.json({ role: c.get("role"), orgId: c.get("orgId") }));
  app.post("/api/orgs/:orgId/keys", requireOrgRole("key.mint"), (c) => c.json({ ok: true }));
  app.post("/api/orgs/:orgId/ai-keys", requireOrgRole("aikey.manage"), (c) => c.json({ ok: true }));
  app.get("/api/workspaces/:workspaceId/history", requireWorkspaceAccess("history.list"), (c) => c.json({ roomRole: c.get("roomRole"), ws: c.get("workspace") }));
  app.post("/api/workspaces/:workspaceId/restore", requireWorkspaceAccess("restore"), (c) => c.json({ ok: true }));
  app.post("/api/ai/run", requireWorkspaceAccess("ai.run", { source: "body" }), async (c) => c.json({ ok: true, roomRole: c.get("roomRole") }));
  // Misordered on purpose: no requireSession in front of it.
  app.get("/unsafe/orgs/:orgId/members", requireOrgRole("members.list"), (c) => c.json({ ok: true }));
  app.get("/unsafe/workspaces/:workspaceId", requireWorkspaceAccess("history.list"), (c) => c.json({ ok: true }));
});
afterAll(async () => {
  await t.dispose();
});

const env = () => ({ DB: t.d1 }) as unknown as Env;

async function login(userId: string) {
  const { token } = await createSession(t.db, userId, nowSeconds());
  return { token, cookie: `${SESSION_COOKIE}=${token}` };
}

async function call(path: string, cookie?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");
  const res = await app.request(path, { ...init, headers }, env());
  return { res, body: (await res.json()) as Record<string, any> };
}

async function world() {
  const adminId = await seedUser(t.db);
  const { orgId, publicWorkspaceId } = await seedOrg(t.db, adminId);
  const exec = await seedUser(t.db);
  const member = await seedUser(t.db);
  const viewer = await seedUser(t.db);
  await seedMember(t.db, orgId, exec, "executive");
  await seedMember(t.db, orgId, member, "member");
  await seedMember(t.db, orgId, viewer, "viewer");
  return { adminId, orgId, publicWorkspaceId, exec, member, viewer };
}

describe("requireSession", () => {
  it("401s with a typed error when there is no cookie", async () => {
    const { res, body } = await call("/api/me");
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: { code: "unauthenticated", message: expect.any(String) } });
  });

  it("401s and clears the cookie for an unknown token", async () => {
    const { res } = await call("/api/me", `${SESSION_COOKIE}=${"A".repeat(43)}`);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("accepts a valid session", async () => {
    const u = await seedUser(t.db);
    const { cookie } = await login(u);
    const { res, body } = await call("/api/me", cookie);
    expect(res.status).toBe(200);
    expect(body.userId).toBe(u);
    expect(res.headers.get("set-cookie")).toBeNull(); // fresh session: no refresh, no cookie churn
  });

  it("rejects an expired session", async () => {
    const u = await seedUser(t.db);
    const token = "expired-token-for-test";
    await t.db.insert(sessions).values({ tokenHash: await sha256Hex(token), userId: u, expiresAt: nowSeconds() - 1 });
    expect((await call("/api/me", `${SESSION_COOKIE}=${token}`)).res.status).toBe(401);
  });

  it("rejects a revoked session on the very next request", async () => {
    const u = await seedUser(t.db);
    const { token, cookie } = await login(u);
    expect((await call("/api/me", cookie)).res.status).toBe(200);
    await revokeSession(t.db, token);
    expect((await call("/api/me", cookie)).res.status).toBe(401);
  });

  it("re-issues the cookie when the session is extended", async () => {
    const u = await seedUser(t.db);
    const token = "stale-token-for-test";
    // Last extended 11 minutes ago.
    const expiresAt = nowSeconds() + SESSION_TTL_SECONDS - 11 * 60;
    await t.db.insert(sessions).values({ tokenHash: await sha256Hex(token), userId: u, expiresAt });
    const { res } = await call("/api/me", `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=${token}`);
  });
});

describe("requireOrgRole", () => {
  it("enforces the role table for each org role", async () => {
    const w = await world();
    const cases: Array<[string, string, number]> = [
      [w.adminId, "members.list", 200],
      [w.exec, "members.list", 200],
      [w.member, "members.list", 200],
      [w.viewer, "members.list", 200],
    ];
    for (const [uid, , status] of cases) {
      const { cookie } = await login(uid);
      expect((await call(`/api/orgs/${w.orgId}/members`, cookie)).res.status).toBe(status);
    }
    const mint = async (uid: string) => (await call(`/api/orgs/${w.orgId}/keys`, (await login(uid)).cookie, { method: "POST" })).res.status;
    expect(await mint(w.adminId)).toBe(200);
    expect(await mint(w.exec)).toBe(403); // key.mint is admin-only in the shared table
    expect(await mint(w.member)).toBe(403);
    expect(await mint(w.viewer)).toBe(403);
  });

  it("exposes the membership role from the database, not the request", async () => {
    const w = await world();
    const { body } = await call(`/api/orgs/${w.orgId}/members`, (await login(w.member)).cookie);
    expect(body).toEqual({ role: "member", orgId: w.orgId });
  });

  it("AI-key management needs the admin or a delegated executive", async () => {
    const w = await world();
    const delegated = await seedUser(t.db);
    await seedMember(t.db, w.orgId, delegated, "executive", { aiKeyDelegated: true });
    const status = async (uid: string) => (await call(`/api/orgs/${w.orgId}/ai-keys`, (await login(uid)).cookie, { method: "POST" })).res.status;
    expect(await status(w.adminId)).toBe(200);
    expect(await status(delegated)).toBe(200);
    expect(await status(w.exec)).toBe(403);
    expect(await status(w.member)).toBe(403);
  });

  it("removing a member denies their very next request", async () => {
    const w = await world();
    const { cookie } = await login(w.member);
    expect((await call(`/api/orgs/${w.orgId}/members`, cookie)).res.status).toBe(200);
    await t.db.update(memberships).set({ status: "removed" }).where(and(eq(memberships.orgId, w.orgId), eq(memberships.userId, w.member)));
    const after = await call(`/api/orgs/${w.orgId}/members`, cookie);
    expect(after.res.status).toBe(404);
    expect(after.body.error.code).toBe("not_found");
  });

  it("a role change takes effect on the next request", async () => {
    const w = await world();
    const { cookie } = await login(w.member);
    const restore = () => call(`/api/workspaces/${w.publicWorkspaceId}/restore`, cookie, { method: "POST" });
    expect((await restore()).res.status).toBe(200);
    await t.db.update(memberships).set({ role: "viewer" }).where(and(eq(memberships.orgId, w.orgId), eq(memberships.userId, w.member)));
    expect((await restore()).res.status).toBe(403);
  });

  it("denies a signed-in user who belongs to a different org (404, same as a missing org)", async () => {
    const a = await world();
    const b = await world();
    const { cookie } = await login(b.adminId);
    const foreign = await call(`/api/orgs/${a.orgId}/members`, cookie);
    const missing = await call(`/api/orgs/NOPE/members`, cookie);
    expect(foreign.res.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect((await call(`/api/orgs/${a.orgId}/keys`, cookie, { method: "POST" })).res.status).toBe(404);
  });

  it("fails closed when requireSession is missing", async () => {
    const w = await world();
    const { res } = await call(`/unsafe/orgs/${w.orgId}/members`, (await login(w.adminId)).cookie);
    expect(res.status).toBe(401);
  });
});

describe("requireWorkspaceAccess", () => {
  it("lets every org role read history on the org workspace; restore needs edit access (not viewers)", async () => {
    const w = await world();
    const hist = async (uid: string) => (await call(`/api/workspaces/${w.publicWorkspaceId}/history`, (await login(uid)).cookie)).res.status;
    for (const uid of [w.adminId, w.exec, w.member, w.viewer]) expect(await hist(uid)).toBe(200);
    const restore = async (uid: string) => (await call(`/api/workspaces/${w.publicWorkspaceId}/restore`, (await login(uid)).cookie, { method: "POST" })).res.status;
    expect(await restore(w.adminId)).toBe(200);
    expect(await restore(w.exec)).toBe(200);
    expect(await restore(w.member)).toBe(200);
    expect(await restore(w.viewer)).toBe(403);
  });

  it("denies cross-org access to a workspace", async () => {
    const a = await world();
    const b = await world();
    const { cookie } = await login(b.adminId);
    const { res, body } = await call(`/api/workspaces/${a.publicWorkspaceId}/history`, cookie);
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect((await call(`/api/workspaces/${a.publicWorkspaceId}/restore`, cookie, { method: "POST" })).res.status).toBe(404);
  });

  it("returns the same 404 for an unknown workspace id as for a foreign one", async () => {
    const a = await world();
    const b = await world();
    const { cookie } = await login(b.adminId);
    const foreign = await call(`/api/workspaces/${a.publicWorkspaceId}/history`, cookie);
    const missing = await call(`/api/workspaces/01NOSUCHWORKSPACE0000000000/history`, cookie);
    expect(missing.res.status).toBe(404);
    expect(missing.body).toEqual(foreign.body);
  });

  it("removed members lose workspace access immediately", async () => {
    const w = await world();
    const { cookie } = await login(w.viewer);
    expect((await call(`/api/workspaces/${w.publicWorkspaceId}/history`, cookie)).res.status).toBe(200);
    await t.db.update(memberships).set({ status: "removed" }).where(and(eq(memberships.orgId, w.orgId), eq(memberships.userId, w.viewer)));
    expect((await call(`/api/workspaces/${w.publicWorkspaceId}/history`, cookie)).res.status).toBe(404);
  });

  it("a personal workspace is owner-only: org admins and other users get 404", async () => {
    const w = await world();
    const personal = await seedPersonal(t.db, w.member);
    const own = await call(`/api/workspaces/${personal}/history`, (await login(w.member)).cookie);
    expect(own.res.status).toBe(200);
    expect(own.body.roomRole).toBe("owner");
    expect((await call(`/api/workspaces/${personal}/history`, (await login(w.adminId)).cookie)).res.status).toBe(404);
    expect((await call(`/api/workspaces/${personal}/history`, (await login(await seedUser(t.db))).cookie)).res.status).toBe(404);
  });

  it("source=body: the id is only a lookup key, access still comes from membership", async () => {
    const a = await world();
    const b = await world();
    const post = (uid: string, workspaceId: unknown) =>
      login(uid).then(({ cookie }) => call("/api/ai/run", cookie, { method: "POST", body: JSON.stringify({ workspaceId }) }));
    expect((await post(a.member, a.publicWorkspaceId)).res.status).toBe(200);
    expect((await post(a.viewer, a.publicWorkspaceId)).res.status).toBe(403); // viewers cannot run AI
    expect((await post(b.adminId, a.publicWorkspaceId)).res.status).toBe(404); // other org's admin
    expect((await post(a.member, undefined)).res.status).toBe(400);
    expect((await post(a.member, 42)).res.status).toBe(400);
    expect((await post(a.member, "x".repeat(65))).res.status).toBe(400);
  });

  it("source=body with a malformed JSON body is a validation error, not a crash", async () => {
    const u = await seedUser(t.db);
    const { cookie } = await login(u);
    const { res } = await call("/api/ai/run", cookie, { method: "POST", body: "{not json" });
    expect(res.status).toBe(400);
  });

  it("fails closed when requireSession is missing", async () => {
    const w = await world();
    const { res } = await call(`/unsafe/workspaces/${w.publicWorkspaceId}`, (await login(w.adminId)).cookie);
    expect(res.status).toBe(401);
  });
});
