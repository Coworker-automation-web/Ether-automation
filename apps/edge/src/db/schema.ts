import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

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

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  adminUserId: text("admin_user_id").notNull().references(() => users.id),
  activeRoleKeyHash: text("active_role_key_hash").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

export const memberships = sqliteTable(
  "memberships",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "executive", "member", "viewer"] }).notNull(),
    status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
    joinedAt: integer("joined_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("memberships_user_idx").on(t.userId)],
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
    // Personal: owner and no org. Organisation: org and no owner (arch §6).
    check(
      "workspaces_scope_ck",
      sql`(${t.scope} = 'personal' AND ${t.ownerUserId} IS NOT NULL AND ${t.orgId} IS NULL)
       OR (${t.scope} = 'organisation' AND ${t.orgId} IS NOT NULL AND ${t.ownerUserId} IS NULL)`,
    ),
    // Exactly one Public Workspace per organisation.
    uniqueIndex("workspaces_one_public_per_org")
      .on(t.orgId)
      .where(sql`${t.scope} = 'organisation'`),
    index("workspaces_owner_idx").on(t.ownerUserId),
  ],
);

export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  r2Key: text("r2_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  visibility: text("visibility", { enum: ["private", "published"] }).notNull().default("private"),
  createdAt: integer("created_at").notNull().default(now),
});

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["auto", "named", "pre_restore"] }).notNull(),
    r2Key: text("r2_key").notNull(),
    bytes: integer("bytes").notNull(),
    title: text("title"),
    summary: text("summary"),
    summaryStatus: text("summary_status", { enum: ["none", "pending", "done", "failed"] }).notNull().default("none"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("snapshots_ws_idx").on(t.workspaceId, t.createdAt)],
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
  (t) => [index("audit_org_idx").on(t.orgId, t.createdAt)],
);
