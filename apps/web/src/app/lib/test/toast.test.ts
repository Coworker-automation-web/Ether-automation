import { describe, expect, it, vi } from "vitest";
import { createToastStore } from "../toast";

describe("toast store", () => {
  it("pushes, dismisses and notifies", () => {
    const store = createToastStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    const id = store.push("hello");
    expect(store.getSnapshot()).toEqual([{ id, message: "hello" }]);
    store.dismiss(id);
    expect(store.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    store.push("x");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps only the newest N and keeps ids unique", () => {
    const store = createToastStore(2);
    const ids = [store.push("a"), store.push("b"), store.push("c")];
    expect(new Set(ids).size).toBe(3);
    expect(store.getSnapshot().map((t) => t.message)).toEqual(["b", "c"]);
  });

  it("does not notify when dismissing an unknown id", () => {
    const store = createToastStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dismiss(99);
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns a stable snapshot between changes (required by useSyncExternalStore)", () => {
    const store = createToastStore();
    store.push("a");
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});
