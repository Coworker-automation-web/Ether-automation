import { ROLES } from "@ether/shared";
import { sql, type SQL } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { MAX_BLOB_BYTES } from "../lib/limits";

const now = sql`(unixepoch())`;

/** DB-level enum guard: Drizzle's `enum` option is TypeScript-only, SQLite would accept any text. */
const oneOf = (col: AnySQLiteColumn, values: readonly string[]): SQL =>
  sql`${col} IN (${sql.join(values.map((v) => sql.raw(`'${v}'`)), sql.raw(", "))})`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    googleSub: text("google_sub").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    picture: text("picture"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_google_sub_uq").on(t.googleSub)],
);

/** Only the SHA-256 of the session token is stored. Expiry slides: see lib/session.ts. */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** The Admin is the single active membership with role 'admin' (no duplicate admin column to drift). */
export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull().default(now),
});

export const memberships = sqliteTable(
  "memberships",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
    /** Executive only: Admin delegated AI-key management. */
    aiKeyDelegated: integer("ai_key_delegated", { mode: "boolean" }).notNull().default(false),
    joinedAt: integer("joined_at").notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    index("memberships_user_idx").on(t.userId, t.status),
    index("memberships_org_idx").on(t.orgId, t.status),
    // Exactly one active admin per org.
    uniqueIndex("memberships_one_admin_per_org")
      .on(t.orgId)
      .where(sql`role = 'admin' AND status = 'active'`),
    check("memberships_role_ck", oneOf(t.role, ROLES)),
    check("memberships_status_ck", oneOf(t.status, ["active", "removed"])),
    check("memberships_delegation_ck", sql`${t.aiKeyDelegated} = 0 OR ${t.role} = 'executive'`),
  ],
);

/** Role keys are stored as hashes only; the plaintext is shown once at mint time. */
export const roleKeys = sqliteTable(
  "role_keys",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["member", "viewer"] }).notNull(),
    keyHash: text("key_hash").notNull(),
    label: text("label").notNull().default(""),
    expiresAt: integer("expires_at").notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    revokedAt: integer("revoked_at"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("role_keys_hash_uq").on(t.keyHash),
    index("role_keys_org_idx").on(t.orgId, t.createdAt),
    check("role_keys_role_ck", oneOf(t.role, ["member", "viewer"])),
    check("role_keys_uses_ck", sql`${t.maxUses} >= 1 AND ${t.uses} >= 0 AND ${t.uses} <= ${t.maxUses}`),
  ],
);

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    scope: text("scope", { enum: ["personal", "organisation"] }).notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["draft", "canvas"] }).notNull().default("draft"),
    title: text("title").notNull(),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    // Personal: an owner and no org. Organisation: an org and no owner.
    check(
      "workspaces_scope_ck",
      sql`(${t.scope} = 'personal' AND ${t.ownerUserId} IS NOT NULL AND ${t.orgId} IS NULL)
       OR (${t.scope} = 'organisation' AND ${t.orgId} IS NOT NULL AND ${t.ownerUserId} IS NULL)`,
    ),
    check("workspaces_kind_ck", oneOf(t.kind, ["draft", "canvas"])),
    // At most one Public Workspace per org. "Exactly one" comes from creating it with the org in one batch.
    uniqueIndex("workspaces_one_public_per_org").on(t.orgId).where(sql`scope = 'organisation'`),
    index("workspaces_owner_idx").on(t.ownerUserId),
  ],
);

export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").notNull().references(() => users.id),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    visibility: text("visibility", { enum: ["private", "published"] }).notNull().default("private"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("uploads_ws_idx").on(t.workspaceId, t.createdAt),
    check("uploads_visibility_ck", oneOf(t.visibility, ["private", "published"])),
  ],
);

/** 1:1 child of uploads holding the bytes (no R2). Kept apart so list queries never touch blobs. */
export const uploadData = sqliteTable(
  "upload_data",
  {
    uploadId: text("upload_id").primaryKey().references(() => uploads.id, { onDelete: "cascade" }),
    data: blob("data", { mode: "buffer" }).notNull(),
  },
  (t) => [check("upload_data_size_ck", sql`length(${t.data}) <= ${sql.raw(String(MAX_BLOB_BYTES))}`)],
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["auto", "named", "pre_restore"] }).notNull(),
    bytes: integer("bytes").notNull(),
    title: text("title"),
    summary: text("summary"),
    summaryStatus: text("summary_status", { enum: ["none", "pending", "done", "failed"] }).notNull().default("none"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("snapshots_ws_idx").on(t.workspaceId, t.createdAt),
    check("snapshots_kind_ck", oneOf(t.kind, ["auto", "named", "pre_restore"])),
    check("snapshots_summary_status_ck", oneOf(t.summaryStatus, ["none", "pending", "done", "failed"])),
  ],
);

/** Yjs state bytes of a snapshot (no R2). */
export const snapshotData = sqliteTable(
  "snapshot_data",
  {
    snapshotId: text("snapshot_id").primaryKey().references(() => snapshots.id, { onDelete: "cascade" }),
    data: blob("data", { mode: "buffer" }).notNull(),
  },
  (t) => [check("snapshot_data_size_ck", sql`length(${t.data}) <= ${sql.raw(String(MAX_BLOB_BYTES))}`)],
);

export const aiKeys = sqliteTable(
  "ai_keys",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    last4: text("last4").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.provider] })],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    day: text("day").notNull(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    requests: integer("requests").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.orgId, t.userId, t.provider, t.model] })],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id"),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    target: text("target"),
    meta: text("meta"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("audit_org_idx").on(t.orgId, t.createdAt), index("audit_actor_idx").on(t.actorId, t.createdAt)],
);
