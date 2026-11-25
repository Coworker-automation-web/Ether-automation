import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_BLOB_BYTES } from "../src/lib/limits";
import * as s from "../src/db/schema";
import { ulid } from "../src/lib/ids";
import { createTestDb, seedMember, seedOrg, seedPersonal, seedUser, type TestDb } from "./helpers/db";
import { eq } from "drizzle-orm";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.dispose();
});

describe("migrations", () => {
  it("apply cleanly to a fresh D1 and create every table", async () => {
    const res = await t.d1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'").all<{ name: string }>();
    const names = res.results.map((r) => r.name).sort();
    expect(names).toEqual(
      ["ai_keys", "ai_usage", "audit_log", "memberships", "orgs", "role_keys", "sessions", "snapshot_data", "snapshots", "upload_data", "uploads", "users", "workspaces"].sort(),
    );
  });

  it("has no R2-style key columns left", async () => {
    const res = await t.d1.prepare("SELECT sql FROM sqlite_master WHERE sql LIKE '%r2_key%'").all();
    expect(res.results).toHaveLength(0);
  });
});

describe("one admin per org", () => {
  it("rejects a second active admin", async () => {
    const a = await seedUser(t.db);
    const b = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, a);
    await expect(t.db.insert(s.memberships).values({ orgId, userId: b, role: "admin" })).rejects.toThrow();
  });

  it("allows a new admin once the old one is no longer an active admin (transfer)", async () => {
    const a = await seedUser(t.db);
    const b = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, a);
    await seedMember(t.db, orgId, b, "executive");
    await t.db.batch([
      t.db.update(s.memberships).set({ role: "executive" }).where(eq(s.memberships.userId, a)),
      t.db.update(s.memberships).set({ role: "admin" }).where(eq(s.memberships.userId, b)),
    ]);
    const admins = await t.db.select().from(s.memberships).where(eq(s.memberships.orgId, orgId));
    expect(admins.filter((m) => m.role === "admin" && m.status === "active")).toHaveLength(1);
  });

  it("does not limit other roles, and a different org has its own admin", async () => {
    const a = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, a);
    for (let i = 0; i < 3; i++) await seedMember(t.db, orgId, await seedUser(t.db), "member");
    await seedOrg(t.db, await seedUser(t.db));
  });

  it("rejects unknown roles, unknown statuses and delegation to non-executives", async () => {
    const a = await seedUser(t.db);
    const u = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, a);
    await expect(t.d1.prepare("INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')").bind(orgId, u).run()).rejects.toThrow();
    await expect(t.d1.prepare("INSERT INTO memberships (org_id, user_id, role, status) VALUES (?, ?, 'member', 'banned')").bind(orgId, u).run()).rejects.toThrow();
    await expect(seedMember(t.db, orgId, u, "member", { aiKeyDelegated: true })).rejects.toThrow();
    await seedMember(t.db, orgId, u, "executive", { aiKeyDelegated: true });
  });
});

describe("workspace scope", () => {
  it("accepts a valid personal and a valid organisation workspace", async () => {
    const a = await seedUser(t.db);
    await seedPersonal(t.db, a);
    await seedOrg(t.db, a);
  });

  it.each([
    ["personal without an owner", "personal", null, null],
    ["personal with an org", "personal", "OWNER", "ORG"],
    ["personal with owner and org", "personal", "OWNER", "ORG"],
    ["organisation without an org", "organisation", null, null],
    ["organisation with an owner", "organisation", "OWNER", "ORG"],
    ["organisation with only an owner", "organisation", "OWNER", null],
    ["unknown scope", "team", "OWNER", null],
  ] as const)("rejects %s", async (_label, scope, owner, org) => {
    const user = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, user);
    await expect(
      t.d1
        .prepare("INSERT INTO workspaces (id, scope, owner_user_id, org_id, title) VALUES (?, ?, ?, ?, 't')")
        .bind(ulid(), scope, owner ? user : null, org ? orgId : null)
        .run(),
    ).rejects.toThrow();
  });

  it("rejects a second Public Workspace for the same org but not for another org", async () => {
    const a = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, a);
    await expect(t.db.insert(s.workspaces).values({ id: ulid(), scope: "organisation", orgId, title: "Second" })).rejects.toThrow();
    await seedOrg(t.db, await seedUser(t.db));
  });

  it("allows many personal workspaces per user", async () => {
    const a = await seedUser(t.db);
    await seedPersonal(t.db, a);
    await seedPersonal(t.db, a);
  });
});

describe("role keys", () => {
  async function newKey(over: Record<string, unknown> = {}) {
    const admin = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, admin);
    const base = { id: ulid(), orgId, role: "member" as const, keyHash: `h-${ulid()}`, expiresAt: 9_999_999_999, createdBy: admin };
    return { admin, orgId, row: { ...base, ...over } };
  }

  it("stores a valid key", async () => {
    const { row } = await newKey();
    await t.db.insert(s.roleKeys).values(row);
  });

  it("can never grant admin or executive", async () => {
    for (const role of ["admin", "executive"]) {
      const { row } = await newKey();
      await expect(t.d1.prepare("INSERT INTO role_keys (id, org_id, role, key_hash, expires_at, created_by) VALUES (?, ?, ?, ?, 1, ?)").bind(row.id, row.orgId, role, row.keyHash, row.createdBy).run()).rejects.toThrow();
    }
  });

  it("rejects uses above max_uses and duplicate hashes", async () => {
    const { row } = await newKey();
    await expect(t.db.insert(s.roleKeys).values({ ...row, maxUses: 1, uses: 2 })).rejects.toThrow();
    await t.db.insert(s.roleKeys).values(row);
    await expect(t.db.insert(s.roleKeys).values({ ...row, id: ulid() })).rejects.toThrow();
  });
});

describe("blobs live in D1 child tables", () => {
  it("stores and cascades snapshot bytes; rejects oversized data", async () => {
    const a = await seedUser(t.db);
    const { publicWorkspaceId } = await seedOrg(t.db, a);
    const id = ulid();
    await t.db.insert(s.snapshots).values({ id, workspaceId: publicWorkspaceId, kind: "auto", bytes: 3 });
    await t.db.insert(s.snapshotData).values({ snapshotId: id, data: Buffer.from([1, 2, 3]) });

    const big = ulid();
    await t.db.insert(s.snapshots).values({ id: big, workspaceId: publicWorkspaceId, kind: "auto", bytes: MAX_BLOB_BYTES + 1 });
    await expect(t.db.insert(s.snapshotData).values({ snapshotId: big, data: Buffer.alloc(MAX_BLOB_BYTES + 1) })).rejects.toThrow();

    await t.db.delete(s.snapshots).where(eq(s.snapshots.id, id));
    expect(await t.db.select().from(s.snapshotData).where(eq(s.snapshotData.snapshotId, id))).toHaveLength(0);
  });

  it("rejects unknown snapshot kinds and statuses", async () => {
    const a = await seedUser(t.db);
    const { publicWorkspaceId } = await seedOrg(t.db, a);
    await expect(t.d1.prepare("INSERT INTO snapshots (id, workspace_id, kind, bytes) VALUES (?, ?, 'manual', 1)").bind(ulid(), publicWorkspaceId).run()).rejects.toThrow();
    await expect(t.d1.prepare("INSERT INTO snapshots (id, workspace_id, kind, bytes, summary_status) VALUES (?, ?, 'auto', 1, 'ready')").bind(ulid(), publicWorkspaceId).run()).rejects.toThrow();
  });
});

describe("cascades", () => {
  it("deleting an org removes its memberships, workspaces and role keys", async () => {
    const a = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, a);
    await t.db.insert(s.roleKeys).values({ id: ulid(), orgId, role: "viewer", keyHash: `h-${ulid()}`, expiresAt: 1, createdBy: a });
    await t.db.delete(s.orgs).where(eq(s.orgs.id, orgId));
    expect(await t.db.select().from(s.memberships).where(eq(s.memberships.orgId, orgId))).toHaveLength(0);
    expect(await t.db.select().from(s.workspaces).where(eq(s.workspaces.orgId, orgId))).toHaveLength(0);
    expect(await t.db.select().from(s.roleKeys).where(eq(s.roleKeys.orgId, orgId))).toHaveLength(0);
  });

  it("deleting a user removes their sessions and personal workspaces", async () => {
    const u = await seedUser(t.db);
    await seedPersonal(t.db, u);
    await t.db.insert(s.sessions).values({ tokenHash: `t-${ulid()}`, userId: u, expiresAt: 1 });
    await t.db.delete(s.users).where(eq(s.users.id, u));
    expect(await t.db.select().from(s.sessions).where(eq(s.sessions.userId, u))).toHaveLength(0);
    expect(await t.db.select().from(s.workspaces).where(eq(s.workspaces.ownerUserId, u))).toHaveLength(0);
  });
});
