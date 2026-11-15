import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, randomSecret, sha256Hex, timingSafeEqual } from "../src/lib/crypto";
import { isOriginAllowed } from "../src/lib/origin";

describe("crypto", () => {
  it("hashes deterministically and never returns the input", async () => {
    const h = await sha256Hex("secret");
    expect(h).toHaveLength(64);
    expect(h).toBe(await sha256Hex("secret"));
    expect(h).not.toContain("secret");
  });

  it("generates unique high-entropy secrets", () => {
    const a = randomSecret();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(randomSecret());
  });

  it("compares in constant-time semantics", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("round-trips AES-GCM and rejects the wrong key", async () => {
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const other = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const { ciphertext, iv } = await encryptSecret("sk-test-1234", key);
    expect(ciphertext).not.toContain("sk-test");
    expect(await decryptSecret(ciphertext, iv, key)).toBe("sk-test-1234");
    await expect(decryptSecret(ciphertext, iv, other)).rejects.toThrow();
  });
});

describe("origin check", () => {
  const origin = "https://ether.example";
  it("allows safe methods without Origin", () => {
    expect(isOriginAllowed(new Request("https://x/api/me"), origin)).toBe(true);
  });
  it("requires matching Origin on POST", () => {
    expect(isOriginAllowed(new Request("https://x/api", { method: "POST" }), origin)).toBe(false);
    expect(isOriginAllowed(new Request("https://x/api", { method: "POST", headers: { Origin: origin } }), origin)).toBe(true);
    expect(isOriginAllowed(new Request("https://x/api", { method: "POST", headers: { Origin: "https://evil" } }), origin)).toBe(false);
  });
  it("requires matching Origin on WebSocket upgrade", () => {
    expect(isOriginAllowed(new Request("https://x/api/ws/1", { headers: { Upgrade: "websocket" } }), origin)).toBe(false);
  });
});
