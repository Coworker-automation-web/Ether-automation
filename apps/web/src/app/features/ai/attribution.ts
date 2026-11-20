export const MAX_ATTRIBUTION_NAME = 60;
const FALLBACK_NAME = "a collaborator";

/** Name shown on AI blocks. Plain text only; collapsed whitespace and a length cap keep the label tidy. */
export function attributionName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned === "") return FALLBACK_NAME;
  return cleaned.length > MAX_ATTRIBUTION_NAME ? `${cleaned.slice(0, MAX_ATTRIBUTION_NAME - 1)}…` : cleaned;
}

/** Architecture §9: AI output is attributed "AI, requested by <name>". */
export function attributionLabel(name: string): string {
  return `AI, requested by ${attributionName(name)}`;
}
