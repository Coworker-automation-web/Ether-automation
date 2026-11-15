import { z } from "zod";
import { ASSIGNABLE_ROLES, ROLES } from "./roles";

export const roleSchema = z.enum(ROLES);
export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

export const idSchema = z.string().min(1).max(64);

export const createOrgSchema = z.object({ name: z.string().trim().min(2).max(80) });
export const joinOrgSchema = z.object({ roleKey: z.string().min(16).max(256) });
export const changeRoleSchema = z.object({ role: assignableRoleSchema });
export const transferAdminSchema = z.object({ toUserId: idSchema });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export const workspaceScopeSchema = z.enum(["personal", "organisation"]);

export const membershipSchema = z.object({
  orgId: idSchema,
  orgName: z.string(),
  role: roleSchema,
  publicWorkspaceId: idSchema,
});

export const meResponseSchema = z.object({
  user: z.object({
    id: idSchema,
    email: z.string().email(),
    name: z.string(),
    picture: z.string().url().nullable(),
  }),
  memberships: z.array(membershipSchema),
});

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type JoinOrgInput = z.infer<typeof joinOrgSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
