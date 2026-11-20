import { describe, expect, it } from "vitest";
import { AI_CONSENT_KEY, grantAiConsent, hasAiConsent, type KeyValueStorage } from "../consent";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("AI consent", () => {
  it("is off until granted, then persists", () => {
    const s = memoryStorage();
    expect(hasAiConsent(s)).toBe(false);
    expect(grantAiConsent(s)).toBe(true);
    expect(s.data.get(AI_CONSENT_KEY)).toBe("1");
    expect(hasAiConsent(s)).toBe(true);
  });

  it("degrades safely when storage is missing or throws", () => {
    expect(hasAiConsent(null)).toBe(false);
    expect(grantAiConsent(null)).toBe(false);
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasAiConsent(broken)).toBe(false);
    expect(grantAiConsent(broken)).toBe(false);
  });
});
