export const ROLES = ["admin", "executive", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Higher number = more privilege. admin > executive > member > viewer. */
export const ROLE_RANK: Readonly<Record<Role, number>> = {
  viewer: 0,
  member: 1,
  executive: 2,
  admin: 3,
};

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Roles an Admin may assign via role change. Admin is only reachable through admin transfer. */
export const ASSIGNABLE_ROLES = ["executive", "member", "viewer"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Roles a role key can grant. Never admin or executive. */
export const KEY_ROLES = ["member", "viewer"] as const satisfies readonly Role[];
export type KeyRole = (typeof KEY_ROLES)[number];

/** Role granted by default when joining with a role key. */
export const JOIN_ROLE: KeyRole = "member";
