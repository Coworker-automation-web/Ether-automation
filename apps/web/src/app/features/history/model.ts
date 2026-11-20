import type { Snapshot } from "@ether/shared";
import { formatRelativeTime } from "../../lib/format";

export type HistoryTab = "all" | "recent" | "summarized";

export const HISTORY_TABS: readonly { readonly value: HistoryTab; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "recent", label: "Recent" },
  { value: "summarized", label: "Summarized" },
];

/** The prototype's "Recent" tab shows items whose age reads "Nm ago" or "1h ago", i.e. under two hours. */
export const RECENT_WINDOW_SEC = 2 * 3600;

const KIND_LABEL: Record<Snapshot["kind"], string> = {
  auto: "Auto-saved",
  named: "Saved",
  pre_restore: "Before restore",
};

export function snapshotTitle(snapshot: Snapshot): string {
  const title = snapshot.title?.trim();
  if (title) return title;
  return snapshot.kind === "pre_restore" ? "Before restore" : "Untitled version";
}

/** "Summarized • 2m ago" — the prototype's meta line, extended for the other summary states. */
export function snapshotMeta(snapshot: Snapshot, nowSec: number): string {
  const age = formatRelativeTime(nowSec, snapshot.created_at);
  switch (snapshot.summary_status) {
    case "done":
      return `Summarized • ${age}`;
    case "pending":
      return `Summarizing • ${age}`;
    default:
      return `${KIND_LABEL[snapshot.kind]} • ${age}`;
  }
}

export interface HistoryFilter {
  readonly tab: HistoryTab;
  readonly query: string;
  readonly nowSec: number;
}

export function matchesQuery(snapshot: Snapshot, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return snapshotTitle(snapshot).toLowerCase().includes(q) || (snapshot.summary ?? "").toLowerCase().includes(q);
}

export function matchesTab(snapshot: Snapshot, tab: HistoryTab, nowSec: number): boolean {
  switch (tab) {
    case "all":
      return true;
    case "recent":
      return nowSec - snapshot.created_at < RECENT_WINDOW_SEC;
    case "summarized":
      return snapshot.summary_status === "done";
  }
}

/** Newest first, then tab and search applied (search is the shell's topbar input). */
export function filterSnapshots(snapshots: readonly Snapshot[], filter: HistoryFilter): Snapshot[] {
  return snapshots
    .filter((s) => matchesTab(s, filter.tab, filter.nowSec) && matchesQuery(s, filter.query))
    .sort((a, b) => b.created_at - a.created_at);
}
