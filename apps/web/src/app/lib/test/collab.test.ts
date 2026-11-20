import { describe, expect, it } from "vitest";
import { classifyClose, isRoleChangeClose, shouldReconnectOnClose } from "../collab/close";
import { CARET_COLORS, colorForUser } from "../collab/colors";

describe("close codes", () => {
  it("classifies the do-not-reconnect codes", () => {
    expect(classifyClose(4401)).toBe("unauthenticated");
    expect(classifyClose(4403)).toBe("forbidden");
    expect(classifyClose(4410)).toBe("revoked");
    expect(classifyClose(1006)).toBeNull();
  });

  it("reconnects on role change and ordinary drops, not on terminal closes", () => {
    expect(shouldReconnectOnClose(4409)).toBe(true);
    expect(shouldReconnectOnClose(1006)).toBe(true);
    expect(shouldReconnectOnClose(4401)).toBe(false);
    expect(shouldReconnectOnClose(4403)).toBe(false);
    expect(shouldReconnectOnClose(4410)).toBe(false);
    expect(isRoleChangeClose(4409)).toBe(true);
    expect(isRoleChangeClose(4410)).toBe(false);
  });
});

describe("caret colours", () => {
  it("is stable per user and always from the palette", () => {
    expect(colorForUser("u1")).toBe(colorForUser("u1"));
    for (const id of ["a", "b", "c", "user-123", ""]) {
      expect(CARET_COLORS).toContain(colorForUser(id));
    }
  });
});
