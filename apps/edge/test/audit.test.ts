import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog } from "../src/db/schema";
import { auditInsert, serializeMeta, writeAudit } from "../src/lib/audit";
import { createTestDb, seedOrg, seedUser, type TestDb } from "./helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.dispose();
});

describe("serializeMeta", () => {
  it("returns null without meta", () => {
    expect(serializeMeta(undefined)).toBeNull();
  });

  it("redacts secret-like and content-like keys, at any depth", () => {
    const out = JSON.parse(
      serializeMeta({
        role: "member",
        roleKey: "ETH-AAAA-BBBB-CCCC-DDDD-EEEE",
        token: "t",
        apiKey: "k",
        nested: { Authorization: "Bearer x", ciphertext: "c", keep: 1 },
        content: "the whole document",
        prompt: "secret prompt",
        title: "Q3 plan",
      })!,
    );
    expect(out).toMatchObject({
      role: "member",
      roleKey: "[redacted]",
      token: "[redacted]",
      apiKey: "[redacted]",
      nested: { Authorization: "[redacted]", ciphertext: "[redacted]", keep: 1 },
      content: "[redacted]",
      prompt: "[redacted]",
      title: "[redacted]",
    });
  });

  it("caps long strings, deep nesting and total size", () => {
    const long = JSON.parse(serializeMeta({ note: "x".repeat(500) })!);
    expect(long.note.length).toBeLessThanOrEqual(201);
    const deep = JSON.parse(serializeMeta({ a: { b: { c: { d: 1 } } } })!);
    expect(deep.a.b.c).toBe("[truncated]");
    const huge = serializeMeta(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, "y".repeat(150)])));
    expect(JSON.parse(huge!)).toEqual({ truncated: true });
  });
});

describe("writeAudit", () => {
  it("writes a row with actor, target and scrubbed meta", async () => {
    const actor = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, actor);
    await writeAudit(t.db, { orgId, actorId: actor, action: "key.mint", target: "key-1", meta: { role: "viewer", keyHash: "abc", maxUses: 1 } });
    const [row] = await t.db.select().from(auditLog).where(eq(auditLog.orgId, orgId));
    expect(row).toMatchObject({ action: "key.mint", actorId: actor, target: "key-1" });
    expect(JSON.parse(row!.meta!)).toEqual({ role: "viewer", keyHash: "abc", maxUses: 1 });
    expect(row!.createdAt).toBeGreaterThan(0);
  });

  it("auditInsert joins an atomic batch with the change it records", async () => {
    const actor = await seedUser(t.db);
    const { orgId } = await seedOrg(t.db, actor);
    await t.db.batch([auditInsert(t.db, { orgId, actorId: actor, action: "member.remove", target: "u1" }), auditInsert(t.db, { orgId, actorId: actor, action: "role.change", target: "u2" })]);
    expect(await t.db.select().from(auditLog).where(eq(auditLog.orgId, orgId))).toHaveLength(2);
  });
});
