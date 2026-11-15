import { describe, expect, it } from "vitest";
import { can, JOIN_ROLE } from "./roles";
import { changeRoleSchema } from "./schemas";

describe("role capabilities", () => {
  it("viewer can only read", () => {
    expect(can("viewer", "org.read")).toBe(true);
    for (const c of ["org.publish", "org.edit", "ai.run", "key.rotate"] as const) {
      expect(can("viewer", c)).toBe(false);
    }
  });

  it("member and executive can publish, edit and run AI but not govern", () => {
    for (const r of ["member", "executive"] as const) {
      expect(can(r, "org.publish")).toBe(true);
      expect(can(r, "ai.run")).toBe(true);
      expect(can(r, "member.remove")).toBe(false);
      expect(can(r, "admin.transfer")).toBe(false);
    }
  });

  it("only admin can rotate keys, remove members, promote and transfer", () => {
    for (const c of ["key.rotate", "member.remove", "member.promote", "admin.transfer"] as const) {
      expect(can("admin", c)).toBe(true);
      expect(can("executive", c)).toBe(false);
    }
  });

  it("executive manages AI key only by delegation", () => {
    expect(can("executive", "aikey.manage")).toBe(false);
    expect(can("executive", "aikey.manage", { aiKeyDelegated: true })).toBe(true);
    expect(can("member", "aikey.manage", { aiKeyDelegated: true })).toBe(false);
  });

  it("joining via role key grants member", () => {
    expect(JOIN_ROLE).toBe("member");
  });

  it("role change schema rejects admin", () => {
    expect(changeRoleSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(changeRoleSchema.safeParse({ role: "viewer" }).success).toBe(true);
  });
});
