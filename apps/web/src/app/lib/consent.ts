/** AI is opt-in with a clear notice (arch §9). Consent is a per-browser convenience flag, not a security control. */
export const AI_CONSENT_KEY = "ether.ai-consent.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasAiConsent(storage: KeyValueStorage | null): boolean {
  try {
    return storage?.getItem(AI_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Returns false when the flag could not be persisted; the caller keeps consent in memory for the session. */
export function grantAiConsent(storage: KeyValueStorage | null): boolean {
  try {
    storage?.setItem(AI_CONSENT_KEY, "1");
    return storage !== null;
  } catch {
    return false;
  }
}
