import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  API_ROUTES,
  type Action,
  can,
  canChangeRole,
  canRemoveMember,
  canTransferAdmin,
  PERMISSIONS,
} from "./permissions";
import { ROLES, type Role, roleAtLeast } from "./roles";

/**
 * Expected matrix, written by hand from the architecture doc (section 2 capability table),
 * NOT derived from PERMISSIONS. Letters = roles allowed: A admin, E executive, M member, V viewer.
 * Evaluated for a signed-in member of an organisation (organisation workspace scope).
 */
const EXPECTED: Record<Action, string> = {
  "auth.start": "AEMV",
  "auth.callback": "AEMV",
  "auth.logout": "AEMV",
  "me.read": "AEMV",
  "profile.update": "AEMV", // with isSelf
  "org.create": "AEMV",
  "org.join": "AEMV",
  "members.list": "AEMV",
  "member.remove": "A",
  "role.change": "A",
  "admin.transfer": "A",
  "key.list": "A",
  "key.mint": "A",
  "key.revoke": "A",
  "aikey.manage": "A", // executive only by explicit delegation (tested below)
  "publicWorkspace.read": "AEMV",
  "publicWorkspace.upload": "AEM",
  "personal.list": "AEMV",
  "personal.create": "AEMV",
  "ws.connect": "AEMV",
  "history.list": "AEMV",
  "name-version": "AEM",
  restore: "AEM",
  "ai.run": "AEM",
  "ai.summarize": "AEM",
  "ai.usage": "AEMV",
};

const LETTER: Record<Role, string> = { admin: "A", executive: "E", member: "M", viewer: "V" };

const PUBLIC: Action[] = ["auth.start", "auth.callback"];
const SESSION: Action[] = ["auth.logout", "me.read", "org.create", "org.join", "personal.list", "personal.create", "ai.usage"];
const SELF: Action[] = ["profile.update"];
const WORKSPACE = ACTIONS.filter((a) => PERMISSIONS[a].kind === "workspace");
const ORG = ACTIONS.filter((a) => PERMISSIONS[a].kind === "org");

describe("permission table coverage", () => {
  it("expected matrix lists exactly the actions in the table", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ACTIONS].sort());
  });

  it("every action is served by at least one API route, and every route maps to a real action", () => {
    const used = new Set(API_ROUTES.map((r) => r.action));
    for (const a of ACTIONS) expect(used.has(a), `no route for ${a}`).toBe(true);
    for (const r of API_ROUTES) expect(ACTIONS).toContain(r.action);
  });

  it("route method+path pairs are unique and under /api", () => {
    const keys = API_ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of API_ROUTES) expect(r.path.startsWith("/api/")).toBe(true);
  });
});

describe("role x action matrix (signed-in org member)", () => {
  const cases = ACTIONS.flatMap((action) => ROLES.map((role) => ({ action, role })));
  it.each(cases)("$role / $action", ({ action, role }) => {
    const expected = EXPECTED[action].includes(LETTER[role]);
    const got = can(role, action, { isSelf: true, workspaceScope: "organisation" });
    expect(got).toBe(expected);
  });
});

describe("callers without an org role", () => {
  it("signed-in non-member: only public, session and self actions", () => {
    for (const a of ACTIONS) {
      const expected = PUBLIC.includes(a) || SESSION.includes(a) || SELF.includes(a);
      expect(can(null, a, { signedIn: true, isSelf: true }), a).toBe(expected);
    }
  });

  it("unauthenticated: public actions only", () => {
    for (const a of ACTIONS) {
      expect(can(null, a, { signedIn: false, isSelf: true }), a).toBe(PUBLIC.includes(a));
    }
  });

  it("role null with no context fails closed for org and workspace actions", () => {
    for (const a of [...ORG, ...WORKSPACE]) expect(can(null, a), a).toBe(false);
  });

  it("self actions require isSelf", () => {
    expect(can("member", "profile.update")).toBe(false);
    expect(can("member", "profile.update", { isSelf: true })).toBe(true);
  });
});

describe("personal workspaces: owner only", () => {
  it("owner may use every workspace action, even with no org role", () => {
    for (const a of WORKSPACE) expect(can(null, a, { signedIn: true, workspaceScope: "personal", isOwner: true }), a).toBe(true);
  });

  it("a non-owner is denied, even if they are an admin of some organisation", () => {
    for (const a of WORKSPACE) {
      for (const role of ROLES) {
        expect(can(role, a, { workspaceScope: "personal", isOwner: false }), `${role}/${a}`).toBe(false);
      }
    }
  });

  it("an unauthenticated caller is denied even when flagged owner", () => {
    expect(can(null, "ws.connect", { signedIn: false, workspaceScope: "personal", isOwner: true })).toBe(false);
  });
});

describe("AI key delegation", () => {
  it("executive manages the AI key only with explicit delegation", () => {
    expect(can("executive", "aikey.manage")).toBe(false);
    expect(can("executive", "aikey.manage", { aiKeyDelegated: false })).toBe(false);
    expect(can("executive", "aikey.manage", { aiKeyDelegated: true })).toBe(true);
  });

  it("delegation flag never helps member or viewer", () => {
    for (const r of ["member", "viewer"] as const) expect(can(r, "aikey.manage", { aiKeyDelegated: true })).toBe(false);
  });

  it("delegation does not unlock other admin actions", () => {
    for (const a of ["key.mint", "key.revoke", "member.remove", "role.change", "admin.transfer"] as const) {
      expect(can("executive", a, { aiKeyDelegated: true })).toBe(false);
    }
  });
});

describe("member-management invariants", () => {
  it("role changes: admin only, never to or from admin", () => {
    expect(canChangeRole("admin", "member", "executive")).toBe(true);
    expect(canChangeRole("admin", "viewer", "member")).toBe(true);
    expect(canChangeRole("admin", "member", "admin")).toBe(false);
    expect(canChangeRole("admin", "admin", "member")).toBe(false);
    for (const r of ["executive", "member", "viewer"] as const) expect(canChangeRole(r, "member", "viewer")).toBe(false);
  });

  it("removal: admin only, and the sole admin cannot be removed", () => {
    expect(canRemoveMember("admin", "member")).toBe(true);
    expect(canRemoveMember("admin", "executive")).toBe(true);
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("executive", "member")).toBe(false);
  });

  it("admin transfer: admin to an existing executive only", () => {
    expect(canTransferAdmin("admin", "executive")).toBe(true);
    for (const t of ["member", "viewer", "admin"] as const) expect(canTransferAdmin("admin", t)).toBe(false);
    expect(canTransferAdmin("executive", "executive")).toBe(false);
  });
});

describe("role ranking", () => {
  it("admin > executive > member > viewer", () => {
    expect(roleAtLeast("admin", "executive")).toBe(true);
    expect(roleAtLeast("executive", "member")).toBe(true);
    expect(roleAtLeast("member", "viewer")).toBe(true);
    expect(roleAtLeast("viewer", "member")).toBe(false);
    expect(roleAtLeast("member", "executive")).toBe(false);
  });
});
