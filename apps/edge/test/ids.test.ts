import { beforeEach, describe, expect, it, vi } from "vitest";

// ids.ts keeps monotonic state per module instance; load a fresh copy per test.
let ulid: typeof import("../src/lib/ids").ulid;
let isUlid: typeof import("../src/lib/ids").isUlid;
let ulidTime: typeof import("../src/lib/ids").ulidTime;
beforeEach(async () => {
  vi.resetModules();
  ({ ulid, isUlid, ulidTime } = await import("../src/lib/ids"));
});

describe("ulid", () => {
  it("is 26 chars of Crockford base32", () => {
    for (let i = 0; i < 50; i++) expect(isUlid(ulid())).toBe(true);
    expect(isUlid("not-a-ulid")).toBe(false);
    expect(isUlid("0000000000000000000000000I")).toBe(false); // I is not in the alphabet
  });

  it("encodes the timestamp", () => {
    expect(ulidTime(ulid(1_700_000_000_000))).toBe(1_700_000_000_000);
  });

  it("is strictly increasing within one millisecond and across a backwards clock step", () => {
    const t = 1_800_000_000_000;
    const ids = Array.from({ length: 500 }, () => ulid(t));
    expect(new Set(ids).size).toBe(500);
    expect([...ids].sort()).toEqual(ids);
    const after = ulid(t - 5_000); // clock went backwards
    expect(after > ids[ids.length - 1]!).toBe(true);
  });

  it("sorts by time across milliseconds", () => {
    const a = ulid(1_900_000_000_000);
    const b = ulid(1_900_000_000_001);
    expect(b > a).toBe(true);
  });

  it("does not collide across many ids", () => {
    expect(new Set(Array.from({ length: 5000 }, () => ulid())).size).toBe(5000);
  });
});
