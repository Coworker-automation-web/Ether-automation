import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { createDb, type Db } from "../../src/db";
import { ulid } from "../../src/lib/ids";
import * as schema from "../../src/db/schema";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../src/db/migrations");

export interface TestDb {
  d1: D1Database;
  db: Db;
  dispose: () => Promise<void>;
}

/** Applies every migration, in order, to a fresh in-memory D1 (real workerd/SQLite). */
export async function applyMigrations(d1: D1Database): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const statements = readFileSync(join(MIGRATIONS_DIR, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    await d1.batch(statements.map((s) => d1.prepare(s)));
  }
}

export async function createTestDb(): Promise<TestDb> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    d1Databases: { DB: "test-db" },
  });
  const d1 = (await mf.getD1Database("DB")) as unknown as D1Database;
  await applyMigrations(d1);
  return { d1, db: createDb(d1), dispose: () => mf.dispose() };
}

// ---- seed helpers: every test makes its own ids, so no cross-test cleanup is needed ----

export async function seedUser(db: Db, name = "User") {
  const id = ulid();
  await db.insert(schema.users).values({ id, googleSub: `g-${id}`, email: `${id.toLowerCase()}@example.com`, name });
  return id;
}

export async function seedOrg(db: Db, adminId: string) {
  const orgId = ulid();
  const publicWorkspaceId = ulid();
  await db.batch([
    db.insert(schema.orgs).values({ id: orgId, name: "Org", createdBy: adminId }),
    db.insert(schema.memberships).values({ orgId, userId: adminId, role: "admin" }),
    db.insert(schema.workspaces).values({ id: publicWorkspaceId, scope: "organisation", orgId, title: "Public" }),
  ]);
  return { orgId, publicWorkspaceId };
}

export async function seedMember(
  db: Db,
  orgId: string,
  userId: string,
  role: "executive" | "member" | "viewer",
  opts: { aiKeyDelegated?: boolean } = {},
) {
  await db.insert(schema.memberships).values({ orgId, userId, role, aiKeyDelegated: opts.aiKeyDelegated ?? false });
}

export async function seedPersonal(db: Db, ownerId: string) {
  const id = ulid();
  await db.insert(schema.workspaces).values({ id, scope: "personal", ownerUserId: ownerId, title: "Mine" });
  return id;
}
