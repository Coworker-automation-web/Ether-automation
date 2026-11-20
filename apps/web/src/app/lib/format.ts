/** "just now", "2m ago", "1h ago", "1d ago" — the prototype's history meta format. Inputs are Unix seconds. */
export function formatRelativeTime(nowSec: number, thenSec: number): string {
  const diff = Math.max(0, nowSec - thenSec);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Local clock time of a Unix-seconds instant, e.g. "05:30". */
export function formatResetTime(resetAtSec: number, opts: { locale?: string; timeZone?: string } = {}): string {
  return new Intl.DateTimeFormat(opts.locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(opts.timeZone === undefined ? {} : { timeZone: opts.timeZone }),
  }).format(new Date(resetAtSec * 1000));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
