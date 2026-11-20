/** Carets reuse the prototype's warm accent palette so collaboration colours stay on-brand. */
export const CARET_COLORS = ["#7B5C45", "#4D8B52", "#5C4028", "#A06A3C", "#6B8E7F", "#8C6D9A"] as const;

/** Stable colour per user id (FNV-1a), identical on every client. */
export function colorForUser(userId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return CARET_COLORS[hash % CARET_COLORS.length] ?? CARET_COLORS[0];
}
