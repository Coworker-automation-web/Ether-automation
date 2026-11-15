export const ROLES = ["admin", "executive", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "org.read",
  "org.publish",
  "org.edit",
  "ai.run",
  "key.rotate",
  "member.remove",
  "member.promote",
  "admin.transfer",
  "aikey.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ALL_EDITING: Capability[] = ["org.read", "org.publish", "org.edit", "ai.run"];

/** Capability matrix from architecture §2. */
export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set<Capability>([
    ...ALL_EDITING,
    "key.rotate",
    "member.remove",
    "member.promote",
    "admin.transfer",
    "aikey.manage",
  ]),
  executive: new Set<Capability>(ALL_EDITING),
  member: new Set<Capability>(ALL_EDITING),
  viewer: new Set<Capability>(["org.read"]),
};

export interface CanOptions {
  /** Executive may manage the org AI key only by explicit delegation. */
  aiKeyDelegated?: boolean;
}

export function can(role: Role, capability: Capability, opts: CanOptions = {}): boolean {
  if (capability === "aikey.manage" && role === "executive") {
    return opts.aiKeyDelegated === true;
  }
  return ROLE_CAPABILITIES[role].has(capability);
}

/** Roles an Admin may assign via role change. Admin is only reachable via transfer. */
export const ASSIGNABLE_ROLES = ["executive", "member", "viewer"] as const satisfies readonly Role[];
/** Role granted by joining with a role key. Never admin/executive. */
export const JOIN_ROLE: Role = "member";
