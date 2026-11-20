import type { Snapshot } from "@ether/shared";
import { describe, expect, it } from "vitest";
import { filterSnapshots, matchesQuery, RECENT_WINDOW_SEC, snapshotMeta, snapshotTitle } from "./model";

const NOW = 100_000;
const snap = (over: Partial<Snapshot> & { id: string }): Snapshot => ({
  kind: "auto",
  title: "Doc",
  summary: null,
  summary_status: "none",
  bytes: 1,
  created_at: NOW - 60,
  ...over,
});

describe("snapshotTitle / snapshotMeta", () => {
  it("falls back for untitled versions", () => {
    expect(snapshotTitle(snap({ id: "a", title: null }))).toBe("Untitled version");
    expect(snapshotTitle(snap({ id: "a", title: "  ", kind: "pre_restore" }))).toBe("Before restore");
    expect(snapshotTitle(snap({ id: "a", title: "Plan" }))).toBe("Plan");
  });

  it("matches the prototype's meta line for summarised items and covers other states", () => {
    expect(snapshotMeta(snap({ id: "a", summary_status: "done", created_at: NOW - 120 }), NOW)).toBe("Summarized • 2m ago");
    expect(snapshotMeta(snap({ id: "a", summary_status: "pending" }), NOW)).toBe("Summarizing • 1m ago");
    expect(snapshotMeta(snap({ id: "a", kind: "named" }), NOW)).toBe("Saved • 1m ago");
    expect(snapshotMeta(snap({ id: "a", kind: "pre_restore", summary_status: "failed" }), NOW)).toBe("Before restore • 1m ago");
  });
});

describe("filterSnapshots", () => {
  const items = [
    snap({ id: "old", title: "Fitness Routine", created_at: NOW - 5 * 3600, summary_status: "done", summary: "weekly strength" }),
    snap({ id: "new", title: "AI Productivity Tips", created_at: NOW - 120, summary_status: "done" }),
    snap({ id: "mid", title: "Web Design Ideas", created_at: NOW - 3600 }),
    snap({ id: "edge", title: "Edge", created_at: NOW - RECENT_WINDOW_SEC }),
  ];
  const ids = (tab: "all" | "recent" | "summarized", query = "") =>
    filterSnapshots(items, { tab, query, nowSec: NOW }).map((s) => s.id);

  it("sorts newest first", () => {
    expect(ids("all")).toEqual(["new", "mid", "edge", "old"]);
  });

  it("Recent is under two hours (prototype: 'Nm ago' or '1h ago')", () => {
    expect(ids("recent")).toEqual(["new", "mid"]);
  });

  it("Summarized shows only versions with a finished summary", () => {
    expect(ids("summarized")).toEqual(["new", "old"]);
  });

  it("searches title and summary, case-insensitively, combined with the tab", () => {
    expect(ids("all", "  design ")).toEqual(["mid"]);
    expect(ids("all", "STRENGTH")).toEqual(["old"]);
    expect(ids("recent", "fitness")).toEqual([]);
    expect(matchesQuery(items[0]!, "")).toBe(true);
  });

  it("does not mutate its input", () => {
    const copy = [...items];
    ids("all");
    expect(items).toEqual(copy);
  });
});
