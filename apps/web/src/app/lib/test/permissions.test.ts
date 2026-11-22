import { ACTIONS, can as sharedCan, ROLES, type AuthzContext } from "@ether/shared";
import { describe, expect, it } from "vitest";
import { can } from "../permissions";

describe("can() wrapper", () => {
  it("answers exactly what the shared table answers for a signed-in organisation member, for every role and action", () => {
    const ctx: AuthzContext = { signedIn: true, workspaceScope: "organisation" };
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        expect(can(role, action), `${role} ${action}`).toBe(sharedCan(role, action, ctx));
      }
    }
  });

  it("matches the permissions the UI relies on", () => {
    expect(can("viewer", "ws.connect")).toBe(true);
    expect(can("viewer", "history.list")).toBe(true);
    expect(can("viewer", "restore")).toBe(false);
    expect(can("member", "restore")).toBe(true);
    expect(can("member", "name-version")).toBe(true);
    expect(can("member", "key.mint")).toBe(false);
    expect(can("admin", "key.mint")).toBe(true);
  });

  it("fails closed without a role, except for session-level actions", () => {
    expect(can(null, "restore")).toBe(false);
    expect(can(null, "ws.connect")).toBe(false);
    expect(can(null, "aikey.manage")).toBe(false);
    expect(can(null, "me.read")).toBe(true);
  });

  it("passes caller context through: AI key delegation and personal workspaces", () => {
    expect(can("executive", "aikey.manage")).toBe(false);
    expect(can("executive", "aikey.manage", { aiKeyDelegated: true })).toBe(true);
    expect(can(null, "restore", { workspaceScope: "personal", isOwner: true })).toBe(true);
    expect(can(null, "restore", { workspaceScope: "personal", isOwner: false })).toBe(false);
  });

  it("lets a caller override the signed-in default", () => {
    expect(can("admin", "ws.connect", { signedIn: false })).toBe(false);
  });
});
