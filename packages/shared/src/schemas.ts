import { z } from "zod";
import { ASSIGNABLE_ROLES, KEY_ROLES, ROLES } from "./roles";

/**
 * Wire conventions
 * - Timestamps are Unix seconds (integers).
 * - Request bodies and most responses use camelCase.
 * - EXCEPTION: snapshot list items mirror the D1 column names (snake_case) as specified.
 * - Ids are opaque strings (ULIDs in production; tests/mocks may use shorter ids).
 */

const unixSeconds = z.number().int().nonnegative();
export const idSchema = z.string().min(1).max(64);

export const roleSchema = z.enum(ROLES);
export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);
export const keyRoleSchema = z.enum(KEY_ROLES);

// ---------- Role key format ----------
/** Crockford base32 (no I, L, O, U): 5 groups x 4 chars = 100 bits. e.g. ETH-K7QM-4XZP-9WDC-H2TN-8RVB */
export const ROLE_KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ROLE_KEY_REGEX = /^ETH(?:-[0-9A-HJKMNP-TV-Z]{4}){5}$/;
export const ROLE_KEY_DEFAULT_EXPIRY_HOURS = 24 * 7;
export const ROLE_KEY_DEFAULT_MAX_USES = 1;

export function normalizeRoleKey(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
export function isRoleKeyFormat(input: string): boolean {
  return ROLE_KEY_REGEX.test(normalizeRoleKey(input));
}

// ---------- Profile / me ----------
export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string(),
  picture: z.string().url().nullable(),
});

export const membershipSchema = z.object({
  orgId: idSchema,
  orgName: z.string(),
  role: roleSchema,
  publicWorkspaceId: idSchema,
  /** Executive only: Admin has delegated AI-key management. */
  aiKeyDelegated: z.boolean(),
});

export const meResponseSchema = z.object({
  user: userSchema,
  memberships: z.array(membershipSchema),
});

export const updateProfileSchema = z.object({ name: z.string().trim().min(1).max(80) });

// ---------- Orgs ----------
export const orgSchema = z.object({
  id: idSchema,
  name: z.string(),
  createdAt: unixSeconds,
  publicWorkspaceId: idSchema,
});

export const createOrgSchema = z.object({ name: z.string().trim().min(2).max(80) });
export const createOrgResponseSchema = z.object({ org: orgSchema });

/** Any malformed or unknown key is answered with key_invalid by the server, never a format error. */
export const joinOrgSchema = z.object({
  roleKey: z.string().min(1).max(64).transform(normalizeRoleKey),
});
export const joinOrgResponseSchema = z.object({ org: orgSchema, role: roleSchema });

export const memberSchema = z.object({
  userId: idSchema,
  name: z.string(),
  email: z.string().email(),
  picture: z.string().url().nullable(),
  role: roleSchema,
  joinedAt: unixSeconds,
});
export const membersResponseSchema = z.object({ members: z.array(memberSchema) });

export const changeRoleSchema = z.object({ role: assignableRoleSchema });
export const changeRoleResponseSchema = z.object({ member: memberSchema });

export const transferAdminSchema = z.object({ toUserId: idSchema });
export const transferAdminResponseSchema = z.object({ adminUserId: idSchema });

// ---------- Role keys ----------
export const mintRoleKeySchema = z.object({
  role: keyRoleSchema.default("member"),
  label: z.string().trim().max(60).default(""),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(ROLE_KEY_DEFAULT_EXPIRY_HOURS),
  maxUses: z.number().int().min(1).max(100).default(ROLE_KEY_DEFAULT_MAX_USES),
});
export type MintRoleKeyInput = z.input<typeof mintRoleKeySchema>;

export const roleKeyInfoSchema = z.object({
  id: idSchema,
  role: keyRoleSchema,
  label: z.string(),
  expiresAt: unixSeconds,
  maxUses: z.number().int().positive(),
  uses: z.number().int().nonnegative(),
  revokedAt: unixSeconds.nullable(),
  createdAt: unixSeconds,
});
/** Plaintext `key` is returned exactly once, at mint time. It is never stored or listed. */
export const mintRoleKeyResponseSchema = roleKeyInfoSchema.omit({ uses: true, revokedAt: true }).extend({
  key: z.string().regex(ROLE_KEY_REGEX),
});
export const roleKeysResponseSchema = z.object({ keys: z.array(roleKeyInfoSchema) });

// ---------- Workspaces ----------
export const workspaceScopeSchema = z.enum(["personal", "organisation"]);
export const workspaceKindSchema = z.enum(["draft", "canvas"]);

export const workspaceSchema = z.object({
  id: idSchema,
  scope: workspaceScopeSchema,
  orgId: idSchema.nullable(),
  ownerUserId: idSchema.nullable(),
  kind: workspaceKindSchema,
  title: z.string(),
  createdAt: unixSeconds,
  updatedAt: unixSeconds,
});
export const personalWorkspacesResponseSchema = z.object({ workspaces: z.array(workspaceSchema) });
export const createPersonalWorkspaceSchema = z.object({ title: z.string().trim().min(1).max(80).default("Untitled") });
export const createPersonalWorkspaceResponseSchema = z.object({ workspace: workspaceSchema });
export const publicWorkspaceResponseSchema = z.object({ workspace: workspaceSchema, role: roleSchema });

/** No R2: upload bytes live in D1 rows (about 2 MB platform cap), so uploads are capped well below 10 MiB. */
export const MAX_UPLOAD_BYTES = 1_500_000;
export const uploadSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  filename: z.string(),
  contentType: z.string(),
  size: z.number().int().nonnegative().max(MAX_UPLOAD_BYTES),
  visibility: z.enum(["private", "published"]),
  createdAt: unixSeconds,
});
export const uploadResponseSchema = z.object({ upload: uploadSchema });

// ---------- Snapshots / history ----------
export const snapshotKindSchema = z.enum(["auto", "named", "pre_restore"]);
export const summaryStatusSchema = z.enum(["none", "pending", "done", "failed"]);

/** Mirrors the D1 `snapshots` columns (snake_case) by specification. */
export const snapshotSchema = z.object({
  id: idSchema,
  kind: snapshotKindSchema,
  title: z.string().nullable(),
  summary: z.string().nullable(),
  summary_status: summaryStatusSchema,
  bytes: z.number().int().nonnegative(),
  created_at: unixSeconds,
});
export const snapshotsResponseSchema = z.object({ snapshots: z.array(snapshotSchema) });

export const nameVersionSchema = z.object({ title: z.string().trim().min(1).max(80) });
export const nameVersionResponseSchema = z.object({ snapshot: snapshotSchema });

export const restoreResponseSchema = z.object({
  restoredSnapshotId: idSchema,
  /** Safety snapshot taken immediately before the restore replaced the live document. */
  preRestoreSnapshotId: idSchema,
});

// ---------- AI ----------
export const AI_TOOLS = ["write", "plan", "blueprint"] as const;
/** Named routes, never raw model ids, so models can change without a frontend deploy. */
export const AI_AGENTS = ["default", "fast", "creative", "research"] as const;
export const MAX_PROMPT_CHARS = 8000;

export const aiToolSchema = z.enum(AI_TOOLS);
export const aiAgentSchema = z.enum(AI_AGENTS);

export const aiGenerateSchema = z.object({
  workspaceId: idSchema,
  tool: aiToolSchema,
  agent: aiAgentSchema.default("default"),
  prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
  web: z.boolean().default(false),
});
export type AiGenerateInput = z.input<typeof aiGenerateSchema>;

export const aiSummarizeSchema = z.object({ workspaceId: idSchema, snapshotId: idSchema });
export const aiSummarizeResponseSchema = z.object({ summary: z.string(), summary_status: summaryStatusSchema });

const usageCounterSchema = z.object({ used: z.number().int().nonnegative(), limit: z.number().int().nonnegative() });
export const aiUsageResponseSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generations: usageCounterSchema,
  summaries: usageCounterSchema,
  /** Present when the caller acts inside an org. */
  orgGenerations: usageCounterSchema.optional(),
  resetAt: z.number().int().positive(),
});

// ---------- Org AI keys (admin, or executive with delegation) ----------
export const AI_PROVIDERS = ["gemini"] as const;
export const aiProviderSchema = z.enum(AI_PROVIDERS);
export const putAiKeySchema = z.object({ provider: aiProviderSchema, apiKey: z.string().trim().min(20).max(256) });
/** The browser only ever sees the last four characters. */
export const aiKeyInfoSchema = z.object({ provider: aiProviderSchema, last4: z.string().length(4) });
export const aiKeysResponseSchema = z.object({ keys: z.array(aiKeyInfoSchema) });
export const testAiKeyResponseSchema = z.object({ ok: z.boolean(), message: z.string().optional() });

// ---------- Inferred types ----------
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type Org = z.infer<typeof orgSchema>;
export type Member = z.infer<typeof memberSchema>;
export type RoleKeyInfo = z.infer<typeof roleKeyInfoSchema>;
export type MintRoleKeyResponse = z.infer<typeof mintRoleKeyResponseSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Upload = z.infer<typeof uploadSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type RestoreResponse = z.infer<typeof restoreResponseSchema>;
export type AiTool = z.infer<typeof aiToolSchema>;
export type AiAgent = z.infer<typeof aiAgentSchema>;
export type AiGenerateRequest = z.infer<typeof aiGenerateSchema>;
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
export type AiKeyInfo = z.infer<typeof aiKeyInfoSchema>;
